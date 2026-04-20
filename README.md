# Avant Regard

> 为先锋时装而生的社区。  
> A community for avant-garde fashion lovers — runway archives, outfit sharing, item reviews, and boutique discovery.

这是 **Avant Regard** 的 monorepo，包含三个独立但协作的子项目：

| 子项目 | 路径 | 技术栈 | 说明 |
| --- | --- | --- | --- |
| 移动端 app（iOS + Android） | [`frontend/`](./frontend) | React Native + Expo 51 + TypeScript + Zustand + React Query + Gluestack | 主交付产品，用户发帖、聊天、发现等完整体验 |
| 后端 API | [`backend/`](./backend) | FastAPI + SQLAlchemy + Supabase/Postgres + Docker | REST 服务，供 frontend 与 web 共同消费 |
| 营销 / 只读网站 | [`web/`](./web) | Next.js 14 (App Router) + TypeScript + Tailwind | 落地页、下载引导，以及 Discover / 帖子详情 / 用户主页的只读视图 |

## 🗂️ 仓库结构

```
avant-regard-app/
├── backend/          # FastAPI 后端
│   ├── app/            # 应用代码（routes, services, db migrations）
│   ├── scripts/        # 数据导入 / 种子脚本
│   ├── requirements.txt
│   └── docker-compose.yml
├── frontend/         # React Native / Expo 移动端
│   ├── App.tsx
│   ├── src/            # screens, components, services, store, theme
│   ├── assets/
│   ├── android/ · ios/ # 原生工程
│   ├── scripts/        # 启动与检查脚本
│   └── package.json
├── web/              # Next.js 14 营销 / 只读网站
│   ├── src/app/        # App Router pages (/, /discover, /posts/[id], /users/[id], /download)
│   ├── src/components/ # UI 组件
│   ├── src/lib/        # API client, types, formatters, config
│   └── package.json
├── package.json      # 根 workspace manifest（npm workspaces）
├── PROGRESS_LOG.md   # 迭代日志
└── README.md
```

> **Tip**：frontend 与 web 通过 npm workspaces 统一安装依赖；backend 是独立的 Python 项目，不参与 node workspace。

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 10+（自带 workspaces 支持）
- Python 3.11+（仅 backend 需要）
- Xcode / Android Studio（仅 iOS / Android 原生构建需要）

### 一次性安装（frontend + web 的所有 JS 依赖）

```bash
npm install
```

此命令会自动为 `frontend/` 与 `web/` 安装依赖，依赖会被尽可能 hoist 到根 `node_modules`。

### Frontend（移动端 app）

首次运行前，复制 `frontend/.env.example` 为 `frontend/.env` 并按需修改 `EXPO_PUBLIC_API_BASE_URL`。

#### 场景 A —— 日常开发（只改 JS / TS）

原生二进制已经装在模拟器里时，只需起 Metro：

```bash
cd frontend
env -u CI npx expo start --clear
```

模拟器里按 `Cmd+R`，或 Metro 终端按 `r` 即可热重载。

> ⚠️ **必须 `env -u CI`**：当前 shell 环境里若存在残留的 `CI=1`，Expo 会进入 CI 模式并禁用 watch/热重载（日志会出现 `Metro is running in CI mode, reloads are disabled`）。用 `env | grep -i ^CI=` 自查。

也可以继续用封装过的脚本（同样会受 `CI` 影响，建议也先 `unset CI`）：

```bash
npm run frontend:dev        # 等价于 cd frontend && node scripts/start-mobile.js
```

#### 场景 B —— iOS 首次启动 / 需要重建原生

出现 `requireNativeComponent: "<X>" was not found in the UIManager` 这类错误，或刚拉了含原生模块的新依赖时，必须重建 dev client：

```bash
cd frontend

# 1. 清理陈旧的 Pods 与构建产物
rm -rf ios/Pods ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData/AvantRegard-*
watchman watch-del-all 2>/dev/null || true
rm -rf node_modules/.cache .expo

# 2. 重装 CocoaPods（把 RNFlashList / RNScreens / React-Core 等原生模块装进 ios/Pods）
cd ios && pod install --repo-update && cd ..

# 3. 编译并安装到已启动的 iPhone 模拟器；命令会顺便起 Metro
env -u CI npx expo run:ios
# 或指定具体模拟器：
# env -u CI npx expo run:ios --device "iPhone 16 Pro"
```

#### 场景 C —— Android 模拟器

```bash
cd frontend
npm run android             # 等价于 expo run:android
```

Android 的 Gradle 会自动处理原生依赖，无需额外的 `pod install`；但新增含原生代码的依赖后仍要重新跑一次 `npm run android`。

#### 何时必须重建原生 vs 只重启 Metro

| 变更 | 需要 `expo run:ios` / `run:android` |
| --- | :---: |
| 只改 `.ts` / `.tsx` / `.js` / 样式 | ❌ Metro 按 `r` 即可 |
| 新增 / 升级含原生代码的依赖（flash-list、reanimated、svg、maps 等） | ✅ |
| 改 `ios/` 原生代码、`Info.plist`、`Podfile` | ✅ |
| 改 `android/` 原生代码、`AndroidManifest.xml`、`build.gradle` | ✅ |
| 改 `app.json` 里影响原生的字段（bundleId、权限、icon、splash） | ✅ |

#### 手动连 Metro（dev client 停在首屏时）

安装好 dev client 后，`xcrun simctl launch` 起来的 app 有时会停在 Expo dev launcher 首屏。用 deep link 强制连到本机 Metro：

```bash
xcrun simctl openurl booted "exp+avant-regard://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
```

### Web（营销 / 只读网站）

```bash
npm run web:dev             # next dev @ http://localhost:3100（默认）
npm run web:build           # 生产构建
npm run web:start           # 生产启动

# 想换端口时：
PORT=4000 npm run web:dev
```

> 默认端口选 3100 而不是 3000，是为了避开本机其他 Next.js 项目的冲突。

首次运行前，复制 `web/.env.example` 为 `web/.env.local`，并把 `NEXT_PUBLIC_API_BASE_URL` 指向后端（默认 `https://api.avantregard.com`）。

### Backend（FastAPI）

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python run.py
```

或通过 Docker：

```bash
cd backend
docker compose -f docker-compose.dev.yml up
```

## 🎨 设计系统

Frontend 与 web 共用一致的视觉语言（极简黑白灰 + Playfair Display 衬线字体）。移动端定义在 `frontend/src/theme/index.ts`；web 在 `web/tailwind.config.ts` 与 `web/src/app/globals.css` 中镜像了同一套令牌，确保品牌一致。

## 🔌 API 约定

所有 API 响应统一采用 `{ code, message, data }` 信封格式，`code !== 0` 视为业务错误。  
Web 与 frontend 在各自的 API 客户端里解包（见 `web/src/lib/api.ts` 与 `frontend/src/services/postService.ts`）。

## 🧪 Web 页面清单（当前范围：落地页 + 下载 + 核心只读）

- `/` — 落地页 Hero / 功能介绍 / Discover 预览 / CTA
- `/discover` — 社区最新帖子瀑布（调用后端 `GET /api/posts/feed`）
- `/posts/[id]` — 帖子详情（图片 / 文案 / 单品信息 / 作者链接）
- `/users/[id]` — 用户主页（头像 / Bio / 粉丝数 / 发布列表）
- `/download` — 下载引导 + 移动端自动跳转（`?auto=1` 时 UA 嗅探）
- `/robots.txt` · `/sitemap.xml` — SEO 基础

## 📝 版本控制

- 所有改动请记录在 [`PROGRESS_LOG.md`](./PROGRESS_LOG.md)
- 提交前请同步更新依赖（根 `npm install` 保证 workspaces 链接正确）

## 📞 联系

有问题请通过 issue 提交，或写信至 `hello@avantregard.com`。
