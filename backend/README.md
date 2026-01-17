# Avant Regard Backend API

基于 FastAPI + Supabase 的时尚社区后端 API。

## 技术栈

- **FastAPI** - 现代高性能 Python Web 框架
- **Supabase** - 开源 Firebase 替代品（PostgreSQL + Storage + Auth）
- **Supabase Auth** - 完整的身份认证系统（Phone OTP + Password）
- **Pydantic** - 数据验证

## 目录结构

```
backend/
├── app/
│   ├── api/
│   │   ├── deps.py          # API 依赖项（认证等）
│   │   └── routes/          # API 路由
│   │       ├── auth.py      # 认证路由
│   │       ├── user.py      # 用户路由
│   │       ├── post.py      # 帖子路由
│   │       ├── comment.py   # 评论路由
│   │       ├── follow.py    # 关注路由
│   │       ├── admin.py     # 管理员路由
│   │       └── files.py     # 文件上传路由
│   ├── core/
│   │   ├── config.py        # 配置
│   │   ├── security.py      # 密码哈希工具
│   │   └── response.py      # 统一响应格式
│   ├── db/
│   │   ├── supabase.py      # Supabase 客户端
│   │   ├── init_tables.sql  # 数据库表结构
│   │   └── functions.sql    # 数据库函数
│   ├── schemas/             # Pydantic 模型
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── post.py
│   │   ├── comment.py
│   │   ├── follow.py
│   ├── services/            # 业务逻辑
│   │   ├── auth_service.py
│   │   ├── user_service.py
│   │   ├── post_service.py
│   │   ├── comment_service.py
│   │   ├── follow_service.py
│   │   ├── admin_service.py
│   │   └── file_service.py
│   └── main.py              # 应用入口
├── requirements.txt         # 依赖
├── run.py                   # 启动脚本
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. 配置 Supabase

1. 在 [Supabase](https://supabase.com) 创建项目
2. 在 SQL Editor 中执行 `app/db/init_tables.sql` 创建表
3. 在 SQL Editor 中执行 `app/db/functions.sql` 创建函数
4. 在 Storage 中创建 `images` bucket 并设置为公开

### 3. 配置环境变量

创建 `.env` 文件：

```bash
# Supabase（必需）
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# Redis（可选）
REDIS_URL=redis://localhost:6379/0

# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
DEBUG=true
CORS_ORIGINS=["http://localhost:3000","http://localhost:19006","exp://localhost:8081"]
```

> ✅ **不再需要 JWT 配置！** 认证完全由 Supabase Auth 处理。

### 4. 配置 Supabase Phone Auth（短信验证）

短信验证使用 Supabase 内置的 Phone Auth 功能：

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 进入项目 → **Authentication** → **Providers**
3. 启用 **Phone** provider
4. 配置短信提供商（推荐 Twilio）：
   - **Twilio Account SID**
   - **Twilio Auth Token**
   - **Twilio Messaging Service SID** 或手机号
5. 在 **Authentication** → **Settings** 中可配置：
   - SMS OTP 过期时间（默认 60 秒）
   - SMS 模板内容

> 💡 **提示**：Supabase 免费版每月有 50 条短信额度，生产环境需升级或配置自己的 Twilio 账号。

### 5. 启动服务

```bash
python run.py
```

或使用 uvicorn：

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 6. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 端点

### 认证 (Auth)
- `POST /api/auth/login` - 密码登录
- `POST /api/auth/login-sms` - 短信验证码登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/sms/send` - 发送注册验证码
- `POST /api/auth/sms/send-login` - 发送登录验证码
- `POST /api/auth/sms/send-reset` - 发送重置密码验证码
- `POST /api/auth/forget-password` - 重置密码
- `POST /api/auth/refresh` - 刷新令牌

### 用户 (User)
- `GET /api/user-info/{userId}` - 获取用户信息
- `PUT /api/user-info/{userId}` - 更新用户信息
- `POST /api/user-info/{userId}/avatar` - 上传头像
- `GET /api/user-info/{userId}/profile` - 获取用户资料
- `PUT /api/user-info/{userId}/profile` - 更新用户资料

### 帖子 (Post)
- `GET /api/posts` - 获取帖子列表
- `GET /api/posts/{postId}` - 获取帖子详情
- `POST /api/posts` - 创建帖子
- `PUT /api/posts/{postId}` - 更新帖子
- `DELETE /api/posts/{postId}` - 删除帖子
- `POST /api/posts/{postId}/like` - 点赞
- `DELETE /api/posts/{postId}/like` - 取消点赞
- `POST /api/posts/{postId}/favorite` - 收藏
- `DELETE /api/posts/{postId}/favorite` - 取消收藏
- `GET /api/posts/user/{userId}` - 获取用户帖子
- `GET /api/posts/user/{userId}/liked` - 获取用户点赞的帖子
- `GET /api/posts/user/{userId}/favorites` - 获取用户收藏的帖子
- `GET /api/posts/show/{showId}` - 获取秀场关联帖子

### 评论 (Comment)
- `GET /api/posts/{postId}/comments` - 获取帖子评论
- `POST /api/posts/{postId}/comments` - 发表评论
- `POST /api/posts/comments/{commentId}/like` - 点赞评论
- `DELETE /api/posts/comments/{commentId}/like` - 取消点赞评论
- `DELETE /api/posts/comments/{commentId}` - 删除评论

### 秀场图片评论
- `GET /api/show-images/{imageId}/reviews` - 获取图片评论
- `POST /api/show-images/{imageId}/reviews` - 发表图片评论
- `GET /api/show-images/users/{userId}/image-reviews` - 获取用户的图片评论
- `DELETE /api/show-images/reviews/{reviewId}` - 删除图片评论

### 关注 (Follow)
- `POST /api/follow/user` - 关注用户
- `DELETE /api/follow/user` - 取消关注用户
- `GET /api/follow/users/{userId}/following-users` - 获取关注的用户
- `GET /api/follow/user/{userId}/following/count` - 获取关注数
- `GET /api/follow/user/{userId}/followers/count` - 获取粉丝数
- `GET /api/follow/user/{followerId}/is-following/{targetUserId}` - 检查是否关注

### 管理员 (Admin)
- `GET /api/admin/posts/pending` - 获取待审核帖子
- `POST /api/admin/posts/{postId}/approve` - 审核通过
- `POST /api/admin/posts/{postId}/reject` - 审核拒绝
- `DELETE /api/auth/admin/users/{userId}` - 删除用户

### 文件 (Files)
- `POST /api/files/upload-image` - 上传图片

## 响应格式

所有 API 使用统一的响应格式：

```json
{
  "code": 0,
  "message": "success",
  "data": {...}
}
```

- `code`: 0 表示成功，非 0 表示错误
- `message`: 响应消息
- `data`: 响应数据

## 认证

使用 **Supabase Auth** 进行身份认证。在请求头中添加：

```
Authorization: Bearer <supabase_access_token>
```

### 认证流程

1. **发送验证码** → `POST /api/auth/sms/send`
2. **验证码登录** → `POST /api/auth/login-sms`（自动注册新用户）
3. **设置密码**（可选）→ 注册时设置或稍后更新
4. **密码登录** → `POST /api/auth/login`
5. **刷新令牌** → `POST /api/auth/refresh`

### Token 管理

- Access Token 由 Supabase Auth 管理，有效期约 1 小时
- Refresh Token 用于获取新的 Access Token
- 前端应在 Token 过期前调用 refresh 接口

## 🐳 Docker 部署

### 开发模式

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的配置

# 2. 启动服务（支持热重载）
docker-compose -f docker-compose.dev.yml up

# 后台运行
docker-compose -f docker-compose.dev.yml up -d

# 查看日志
docker-compose -f docker-compose.dev.yml logs -f api
```

### 生产模式

```bash
# 1. 配置环境变量
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_KEY=your-anon-key
export SUPABASE_SERVICE_KEY=your-service-role-key
export JWT_SECRET_KEY=your-super-secret-key
export DEBUG=false

# 2. 构建并启动
docker-compose up -d --build

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f api
```

### Docker 命令速查

```bash
# 停止服务
docker-compose down

# 重新构建
docker-compose build --no-cache

# 进入容器
docker exec -it avant-regard-api bash

# 清理
docker-compose down -v --rmi all
```

### 仅构建镜像

```bash
# 构建
docker build -t avant-regard-api .

# 运行
docker run -d \
  -p 8000:8000 \
  -e SUPABASE_URL=xxx \
  -e SUPABASE_KEY=xxx \
  -e SUPABASE_SERVICE_KEY=xxx \
  -e JWT_SECRET_KEY=xxx \
  --name avant-regard-api \
  avant-regard-api
```

### 环境变量

生产环境请确保：
- 使用强 `JWT_SECRET_KEY`
- 设置 `DEBUG=false`
- 正确配置 `CORS_ORIGINS`
