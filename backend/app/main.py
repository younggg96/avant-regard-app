"""
Avant Regard API - FastAPI 应用入口
"""
import sys
print(f"[BOOT] Python {sys.version}, loading app...", flush=True)
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.response import error

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
from app.api.routes.notification import router as notification_router
from app.api.routes.banner import router as banner_router
from app.api.routes.community import router as community_router
from app.api.routes.moderation import router as moderation_router
from app.api.routes.chat import router as chat_router
from app.api.routes.maintenance import router as maintenance_router

# 导入缓存服务
from app.services.cache_service import cache_service
from app.services.maintenance_service import maintenance_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    print("🚀 Avant Regard API starting...")
    
    # 连接 Redis
    cache_service.connect()
    
    yield
    
    # 关闭时执行
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


# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理器"""
    return JSONResponse(
        status_code=500,
        content=error(code=500, message=str(exc))
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
app.include_router(notification_router, prefix="/api")
app.include_router(banner_router, prefix="/api")
app.include_router(community_router, prefix="/api")
app.include_router(moderation_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(maintenance_router, prefix="/api")


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
