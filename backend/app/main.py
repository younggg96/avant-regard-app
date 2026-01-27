"""
Avant Regard API - FastAPI 应用入口
"""
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    print("🚀 Avant Regard API starting...")
    yield
    # 关闭时执行
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


# 健康检查
@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "service": "avant-regard-api"}


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
