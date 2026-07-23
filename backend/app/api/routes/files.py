"""
文件上传路由 + 图片转换代理

## 图片转换代理（GET /files/image）
MemFire Cloud 的 Storage 没有 `render/image` 端点，客户端只能拉原图
（几 MB 起步），feed 加载体验很差。这里用 Pillow 做一次性转换 + 磁盘
缓存，让下游消费方能按需请求缩略图 / 中图，典型 400px WebP 只有
20~60KB。

设计要点：
- **URL 白名单**：只接受 `settings.SUPABASE_URL` 的 host，避免被当成
  SSRF 开放代理。
- **不鉴权**：expo-image / 浏览器 `<img>` 发请求时不带我们的 Bearer，
  强行要求鉴权会把这条路由完全用不起来。白名单 + 资源本身 public 即
  是正确的安全边界。
- **不可变缓存**：Storage 对象路径里带 uuid + 日期，一旦写入永不变更；
  响应直接 `Cache-Control: public, max-age=31536000, immutable`，并
  带 ETag 允许客户端 304。
- **磁盘缓存 + FileResponse**：命中时走 zero-copy sendfile，不把图片
  读进 Python 堆，单进程也能扛高 QPS。
- **Pillow 放在 `asyncio.to_thread`**：避免阻塞事件循环。
"""
import asyncio
import hashlib
import io
import os
import tempfile
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import (
    APIRouter, BackgroundTasks, HTTPException, Depends,
    UploadFile, File, Query, Header,
)
from fastapi.responses import FileResponse, Response
from PIL import Image

from app.services.file_service import file_service, FileService
from app.api.deps import get_current_user_id
from app.core.response import success
from app.core.config import settings

router = APIRouter(prefix="/files", tags=["文件上传"])

IMAGE_MIME_MAP = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "heic": "image/heic",
}
VIDEO_MIME_MAP = {
    "mp4": "video/mp4", "mov": "video/quicktime",
    "m4v": "video/x-m4v", "webm": "video/webm",
}

def _infer_content_type(filename: str | None, declared: str | None) -> str:
    """从文件名或声明的 content_type 推断实际 MIME 类型"""
    if declared and (declared.startswith("image/") or declared.startswith("video/")):
        return declared
    if filename:
        ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
        merged = {**IMAGE_MIME_MAP, **VIDEO_MIME_MAP}
        if ext in merged:
            return merged[ext]
    return declared or ""


@router.post("/upload-image")
async def upload_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user_id: int = Depends(get_current_user_id)
):
    """上传图片"""
    print(f"Upload request - filename: {file.filename}, content_type: {file.content_type}")

    content_type = _infer_content_type(file.filename, file.content_type)
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail=f"只能上传图片文件 (received: {file.content_type})")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片大小不能超过10MB")

    print(f"Uploading image: {len(content)} bytes, type: {content_type}")
    # 同步 HTTP 上传放线程池，避免阻塞事件循环
    url = await asyncio.to_thread(
        file_service.upload_image, content, file.filename, content_type
    )

    if not url:
        raise HTTPException(status_code=500, detail="图片上传失败")

    # 响应返回后在线程池里预生成各尺寸变体（见 _prewarm_image_variants）。
    # 上传字节已在内存里，预热连回源 Storage 都不需要。
    background_tasks.add_task(_prewarm_image_variants, url, content)
    return success({"url": url})


@router.post("/upload-video")
async def upload_video(
    file: UploadFile = File(...),
    current_user_id: int = Depends(get_current_user_id)
):
    """上传视频"""
    print(f"Upload video request - filename: {file.filename}, content_type: {file.content_type}")

    content_type = _infer_content_type(file.filename, file.content_type)
    if not content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail=f"只能上传视频文件 (received: {file.content_type})")

    content = await file.read()
    max_video_size = 100 * 1024 * 1024  # 100 MB
    if len(content) > max_video_size:
        raise HTTPException(status_code=400, detail="视频大小不能超过100MB")

    print(f"Uploading video: {len(content)} bytes, type: {content_type}")
    url = await asyncio.to_thread(
        file_service.upload_video, content, file.filename, content_type
    )

    if not url:
        raise HTTPException(status_code=500, detail="视频上传失败")
    return success({"url": url, "mediaType": "video"})


# ============================================================================
# 图片转换代理
# ============================================================================

_IMAGE_CACHE_DIR = os.environ.get(
    "IMAGE_PROXY_CACHE_DIR",
    os.path.join(tempfile.gettempdir(), "avant_image_cache"),
)
os.makedirs(_IMAGE_CACHE_DIR, exist_ok=True)

_STORAGE_HOST = urlparse(settings.SUPABASE_URL).hostname or ""
_ALLOWED_HOSTS = {_STORAGE_HOST} - {""}

# 输出尺寸上限：与 Supabase Image Transformation 保持一致，既够用又能
# 防止恶意请求把服务端放大图浪费 CPU。
_MAX_DIMENSION = 2500
# 源图体积上限。超过视为异常内容直接拒绝 —— 上传链路现在会压到 ~1MB
# 以内，服务器上只有老数据会命中这条；即便不命中也能防极端请求。
_MAX_SOURCE_BYTES = 25 * 1024 * 1024
_FETCH_TIMEOUT_S = 15.0
# 长期缓存头：Storage 对象路径是 uuid + 日期，写入后从不改变，可以让
# 客户端 / CDN 无限期缓存。
_CACHE_CONTROL = "public, max-age=31536000, immutable"


def _is_allowed_source(url: str) -> bool:
    """URL 白名单：仅 Storage 自家的 host 可被代理。"""
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme not in ("https", "http"):
        return False
    return parsed.hostname in _ALLOWED_HOSTS


def _pick_output_format(
    accept_header: Optional[str], explicit_fmt: Optional[str]
) -> tuple[str, str, str]:
    """
    决定输出格式。返回 `(pillow_format, mime_type, extension)`。

    策略：
      1. 显式 `fmt=` 最高优先 —— 方便老浏览器 / 需要 JPEG 的场景强制。
      2. 若客户端 `Accept` 含 `image/webp`，用 WebP（10-30% 小于 JPEG，
         移动浏览器 & expo-image 普遍支持）。
      3. 保底 JPEG（兼容最广、Pillow 编码最稳）。
    """
    if explicit_fmt:
        f = explicit_fmt.lower()
        if f == "webp":
            return "WEBP", "image/webp", "webp"
        if f in ("jpeg", "jpg"):
            return "JPEG", "image/jpeg", "jpg"
        if f == "png":
            return "PNG", "image/png", "png"

    if accept_header and "image/webp" in accept_header.lower():
        return "WEBP", "image/webp", "webp"

    return "JPEG", "image/jpeg", "jpg"


def _cache_key(url: str, w: int, h: int, q: int, fmt: str) -> str:
    digest = hashlib.sha256(
        f"{url}|{w}|{h}|{q}|{fmt}".encode("utf-8")
    ).hexdigest()
    return digest


def _cache_path(key: str, ext: str) -> str:
    return os.path.join(_IMAGE_CACHE_DIR, f"{key}.{ext}")


def _source_cache_path(url: str) -> str:
    """
    原图字节的本地缓存路径。

    同一张图会被请求多个尺寸（THUMBNAIL / FEED_CARD / MEDIUM / LARGE），
    没有这层缓存时每个尺寸的冷启动都要回源 Storage 拉一次几 MB 的原图。
    落一份盘后，多尺寸转换只回源一次。
    """
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
    return os.path.join(_IMAGE_CACHE_DIR, f"{digest}.src")


def _atomic_write(path: str, data: bytes) -> None:
    """先写 tmp 再 rename，避免并发请求读到半个文件。"""
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, path)


def _transform_bytes(
    src_bytes: bytes,
    width: int,
    height: int,
    quality: int,
    pil_fmt: str,
) -> bytes:
    """
    CPU-bound 转换。调用方用 `asyncio.to_thread` 包起来跑。

    resize 策略：
      - 零 → 不 resize（当作只做格式 / 质量转换）。
      - 只给 width / height → 按长边约束，保持宽高比。
      - 两个都给 → 以较小 scale fit 在矩形内（类似 `contain`）。
      - 永不放大：若原图已经比目标小，直接返原尺寸，避免像素拉伸。
    """
    with Image.open(io.BytesIO(src_bytes)) as im:
        # JPEG 不支持 alpha；统一 flatten 成 RGB 避免 Pillow 抛
        # `OSError: cannot write mode RGBA as JPEG`。
        if pil_fmt == "JPEG" and im.mode != "RGB":
            im = im.convert("RGB")
        elif pil_fmt == "WEBP" and im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA")

        ow, oh = im.size
        if width or height:
            if width and height:
                scale = min(width / ow, height / oh)
            elif width:
                scale = width / ow
            else:
                scale = height / oh
            if scale < 1.0:
                new_w = max(1, int(round(ow * scale)))
                new_h = max(1, int(round(oh * scale)))
                im = im.resize((new_w, new_h), Image.LANCZOS)

        out = io.BytesIO()
        save_kwargs: dict = {"quality": quality}
        if pil_fmt == "JPEG":
            # progressive JPEG 在弱网下感知速度更好，optimize 再省 3-5%。
            save_kwargs.update(optimize=True, progressive=True)
        elif pil_fmt == "WEBP":
            # method=6 质量最好但慢 ~5×；4 是质量/耗时的平衡点。
            save_kwargs.update(method=4)
        im.save(out, format=pil_fmt, **save_kwargs)
        return out.getvalue()


# 上传后只预热最高频的两个尺寸。必须与前端 `imageUtils.ts` 的
# IMAGE_SIZE_CONFIG 完全一致（w / q / fmt 任一不同都会算出不同 key）：
#   FEED_CARD 640/80：两列 feed 封面
#   MEDIUM    800/80：多图详情 / 常规内容图
#
# THUMBNAIL 与 LARGE 按需生成，避免每次上传后连续四次 WebP 编码挤占
# API 进程 CPU。前端统一以 fmt=webp 请求。
_PREWARM_VARIANTS: list[tuple[int, int]] = [
    (640, 80),
    (800, 80),
]


def _prewarm_image_variants(url: str, src_bytes: bytes) -> None:
    """
    上传成功后同步预生成各尺寸 WebP 变体（由 BackgroundTasks 在响应
    返回后跑在线程池里，不阻塞上传请求本身）。

    效果：其他用户刷到这张新图时，代理路由必定命中磁盘缓存，走
    zero-copy sendfile —— 冷启动的「回源 + Pillow 转换」路径只在
    这里跑一次，而且用的是上传请求里已经在内存里的字节，连回源
    都省了。
    """
    try:
        _atomic_write(_source_cache_path(url), src_bytes)
    except Exception as e:
        print(f"[image prewarm] source cache write failed: {e}")

    for width, quality in _PREWARM_VARIANTS:
        key = _cache_key(url, width, 0, quality, "WEBP")
        cached = _cache_path(key, "webp")
        if os.path.isfile(cached):
            continue
        try:
            out_bytes = _transform_bytes(src_bytes, width, 0, quality, "WEBP")
            _atomic_write(cached, out_bytes)
        except Exception as e:
            # 预热失败无碍：首个真实请求会走原始的按需转换路径。
            print(f"[image prewarm] w={width} failed for {url}: {e}")


@router.get("/image")
async def proxy_image(
    url: str = Query(..., description="原始图片 URL（必须属于受信任的 Storage 域名）"),
    w: int = Query(0, ge=0, le=_MAX_DIMENSION, description="目标宽度，0 表示不缩放"),
    h: int = Query(0, ge=0, le=_MAX_DIMENSION, description="目标高度，0 表示不约束"),
    q: int = Query(80, ge=20, le=100, description="质量 20-100"),
    fmt: Optional[str] = Query(
        None,
        pattern="^(webp|jpeg|jpg|png)$",
        description="显式指定输出格式；不传则按 Accept 协商",
    ),
    accept: Optional[str] = Header(None, description="客户端 Accept（用于 WebP 协商）"),
    if_none_match: Optional[str] = Header(None, alias="If-None-Match"),
):
    """
    图片代理 + 转换端点。

    典型调用：
      GET /api/files/image?url=https://.../images/2024/xxx.jpg&w=400&q=75
      → 返回约 30-60KB 的 WebP / JPEG 缩略图，带 31536000s immutable 缓存头。
    """
    if not _is_allowed_source(url):
        raise HTTPException(status_code=400, detail="URL 不在允许的源站白名单")

    pil_fmt, mime, ext = _pick_output_format(accept, fmt)
    key = _cache_key(url, w, h, q, pil_fmt)
    etag = f'"{key}"'

    # 未显式指定 fmt 时输出内容取决于 Accept 头，必须带 Vary: Accept，
    # 否则 CDN / 共享缓存会把按 WebP 协商出的响应错发给不支持 WebP 的
    # 客户端。显式 fmt 时 URL 完全决定内容，不加 Vary 让 CDN 缓存键
    # 保持干净（客户端现在统一传 fmt=webp 走这条路径）。
    common_headers = {
        "ETag": etag,
        "Cache-Control": _CACHE_CONTROL,
    }
    if not fmt:
        common_headers["Vary"] = "Accept"

    # 客户端已经拿过这张图就回 304，省流量。因为我们每次根据
    # (url, w, h, q, fmt) 算出确定性 key，ETag 具有幂等性。
    if if_none_match and if_none_match.strip() == etag:
        return Response(status_code=304, headers=common_headers)

    cached = _cache_path(key, ext)
    if os.path.isfile(cached):
        return FileResponse(cached, media_type=mime, headers=common_headers)

    # 回源前先查原图缓存：同一张图的其它尺寸请求已经拉过原图的话，
    # 这里零网络成本直接复用。
    src: Optional[bytes] = None
    src_cached = _source_cache_path(url)
    if os.path.isfile(src_cached):
        try:
            with open(src_cached, "rb") as f:
                src = f.read()
        except OSError:
            src = None

    if src is None:
        try:
            async with httpx.AsyncClient(
                timeout=_FETCH_TIMEOUT_S, follow_redirects=True
            ) as client:
                resp = await client.get(url)
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"回源失败: {e}")

        if resp.status_code != 200:
            raise HTTPException(
                status_code=resp.status_code if resp.status_code >= 400 else 502,
                detail=f"回源返回 {resp.status_code}",
            )

        src = resp.content
        if len(src) > _MAX_SOURCE_BYTES:
            raise HTTPException(status_code=413, detail="源图过大")

        try:
            _atomic_write(src_cached, src)
        except Exception as e:
            print(f"[image proxy] source cache write failed: {e}")

    try:
        out_bytes = await asyncio.to_thread(
            _transform_bytes, src, w, h, q, pil_fmt
        )
    except Exception as e:
        # Pillow 偶尔会碰到无法解码的格式（比如 HEIC 没装 pillow-heif
        # 的环境）—— 不要把整个 feed 弄崩，直接 502 让客户端 fallback
        # 到占位图就行。
        print(f"[image proxy] transform failed: {e}")
        raise HTTPException(status_code=502, detail=f"图片转换失败: {e}")

    try:
        _atomic_write(cached, out_bytes)
    except Exception as e:
        # 缓存写失败不影响本次响应返回，日志记录留着排查磁盘问题。
        print(f"[image proxy] cache write failed: {e}")

    return Response(content=out_bytes, media_type=mime, headers=common_headers)
