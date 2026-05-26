"""
Avant Regard API - FastAPI 应用入口
"""
import sys
print(f"[BOOT] Python {sys.version}, loading app...", flush=True)
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.response import error
from app.db.supabase import is_transient_supabase_error

import httpx
from postgrest.exceptions import APIError

# 导入路由
from app.api.routes.auth import router as auth_router
from app.api.routes.user import router as user_router
from app.api.routes.post import router as post_router
from app.api.routes.comment import router as comment_router
from app.api.routes.follow import router as follow_router
from app.api.routes.admin import router as admin_router, admin_user_router
from app.api.routes.files import router as files_router
from app.api.routes.brands import router as brands_router
from app.api.routes.shows import router as shows_router
from app.api.routes.buyer_store import router as buyer_store_router
from app.api.routes.store_merchant import router as store_merchant_router
from app.api.routes.store_product import router as store_product_router
from app.api.routes.listing import (
    router as listing_router,
    sellers_router as listing_sellers_router,
    admin_router as listing_admin_router,
    marketplace_router as listing_marketplace_router,
)
from app.api.routes.provenance import (
    router as provenance_router,
    collections_router as collections_router,
    price_router as price_history_router,
)
from app.api.routes.orders import (
    orders_router as orders_router,
    offers_router as offers_router,
    admin_orders_router as admin_orders_router,
)
from app.api.routes.aftersales import (
    disputes_router as disputes_router,
    authentication_router as authentication_router,
    reviews_router as trade_reviews_router,
    admin_disputes_router as admin_disputes_router,
    admin_auth_router as admin_auth_router,
)
from app.api.routes.archive_plus import (
    archive_router as archive_router,
    plus_router as plus_router,
)
from app.api.routes.wallet import (
    wallet_router as wallet_router,
    kyc_router as kyc_router,
    admin_wallet_router as admin_wallet_router,
    admin_kyc_router as admin_kyc_router,
)
from app.api.routes.address import router as address_router
from app.api.routes.payment_webhooks import router as payment_webhooks_router
from app.api.routes.trading_support import (
    support_router as trading_support_router,
    admin_support_router as admin_trading_support_router,
)
from app.api.routes.notification import router as notification_router
from app.api.routes.banner import router as banner_router
from app.api.routes.community import router as community_router
from app.api.routes.moderation import router as moderation_router
from app.api.routes.chat import router as chat_router
from app.api.routes.maintenance import router as maintenance_router
from app.api.routes.feature_flags import router as feature_flags_router
from app.api.routes.level import (
    router as level_router,
    lottery_router,
    benefit_router,
    admin_level_router,
    admin_lottery_router,
)
from app.api.routes.ai_post import router as ai_post_router
from app.api.routes.ai_prompts_admin import router as ai_prompts_admin_router

# 导入缓存服务
from app.services.cache_service import cache_service
from app.services.maintenance_service import maintenance_service
from app.services.scheduler_service import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    print("🚀 Avant Regard API starting...")
    
    # 连接 Redis
    cache_service.connect()

    # 启动后台调度器(订单/钱包/物流定时任务)。
    # 通过 settings.ENABLE_BACKGROUND_SCHEDULER 控制,默认关闭便于本地调试,
    # 生产环境只在选举出来的"主"实例打开,避免多副本重复执行。
    start_scheduler()

    yield

    # 关闭时执行
    stop_scheduler()
    cache_service.disconnect()
    print("👋 Avant Regard API shutting down...")


# 创建 FastAPI 应用
app = FastAPI(
    title="Avant Regard API",
    description="时尚社区后端 API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 维护模式中间件：开启后除白名单外全部返回 503
# 白名单：认证、管理员后台、维护状态查询、健康检查、OpenAPI 文档、根路径
_MAINTENANCE_ALLOWLIST_PREFIXES = (
    "/api/auth",
    "/api/admin",
    "/api/maintenance",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
)


@app.middleware("http")
async def maintenance_mode_middleware(request: Request, call_next):
    """维护模式统一拦截。

    - OPTIONS 请求（CORS 预检）不拦截，否则浏览器会因预检失败拿不到真实错误体。
    - 白名单前缀直接放行，保证管理员仍能登录并关闭维护。
    - 其他情况在维护开启时统一返回 503，响应体与业务错误信封保持一致。
    """
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    if path == "/" or any(path.startswith(p) for p in _MAINTENANCE_ALLOWLIST_PREFIXES):
        return await call_next(request)

    config = maintenance_service.get_config()
    if config.get("enabled"):
        return JSONResponse(
            status_code=503,
            content=error(
                code=503,
                message=config.get("message", "服务维护中"),
                data={"maintenance": True},
            ),
        )

    return await call_next(request)


# ===== 异常处理 =====
# 设计说明：
# - 上游数据层（Supabase/PostgREST/nginx）偶发 5xx 或网络抖动时，必须把"上游瞬时故障"
#   和"业务错误"区分开：前者返回 502 + 友好文案，客户端应重试；后者保留原始语义。
# - 原先 `global_exception_handler` 直接 `str(exc)`，会把 `APIError` 的 Python dict
#   repr 泄漏给客户端（形如 `{'message': 'JSON could not be generated', ...}`），
#   既不安全也无法被前端按语义处理。这里按异常类型分派处理，最后才兜底 Exception。

_UPSTREAM_UNAVAILABLE_MESSAGE = "数据服务暂不可用，请稍后重试"


@app.exception_handler(APIError)
async def postgrest_api_error_handler(request: Request, exc: APIError):
    """处理 supabase-py/postgrest-py 抛出的 APIError。

    - 上游瞬时故障（502/503/504 或非 JSON 响应）：统一转为 502 + 友好文案。
      前端/移动端看到 502 即可触发"重试"交互。
    - 其他 PostgREST 错误（PG 错误码等业务问题）：透传 `exc.message`，HTTP 400。
    """
    if is_transient_supabase_error(exc):
        print(
            f"[APIError][upstream] path={request.url.path} "
            f"code={exc.code} message={exc.message!r} "
            f"hint={exc.hint!r} details={exc.details!r}",
            flush=True,
        )
        return JSONResponse(
            status_code=502,
            content=error(code=502, message=_UPSTREAM_UNAVAILABLE_MESSAGE),
        )

    print(
        f"[APIError] path={request.url.path} code={exc.code} "
        f"message={exc.message!r} hint={exc.hint!r}",
        flush=True,
    )
    return JSONResponse(
        status_code=400,
        content=error(code=400, message=exc.message or "数据层错误"),
    )


@app.exception_handler(httpx.HTTPError)
async def httpx_error_handler(request: Request, exc: httpx.HTTPError):
    """httpx 连接/超时/协议错误——上游不可达，按瞬时故障处理。"""
    print(
        f"[httpx] path={request.url.path} error={type(exc).__name__}: {exc!s}",
        flush=True,
    )
    return JSONResponse(
        status_code=502,
        content=error(code=502, message=_UPSTREAM_UNAVAILABLE_MESSAGE),
    )


_SENSITIVE_FIELDS = {"password", "newPassword", "oldPassword", "identityToken"}


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """把 Pydantic 422 校验失败信息打到服务端日志，并以字段级消息返回。

    避免把 password 等敏感字段写入日志。
    """
    errors = exc.errors()
    summary = []
    for e in errors:
        loc = e.get("loc", ())
        field = loc[-1] if loc else "field"
        summary.append(f"{field}={e.get('msg')!r}({e.get('type')})")

    safe_body = {}
    try:
        body = await request.json()
        if isinstance(body, dict):
            for k, v in body.items():
                if k in _SENSITIVE_FIELDS:
                    safe_body[k] = f"<{len(v)} chars>" if isinstance(v, str) else "<hidden>"
                elif isinstance(v, str):
                    safe_body[k] = f"{v!r} (len={len(v)})"
                else:
                    safe_body[k] = v
    except Exception:
        safe_body = {"_unparsed": True}

    print(
        f"[422] path={request.url.path} body={safe_body} errors=[{'; '.join(summary)}]",
        flush=True,
    )

    detail_msg = "; ".join(
        f"{(e.get('loc') or ['field'])[-1]}: {e.get('msg')}" for e in errors
    )
    return JSONResponse(
        status_code=422,
        content=error(code=422, message=detail_msg or "请求参数不合法"),
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """未被上方精确处理的异常兜底。保持原有 500 语义，但不再泄漏 repr。"""
    print(
        f"[Exception] path={request.url.path} error={type(exc).__name__}: {exc!s}",
        flush=True,
    )
    return JSONResponse(
        status_code=500,
        content=error(code=500, message=str(exc)),
    )


# 注册路由
app.include_router(auth_router, prefix="/api")
app.include_router(user_router, prefix="/api")
app.include_router(post_router, prefix="/api")
app.include_router(comment_router, prefix="/api")
app.include_router(follow_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(admin_user_router, prefix="/api")
app.include_router(files_router, prefix="/api")
app.include_router(brands_router, prefix="/api")
app.include_router(shows_router, prefix="/api")
app.include_router(buyer_store_router, prefix="/api")
app.include_router(store_merchant_router, prefix="/api")
app.include_router(store_product_router, prefix="/api")
app.include_router(listing_router, prefix="/api")
app.include_router(listing_sellers_router, prefix="/api")
app.include_router(listing_admin_router, prefix="/api")
app.include_router(listing_marketplace_router, prefix="/api")
app.include_router(provenance_router, prefix="/api")
app.include_router(collections_router, prefix="/api")
app.include_router(price_history_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(offers_router, prefix="/api")
app.include_router(admin_orders_router, prefix="/api")
app.include_router(disputes_router, prefix="/api")
app.include_router(authentication_router, prefix="/api")
app.include_router(trade_reviews_router, prefix="/api")
app.include_router(admin_disputes_router, prefix="/api")
app.include_router(admin_auth_router, prefix="/api")
app.include_router(archive_router, prefix="/api")
app.include_router(plus_router, prefix="/api")
app.include_router(wallet_router, prefix="/api")
app.include_router(kyc_router, prefix="/api")
app.include_router(admin_wallet_router, prefix="/api")
app.include_router(admin_kyc_router, prefix="/api")
app.include_router(address_router, prefix="/api")
app.include_router(payment_webhooks_router, prefix="/api")
app.include_router(trading_support_router, prefix="/api")
app.include_router(admin_trading_support_router, prefix="/api")
app.include_router(notification_router, prefix="/api")
app.include_router(banner_router, prefix="/api")
app.include_router(community_router, prefix="/api")
app.include_router(moderation_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(maintenance_router, prefix="/api")
app.include_router(feature_flags_router, prefix="/api")
app.include_router(level_router, prefix="/api")
app.include_router(lottery_router, prefix="/api")
app.include_router(benefit_router, prefix="/api")
app.include_router(admin_level_router, prefix="/api")
app.include_router(admin_lottery_router, prefix="/api")
app.include_router(ai_post_router, prefix="/api")
app.include_router(ai_prompts_admin_router, prefix="/api")


# 健康检查
@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "service": "avant-regard-api",
        "redis": cache_service.is_connected,
    }


@app.get("/cache/stats")
async def cache_stats():
    """获取缓存统计信息"""
    return cache_service.get_stats()


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "Welcome to Avant Regard API",
        "docs": "/docs",
        "redoc": "/redoc"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=settings.DEBUG
    )
