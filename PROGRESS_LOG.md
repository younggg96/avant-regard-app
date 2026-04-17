# Progress Log

## 2026-04-17: Monorepo Restructure — `frontend/` + `backend/` + new `web/` (Next.js 14)

### Summary
Split the repository into a 3-workspace monorepo:

| Workspace | Path | Stack | Role |
| --- | --- | --- | --- |
| `@avant-regard/frontend` | `frontend/` | Expo 51 · React Native · TS · Zustand · React Query · Gluestack | 移动端 app (原有代码整体迁入) |
| `@avant-regard/web` | `web/` | Next.js 14 App Router · TypeScript · Tailwind CSS | 全新营销 / 只读网站 |
| backend (Python) | `backend/` | FastAPI · SQLAlchemy · Docker | 保持不变，只做结构性归位（数据导入脚本移入 `backend/scripts/`） |

Root now只保留 monorepo 级别的文件：`package.json`（npm workspaces）、`.gitignore`、`README.md`、`PROGRESS_LOG.md`。

### Why
App 的业务逻辑越来越复杂，同时 SEO 与应用商店外的获客通道需要一个独立的 web 站点。把 frontend/backend/web 并列放在一个 monorepo 下：
- 共享一个 git 历史与 issue tracker
- 通过 npm workspaces 共用 node 依赖缓存
- 当 web 与 frontend 未来需要共享 API 类型或业务 hook 时，可零成本抽出 `packages/shared`（本次范围之外）
- 不互相污染：web 的 Next.js 构建与 frontend 的 Expo Metro 互不干扰

### Key Structural Changes

#### Repo layout
- 新增 `frontend/` 目录，把原根目录下的 app 文件整体迁入（通过 `git mv` 保留历史）：
  - `App.tsx`, `index.js`, `package.json`, `package-lock.json`
  - `app.json`, `babel.config.js`, `metro.config.js`, `tsconfig.json`, `eas.json`, `gluestack.config.ts`, `env.d.ts`
  - `src/`, `assets/`, `android/`, `ios/`, `patches/`
  - `.env`, `.env.example`, `.expo/`, `node_modules/`（gitignored 的直接 mv）
- 把 `scripts/` 里的前端脚本 (`start-mobile.js`, `check-setup.js`) 迁入 `frontend/scripts/`；数据导入脚本 (`excel_to_csv.py` 等) 迁入 `backend/scripts/`
- `backend/` 保持不动
- 新建 `web/`（Next.js 14 App Router 项目）

#### Root `package.json`
新增根 `package.json`，声明 `workspaces: ["frontend", "web"]`，并提供短命令：
- `npm run frontend:dev` / `:ios` / `:android`
- `npm run web:dev` / `:build` / `:start`
- `npm run backend:dev`（调用 `backend/venv/bin/python run.py`）

#### Frontend 调整
- `frontend/package.json` 更名为 `@avant-regard/frontend`；`"web": "expo start --web"` 改名为 `"expo:web"`，避免与 monorepo 的 `web` workspace 命令冲突
- `frontend/tsconfig.json` 移除了不存在的 `packages/core` path 映射，保持 `@/*: ./src/*` 单一映射
- `frontend/scripts/check-setup.js` 重写，移除 `packages/core` 相关检查，新增 `.env` 存在性检查
- `.npmrc` 从 frontend 提升到根目录，让 `legacy-peer-deps=true` 对所有 workspaces 生效

#### Backend 调整
- 新增 `backend/scripts/`，容纳原根 `scripts/` 中的数据/数据库导入脚本
- 代码不变

#### Web 新项目
创建 Next.js 14 (App Router) + Tailwind，页面清单：
- `src/app/page.tsx` — 落地页：Hero、功能四宫格、Discover 预览 grid、CTA 段
- `src/app/download/page.tsx` — 下载引导页 + `SmartRedirect`（`?auto=1` 时按 UA 自动跳 App Store / Play Store）
- `src/app/discover/page.tsx` — 只读 Discover（调用后端 `GET /api/posts/feed`）
- `src/app/posts/[id]/page.tsx` — 帖子详情（图片 / 文案 / 单品信息 / 作者链接 / 评论点赞统计）
- `src/app/users/[id]/page.tsx` — 用户主页（头像 / bio / 粉丝数 / 发布瀑布）
- `src/app/not-found.tsx`, `src/app/error.tsx` — 404 / 错误边界
- `src/app/robots.ts`, `src/app/sitemap.ts` — SEO 基础
- `src/components/SiteHeader.tsx`, `SiteFooter.tsx`, `PostCard.tsx`, `DownloadCTAs.tsx`, `SmartRedirect.tsx` — UI 组件
- `src/lib/{config,types,api,format}.ts` — 运行时配置、类型镜像、只读 API 客户端（解包 `{ code, message, data }`）、格式化工具

设计令牌在 `tailwind.config.ts` 中镜像 `frontend/src/theme/index.ts`（同色阶黑白灰 + Playfair Display 衬线字体）。

### Design Principles
- **DRY / 镜像而非复制**：web 的类型与 API 客户端是 frontend 的"narrow mirror"，只保留只读所需字段；当未来需要真正复用业务 hook 时，可抽出 `packages/shared`
- **SRP**：workspace 边界清晰——frontend 负责原生体验，web 负责 SEO / 公开访问，backend 是唯一数据源
- **KISS**：web v1 全部是 server components，没有客户端状态；`SmartRedirect` 是唯一 `"use client"` 组件，只负责 UA 嗅探
- **Open/Closed**：新增页面（例如 `/brands/[id]`）时无需改动 layout / header；`web/src/lib/api.ts` 只需再加一个函数
- **Holistic**：stash 迁移时对 patch 做了路径重写（`a/src/` → `a/frontend/src/`），保证 30+ 未提交改动（FeedbackSheet、ShareContentPickerModal 等）无缝落在新结构下

### Verification
- `npm install` 从根部成功完成，workspaces 依赖正确链接
- `npm run web:build` 通过，生成 8 条 App Router 路由（首页 / download 静态化，posts/users 动态）
- `frontend/` 下 `./node_modules/.bin/expo --version` 正常，原有 TS 报错为迁移前遗留，不由本次改动引入

### Notes
- Next.js 14.2.18 有已知安全告警（2025-12 CVE），后续可升级到最新 14.2.x patch 或 15.x
- Frontend 的 `.npmrc` 已提升到根目录；之前在 workspace 内的 `.npmrc` 会被 npm 忽略

---

## 2026-04-17: Store Share Card — Drop Image Placeholder When Store Has No Image (买手店卡片无图时不占位)

### Summary
In `frontend/src/screens/Chat/components/MessageBubble.tsx`, the buyer-store (`store_card`) share message no longer renders a grey storefront-icon placeholder when the underlying store has no `imageUrl`. The card now collapses to a pure text card (title + city/country + rating + tags + footer), matching the post card's null-image idiom.

### Why
The placeholder added ~160pt of decorative grey space that carried no information and actively competed with the real content (store name, city, rating, tags). The post card path (`postCard.imageUrl && <OptimizedImage …/>`) already did the right thing by simply omitting the image node; the store card was the outlier.

### Key Changes (`frontend/src/screens/Chat/components/MessageBubble.tsx`)
- Replaced the `storeCard.imageUrl ? <OptimizedImage/> : <View placeholder>` ternary with a single `&&` conditional — no image ⇒ no image node.
- Removed the now-unused `storeCardStyles.placeholder` block (it only held `alignItems` / `justifyContent`; grep confirmed zero remaining references).

### Design Principles
- **KISS**: a missing image is best expressed by absence, not by a grey-box stand-in.
- **DRY**: store card now follows the same null-image idiom as the post card.
- **Holistic**: searched for other consumers of `storeCardStyles.placeholder` before deleting — none existed. Show (`秀场`) and brand (`品牌`) cards intentionally left unchanged: their placeholders still read as an explicit "media missing" signal for those domains; can revisit if the same request lands.

### Verification
- `ReadLints` clean on `MessageBubble.tsx`.

## 2026-04-13: Store Follow Button (关注店铺按钮)

### Feature Summary
Added a "关注店铺" (follow/favorite) heart button to store cards and bottom sheets across the map, list, and search screens. Created a reusable `useStoreFavorites` hook that batch-loads the user's favorited store IDs and provides optimistic toggle with rollback.

### Changes Made

**Reusable Hook**
- `src/hooks/useStoreFavorites.ts` — New hook: loads user's favorite store IDs (up to 500), provides `isFavorited(storeId)` check and `toggleFavorite(storeId)` with optimistic UI + rollback on error

**Modified Screens**
- `src/screens/StoreSearchScreen.tsx` — Added heart toggle button in each search result card header (between store name and open/closed badge)
- `src/screens/BuyerMapScreen.tsx` — Added heart toggle in the bottom horizontal card strip (action buttons area) and in the bottom sheet detail header (next to close button)
- `src/screens/StoreListScreen.tsx` — Added heart toggle in each list card header and in the bottom sheet detail header

## 2026-04-13: User Title System (头衔系统)

### Feature Summary
Implemented a complete user title/badge system allowing admins to assign titles to users, and users to select a primary title for display.

### Changes Made

**Database**
- `backend/app/db/migrations/031_add_user_titles.sql` — New `user_titles` table with unique-primary constraint

**Backend API**
- `backend/app/services/admin_service.py` — Title CRUD + batch title loading in user list
- `backend/app/api/routes/admin.py` — Admin endpoints: GET/POST titles per user, DELETE title
- `backend/app/api/routes/user.py` — User endpoints: list own titles, set/clear primary
- `backend/app/services/user_service.py` — `_get_primary_title()` helper; `primaryTitle` in UserInfo response
- `backend/app/schemas/user.py` — Added `primaryTitle` optional field to `UserInfo`
- `backend/app/services/chat_service.py` — Include `primary_title` in `_get_user_brief`
- `backend/app/schemas/chat.py` — Added `senderTitle` to `MessageResponse`
- `backend/app/api/routes/store_merchant.py` — Auto-assign shop title on merchant approval

**Frontend Services**
- `src/services/adminService.ts` — `getUserTitlesAdmin`, `addUserTitle`, `removeUserTitle`; updated `AdminUser` type
- `src/services/userInfoService.ts` — `UserTitle` type, `getUserTitles`, `setPrimaryTitle`, `clearPrimaryTitle`; `primaryTitle` on `UserInfo`
- `src/services/chatService.ts` — `senderTitle` on `Message`

**Frontend Screens**
- `src/screens/admin/UsersTab.tsx` — Title chips on user cards, title management modal
- `src/screens/SettingsScreen.tsx` — Added "我的头衔" entry in account section
- `src/screens/MyTitlesScreen.tsx` — New screen for viewing/selecting primary title
- `src/screens/Profile/index.tsx` — Display all titles section below followed brands
- `src/screens/Profile/hooks/useProfileData.ts` — Load user titles
- `src/screens/Profile/components/UserTitlesSection.tsx` — New component for title chips
- `src/screens/UserProfileScreen.tsx` — Display titles on other user's profile

**Frontend Components (Display)**
- `src/components/PostCard.tsx` — Show primary title badge next to author name
- `src/components/ForumPostCard.tsx` — Show primary title badge next to author name
- `src/components/PostDetail/types.ts` — `userTitle` field on Comment/CommentReply
- `src/components/PostDetail/CommentsSection.tsx` — Show title badge next to commenter name
- `src/components/PostDetail/hooks/useComments.ts` — Map `primaryTitle` to comment display
- `src/screens/Chat/components/MessageBubble.tsx` — Show sender title above chat bubble
- `src/screens/Discover/types.ts` — `title` field on author
- `src/screens/Discover/utils.ts` — Map `primaryTitle` to post author

**Navigation**
- `App.tsx` — Registered `MyTitles` screen

## 2026-04-13: Enrich Admin User Card (用户管理详情增强)

### Feature Summary
Enhanced the admin user management panel to display richer user information per card.

### Changes Made

**Backend**
- `backend/app/services/admin_service.py` — `get_users` now fetches: `bio`, `location`, `gender`, `age` from `user_info`; post count from `posts`; follower/following counts from `user_follows`; merchant info from `store_merchants`

**Frontend**
- `src/services/adminService.ts` — Extended `AdminUser` interface with `bio`, `location`, `gender`, `age`, `postCount`, `followerCount`, `followingCount`, `merchant`; added `AdminUserMerchant` interface
- `src/screens/admin/UsersTab.tsx` — User card now shows: Admin/商家 badges, stats row (帖子/粉丝/关注), bio, phone/email/location/gender+age/registration date/store info with icons

## 2026-04-13: Profile Store Activity Tab (个人主页买手店动态)

### Feature Summary
Added a "买手店" tab to the user's own profile page, displaying their buyer store activity: favorited stores, comments on stores, and store ratings. Each activity type is shown as a sub-tab with store details and navigation to the store detail page.

### Changes Made

**Backend — Schema**
- `backend/app/schemas/buyer_store.py` — Added `UserStoreActivityStore`, `UserFavoritedStore`, `UserStoreComment`, `UserStoreRatingItem`, `UserStoreActivity` Pydantic models

**Backend — Service**
- `backend/app/services/buyer_store_community_service.py` — Added `_get_store_lookup()` batch helper; `get_user_favorited_stores_with_details()`, `get_user_comments_with_store_info()`, `get_user_ratings_with_store_info()`, `get_user_store_activity()` methods

**Backend — API**
- `backend/app/api/routes/buyer_store.py` — Added `GET /api/buyer-stores/user/activity` (auth-required) returning combined favorites/comments/ratings

**Frontend — Service**
- `src/services/buyerStoreService.ts` — Added `UserStoreActivityStore`, `UserFavoritedStore`, `UserStoreCommentItem`, `UserStoreRatingItem`, `UserStoreActivity` types; `getUserStoreActivity()` function

**Frontend — Profile Types & Hook**
- `src/screens/Profile/types.ts` — Added `"storeActivity"` to `TabType`, added `StoreActivitySubTab` type
- `src/screens/Profile/hooks/useProfileData.ts` — Added `storeActivity`, `storeActivitySubTab`, `storeActivityLoading`, `storeActivityLoaded` state; `loadStoreActivity()` loader

**Frontend — UI**
- `src/screens/Profile/styles.ts` — Added `storeActivityStyles` stylesheet for activity cards
- `src/screens/Profile/components/PostsContent.tsx` — Added `StoreActivityContent` component with sub-tabs (收藏/评论/评分), star rating display, store image placeholders, date formatting
- `src/screens/Profile/index.tsx` — Wired "买手店" tab into tab bar, effects, refresh, and `PostsContent` props

## 2026-04-13: Store Search Screen (店铺搜索独立页面)

### Feature Summary
Extracted the store search from BuyerMapScreen into a dedicated StoreSearchScreen, matching the DiscoverHeader search bar design pattern (pressable fake input navigating to a full search screen).

### Changes Made

**New Screen**
- `src/screens/StoreSearchScreen.tsx` — Full-screen store search with debounced input, paginated results via `getStoresPaginated`, store cards with style tags/brands/status, load-more and empty states

**Modified**
- `src/screens/BuyerMapScreen.tsx` — Replaced `TextInput` search bar with a pressable placeholder matching DiscoverHeader style; removed local `searchQuery` state and debounce logic; navigates to `StoreSearch` screen on press
- `App.tsx` — Imported `StoreSearchScreen` and registered `StoreSearch` route in the stack navigator

## 2026-04-13: Fix 502 & Admin N+1 Query (后端修复)

### Fix Summary
1. **Pinned dependency versions** in `requirements.txt` — unpinned `supabase>=2.16.0` and `httpx` caused version conflicts with pinned `pydantic==2.6.1` during Docker build, leading to immediate crash (empty runtime logs, 502 on Zeabur).
2. **Eliminated N+1 queries** in `admin_service.get_users()` — replaced per-user count queries (60 DB round-trips per page) with 3 batch queries + Python-side aggregation.

### Changes Made

**Backend**
- `backend/requirements.txt` — Locked all versions to match working local venv: `fastapi==0.128.0`, `pydantic==2.12.5`, `pydantic-settings==2.12.0`, `uvicorn==0.40.0`, `supabase==2.27.1`, `httpx==0.28.1`
- `backend/app/services/admin_service.py` — Replaced N+1 loop queries (`for uid in user_ids: count posts/followers/following`) with batch `.in_("user_id", user_ids)` queries and client-side counting
