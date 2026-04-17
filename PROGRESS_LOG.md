# Progress Log

## 2026-04-17: Chat Input — Hide `+` While Writing, Remove Cancel Button, Tap-Outside to Exit (写消息时的极简交互)

### Summary
在消息撰写态（`isWriting === true`）下：
1. 输入框左侧的 `+` 按钮隐藏，避免和正在打字的焦点竞争；
2. 去掉"取消"按钮——`取消` + `发送` 原来是左右一行，现在只剩右对齐的 `发送`；
3. 整个消息列表区域覆盖一层透明 `Pressable`，点击任意非输入框区域即退出撰写态（同旧"取消"行为：清空草稿 + 收起 keyboard + 折叠输入框）。

### Why
原来"加号 + 取消"同时占据底部栏，写一条消息要盯着 4 个控件（+ / 输入框 / 取消 / 发送），视觉噪音大；且"取消"按钮在 iOS 风格里很少见，多数用户习惯的是"点外面就收起来"。这次把交互收敛到"专心写，写完发；不想发就点别处"。

### Key Changes

- `frontend/src/screens/Chat/components/MessageInput.tsx`
  - `plusButton` 现在只在非撰写态才渲染（`!isWriting && onToggleSharePicker`），撰写时不占位。
  - 撰写态的底部控件行从 `[取消 | 发送]`（`inputActions: space-between`）改为 `[      发送]`（`inputActionsEnd: flex-end`）。
  - 从 Props 中移除 `onCancel`：该职责已迁移到 ChatScreen 的 tap-outside 覆盖层，MessageInput 不再需要了解"取消"。
- `frontend/src/screens/Chat/styles.ts`
  - 删除 `inputActions` / `cancelButton` / `cancelButtonText` 三个不再被引用的样式（Grep 确认无遗留消费者）。
  - 新增 `inputActionsEnd` 右对齐样式。
- `frontend/src/screens/Chat/index.tsx`
  - 新增 `exitWriting` 单点函数：`setIsWriting(false) + setInputText("") + inputRef.current?.blur()`。作为所有"退出撰写"路径的唯一出口（DRY）。
  - `FlatList` 外再包一层 `View style={flex:1}`；在它内部、`MessageInput` 外部挂一个 `isWriting` 条件下才渲染的 `Pressable style={StyleSheet.absoluteFillObject}`，点击即触发 `exitWriting`。
  - FlatList 加 `keyboardShouldPersistTaps="handled"`，让点击结果（如气泡的长按）仍可正常响应。
  - `handleToggleSharePicker` 先调用 `exitWriting()` 再切换分享面板状态——打开 `+` 菜单时自动退出撰写，避免 keyboard 和分享面板同时出现。
  - 移除向 `MessageInput` 传递的 `onCancel` prop。

### Design Principles
- **KISS**：把"退出撰写"从一颗显式按钮变成整个外部区域的隐式行为，底部只剩一颗 `发送`——视觉和心智负担最小化。
- **DRY**：`exitWriting` 作为单点函数同时服务 tap-outside overlay 和 `+` 按钮切换路径；避免"收起 keyboard + 清空 + blur"这三步被写两遍。
- **SOLID（SRP）**：MessageInput 不再关心"取消"是什么意思——它只负责渲染输入、把 `onStartWriting / onSend` 抛出去；"退出撰写"由容器组件 ChatScreen 决定如何触发。
- **Holistic**：检查了所有 `cancelButton` / `inputActions` 引用，确认这些样式删除安全；`+` 按钮的行为（开 sharePicker 时自动 exitWriting）被同步更新，保证打开分享面板和撰写消息这两种模式永远互斥。

### Verification
- `ReadLints` 在 `MessageInput.tsx`、`styles.ts`、`Chat/index.tsx` 全部 clean。
- 手动 Trace：撰写 → 点消息列表任意位置 → overlay onPress 触发 → exitWriting → `isWriting=false` → overlay 卸载 → input 回到折叠态。

---

## 2026-04-17: In-Chat Share Card Picker (聊天内「+」分享多类型卡片)

### Summary
在聊天输入框左侧新增 `+` 按钮，点击后在输入框下方展开一排类别图标（帖子 / 买手店 / 品牌 / 秀场 / 用户）。点击任一类别会弹出一个 60% 屏高的底部模态，列出该类别下可分享的具体内容，选中即直接作为卡片消息发送给当前对话方。

### Why
对话中除了文字以外，分享「我最近看过的帖子/店/品牌/秀/某个用户」是非常高频的动作。此前虽然 `PostDetail` / `StoreDetail` 等页面通过 `ShareToChatModal` 能把单张卡片「推」进 DM，但用户在聊天里无法「拉」——想分享必须先跳回到内容所在页。现在把这条反向路径补齐。

### Design
- **轻量两段式**：`+` → 行内 `SharePickerSheet`（5 个圆角图标按钮，横排，无额外弹层）→ 选定类别后才推上 60% 的 `ShareContentPickerModal`。避免一次性把 5 类内容全塞进一个大模态。
- **帖子有 3 个 tab**：`我的发布` / `我的收藏` / `我的喜欢`，默认"我的发布"。一旦开始搜索关键词，tab 行隐藏、直接走全局 `searchPosts`（同时覆盖笔记和论坛帖子）。
- **其他类别**：默认展示浏览列表（store 全量 / brand / show 分页首页 / user 走 `getFollowingUsers` 的"关注中"列表），搜索时切到各自的 `searchXxx` API。
- **用户卡片（user_card）全新加入**：新增 `UserSharePayload`、builder、解析器、气泡渲染（大头像 + 昵称 + 坐标+primaryTitle + bio）、点击跳 `UserProfile`。

### Key Changes

**新增文件**
- `frontend/src/screens/Chat/components/SharePickerSheet.tsx` — 行内类别选择面板（5 个彩色图标按钮）。
- `frontend/src/screens/Chat/components/ShareContentPickerModal.tsx` — 60% 屏高底部模态，支持搜索 + 帖子三 tab，统一的 `row / thumb / rowInfo` 列表项样式。对外暴露 `SharePayload` 判别联合类型（`post_card | store_card | brand_card | show_card | user_card`）。

**修改文件**
- `frontend/src/components/ShareToChatModal.tsx`
  - 新增 `UserSharePayload` + `buildUserSharePayload`（支持 `UserInfo` 与 `FollowingUser` 两种上游结构——`avatarUrl` / `avatar` 字段归一化）。
  - 新增 `buildPostSharePayloadFromService(post: ServicePost)`，让 picker 可以直接从 `postService` 的原始 shape 构建 payload，无需经过 `components/PostCard` 的 UI-shape 再转一次（DRY：share payload 的 schema 仍只写在这个文件里）。
- `frontend/src/screens/Chat/components/MessageInput.tsx`
  - 新增可选 `sharePickerOpen` + `onToggleSharePicker`，在输入框左侧渲染 `+`/`×` 切换按钮（背景在激活态变黑）。
  - 折叠/展开两种模式都用同一套 `inputRow` + `plusButton` 布局，保持行为一致。
- `frontend/src/screens/Chat/styles.ts`
  - 新增 `inputRow` / `inputRowFlex` / `plusButton` / `plusButtonActive` 四条样式。
- `frontend/src/screens/Chat/index.tsx`
  - 新增 `sharePickerOpen` + `shareCategory` 两条状态。
  - 抽取 `sendPayload(content, messageType)` 作为所有发送路径（文字、卡片）的唯一出口——移除之前 `require("../../services/chatService")` 的懒加载 hack，统一使用顶层 `sendMessageREST` import。
  - 打开输入时自动关闭分享面板，反之亦然；`sendRestricted` 时分享面板也不显示。
  - 分享命中 `sendRestricted`（第一条未回复前只能发一条）时直接忽略，保留原有会话节流策略。
- `frontend/src/screens/Chat/components/MessageBubble.tsx`
  - 新增 `tryParseUserCard` + `user_card` 渲染分支（置于最前）：大头像 + 名称 + 「位置 · 主职业」 + bio，点击 `navigate("UserProfile", { userId })`。
  - 新增 `userCardStyles`，样式风格与现有 store/brand/show/post 卡片保持一致（同色 footer + 查看箭头）。

### Design Principles
- **KISS**：行内 sheet 只负责"选类别"，模态只负责"选内容"；双职责分离，代码各自短小，没有复杂的 switch-based "super modal"。
- **DRY**：`SharePayload` 判别联合类型放在 picker，builder 放在 `ShareToChatModal`；`sendPayload(content, type)` 成为聊天屏唯一的发送出口；`user_card` 走与 store/brand/show 相同的 null-image / footer 约定。
- **SOLID**：`SharePickerSheet` 只认 `ShareCategory`；`ShareContentPickerModal` 只认 `category` + 返回 `SharePayload`；发送侧完全不关心它是哪类卡片——加第六类（例如 Community）时无需修改 `Chat/index.tsx` 的发送逻辑。
- **Holistic**：所有下游变更同步落地——`MessageBubble` 支持新 `user_card` 解析 + 渲染 + 点击跳转；`chatService.sendMessage` 已支持任意 `messageType` 参数；`UserProfile` 路由参数已验证是 `userId`。

### Verification
- `ReadLints` 扫过全部改动文件，全部 clean。
- 发送路径：文字消息走 `sendPayload(text, "text")`、卡片消息走 `sendPayload(JSON.stringify(payload), messageType)`，二者共用同一条 WS / REST 分发。

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

---

## 2026-04-17: ProfileScreen + UserProfileScreen Sticky Header Flicker Fix (post-monorepo 复发修复)

### Bug Summary
用户反馈"吸顶 Header 半透明卡住"的视觉 bug 依然经常出现（"我"tab 截图可见）。

### Root Cause
此前针对 `UserProfileScreen` 做过的 `withTiming` 修复是在旧仓库结构（根路径 `src/`）上改的。Monorepo 重构把代码迁到 `frontend/src/` 之后，修复丢失；同时**自己的主页** `frontend/src/screens/Profile/index.tsx` 这个独立文件从一开始就没修过，所以 bug 也同样存在。两个文件都在用旧的 20px 滚动驱动插值方案：

```ts
// 旧方案（两个文件相同）：opacity 直接跟着 scrollY 在 [threshold-20, threshold] 插值
const collapsedHeaderAnimatedStyle = useAnimatedStyle(() => ({
  opacity: interpolate(scrollY.value, [headerFadeThreshold - 20, headerFadeThreshold], [0, 1], Extrapolation.CLAMP),
}));
```

快速滑动 / 回弹时 scrollY 可能停在那 20px 中间，opacity 就被锁在 0.3–0.7，白色半透明条覆盖在封面上。

### Fix
在两个文件里统一替换为"布尔状态 + `withTiming` 时间动画"，并且把每帧 `runOnJS(setIsCollapsed)` 改为"仅在布尔翻转时"才调用：

- `frontend/src/screens/Profile/index.tsx`
- `frontend/src/screens/UserProfileScreen.tsx`

共同变更：
1. 新增 reanimated 导入：`useDerivedValue`, `withTiming`, `Easing`。
2. 新增 `lastCollapsedShared = useSharedValue(false)`，`scrollHandler` 仅在 `collapsed !== lastCollapsedShared.value` 时才 `runOnJS(updateCollapsedState)`。
3. 用 `headerProgress = useDerivedValue(() => withTiming(scrollY.value > threshold ? 1 : 0, { duration: 180, easing: Easing.out(Easing.quad) }))` 驱动：
   - `collapsedHeaderAnimatedStyle` → `opacity: headerProgress.value`
   - `topActionsAnimatedStyle` → `opacity: 1 - headerProgress.value`（完全反向，共享同一进度，杜绝错位）

`withTiming` 的特性保证 opacity **永远在 0 或 1 上收敛**，哪怕用户在过渡过程中停下或反方向滑动，动画也会平滑收束到正确的终值，不会再出现 "冻结" 在半透明中间值的情况。

### Verification
- Lint 两个文件均通过。
- 视觉：快速上下甩动封面区域，不再出现图一那种残留的半透明白带；白色吸顶 Header 总是干净地出现或消失。

---

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

## 2026-04-17: Web Fashion Redesign & Animations (网站时尚化改造 + 动画)

### Feature Summary
全站时尚化视觉升级：引入 Inter 字体与 Playfair 形成衬线/无衬线对比，新增品牌走马灯、滚动触发入场动画、PostCard hover overlay 揭示效果及 Hero 分段入场动效，整体视觉更接近高端时装编辑类网站。

### Changes Made

**New Components**
- `web/src/components/Marquee.tsx` — 客户端品牌走马灯：15 个先锋设计师品牌无缝滚动，通过 Tailwind `animate-marquee` 驱动
- `web/src/components/AnimateIn.tsx` — 客户端滚动触发动画容器：使用 IntersectionObserver，支持 delay 属性实现交错动效

**Design System**
- `web/tailwind.config.ts` — 新增 `marquee`/`scaleIn`/`lineExpand`/`slideUpSm` keyframes，优化 `text-hero`/`text-display` 字阶，调整 shadow 层次，添加 `transitionDuration` 扩展
- `web/src/app/globals.css` — 切换 body 默认字体为 Inter，新增 `.link-underline`（scale-x 动画下划线）、动画延迟工具类（`.delay-75` ~ `.delay-700`），优化 `.btn-primary`/`.btn-secondary` 微交互
- `web/src/app/layout.tsx` — 引入 Inter 字体，CSS variable `--font-inter`，与 `--font-playfair` 并存

**Pages & Components**
- `web/src/app/page.tsx` — Hero 五段分层入场动画（chip→标题→正文→CTA→副文案），Hero 手机模型优化；Features 卡片新增大号装饰数字，AnimateIn 交错展现；新增 Marquee 分隔带；posts 网格交错 AnimateIn
- `web/src/components/SiteHeader.tsx` — Nav 链接换用 `.link-underline` 动画效果，Logo 简化过渡，高度收紧至 `h-14`
- `web/src/components/PostCard.tsx` — hover 时图片放大 `scale-[1.06]`，渐变 overlay 从下方揭示标题/用户名，type badge hover 渐隐
- `web/src/components/SiteFooter.tsx` — 更 editorial 的三列布局，底栏 Logo 用衬线斜体，去掉 `bg-ink-100` 背景改为纯白
- `web/src/app/discover/page.tsx` — 页头及所有卡片用 AnimateIn 交错加载，空状态样式优化

## 2026-04-17: Image Loading Optimization (图片加载优化)

### Problem
所有 `<Image>` 组件均设置了 `unoptimized`，导致 Next.js 图片优化管道完全失效：无 WebP/AVIF 转换、无按需缩放、无 CDN 缓存，用户直接下载原始大图。

### Optimizations Applied

**`web/next.config.js`**
- 添加 `formats: ["image/avif", "image/webp"]`：优先输出 AVIF（比 JPEG 小 40-50%），回退 WebP
- 添加 `minimumCacheTTL: 86400`：优化后的图片在 CDN 边缘缓存 24 小时

**`web/src/components/FadeImage.tsx`（新建）**
- 客户端 fade-in 图片组件：图片加载前保持 `opacity-0`，容器的 `bg-ink-200` 作为 skeleton 占位；图片解码完成后 500ms 渐入，避免布局闪烁

**移除 `unoptimized` 标志（5 处）+ 修正 sizes + 设置 quality**
- `PostCard.tsx` — 使用 `FadeImage`，`quality={85}`（时装摄影需保留细节），`sizes` 精确到 4 个断点
- `posts/[id]/page.tsx` — 头像用 `quality={75}`，内容大图用 `FadeImage` + `quality={90}`，sizes 收紧为 `720px`
- `users/[id]/page.tsx` — 封面图用 `FadeImage` + `quality={85}`，头像 `quality={80}` + 移除 `unoptimized`
- `page.tsx` — HeroMockup 缩略图移除 `unoptimized`，`quality={75}`

## 2026-04-17: App Design Alignment (网站与 App 设计语言对齐)

### Research
深入研究 `frontend/src/theme/index.ts`、`components/ui/button.tsx`、`PostCard.tsx`、`CenteredTabBar.tsx`、`DiscoverHeader.tsx` 等，提取 app 的核心设计 token。

### Key Design Differences Found & Fixed

| 维度 | App 原则 | 修复前 | 修复后 |
|------|---------|--------|--------|
| 主字体 | Playfair Display 覆盖所有文字 | body = Inter（无衬线） | body = Playfair；Inter 保留为 `.font-label` 工具类 |
| 按钮圆角 | `borderRadius: 8px`（矩形软圆角） | `rounded-full`（胶囊形） | `rounded`（8px） |
| 卡片圆角 | PostCard 8px | `rounded-xl`（16px） | `rounded`（8px） |
| 阴影 | `shadowOpacity: 0.05`（极轻） | 偏重 | 精确对齐 app `sm/md/lg` 三档 |
| 分隔线 | 0.5–1px `#E0E0E0` | 偏粗 | `border-black/[0.06]` |
| Nav 指示器 | 24×2px 居中短黑条 | 全宽下划线 | 24px 宽居中短条 |

### Files Changed
- `web/tailwind.config.ts` — 色阶精确对齐 theme.colors，阴影精确对齐 theme.shadows
- `web/src/app/globals.css` — body 改为 Playfair；按钮改为矩形 8px；hairline 对齐
- `web/src/app/page.tsx` — HeroMockup 添加 app 风格搜索栏；Features 卡片 app 化
- `web/src/components/SiteHeader.tsx` — nav 使用 app CenteredTabBar 指示器风格
- `web/src/components/PostCard.tsx` — 卡片 8px 圆角、极轻阴影、bg-ink-100 骨架色
- `web/src/components/DownloadCTAs.tsx` — 按钮改为矩形 8px
- `web/src/components/SiteFooter.tsx` — 分隔线对齐，导航标题用 font-label

## 2026-04-17: Dark Mode (全站深色模式)

### Implementation
- **`next-themes`**：安装并集成，支持 light / dark / system 三种偏好，`localStorage` 持久化，SSR 安全（`suppressHydrationWarning`）
- **`tailwind.config.ts`**：`darkMode: "class"` 启用 class 控制
- **CSS 变量调色板**（`globals.css`）：

| Token | Light | Dark |
|-------|-------|------|
| `--canvas` | `#ffffff` | `#0a0a0a` |
| `--canvas-soft` | `#f9f9f9` | `#111111` |
| `--canvas-raised` | `#f0f0f0` | `#1a1a1a` |
| `--ink` | `#000000` | `#ededed` |
| `--border` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.08)` |

### New Files
- `web/src/components/ThemeToggle.tsx` — 客户端 sun/moon 图标切换按钮，挂载后解决 hydration mismatch

### Modified Files
- `web/src/app/layout.tsx` — `<ThemeProvider>` 包裹，`suppressHydrationWarning`，`themeColor` 响应系统主题
- `web/src/app/globals.css` — 所有组件类（`.btn-primary/.btn-secondary/.chip/.link-muted/.link-underline/.hairline`）添加 `dark:` 变体；`body` 颜色改用 CSS 变量；`transition: background-color/color` 平滑切换
- `web/src/components/SiteHeader.tsx` — header 添加 dark 背景/边框，嵌入 ThemeToggle 在下载按钮左侧
- `web/src/components/PostCard.tsx` — 卡片 dark bg `#1a1a1a`，骨架色 `#252525`，文字颜色对齐
- `web/src/components/SiteFooter.tsx` — footer dark bg/border/text
- `web/src/components/DownloadCTAs.tsx` — dark mode 下 btn-primary 自动反转（白底黑字）
- `web/src/app/page.tsx` — 全页区块 dark: 覆盖；HeroMockup 模拟屏支持深色
- `web/src/app/discover/page.tsx` — 页面背景、空状态、分隔线 dark 处理
- `web/src/app/posts/[id]/page.tsx` — 文章页完整 dark 支持
- `web/src/app/users/[id]/page.tsx` — 用户主页完整 dark 支持




