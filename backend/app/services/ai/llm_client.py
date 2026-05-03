"""
LLM 多供应商统一封装。

支持的供应商 (均使用 OpenAI 兼容协议):
  - DeepSeek (默认文本)
  - 通义千问 (含视觉模型 Qwen-VL)
  - Moonshot (Kimi)

设计要点:
  - openai 包是必需依赖,通过 base_url 指向各供应商网关。统一接口避免
    服务层判断 provider 写一堆 if-else。
  - call_text(): 普通文本生成,DeepSeek / 通义千问 text / Moonshot 都走这个。
  - call_vision(): 多模态,目前只接 Qwen-VL (DeepSeek/Moonshot 文本模型不支持图片)。
  - 单次重试: timeout / 5xx / 网络异常会自动重试 1 次,二次失败抛 RuntimeError
    给上层 ai_post_service,后者负责落 status='error' 日志。
  - 不在这一层做 prompt 拼装,prompt_builder 才是单一职责。
  - cost 估算放在 estimate_cost(),用基线单价表;真实账单还是看供应商账户。
    单价随时变,改这里不改 schema 就行。
"""

import time
from typing import Dict, Any, List, Optional, Tuple

from openai import OpenAI
from openai import APIError, APITimeoutError, APIConnectionError

from app.core.config import settings


class LLMClientError(RuntimeError):
    """LLM 调用最终失败 (重试后仍失败)。包含 provider/model 便于落日志。"""

    def __init__(self, message: str, provider: str, model: str):
        super().__init__(message)
        self.provider = provider
        self.model = model


# 估算成本用的单价表 (元/百万 token, 截至 2026-04 公开价)
# 真实账单仍以供应商账户为准,这里是 ai_post_service_logs.cost_cents 的近似值。
# 改单价时无需改 schema。
_PRICE_PER_MILLION_TOKENS_CNY = {
    ("deepseek", "deepseek-chat"): {"input": 1.0, "output": 2.0},
    ("qwen", "qwen-plus"): {"input": 0.8, "output": 2.0},
    ("qwen", "qwen-vl-plus"): {"input": 8.0, "output": 8.0},
    ("moonshot", "moonshot-v1-8k"): {"input": 12.0, "output": 12.0},
}


def _resolve_provider(provider: Optional[str]) -> str:
    return (provider or settings.AI_DEFAULT_PROVIDER).lower()


def _resolve_text_model(provider: str) -> Tuple[str, str]:
    """返回 (api_key, base_url, model) 三元组中的 (api_key, base_url)。"""
    if provider == "deepseek":
        if not settings.DEEPSEEK_API_KEY:
            raise LLMClientError("DEEPSEEK_API_KEY 未配置", provider, "")
        return settings.DEEPSEEK_API_KEY, settings.DEEPSEEK_BASE_URL, settings.DEEPSEEK_MODEL
    if provider == "qwen":
        if not settings.QWEN_API_KEY:
            raise LLMClientError("QWEN_API_KEY 未配置", provider, "")
        return settings.QWEN_API_KEY, settings.QWEN_BASE_URL, settings.QWEN_TEXT_MODEL
    if provider == "moonshot":
        if not settings.MOONSHOT_API_KEY:
            raise LLMClientError("MOONSHOT_API_KEY 未配置", provider, "")
        return settings.MOONSHOT_API_KEY, settings.MOONSHOT_BASE_URL, settings.MOONSHOT_MODEL
    raise LLMClientError(f"未知 provider: {provider}", provider, "")


def _build_client(api_key: str, base_url: str) -> OpenAI:
    return OpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=settings.AI_REQUEST_TIMEOUT,
        max_retries=0,  # 我们自己控制重试,避免 openai 默认重试与超时叠加
    )


def estimate_cost_cents(provider: str, model: str, input_tokens: int, output_tokens: int) -> int:
    """估算 token 成本,返回分 (cents)。CNY,*100 取整,最少 1 分。"""
    price = _PRICE_PER_MILLION_TOKENS_CNY.get((provider, model))
    if not price:
        return 0
    cny = (input_tokens / 1_000_000) * price["input"] + (output_tokens / 1_000_000) * price["output"]
    return max(1, int(round(cny * 100)))


def call_text(
    system_prompt: str,
    user_prompt: str,
    *,
    provider: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> Dict[str, Any]:
    """
    调用文本 LLM。

    返回:
      {
        "provider": "deepseek",
        "model": "deepseek-chat",
        "content": "...",
        "raw": {...},                  # 原始 ChatCompletion (dict)
        "tokens_used": 1234,
        "cost_cents": 3,
      }
    """
    provider = _resolve_provider(provider)
    api_key, base_url, model = _resolve_text_model(provider)
    client = _build_client(api_key, base_url)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    kwargs = {
        "model": model,
        "messages": messages,
        "temperature": temperature if temperature is not None else settings.AI_TEMPERATURE,
        "max_tokens": max_tokens if max_tokens is not None else settings.AI_MAX_OUTPUT_TOKENS,
    }

    last_err: Optional[Exception] = None
    for attempt in range(2):  # 最多重试 1 次 (共调用 2 次)
        try:
            resp = client.chat.completions.create(**kwargs)
            content = resp.choices[0].message.content if resp.choices else ""
            usage = getattr(resp, "usage", None)
            input_tokens = getattr(usage, "prompt_tokens", 0) if usage else 0
            output_tokens = getattr(usage, "completion_tokens", 0) if usage else 0
            tokens_used = (input_tokens + output_tokens) if usage else 0
            return {
                "provider": provider,
                "model": model,
                "content": content or "",
                "raw": resp.model_dump() if hasattr(resp, "model_dump") else {},
                "tokens_used": tokens_used,
                "cost_cents": estimate_cost_cents(provider, model, input_tokens, output_tokens),
            }
        except (APITimeoutError, APIConnectionError) as e:
            last_err = e
            time.sleep(0.5 * (attempt + 1))
            continue
        except APIError as e:
            # 5xx 重试,4xx (限流/参数错) 直接抛
            status_code = getattr(e, "status_code", None) or 500
            if 500 <= status_code < 600 and attempt == 0:
                last_err = e
                time.sleep(0.5)
                continue
            raise LLMClientError(f"{provider} API error: {e!s}", provider, model) from e

    raise LLMClientError(f"{provider} 调用失败 (重试后): {last_err!s}", provider, model)


def call_vision(
    system_prompt: str,
    user_prompt: str,
    image_urls: List[str],
    *,
    provider: str = "qwen",
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> Dict[str, Any]:
    """
    调用视觉 LLM (Qwen-VL)。其他 provider 暂不支持视觉,会报错。

    image_urls 必须是公网可达的 https URL (Supabase Storage 公开桶即可)。
    """
    provider = _resolve_provider(provider)
    if provider != "qwen":
        raise LLMClientError(
            f"视觉模式仅支持 qwen,当前 provider={provider}", provider, ""
        )
    if not settings.QWEN_API_KEY:
        raise LLMClientError("QWEN_API_KEY 未配置", provider, "")
    if not image_urls:
        raise LLMClientError("call_vision 需要至少 1 张图片", provider, "")

    model = settings.QWEN_VL_MODEL
    client = _build_client(settings.QWEN_API_KEY, settings.QWEN_BASE_URL)

    # OpenAI 多模态消息格式: content 是 list[{type,...}]
    user_content: List[Dict[str, Any]] = [{"type": "text", "text": user_prompt}]
    for url in image_urls[:9]:
        user_content.append({"type": "image_url", "image_url": {"url": url}})

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]
    kwargs = {
        "model": model,
        "messages": messages,
        "temperature": temperature if temperature is not None else settings.AI_TEMPERATURE,
        "max_tokens": max_tokens if max_tokens is not None else settings.AI_MAX_OUTPUT_TOKENS,
    }

    last_err: Optional[Exception] = None
    for attempt in range(2):
        try:
            resp = client.chat.completions.create(**kwargs)
            content = resp.choices[0].message.content if resp.choices else ""
            usage = getattr(resp, "usage", None)
            input_tokens = getattr(usage, "prompt_tokens", 0) if usage else 0
            output_tokens = getattr(usage, "completion_tokens", 0) if usage else 0
            tokens_used = (input_tokens + output_tokens) if usage else 0
            return {
                "provider": provider,
                "model": model,
                "content": content or "",
                "raw": resp.model_dump() if hasattr(resp, "model_dump") else {},
                "tokens_used": tokens_used,
                "cost_cents": estimate_cost_cents(provider, model, input_tokens, output_tokens),
            }
        except (APITimeoutError, APIConnectionError) as e:
            last_err = e
            time.sleep(0.5 * (attempt + 1))
            continue
        except APIError as e:
            status_code = getattr(e, "status_code", None) or 500
            if 500 <= status_code < 600 and attempt == 0:
                last_err = e
                time.sleep(0.5)
                continue
            raise LLMClientError(f"{provider} VL API error: {e!s}", provider, model) from e

    raise LLMClientError(f"{provider} VL 调用失败 (重试后): {last_err!s}", provider, model)
