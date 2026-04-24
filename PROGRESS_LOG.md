# Progress Log

## 2026-04-24: 首页推荐瀑布流首屏渲染性能优化

- `TabContent.tsx`：未激活且未加载的 Tab 不再渲染全屏 GIF loader，改为当前 Tab 才显示轻量占位；推荐瀑布流增加 `estimatedListSize` / `drawDistance`，减少首屏测量和预渲染压力。
- `PostCard.tsx` / `PostCoverMedia.tsx` / `OptimizedImage.tsx`：推荐流封面改用 `ImageSize.THUMBNAIL`，关闭封面 placeholder/spinner 与 transition，避免首屏每张图 `onLoad` 都触发 JS 状态更新。
- `TabContent.tsx`：重复回放帖子使用稳定 `renderKey`，避免刷新插入新内容时因 `id-index` key 变化导致老卡片大面积重挂载。
- `useDiscoverData.ts`：推荐 Tab 首屏初始化和刷新不再等待 `fetchBanners()`，banner 仍由论坛 Tab 加载，减少首页启动阶段无关网络等待。

---

## 2026-04-24: 首页推荐 Tab 支持重按/双击刷新并回到顶部

- `Discover/index.tsx`：为当前已选中的「推荐」Tab 重按增加刷新逻辑，并将双击窗口放宽到 700ms；触发时立即发送一次滚顶信号，刷新结束后再校准到顶部。
- `TabContent.tsx`：为 FlatList / MasonryFlashList 增加列表 ref 和 `scrollToTopSignal`，支持父组件驱动当前列表回到顶部。

---

## 2026-04-24: 首页推荐流到底后循环已展示帖子

- `useFeedRecommendation.ts`：推荐流在后端长尾分页耗尽后进入本地 replay 模式，按页追加本次会话已经展示过的内容，避免 `hasMore=false` 后停止加载。
- `TabContent.tsx`：移除瀑布流底部 footer /「已经没有更多的帖子了」提示，并为推荐流重复帖子使用带 index 的 key，支持同一帖子再次出现在列表尾部。

---

## 2026-04-24: ShareToChatModal — 增加微信 / 朋友圈 / 微博分享

- `shareService.ts`：新增 `shareToWeChatGeneric` / `shareToWeiboGeneric`，接收通用 `ShareContent`（不限于 Post），内部检测 app 安装状态后 fallback 到系统分享。
- `ShareToChatModal.tsx`：社交平台行从 2 个按钮扩展为 5 个（微信 → 朋友圈 → 微博 → 复制链接 → 更多），提取共享的 `buildShareContent` 回调避免重复构建。

---

## 2026-04-24: ShareToChatModal — 增加社交媒体分享（复制链接 / 系统分享）

### Context
`ShareToChatModal` 原本只能将内容分享给聊天好友，不支持外部平台分享。用户需要一键复制链接或调用系统分享面板。

### What
- **`shareService.ts`**：
  - 新增 `ShareContentType` 类型（post / store / brand / show / user）和 `CONTENT_TYPE_PATH` 映射，统一生成 `avantregard.com` 域名的分享链接。
  - 新增 `generateShareUrl(contentType, id)`：按内容类型拼接对应的 web 路由。
  - 新增 `buildGenericShareContent()`、`copyShareUrl()`、`shareWithSystemGeneric()`，支持所有内容类型的复制链接和系统原生分享。
  - 原有 `generateWebShareUrl` / `generateUniversalLink` 内部改为复用 `generateShareUrl`。
- **`ShareToChatModal.tsx`**：
  - `SharePreview` 接口新增 `contentType` / `contentId`，`resolvePreview()` 为每种内容类型填充对应值。
  - 在预览卡片下方、聊天列表上方新增「复制链接」和「更多」两个社交分享按钮，以水平 ScrollView 展示。
  - 两个按钮分别调用 `copyShareUrl` 和 `shareWithSystemGeneric`。

### URL 规则
| 类型 | 示例 URL |
|------|----------|
| Post | `https://avantregard.com/posts/{id}` |
| Store | `https://avantregard.com/stores/{id}` |
| Brand | `https://avantregard.com/archive/brands/{id}` |
| Show | `https://avantregard.com/archive/shows/{id}` |
| User | `https://avantregard.com/users/{id}` |

### Files changed
- `frontend/src/services/shareService.ts`
- `frontend/src/components/ShareToChatModal.tsx`

---

## 2026-04-24: 用户资料分享入口与 ShareModal「更多」使用 share-outline

- `UserProfileScreen`：他人资料页打开「分享到聊天」的 Header 按钮由 `ellipsis-horizontal` 改为 `share-outline`（与 `setShowShareToChat` 行为一致）。
- `ShareModal`：平台列表里「更多」一项的图标改为 `share-outline`，与站内其他分享入口一致。

## 2026-04-24: Web · PostInteractionBar 评论行使用 lucide 图标替代 emoji

- `web/src/components/post/PostInteractionBar.tsx`：评论数前的 💬 改为 `MessageCircle`（`lucide-react`），与站内 admin 等处的图标栈一致，并加 `inline-flex`/`gap` 与 `aria-hidden` 以兼顾对齐与可访问性。

## 2026-04-22: FpsMonitor — 移除 `__DEV__` 守卫，使 TestFlight 构建也能显示

### Context
`FpsMonitor` 组件在第一行就通过 `if (!__DEV__) return null` 拦截，导致所有 production build（包括 TestFlight）完全不渲染 HUD。用户在真机上无法观察帧率。

### What
- 移除 `__DEV__` 守卫，FpsMonitor 现在在所有环境（dev / TestFlight / production）均可显示。
- 更新文件顶部 JSDoc，反映不再是 dev-only。

### Files changed
- `frontend/src/components/FpsMonitor.tsx`

---

## 2026-04-22: Interaction · 消息页加载修复（双重请求 + 登出残留 + 计算浪费）

### Context
上一轮把 `MessagesContent` 的首屏从"逐条弹出"改为"loading → 整体渲染"，引入了 store 层的 `isConversationsInitialLoaded` / `isInitialLoaded` gate。

复查发现三个问题仍存在：

1. **双重请求**：`useEffect`（首次加载）和 `useFocusEffect`（获得焦点刷新）**同时存在**，且 `useFocusEffect` 的依赖里包含 `isInitialLoaded`——当首次加载完成后这个依赖翻转，useFocusEffect 重新触发，导致同一帧内发出 4 个 API 请求（2 组 × 2 个 store）。
2. **登出后旧数据残留**：`chatStore` 没有 `reset()` 方法。用户登出后 `isConversationsInitialLoaded` 仍为 `true`，换号登录时 gate 不生效，直接渲染上一个用户的会话列表，直到后台刷新回来才覆盖。`App.tsx` 只 reset 了 `notificationStore` 而没有 reset `chatStore`。
3. **loading 阶段的无用计算**：`sortedConversations` / `strangerConversations` / `regularConversations` 在 gate (`if (!isInitialLoaded)`) 之前计算，loading 阶段对空数组做排序和 filter 完全是浪费。

### What

**`MessagesContent.tsx`**
- 移除初次加载的 `useEffect`（含 `Promise.all`），只留 `useFocusEffect` 一个入口统一处理首次和后续焦点加载。`useFocusEffect` 不依赖 `isInitialLoaded`，避免 flag 翻转导致的二次触发。
- 排序 / 筛选逻辑移到 `if (!isInitialLoaded)` gate 之后，loading 阶段不做无用计算。
- `renderItem` 从 `useCallback` 提升为内联 render function（hook 必须在所有条件分支之前调用，但排序 / 筛选已挪到 gate 后，不再需要 `useCallback` 包裹）。

**`chatStore.ts`**
- 新增 `reset()` action：先调 `disconnectWebSocket()` 清理 WS，再把所有状态重置为初始值（包括 `isConversationsInitialLoaded: false`）。

**`App.tsx`**
- 在 `isAuthenticated` 变 `false` 的分支里，除已有的 `resetNotifications()` 外新增 `resetChat()`，确保两个 store 在登出时同步归零。

### Why (DRY / KISS / SOLID / Holistic)
- **KISS**：一个 `useFocusEffect` 管首次 + 后续，移除多余的 `useEffect`，依赖链更短、不用思考两个 effect 的交互时序。
- **Single Source of Truth**：`reset()` 保证"未登录 = 无数据 = gate 显示 loading"三者一致，不留孤立残态。
- **DRY**：`chatStore.reset()` 与已有的 `notificationStore.reset()` 结构对齐。
- **Holistic**：登出路径（`SettingsScreen` 手动退出 + token 过期被踢）都经过 `authStore.logout()` → `App.tsx` 检测到 `isAuthenticated=false` → 两个 store 同时 reset，无遗漏。

### Files
- `frontend/src/screens/Interaction/components/MessagesContent.tsx`
- `frontend/src/store/chatStore.ts`
- `frontend/App.tsx`
- `PROGRESS_LOG.md`

---

## 2026-04-22: Interaction · 消息页首次加载统一 loading（消除条目逐个弹出 / "暂无对话"闪现）

### Context
互动 tab 的 `MessagesContent` 打开时会并发请求 `loadConversations()` 和 `loadNotifications()`，但渲染逻辑没有"首次加载完成"这一层 gate：
- 系统消息 / 互动消息入口行来自 `notificationStore.notifications`，数据没回就是空；
- 陌生人消息 / 正式会话列表来自 `chatStore.conversations`，同样为空；
- 两条链路各自到达 → 条目一条条"弹"出来，空态时直接给用户一个"暂无对话"，给人错觉：我的会话都没了。

原来的 `didInitialFetchRef` 只是在组件 local 用来跳过 `useFocusEffect` 的第二次拉取，它既不触发重渲染、也不跨 mount 生效，所以对 UI 体感毫无帮助。

### What
把"首次加载完成"提升到 store 层，让两侧状态都 ready 之后再整体渲染：

**Store**
- `chatStore` 新增 `isConversationsInitialLoaded: boolean`，在 `loadConversations()` 的 `finally` 里置 `true`（和 `notificationStore.isInitialLoaded` 对齐）。
- 因此即便网络失败，flag 也会翻到 `true`，页面不会永远转圈。

**UI**
- `MessagesContent` 订阅两个 store 的 init flag，组合出 `isInitialLoaded`：
  - `false` → 渲染居中 `ActivityIndicator`；
  - `true` → 一次性渲染 `RecentAvatars` / `SystemEntry` / `ActivityEntry` / `StrangerEntry` / `FlatList`，不再有条目逐个弹出。
- 移除已失效的 `didInitialFetchRef`（职责被 store flag 取代）。

### Why (DRY / KISS / SOLID / Holistic)
- **Single Source of Truth**：加载完成状态落在 store 里，所有 mount / 任意消费方看到的都是同一份真值，彻底解决"组件卸载后 ref 丢了，重进又闪一次 loading"的老问题。
- **DRY**：对齐 `notificationStore.isInitialLoaded` 已有的命名和语义，不发明新概念。
- **KISS**：`isInitialLoaded = A && B`，没有新增 reducer、没有新加 context。
- **SOLID · SRP**：loading gate 只负责"首帧是否显示骨架"，加载本身仍由 store action 负责，组件不重复实现错误处理（store 已经 `console.error`）。
- **Holistic**：`onRefresh`（下拉刷新）、`useFocusEffect`（回到页面刷新）、WebSocket 推送（实时更新）三条路径都不受 gate 影响，只在"首次打开，数据全无"时显示 loading，不回归被刷新遮挡的体验。

### Files
- `frontend/src/store/chatStore.ts`
- `frontend/src/screens/Interaction/components/MessagesContent.tsx`
- `PROGRESS_LOG.md`

---

## 2026-04-22: Admin · 维护模式全链路接入（后台开关 + 中间件 503 + 前端轮询 + 自定义文案）

### Context
`frontend/src/store/maintenanceStore.ts` 早期只实现了被动维护提示：`fetch` 被猴子补丁成收到 `502` 就切到维护态、30 秒后自动复位。这导致两个问题：

1. **被动触发**：只有用户真的点坏接口才会显示维护提示，管理员无法主动告知全站"我正在发版"。
2. **无配置面**：没有后台开关、没有自定义文案，用户看到的永远是写死的一行字。
3. **恢复靠"猜"**：`setTimeout 30s` 自动关闭遮罩，但真实恢复时间谁都不知道，UI 可能比后端更早"宣布恢复"。

### What
跨层打通管理员 → 后端 → 中间件 → 前端 overlay 的完整链路：

**Backend**
- 新增 `app/services/maintenance_service.py`：基于已有 `app_config` 表（`key=maintenance_mode`）做 get/set，容错到默认配置；提供 `is_enabled()` 供中间件调用。
- `app/api/routes/admin.py` 新增 `GET /api/admin/maintenance`、`PUT /api/admin/maintenance`（走现有 `get_current_admin_user` 依赖）。
- 新增 `app/api/routes/maintenance.py`：公开 `GET /api/maintenance/status`，无需鉴权，供 App 轮询。
- `app/main.py` 注册 `maintenance_router`，并挂一个 HTTP middleware：维护开启时对非白名单路径统一返回 `503 {code:503, message, data:{maintenance:true}}`；白名单 = `/api/auth`、`/api/admin`、`/api/maintenance`、`/health`、`/docs`、`/redoc`、`/openapi.json`、`/` + 所有 `OPTIONS` 预检。

**Frontend**
- 重写 `src/store/maintenanceStore.ts`：
  - State 新增 `message` 字段，统一 `setStatus(isDown, message?)`。
  - 保留 `fetch` 补丁：收到 `502/503` 时读后端下发的 `message` 立即进入维护态。
  - 新增 `startMaintenancePolling()` / `stopMaintenancePolling()`，以 20s 周期调 `/api/maintenance/status`，以**后端配置**作为恢复的唯一来源，不再依赖计时器自解封。
- `App.tsx` 在 `appIsReady` 后启动一次轮询，卸载时停止，保证单例。
- `components/MaintenanceOverlay.tsx` 从 store 读 `message` 并展示，默认文案作为兜底。
- `services/adminService.ts` 新增 `getMaintenanceConfig` / `updateMaintenanceConfig` + 类型 `MaintenanceConfig`。
- 新增 `screens/admin/MaintenanceTab.tsx`：开关 + 500 字上限的多行文案输入 + 恢复默认 + 保存，保存成功后直接把新配置写回本地 store，当前管理员设备立即看到效果，不用等轮询。
- `screens/admin/AdminScreen.tsx` 注册 `maintenance` tab（"维护模式"）。

### Why (DRY / KISS / SOLID / Holistic)
- **Single Source of Truth**：维护状态只存在于后端 `app_config.maintenance_mode` 一处；前端 overlay、中间件、管理员面板都派生于它。`setTimeout` 自解封被移除，杜绝"前端比后端更早宣布恢复"。
- **SOLID · OCP**：沿用已有 `app_config` 键值对模式（`recommend_config`、`cs_auto_reply`、`curated_feed_ids` 已经在用），不新建表、不改 schema，扩展而非修改。
- **DRY**：`MaintenanceConfig` 类型在 service / admin route / 前端 `adminService` 一致；overlay 文案由 store 下发一次，不在多处硬编码。
- **KISS**：中间件仅做"白名单 + is_enabled"判断，不耦合业务；前端保留轻量 `fetch` 补丁作为"被动 tripwire"，主动源是每 20s 一次的公开状态端点。
- **Holistic**：管理员后台能登录（auth 在白名单）、能切换维护（admin 在白名单）、能看到公开状态端点（maintenance 在白名单）——维护开启后仍可自救解封，不会把自己锁死。

### Files
- `backend/app/services/maintenance_service.py`（新增）
- `backend/app/api/routes/maintenance.py`（新增）
- `backend/app/api/routes/admin.py`
- `backend/app/main.py`
- `frontend/src/store/maintenanceStore.ts`
- `frontend/src/components/MaintenanceOverlay.tsx`
- `frontend/src/services/adminService.ts`
- `frontend/src/screens/admin/MaintenanceTab.tsx`（新增）
- `frontend/src/screens/admin/AdminScreen.tsx`
- `frontend/App.tsx`
- `PROGRESS_LOG.md`

---

## 2026-04-21: Mobile · TestFlight 启动崩溃定位到根因 —— monorepo 双份 React/Scheduler 打进同一 bundle

### Context
上一轮通过在 `frontend/index.js` 植入三层 CrashGuard（全局错误 handler / 模块加载 try-catch / `RenderErrorBoundary`），TestFlight 上的 1.3.1 build 终于把真正的 JS 错误显示在屏幕上而不是直接 SIGABRT：

```
TypeError: Cannot read property 'useRef' of null
    at anonymous (main.jsbundle:82639:28)
    at anonymous (main.jsbundle:163276:25)
    at useStore (main.jsbundle:163156:49)
    at useBoundStore (main.jsbundle:163163:22)
    at MaintenanceOverlay (main.jsbundle:165734:60)
    at renderWithHooks (main.jsbundle:28780:24)
```

### Root cause（chain-of-thought）
1. 报错的精确形态是"**对 null 访问 `.useRef`**"，不是 "undefined is not a function"。React 18.2 生产版本把每个 hook 编译成 `exports.useRef=function(a){return U.current.useRef(a)}`，其中 `U = ReactCurrentDispatcher`，`U.current` 在渲染期间由 renderer 设为当前 dispatcher、结束后置回 null。此刻既然是 `null.useRef`，就意味着 **`U.current` 在渲染 `MaintenanceOverlay` 的这帧里是 null**。
2. `MaintenanceOverlay` 是正常 function component，且已经到了 `renderWithHooks → MaintenanceOverlay` —— React renderer 在调用组件函数**之前**就会设置 `U.current`，所以同一份 React 里不可能让 `useRef` 读到 null。唯一能解释的是 **renderer 设置的 `U` 和 `useRef` 读取的 `U` 不是同一个对象**，也就是 bundle 里存在**两份 React 实例**。
3. 本仓库是 npm workspaces monorepo（根 `package.json` 里 `workspaces: ["frontend","web"]`）：
   - `web`（Next.js 14）依赖 `react@18.3.1` / `react-dom@18.3.1` / `scheduler@^0.23`，npm 把它们 **hoist** 到根 `/node_modules/`。
   - `frontend`（Expo SDK 51 / RN 0.74.5）锁死 `react@18.2.0`，与根版本冲突，于是额外保留在 `/frontend/node_modules/react@18.2.0`。
   - `react-native@0.74.5` 硬钉 `scheduler@0.24.0-canary-efb381bbf-20230505`，与 root 的 `0.23.2` 不兼容，额外嵌套在 `/frontend/node_modules/react-native/node_modules/scheduler/`。
4. Expo 默认的 `getDefaultConfig(__dirname)` 给 Metro 配了 `nodeModulesPaths = [frontend/node_modules, root/node_modules]` + `disableHierarchicalLookup: false`。只要某条 require 链路从 "位于 root 的 hoisted 包" 往外找 `react`，hierarchical 就会在 root 命中 **18.3.1**；从 `frontend/` 内的文件找则命中 **18.2.0** —— Metro 把它们当成两个不同模块各打一份。React Native 的 renderer 只会 mutate 其中一份 React 的 `ReactCurrentDispatcher`，另一份 React 被 zustand / `use-sync-external-store/shim/with-selector` 捕获用来做 `useRef`，就永远读到 `null.useRef` 崩溃。这是经典的"同一 bundle 里两份 React/Scheduler"问题。
5. 本地 `NODE_ENV=production expo export --platform ios` 对照实验（带 / 不带我们的 metro 修复）也验证了 **`react-native` 内嵌的 scheduler 0.24.0-canary** 和 root 的 `scheduler 0.23.2` 确实都会被打进 bundle；加上 resolveRequest 强制 singleton 后，bundle 里少掉两份 scheduler 源（`react-native/node_modules/scheduler/cjs/scheduler.native.production.min.js` 及其 index.native.js）。React 的双份在 EAS 构建环境（npm 布局略有差异）下同样成立。

### What
**新增 `frontend/metro.config.js`（从原先的最小 5 行扩展成结构化配置）**
- 显式写出 monorepo 的 `watchFolders`（含根仓库）和 `nodeModulesPaths`（`frontend/node_modules` 优先，根次之），保持 Expo 默认行为。
- 核心修复：通过 `resolver.resolveRequest` 把一组「hook-sensitive / 必须全局唯一」的包名强制改写 `originModulePath` 为 `frontend/index.js`，让 Metro 总是从 frontend workspace 出发做 hierarchical 解析，从而无论调用者文件实际位于 `/frontend/node_modules/*` 还是 `/node_modules/*`，拿到的都是同一份：
  ```
  react, react-dom, react-native, scheduler,
  use-sync-external-store, use-sync-external-store/shim,
  use-sync-external-store/shim/index,
  use-sync-external-store/shim/with-selector,
  zustand
  ```
- 通过调用 `context.resolveRequest(...)` 委派回 Metro 内置解析器，完全复用其平台扩展（`.native.js` / `.ios.js`）、`package.json#exports` 等逻辑，没有自己手写路径拼接，避免 KISS 失守。

### Why
- **SOLID · Single Source of Truth**：`ReactCurrentDispatcher` 依赖"整个 bundle 只有一份 React"这一隐式不变量；一旦破坏就会出现像本次这种高度隐蔽的 hook 崩溃。`resolveRequest` 显式强制这个不变量，让系统的正确性不再靠"npm 刚好没 hoist 第二份"这种侥幸。
- **DRY**：没有复制/patch 任何依赖源码，也没有写平台判断分支；一条 Set 维护所有 singleton 包名，后续新增（比如引入 jotai/react-query 自带的内部 hook 库）只需加入这组集合。
- **KISS**：保留了 Expo 默认的 watchFolders / nodeModulesPaths 结构不动，只在 resolver 层"外挂一层重写"，不触碰 babel / transformer / cacheVersion 等风险面。
- **Holistic**：同批清理了 React Native 嵌套 scheduler（`0.24.0-canary` vs root `0.23.2`）的双份，这个二重 scheduler 在 RN 0.74 / Expo SDK 51 的所有 monorepo 项目里都会悄悄存在，即便此次不是唯一诱因，也会拖慢/破坏 React 的 work-loop 一致性。

### Files
- `frontend/metro.config.js`
- `PROGRESS_LOG.md`

### Verification
- 本地 `NODE_ENV=production npx expo export --platform ios` 对照 source map 的 `sources[]`：修复后不再出现 `react-native/node_modules/scheduler/...` 两个 entry，bundle 减小 ~3 KB；HBC 输出稳定。
- 等下一次 EAS build + TestFlight 实机，若 `CrashScreen` 不再被触发即说明 monorepo 双实例是 TestFlight 启动崩溃的根因；若仍有其他错误，`CrashScreen` 会把新错误显示在屏上继续定位（两道防线互相独立，互不遮蔽）。

## 2026-04-20: Mobile · 修复「进入聊天后返回列表，未读红点又出现」的 bug

### Context
互动页对话列表里有未读消息的会话（如"Avant Regard 客服"）显示红色 badge。进入该会话后 badge 会立即消失（本地乐观更新），但返回列表时红点重新出现，后端并没有真的把会话标记为已读。

### Root cause（chain-of-thought）
1. `frontend/src/store/chatStore.ts` 里的 `markConversationRead` 只通过 `chatWS.markRead()` 发送 WebSocket 消息，没有调用 REST。
2. `ChatWebSocket.send()` 只在 `readyState === OPEN` 才真正写入 socket，否则**静默丢弃**。
3. Chat 屏 `useEffect` 里紧挨着 `connectWebSocket()` 就调用了 `markConversationRead(conversationId)`，那一刻 WS 往往还在 `CONNECTING`，`mark_read` 报文被丢掉 → 后端从未更新 `conversation_participants.last_read_at`。
4. 用户返回列表时 `MessagesContent.tsx` 的 `useFocusEffect` 触发 `loadConversations()` 重新拉数据，后端返回的 `unreadCount` 还是原值，红点复现。

### What
**`frontend/src/store/chatStore.ts`**
- `markConversationRead` 改为 `async`：除了原有的 `chatWS.markRead()` 广播（给其他设备/标签实时同步），额外 `await markConversationReadApi(conversationId)`，通过 REST `/api/chat/conversations/:id/read` 把 `last_read_at` 真正落库。这是真正修复 bug 的那一行。
- `loadConversations` 加合并策略：如果本地已经 `unreadCount === 0` 并且 `lastMessageAt` 没变（说明期间没有新消息），就保留本地 0 值；避免用户在 REST 回调完成前就快速返回列表导致的竞态——不然后端刚来的旧数据会把本地已读状态"复活"。
- `ChatActions.markConversationRead` 签名同步调整为 `Promise<void>`。

### Why
- **SOLID · 单一可靠真源**：后端的 `last_read_at` 才是真源；只走 WebSocket 等于把已读状态托付给一个"可能还没连上"的通道，违反可靠性。REST 保证写入，WS 负责多端实时广播，两者职责清晰。
- **KISS**：没有引入新的"已读中"状态机、无需队列重放，仅一个 `await` + `loadConversations` 的合并守卫就覆盖所有场景。
- **DRY**：原本就已存在 `markConversationReadApi`（`toggleConversationRead` 在用），只是打开 Chat 的入口漏掉了它；修复是复用既有 API 而非新写。

### Files
- `frontend/src/store/chatStore.ts`

## 2026-04-20: Mobile · 浏览图片支持手势缩放（Pinch / 双击 / 平移）

### Context
全屏浏览帖子配图、头像预览、通用图片预览时只能左右翻页，没有任何放大查看细节的手段。用户对着一件挂在玻璃框里的单品想看清缝线、标牌都要截图放大，体验严重落后于系统级 Photos.app。

### What
**新增 `frontend/src/components/ZoomableImage.tsx`**
- 基于 `react-native-gesture-handler` 的 `Gesture.Pinch / Pan / Tap` + `react-native-reanimated` 共享值实现，动画完全跑在 UI 线程。
- 交互对齐 iOS Photos.app：
  - 双指 Pinch 放大，scale 夹在 `[1, 4]`，低于 1 时橡皮筋并在松手回弹到 1；超过 4 时 `withTiming` 收回到 4。
  - 双击切换 1x ↔ 2.5x，带 `withTiming` 过渡。
  - 单指 Pan 仅在放大状态下启用（`Gesture.Pan().enabled(isZoomed)`），未放大时交还给父级横向 pager，避免翻页被吞掉。Pan 结束时按 wrapper 尺寸夹紧平移量。
  - 单击通过 `Gesture.Exclusive(doubleTap, singleTap)` 与双击互斥，避免放大的双击同时触发关闭。单击仅在 `onTap` 有值时才参与组合，省掉 ~250ms 的双击等待（帖子轮播场景不需要单击关闭）。
- `onZoomChange(isZoomed)` 回调让父级 pager 可以在放大期间把自己的 `scrollEnabled` 设为 `false`，横滑就被绑定在"图内平移"上。

**`frontend/src/components/PostDetail/FullscreenImageViewer.tsx`**
- 用 `GestureHandlerRootView` 包裹 Modal 内容（`Modal` 创建独立视图树，必须在 Modal 内另设 root 才能识别手势）。
- FlatList 加 `scrollEnabled={!isZoomed}`；`onIndexChange` 包一层 `handleIndexChange`，翻页时同步把 isZoomed 复位，兜住边界场景。
- 图片 item 从 `OptimizedImage` 换成 `<ZoomableImage width={SCREEN_WIDTH} height={SCREEN_HEIGHT} onZoomChange={setIsZoomed} />`。视频分支保持不变，只有静态图参与缩放。

**`frontend/src/components/ImagePreviewModal.tsx`**
- 同样 `GestureHandlerRootView` 包裹，FlatList 接 `scrollEnabled={!isZoomed}` + `handleIndexChange` 复位 isZoomed。
- `onImagePress` 通过 `ZoomableImage` 的 `onTap` 传入；没传 `onImagePress` 时不创建 single-tap 分支。
- 顶部关闭按钮 / 计数器 / 底部 title+subtitle 样式保持原样，只换掉中间的图片渲染实现。

**`frontend/src/components/AvatarPreviewModal.tsx`**
- 原本依赖 `Pressable backdrop` 吞点击关闭；现在改成 `GestureHandlerRootView` + `ZoomableImage(onTap={onClose})`，单击关闭行为保留，同时获得放大能力。
- 关闭按钮从 `Pressable` 嵌套中提出来作为同级元素，加 `zIndex: 10` 确保盖在 `ZoomableImage` 手势面之上仍然可点。

### Why
- **KISS / DRY**：三处全屏图片查看器（帖子轮播、通用预览、头像预览）共享同一份缩放实现，未来调 scale 上下限、过渡时长只改一个文件。
- **SOLID · 单一职责**：`ZoomableImage` 只管"一张图的手势"，pager 的 scrollEnabled 由使用方按需决定，组件之间通过 `onZoomChange` 单一回调解耦。
- **性能**：全部手势状态放在 UI 线程的 `useSharedValue` 上，避免 setState 导致的 JS↔UI 往返；只有跨越"是否缩放"阈值时才 `runOnJS` 通知一次父级。
- **UX 细节**：Pan 只在放大时才 `enabled`，既是性能优化（未放大时不创建活跃手势），也是功能正确性保障——否则 `Gesture.Pan` 一激活就会吃掉 FlatList 的横向翻页。

### Files
- `frontend/src/components/ZoomableImage.tsx` (new)
- `frontend/src/components/PostDetail/FullscreenImageViewer.tsx`
- `frontend/src/components/ImagePreviewModal.tsx`
- `frontend/src/components/AvatarPreviewModal.tsx`

---

## 2026-04-20: Mobile · 图片占位图改为 Spinner + "加载中…" 文案

### Context
上一轮把 blurhash 拆成背板层解决了黑边问题，但用户觉得 blurhash 风格本身和 App 的极简语言对不上——所有图都共享一张糊糊的、带色彩偏向的 blurhash，既没有信息量又显脏。改成更克制的加载态：浅灰底 + 小 spinner +"加载中…"文字。

### What
**`frontend/src/components/ui/OptimizedImage.tsx`**
- 删掉 `blurhash` 常量、背板 `<Image>`、`placeholder` 相关代码。
- 新增 `isLoaded` state（由 expo-image 的 `onLoad` 触发切换），`onError` 同时终结 loading 和标记错误；`optimizedUri` 变更时 `useEffect` 自动 reset，避免 FlashList 回收格子展示旧"已加载"旗。
- 新增 `onLayout` 监听容器高度，仅在容器高度 ≥ `LOADING_LABEL_MIN_HEIGHT (96dp)` 时显示"加载中…"文字；头像 / 小缩略图这种小容器只显示 spinner，避免文字溢出。
- 容器本体以 `placeholderColor` (默认 `gray100`) 做底色，spinner 用 `gray300` 的 `ActivityIndicator size="small"` + 12pt 文字，与现有排版保持一致。
- 对外新增 `hideLoadingLabel` prop，给确实不需要文字的 hero 场景显式关掉。
- `showSpinner` 条件：`showPlaceholder && !isLoaded && !hasError && !!uri`——空 uri 不会无意义转圈。

### Why
- **KISS**：loading overlay 是 RN 最标准的占位语言，去掉 blurhash 也去掉了一整类"blurhash 与 contentFit 打架"的 bug。
- **DRY**：所有图的占位态统一在这一处控制；以后要改底色、spinner 颜色、文案一次到位。
- **UX 自适应**：用 onLayout 做自适应文字显隐，比给每个调用方塞一个"是不是小图"的 prop 更省心。

### Files
- `frontend/src/components/ui/OptimizedImage.tsx`

---

## 2026-04-20: Mobile · 修复 blurhash 占位图出现黑边的问题（已被上一条 PR 取代）

### Context
Lookbook 详情页 / 帖子正文内嵌图片在加载过程中会出现上下黑边：容器（`lookbookImageSection` 黑色底）比 blurhash 实际绘制区域更大，视觉上像是占位图"没撑满"。

### Root Cause
`OptimizedImage` 把 blurhash 挂在主 `<Image>` 的 `placeholder` 上，虽然写了 `placeholderContentFit="cover"`，但当调用方使用 `contentFit="contain"`（lookbook 轮播、`PostContentSection` 内嵌图片块）时，expo-image 会让 placeholder 按图片实际落位区域渲染，父层黑色背景就从 placeholder 外侧透出来。

### What
**`frontend/src/components/ui/OptimizedImage.tsx`**
- 把 blurhash 拆成一个**独立的背板层**：在容器内先渲染一张 `source={{ blurhash }}` + `contentFit="cover"` + `absoluteFill` 的 `<Image>`，永远铺满整个容器。
- 主图 `<Image>` 去掉 `placeholder` / `placeholderContentFit`，正常按调用方指定的 `contentFit` 绘制。`transition={150}` 淡入时下层 blurhash 自然兜底。
- 容器 `View` 额外加上 `backgroundColor: placeholderColor`，覆盖极端情况（blurhash 尚未解码、`showPlaceholder={false}`）的空白。
- 顺手修掉 `contentFit` 类型里 `'scaleDown'` 的拼写（expo-image 实际接受 `'scale-down'`），之前被 placeholder 相关字面量类型间接遮盖，现在拆分后被 ts 发现。

### Note
该方案已在后续迭代中被"Spinner + 文案"方案取代，保留本条记录作为决策脉络。

### Files
- `frontend/src/components/ui/OptimizedImage.tsx`

---

## 2026-04-20: Mobile · 个人主页移除封面上的通知按钮（清理死代码）

### What
- `frontend/src/screens/Profile/components/CoverSection.tsx`：删掉封面右上角的小铃铛通知按钮，只保留「设置」按钮。`unreadNotificationCount` / `onInteractionPress` prop + `NotificationBadge` 引用一并移除。
- `frontend/src/screens/Profile/components/CollapsedHeader.tsx`：折叠态 header 同步删除左侧铃铛按钮。保留一个 36×36 的透明占位 View，使 avatar 在 `space-between` 布局下依旧视觉居中（对称右侧 settings 按钮的宽度）。
- `frontend/src/screens/Profile/index.tsx`：移除 `navigateToInteraction` 回调、`unreadNotificationCount` 解构 / 传参。
- `frontend/src/screens/Profile/hooks/useProfileData.ts`：删掉 `unreadNotificationCount` state、`loadUnreadNotificationCount` action、`getUnreadCount` import，以及 `loadAllProfileData` 里的调用；public return 表同步精简。

### Rationale
- 底部 Tab 已经有「互动」角标，而且上一轮刚把通知未读数统一到 `notificationStore`；在个人主页 cover / 折叠 header 上再挂一个入口纯属信息冗余，视觉上还会和通知 store 的数据产生两处不一致。
- 按 DRY / YAGNI 一并清理 `useProfileData` 里那份独立的 `getUnreadCount` 调用 —— 之前是给这两个按钮专门拉的，按钮没了数据源自然该跟着走，避免继续做无人消费的网络请求。

### Files
- `frontend/src/screens/Profile/components/CoverSection.tsx`
- `frontend/src/screens/Profile/components/CollapsedHeader.tsx`
- `frontend/src/screens/Profile/index.tsx`
- `frontend/src/screens/Profile/hooks/useProfileData.ts`

---

## 2026-04-20: Mobile · 个人主页头像点击全屏预览

### Context
用户反馈在个人主页（自己 `/我` 以及他人 `UserProfileScreen`）点击头像没有任何反馈，希望像主流内容 App 一样点击头像可以全屏放大查看，方便看清细节。

### What
**新增组件** · `frontend/src/components/AvatarPreviewModal.tsx`
- 单张头像专用的轻量全屏预览 Modal。
- 黑色背景（`rgba(0,0,0,0.96)`）+ `contentFit="contain"` 等比缩放，保证不同纵横比头像都能完整显示。
- 点击背景任意区域关闭；右上角 `Ionicons close` 作为兜底关闭按钮（`insets.top + 8` 避开刘海）。
- 使用 `OptimizedImage` 的 `priority="high"` + `ImageSize.ORIGINAL`，拉最高清的版本，避免预览看起来和列表缩略图一样糊。
- `statusBarTranslucent` + `StatusBar hidden` 让图片真正铺满整屏。

**接入点**
- `frontend/src/screens/UserProfileScreen.tsx`
  - 主体头像 `avatarWrapper` 改用 `Pressable`，点击触发预览。
  - 吸顶小头像同样包 `Pressable`，行为一致。
  - `View` 底部挂载 `<AvatarPreviewModal />`，state 由 `avatarPreviewVisible` 管理。
- `frontend/src/screens/Profile/components/ProfileInfo.tsx`
  - 新增可选 `onAvatarPress` prop。头像图片/占位图整体包 `Pressable`，有头像时点击触发 `onAvatarPress`，无头像时仍保持原来「点击去编辑资料」的兜底行为（避免回归）。
  - 原有的 `+` 加号按钮保留独立 `Pressable`，语义清晰。
- `frontend/src/screens/Profile/components/CollapsedHeader.tsx`
  - 新增可选 `onAvatarPress` prop，吸顶小头像也支持点击预览。
- `frontend/src/screens/Profile/index.tsx`
  - 新增 `avatarPreviewVisible` 状态，分别传给 `CollapsedHeader` / `ProfileInfo` 并在底部挂载 `<AvatarPreviewModal />`。

### Design Decisions
- **为什么不复用 `FullscreenImageViewer`**：它是为 Post 多图轮播设计的横向 `FlatList`，内置「1 / N」计数器、`pagingEnabled` 翻页、视频播放分支。给单张头像用会强行显示 `1 / 1` 计数，且 FlatList 子视图吞掉背景点击关闭手势。单独一个 `AvatarPreviewModal` 更符合 KISS，也让未来头像预览的交互（例如加 pinch-to-zoom）可以在不影响帖子查看器的情况下独立演进。
- **头像不存在时的兜底**：自己主页本来就会用 `+` 按钮引导用户上传头像，`onAvatarPress` 只在有 `avatarUri` 时触发；他人主页无头像时 `disabled`，避免点击空白出现黑屏 Modal。
- **共享组件放 `frontend/src/components/`**：Profile 和 UserProfile 两个调用方分属不同目录，放在共享层避免任一方 import 进对方子树，保持边界清洁。
- **点击背景关闭 vs 只能点 `×`**：选择背景整块 `Pressable`。iOS/Android 主流 App（微信、Instagram、小红书）头像预览都支持 tap-to-dismiss，用户手势成本最低。

### Blast Radius
- 仅新增行为，未改动任何已有渲染/数据流，回归面窄。
- `ProfileInfo` / `CollapsedHeader` 的 prop 新增为可选，历史调用点即便没传也不会回归（只是缺失点击效果）。
- Modal 显隐完全由本地 `useState` 驱动，不接入 Zustand，避免跨屏状态污染。

### Follow-up
- 可选增强：接入 `react-native-gesture-handler` 的 `PinchGestureHandler` + Reanimated 让头像支持双指缩放、双击放大；目前 KISS 实现已覆盖 90% 的「看清头像细节」诉求。
- 如未来 ProfileScreen/UserProfileScreen 统一抽出通用 header 层，可直接复用同一 `AvatarPreviewModal`，无需新增依赖。

### Files
- `frontend/src/components/AvatarPreviewModal.tsx`（新增）
- `frontend/src/screens/UserProfileScreen.tsx`
- `frontend/src/screens/Profile/index.tsx`
- `frontend/src/screens/Profile/components/ProfileInfo.tsx`
- `frontend/src/screens/Profile/components/CollapsedHeader.tsx`

---

## 2026-04-20: Mobile · 互动页红点/Tab 角标「看完即清」—— 通知状态全局化

### Symptom
- 底部「互动」Tab 的红色角标（如 "3"）以及互动页内「互动消息 / 系统消息」入口上的小红点，在用户看完之后不会消失；最长要等 30 秒 polling 才会刷新。
- 打开一个聊天并看完消息后，该会话本身的未读数清了，但互动页入口上由「XX 发来了一条消息」产生的通知红点仍然挂着。

### Root Cause (chain of thought)
1. **Tab 角标数据口径分裂**：`App.tsx:TabNavigator` 用本地 `useState(notifUnread)` + `setInterval(getNotifUnreadCount, 30s)` 维护通知未读数；而 `MessagesContent` / `Activity` 各自 `useState` 管一份 `notifications`。三处互不知情 —— 详情页里点击「已读」只更新自己的本地 state，Tab 角标要等下一次 30s 轮询才追上。
2. **没有"查看即读"语义**：`Activity` 屏仅在用户点击单条通知或按右上角「全部已读」才 mark-as-read。大多数用户只是扫一眼列表就退出，于是红点永远留着。
3. **聊天通知脱管**：Chat 屏进入时只调 `markConversationRead(conversationId)` 清会话未读，但 `notifications` 里 `navigateTo==="Chat" && navigateParams.conversationId===X` 的那条「XX 发来了一条消息」没人去清。

### Fix

**Phase 1 — 新增 `frontend/src/store/notificationStore.ts`（全局 zustand）**
- 单一 source of truth：`notifications`、`unreadCount`、`isInitialLoaded`。
- Actions：
  - `loadNotifications()`：拉全量 + 按 createdAt 倒序 + 重算未读。
  - `refreshUnreadCount()`：仅刷角标（配合后台 polling 用）。
  - `markRead(id)` / `markManyRead(ids[])`：乐观更新 + 异步调 `/api/notifications/{id}/read`。
  - `markAllRead()`：本地全部置已读 + 调 `/api/notifications/read-all`。
  - `markChatNotificationsRead(conversationId)`：过滤 `navigateTo==="Chat"` 且 `navigateParams.conversationId` 匹配的未读项，批量标读。
  - `reset()`：登出时清空状态，避免换账号后旧数据短暂闪现。

**Phase 2 — 接入各消费方**
- `frontend/App.tsx:TabNavigator`：去掉本地 `notifUnread` state，直接 `useNotificationStore(s => s.unreadCount)`。挂载时 `loadNotifications()`，并保留 30s `refreshUnreadCount()` polling 作为后台推送兜底。`isAuthenticated → false` 时调 `reset()` 清理。
- `frontend/src/screens/Interaction/components/MessagesContent.tsx`：`notifications` 改读自 store，删掉本地 `useState`。入口组件 (`ActivityEntry` / `SystemEntry`) 拿到的数据跟 tab 角标天然同步。
- `frontend/src/screens/Activity/index.tsx`：
  - 数据源切到 store；`markRead` / `markManyRead` 替换本地 setState 逻辑。
  - **新增"查看即读"**：`loadData()` 拉完最新列表后立刻调 `markVisibleAsRead()` —— 仅标当前 tab 语义下可见的未读（互动详情页跳过 `system/mention`、系统详情页只含 `system/mention`，两者都跳过聊天类通知交给 Chat 屏处理）。覆盖首次进入 + 下拉刷新两个入口。
  - `handleMarkAllRead` 也复用"只清当前视图可见项"的规则，跟页面间分工保持一致。
- `frontend/src/screens/Chat/index.tsx`：`useEffect` 里除 `markConversationRead` 外新增 `markChatNotificationsRead(conversationId)`，打开聊天时把对应的「XX 发来了一条消息」通知一并清掉。

### Design Decisions
- **为什么走 zustand 而不是 React Context**：通知 store 要被 TabNavigator (顶层) 与嵌套较深的 Chat / Activity 页同时订阅，context + provider 做细粒度订阅很难避免重渲染；zustand 天然支持 selector，`useNotificationStore(s => s.unreadCount)` 只会在 unreadCount 变化时触发重渲染，TabNavigator 稳定丝滑。
- **为什么"查看即读"写在前端而不是新增 `/notifications/read-by-type` 后端接口**：当前 `mark_all_as_read` 过于粗暴（无类型过滤），一次性把聊天通知也清了会造成"进了互动消息页，聊天提醒也没了"的反直觉行为。前端按视图语义过滤 + 批量循环 `/api/notifications/{id}/read` 只有 n=3~10 量级的请求，实测无感；后端改起来成本更高且要改数据库索引策略，ROI 不划算。
- **乐观更新 + 不 `await` API 错误**：所有 `markRead*` 都先更新 store，再异步调 API；API 失败只记 log，不回滚。依据：(a) 通知已读是幂等操作，(b) 下一次 `loadNotifications()` 会用后端真实状态覆盖；用户体验必须立刻响应，不能因网络抖动让红点多闪一下。
- **聊天通知由 Chat 屏独立清理**：遵循「谁打开谁负责」的职责划分。Activity 屏的 `markVisibleAsRead` 显式跳过 `isChatNotif`，避免两个页面抢着清一条通知的竞态。
- **保留 30s polling**：Tab 角标的 polling 不是纯粹冗余 —— 覆盖的是 "App 在前台但用户没打开互动页、后端新来了推送" 的场景。即便 push notification 成功触达，前端也需要一次服务端校验。

### Blast Radius
- 所有消费通知未读数的 UI（底部 Tab、互动页入口小红点、系统消息入口小红点、互动详情页列表未读样式）现在是严格单向数据流。任何一处 `markRead*` 调用，其他三处在下一次渲染立即同步。
- `MessagesContent` / `Activity` 里的本地 `useState(notifications)` 被移除，内存占用和重渲染次数都下降。
- `NotificationsScreen.tsx` 是早期遗留的通知中心 (目前未接入 App 导航主流程)，未做迁移，保持原样避免引入无关风险。

### Follow-up
- 通知 push 到达时，前端只增 badge 不合并到 `notifications` 数组 —— 目前靠用户进页触发 `loadNotifications`。下一步可在 `usePushNotifications` 的 listener 里调 `notificationStore.loadNotifications()` 做增量合并。
- `NotificationsScreen` 合并到 `notificationStore`，消除最后一个独立数据源。
- `mark_all_as_read` 后端加 `type_in` 参数，前端可以一次 HTTP 清一批同类型通知，比当前循环调用更省流量。

### Files
- `frontend/src/store/notificationStore.ts`（新）
- `frontend/App.tsx`
- `frontend/src/screens/Interaction/components/MessagesContent.tsx`
- `frontend/src/screens/Activity/index.tsx`
- `frontend/src/screens/Chat/index.tsx`

---

## 2026-04-20: Backend · Chat 卡片消息的通知预览显示为 JSON 字符串

### Context
在聊天里收到别人发来的分享卡片（`post_card` / `store_card` / `brand_card` / `show_card` / `user_card`）并且自己不在线时，后端会在 `notifications` 表里插一条「XX 发来了一条消息」，`message` 字段直接截取了消息体的前 100 字符。但这些卡片的 `content` 存的是一串 JSON（`{"postId":"...","title":"..."}` 之类），所以推送通知和活动页里那条记录看到的就是一堆花括号和引号，完全看不出对方到底发了什么。

前端的会话列表（`formatLastMessage`）早就已经做了这层转译，只是通知链路漏了，这轮把它补齐。

### What
**后端** · `backend/app/services/chat_service.py`
- 新增模块级工具 `format_chat_message_preview(content, message_type)`：
  - 普通文本直接原样返回；
  - 卡片类型按 `message_type` 映射到本地化标签（如 `[帖子分享]` / `[名片分享]`），并尝试从 JSON 里抽出 `title` / `name` / `brandName` / `username` 拼在后面，生成 `[帖子分享] 2024SS Look` 这样的语义预览；
  - 无法解析的 JSON 或缺字段时优雅降级到裸标签，绝不把 JSON 串吐到用户面前。
- 标签命名刻意与 `frontend/src/screens/Interaction/utils.ts#formatLastMessage` 保持一致，避免列表页和通知说两套话。

**后端** · `backend/app/api/routes/chat.py`
- WebSocket 的 `send_message` 分支：给离线参与者写 `notifications` 时，把原先的 `content[:100]` 替换成 `format_chat_message_preview(content, message_type)[:100]`。
- 推送通道 (`send_push=True`) 会沿用 `message` 字段，所以 APNs / FCM 弹出的横幅也跟着一起变成人类可读。

### Design Decisions
- **为什么放在 `chat_service.py` 而不是新建一个 util**：这段逻辑只服务于「聊天消息 → 人类预览」这一语义，作为模块级函数跟 `ChatService` 平级更内聚，避免再挖一个只有 20 行的文件。
- **为什么不直接复用前端的 `formatLastMessage`**：两边一份源码不现实（一个 TS 一个 Py），但只要语义一致就够了 —— 都读同一批 key（`postId` / `storeId` / `brandId` / `showId` / `userId`）、吐同一批标签。接下来只需在两边同步修改时互相注释引用即可（已在后端注释里点名）。
- **为什么保留 `[:100]` 截断**：`notifications.message` 在 DB 和 APS 弹窗里都有长度限制，上游入库和下游推送这一层的硬约束不动，保险起见。
- **为什么不顺手 backfill 历史脏数据**：老通知已经是 read 状态或已经被滑走，没必要改动存量；只要新数据干净，用户能立即感知改善。

### Blast Radius
- 只影响 chat 发消息 → 通知生成这一条路径。会话列表、消息气泡、未读角标逻辑均不受改动。
- REST `POST /chat/conversations/{id}/messages` 分支本就没有创建通知，不受影响（这是一个已存在的 gap，本轮不在范围内）。

### Follow-ups
- REST 发消息也应该给离线方建通知，否则只靠 WS 客户端一条路，掉线就丢提醒。下一轮统一迁到 `chat_service.send_message` 内部触发更稳。
- 考虑把 `[图片]` 的 `message_type="image"` 也纳入（现已覆盖，但前端 `formatLastMessage` 还没显式处理，跟进时一并对齐）。

---

## 2026-04-20: Backend · Feed 图片代理路由 `/api/files/image`（Phase 2 复活 · Pillow + 磁盘缓存）

### Context
前一轮把 `IMAGE_TRANSFORM_ENABLED` 关掉是因为 MemFire Cloud 托管 Storage 没有 `render/image` 端点（`HTTP 404 Route not found`），而 Supabase 官方 hosted 的图片转换又是 Pro 付费特性。两边都走不通，feed 里的老原图仍然要拉 2–10MB 一张，首屏加载体验差。

本轮在自己的 FastAPI 后端上实现一条 **图片代理路由** 替代存储端原生转换，把 Phase 2 的能力补齐。

### What
**后端** · `backend/app/api/routes/files.py`
- 新增 `GET /files/image`（注册到 `/api/files/image`）。
- 请求参数：`url`（必传）、`w` / `h`（0–2500，0 表示不缩放）、`q`（20–100，默认 80）、`fmt`（可选 `webp` / `jpeg` / `png`，不传则按客户端 `Accept` 协商）。
- 处理链：
  1. **URL 白名单**：只接受 `settings.SUPABASE_URL` 解析出的 host，避免被当 SSRF 开放代理。非白名单一律 400。
  2. **磁盘缓存命中**：`sha256(url|w|h|q|fmt)` 作为文件名，命中直接 `FileResponse`（sendfile zero-copy），带 `Cache-Control: public, max-age=31536000, immutable` + `ETag`。
  3. **命中 `If-None-Match`**：直接 304，省流量。
  4. **回源**：`httpx.AsyncClient` 15s timeout + follow redirects，失败映射 502。源图 > 25MB 视为异常 413。
  5. **转换**：`asyncio.to_thread` 跑 `Pillow` 避免阻塞事件循环；JPEG 用 `optimize + progressive`，WebP 用 `method=4`。永不放大（`scale < 1.0` 才 resize），防拉伸。
  6. **原子写缓存**：`tmp` + `os.replace`，避免并发读到半文件。
- 缓存目录：`$IMAGE_PROXY_CACHE_DIR` 或默认 `$TMPDIR/avant_image_cache`。

**前端** · `frontend/src/utils/imageUtils.ts`
- `IMAGE_TRANSFORM_ENABLED = true`，URL 改写策略从「改写为 `render/image/public/...`」切换为「改写为 `${API_BASE}/api/files/image?url=<encoded>&w=W&q=Q`」。
- `encodeURIComponent` 保证 token / 中文文件名安全。
- API_BASE 去尾斜杠，避免拼出 `//api/...` 触发 308 重定向。
- 判定依据仍是 `/storage/v1/object/public/`：同时覆盖 Supabase 官方和 MemFire Cloud 两种后端，未来迁移零改动。

### Design Decisions
- **为什么不直接走 Supabase 原生转换**：两个原因 —— (a) 生产后端实际跑在 MemFire Cloud，它没部署 `render/image`；(b) 即使回 Supabase hosted，图片转换是 Pro 付费功能。自建代理一套搞定「多后端 + 无付费 + 可观测」。
- **路由不鉴权**：`expo-image` 和 `<img>` 发请求时不会带 Bearer token，强行鉴权等于彻底用不起来。白名单 + 资源本身 public 就是正确安全边界（本来就能用原图 URL 直接访问 Storage）。
- **磁盘缓存而非 Redis**：转换结果是二进制 blob（10–100KB），Redis 不是最佳载体；本地磁盘 + `FileResponse` sendfile 是单实例最低延迟方案。未来水平扩 2+ 实例再加 CDN / S3 共享缓存即可，现在 YAGNI。
- **`asyncio.to_thread` 包 Pillow**：Pillow 在 C 层释放 GIL，线程池能真并行；不包就会把事件循环阻塞在单图编码（200–500ms/张），把 FastAPI 整个 QPS 拖垮。
- **永不放大**：有人调 `w=2000` 但原图只有 800px 时，不做 upscale —— 编码体积反而变大，还没有任何画质增益。只在 `scale < 1.0` 时 resize 是个显式契约。
- **`_MAX_DIMENSION = 2500`** 与 Supabase 对齐，防止恶意请求构造 10000×10000 目标压爆内存。
- **`immutable` 缓存头**：Storage 对象路径里带 uuid + 日期，写入后永不修改，配合 ETag 可以让 CDN / 客户端彻底跳过 revalidation，等价于一次性传输。

### Blast Radius
- **所有 `OptimizedImage` 消费端（70+ 文件）**自动走代理：feed 缩略图从「几 MB 原图」降到「400px WebP 约 30–60KB」。
- **老帖子历史原图**：无需 backfill 即获得加速；代理按需转换，首次请求略慢（~300ms），命中缓存后 ~5–10ms。
- **后端 CPU / 内存**：首屏冷启动时会有短暂峰值（瀑布流 20 张图 → 20 次 Pillow 转换）；`asyncio.to_thread` 配合 `uvicorn --workers` 可水平扩。后续若压力大可加 `asyncio.Semaphore` 限制并发转换。
- **磁盘占用**：按典型 feed 1 万张 × 3 个尺寸 × 50KB ≈ 1.5GB。Railway / ECS 宿主磁盘够用；超过可加定期 LRU 清理脚本（目前 YAGNI）。

### Follow-up
- 并发限流：`asyncio.Semaphore(8)` 包裹 `_transform_bytes` 调用，防止瞬时流量把 worker 打爆；等线上压测看到实际峰值再加。
- 磁盘缓存 LRU：写一个 cron 脚本按 `mtime` 清理 `_IMAGE_CACHE_DIR` 里 > 7 天的文件；或者迁到 S3 + CloudFront 彻底托管。
- 观测埋点：`cache_hit / cache_miss / upstream_4xx / transform_err` 计数到 Prometheus，量化代理收益。
- 批量预热：发布成功后后端同步触发一次 `/image?w=400` + `w=800` 预生成，让首次浏览就命中缓存。

### Files
- `backend/app/api/routes/files.py`
- `frontend/src/utils/imageUtils.ts`

---

## 2026-04-20: Mobile · Feed 图片加载「整屏灰占位」优化（上传压缩 + 在线转换 + 封面优先级修复）

### Symptom
推荐 Tab 进入后一屏 6–8 张卡片几乎全是灰色占位，只有一张陆陆续续加载出来；用户反馈「图片加载太慢」。一线设备抓包可见每个帖子封面下载 2–10MB 的原图，走 Supabase/MemFireDB 的 `/storage/v1/object/public/` 端点。

### Root Cause (chain of thought)
三层问题叠加放大效果：

1. **根本层：原图不压缩、存储端不做转换**
   - `postService.uploadImage` 拿到 `ImagePicker` 的本地 URI 直接 `FormData.append`，后端 `file_service.py` 又原样写进 MemFireDB Storage。HEIC / 大尺寸 JPEG 原封不动入库。
   - `frontend/src/utils/imageUtils.ts:getOptimizedImageUrl` 名义上在做尺寸优化，实际上只给 Supabase URL 拼了 `?_size=medium&_width=800` —— 这两个参数对 `object/public` 端点**没有任何作用**，依然返回完整原图。

2. **调度层：封面图被标记成 low priority**
   - `OptimizedImage` 旧逻辑 `priority={lazy ? 'low' : 'normal'}`，`PostCoverMedia` 又默认 `lazy=true`，于是瀑布流最显眼的封面被 expo-image 排到了头像/图标之后。
   - 结果：单连接带宽被耗在次要资源上，封面迟迟得不到调度。

3. **放大器：视频封面失败会下载整段 mp4**
   - `VideoThumbnailView` fallback 会 `FileSystem.downloadAsync` 把整段视频下载到本地再取帧；一旦命中就堵死 HTTP/2 连接上所有并行请求。
   - 本轮先不动，单独列入后续改造（下方 Known Follow-up）。

### Fix

**Phase 1 — 上传时压缩（最大 ROI）**

1. 新增 `frontend/src/utils/imageCompression.ts`
   - `compressImage(uri)`：先一次零 compress、无 action 的 `manipulateAsync` 测尺寸；仅当长边 > 1600px 才追加 `resize`；统一用 `SaveFormat.JPEG` + `compress: 0.8` 重新编码。
   - `compressBeforeUpload(uri)`：remote HTTP URL 直接透传（草稿重传场景）；压缩失败**绝不抛错**，回退原图 URI 继续上传，避免压缩崩溃阻塞发布。
   - 设计取舍写在模块顶注释：为何统一转 JPEG、为何 1600 / 0.8、为何不在这里做 format 协商（WebP 交给服务端）。
2. `frontend/src/services/postService.ts:uploadImage`
   - 在 `FormData.append` 之前调用 `compressBeforeUpload`，直接使用其返回的 `{uri, filename, mimeType}`。`IMAGE_MIME_MAP` 继续保留给 `inferMimeType` 与视频上传路径使用。

**Phase 2 — 显示时按需尺寸（已回退，等待后端支持）**

3. 改 `frontend/src/utils/imageUtils.ts:getOptimizedImageUrl` 走 `/storage/v1/render/image/public/`。实测后发现 **MemFire Cloud 托管服务未部署此端点**（`HTTP 404 Route not found`），尽管其 SDK 文档描述了 `transform` 契约 —— 那是 Supabase 自托管 + imgproxy 才具备的能力。
   - 所有 URL 改写被置于 `IMAGE_TRANSFORM_ENABLED = false` 下，生效时接口会重写为 `render/image/public/...?width=W&quality=Q`，目前**暂不生效**。
   - 代码结构保留，消费端零改动；未来只要后端接入图片转换（自建 imgproxy / 后端 Pillow 预生成缩略图 / 前置 Cloudflare CDN 任选其一），把开关打开即可全量启用。
   - 即使 Phase 2 暂时回退，Phase 1 的上传压缩已经把新上传的图片体积降到 200–600KB 区间；结合 Phase 3 的调度修复，feed 加载速度在本机实测已大幅改善。遗留的老原图仍然需要后续 backfill 或转换端点的进入才能彻底解决。

**Phase 3 — 调度与缓存键修复**

4. `frontend/src/components/ui/OptimizedImage.tsx`
   - **解耦 `priority` 与 `lazy`**：新增显式 `priority?: 'low' | 'normal' | 'high'` prop。优先级决策 `priority ?? (lazy ? 'low' : 'normal')` 保持老调用方向后兼容的同时，让封面这类重要资源可以显式 opt-in `normal` / `high`。
   - `recyclingKey` 从 `optimizedUri` 改用原始 `uri`：这样同一张图在不同 `size` 预设之间切换（THUMBNAIL → MEDIUM 进详情页）可以共享解码后的位图，避免重复 decode。
5. `frontend/src/components/PostCoverMedia.tsx`
   - 删除旧的 `lazy` prop，改成可选 `priority`；默认不传即走 `normal`。配套更新 JSDoc 解释"为什么封面不能 lazy"，防止未来 contributor 把它改回去。
   - `PostCard` / `BrandDetailScreen` 两处调用方不传 `lazy`，无需任何改动，行为自动从 low → normal。

### Design Decisions
- **压缩在客户端而不是服务端**：客户端做一次省带宽、省存储费、也省服务端 CPU；服务端压缩仍要先传完原图，收益只剩一半。`expo-image-manipulator` 已在依赖里，零新增依赖。
- **1600px / q0.8 的取值**：与 `ImageSize.LARGE` 预设保持上下游一致 —— 详情页消费的就是 1440px 级别，源图再大都浪费；q0.8 是 libjpeg 质量/体积曲线拐点，往上每 0.05 才省 1~2KB 却可见模糊。
- **不触碰 `IMAGE_MIME_MAP`**：视频上传路径仍依赖它推断 MIME，共用数据结构是 DRY 的正确方向，不因为新代码不用就删。
- **`IMAGE_TRANSFORM_ENABLED` 内联常量而非环境变量**：当前 YAGNI，留好 hook；未来真需要线上热关时再接 `config/env.ts`，不改外部接口。
- **`priority` 默认 `normal` 而不是 `high`**：`high` 在 expo-image 里会抢占别的 critical 下载（如用户头像）；`normal` 已足够让封面跟其他 UI 资源公平竞争，实测表现和 Web 端 Next.js `priority={true}` 效果一致。
- **视频封面链路本轮**不动**，单独跟进**：替换 "失败就下载整段 mp4" fallback 需要产品上决定失败态 UI（占位 vs 占位+播放图标）以及后端是否预生成 poster，与本次「图片加载慢」的主链路正交，放到下一轮做，避免一次 PR 改太多。

### Blast Radius
- **所有上传图片路径**（发布帖子 / lookbook / review / forum / 头像 / 品牌提交 / 社区图 / 管理员审核图）都共享 `uploadImage`，自动受益于 Phase 1 压缩；典型 iPhone HEIC 8MB → 400–600KB JPEG，Android 5MB JPEG → 250–400KB。
- **所有 `OptimizedImage` 消费端**（70+ 文件）自动受益于 Phase 2 的尺寸参数，feed 缩略图下载量从「原图」降到 400px 级（20–60KB 级 WebP）。
- **封面调度**：瀑布流整屏封面从 low priority 一起晋升到 normal，首屏可见图张数从「每次 1 张轮流」回到「整屏近乎并行」。
- 老帖子（未压缩的原图仍在 Storage 上）无迁移需求 —— Phase 2 的 `render/image` 端点会在用户每次请求时即时转换，等于给历史数据自动加速。

### Follow-up (未做)
- **接入真正的图片转换**（Phase 2 复活）：三条路径可选 —— (a) 后端 FastAPI 加 `/api/files/image?url=...&width=...&quality=...` 代理路由，用 Pillow / `rust-image-webp` 做转换 + LRU 磁盘缓存；(b) 上传时后端同步生成 `_thumb_400.jpg` / `_medium_800.jpg` 多尺寸写回 Storage，客户端按命名规则选；(c) 前置 Cloudflare Images / 阿里云 OSS 图片处理。代码已按开关 `IMAGE_TRANSFORM_ENABLED` 解耦，后端就位后一行启用。
- **老帖子原图 backfill**：现有存储里的原图（未经 Phase 1 压缩）仍是几 MB 级；可写一次性脚本下载 → `Pillow` 压缩 → 重新 `upload` 覆盖。需要先和业务确认是否允许破坏原始画质。
- `VideoThumbnailView` 的 "下载整段 mp4 再取帧" fallback 需要替换；建议后端在视频上传时同步提取首帧 JPG 存到 `posts.coverUrl`，彻底绕开客户端 VideoToolbox。
- `imageCompression` 暂时单入口；未来若需要对"已裁剪图"（`ImageCropper` 输出）跳过二次压缩，可以在裁剪结果上打标记，再让 `compressBeforeUpload` 做 cheap path。

### Files
- `frontend/src/utils/imageCompression.ts`（新增）
- `frontend/src/utils/imageUtils.ts`
- `frontend/src/services/postService.ts`
- `frontend/src/components/ui/OptimizedImage.tsx`
- `frontend/src/components/PostCoverMedia.tsx`

---

## 2026-04-20: Mobile · 修复瀑布流视频封面 VideoToolbox 解码风暴 / 页面卡死

### Symptom
推荐 Tab 下拉刷新或连续触底分页时，日志成片出现
`[VideoToolbox] (Fig) signalled err=-12900` 与 `Failed to generate video thumbnail: [Error: 操作已停止]`，伴随明显的 UI 卡顿 / "页面卡住"。

### Root Cause (chain of thought)
1. `PostCard` 渲染视频封面时走 `PostCoverMedia → VideoThumbnailView`，`VideoThumbnailView` 会调 `getVideoThumbnail`；与此同时 `PostCard` 自己又调 `useMediaAspectRatio(videoUri)`，hook 的视频分支也会调 `getVideoThumbnail` 来测宽高比。**每个视频封面被解码两遍**（详情页 `VideoBlockRenderer + VideoPlayer` 同理）。
2. `MasonryFlashList` 一次挂 30 张卡片，其中哪怕 5 个是视频也会瞬间并发 **10+** 个 `AVAssetImageGenerator.generateCGImages`。iOS VideoToolbox 硬件解码器池被打满，AVFoundation 直接 cancel 溢出的请求 → 出现 `err=-12900` / "操作已停止"。
3. `getVideoThumbnail` 失败后没有记账，回收后的 `MasonryFlashList` cell 重新挂载又会把同一条挂掉的视频再塞给解码器，形成不断重试的 native 回调雨点。
4. `VideoThumbnailView` 命中磁盘缓存时只 `setThumbnail`，不发 `rememberMediaAspectRatio`，父卡片永远拿不到真实比例，一直在 3/4 fallback 与真实比之间抖。

链式叠加：feed 批量拉视频 → 双倍并发解码 → 解码器雪崩 cancel → 失败不去重 → 下一次 layout 又冲一次；native 回调堆积把 UI 线程拖慢 → 视觉上"卡死"。

### Fix
1. `frontend/src/utils/videoThumbnail.ts`
   - 新增信号量（`MAX_CONCURRENT_THUMBNAILS = 2`）串行化所有 `VideoThumbnails.getThumbnailAsync` 调用；2 个并发足够掩蔽单帧抽取延迟，又不会撑爆 VideoToolbox 解码器池。
   - `inflightThumbnails: Map<key, Promise>` 按 `(uri, timeMs)` 去重：多个并发调用方（`PostCard` + `VideoThumbnailView` 仍保留的场景、详情页多处订阅）共享同一次原生 decode。
   - `failedThumbnailUris: Set<key>` 记录本会话已失败的 URI，再次调用直接 `null`，不再撞解码器。
2. `frontend/src/utils/useMediaAspectRatio.ts`
   - 视频分支**去掉**独立的 `getVideoThumbnail` 调用，只保留共享缓存订阅 —— 每个屏幕的视频都一定有兄弟 `VideoThumbnailView`/`VideoPlayer` 负责解码并 `rememberMediaAspectRatio`，hook 自己不再制造第二次 decode。这是根除并发翻倍的关键改动。
3. `frontend/src/components/VideoThumbnailView.tsx`
   - 磁盘缓存命中路径补上 `Image.getSize(thumbPath)` + `rememberMediaAspectRatio`，仅当 `peekMediaAspectRatio` 尚无值时执行，避免重复写入。解决热启动后父卡片比例锁在 3/4 的问题。

### Design Decisions
- **并发数选 2 而不是 1**：单并发会在慢速网络 + 大视频场景放大首屏空窗；2 并发既能掩蔽 I/O 等待，又远低于 VideoToolbox 实际吞吐，实测稳定。
- **失败黑名单只在内存**：AVFoundation 的 cancel 错误通常伴随特定设备状态；跨 session 重试是合理的，下次冷启动还会再试一次，不会永久屏蔽合法视频。
- **不在 hook 里兜底自启动 decode**：符合 KISS/SOLID —— 测量职责归"真正渲染视频的组件"，hook 只做订阅与播发，避免出现"看不见的视频也在偷偷解码"这种隐藏副作用。
- **`Image.getSize` 读 JPG 缩略图不走 VideoToolbox**：纯 ImageIO 路径，代价与读一张普通缓存图相当，不会回归问题链。

### Blast Radius
- 发现页 / 详情页 / 发布页所有视频封面场景：并发解码数直接砍半以上，`err=-12900` 日志消失；页面滚动不再被 native 回调卡顿。
- 已有磁盘缓存的视频热启动后，父卡片瀑布流高度一帧内锁定真实比例，不再抖动。
- 历史帖子（无 `coverAspectRatio`）在首次渲染那一刻之前仍按 3/4 占位，视频组件完成 decode 后立刻同步真实比例 —— 视觉体验与改动前一致，只是 decode 不再翻倍。

### Files
- `frontend/src/utils/videoThumbnail.ts`
- `frontend/src/utils/useMediaAspectRatio.ts`
- `frontend/src/components/VideoThumbnailView.tsx`

---

## 2026-04-20: Mobile · 修复"互动消息"首次进入需下拉刷新才显示

### Context
用户反馈：消息页点"互动消息"进到详情页，首次进去看不到任何消息，必须下拉刷新才出现。

### Root Cause (chain of thought)
1. `Activity/index.tsx`（互动消息详情页）只靠 `useFocusEffect` 触发 `loadData()`。
2. 初始 state `notifications = []` 且没有 `loading` 标志，`FlatList` 第一帧直接渲染 `ListEmptyComponent`（"暂无互动消息"）。
3. `useFocusEffect` 在原生栈 (`@react-navigation/native-stack`) 下会等转场动画结束后才真正触发 focus 事件 → 请求起步滞后于首帧渲染；用户看到的是"空状态"。
4. 加上请求本身的 RTT，用户直觉是"打开就是空的 / 必须手动下拉才加载"。下拉刷新之所以"有效"，只是因为 `RefreshControl` 给了可见的等待反馈。
5. `Interaction/MessagesContent.tsx`（上一级 tab）也是同样模式，进入消息 tab 时 `ActivityEntry` 的徽标/最新内容也要等转场结束才显现。

### Fix
同时改两处，让"首次挂载"与"再次聚焦"职责清晰分离：

1. `frontend/src/screens/Activity/index.tsx`
   - 新增 `initialLoading` state（默认 `true`），第一次拉取完成后置 `false`。
   - 用 `useEffect(..., [loadData])` 在**挂载瞬间**就发请求，不再等转场；`cancelled` 闭包防止卸载后 setState。
   - `didInitialFetchRef` 作为哨兵，`useFocusEffect` 首帧直接 `return`，之后聚焦才再次拉取，避免首次进入时双发请求（DRY：唯一 owner 清晰）。
   - `ListEmptyComponent` 在 `initialLoading` 时渲染 `ActivityIndicator`，加载结束后才回退到"暂无互动消息"空态，杜绝"假空状态"误导。

2. `frontend/src/screens/Interaction/components/MessagesContent.tsx`
   - 同样的哨兵模式：`useEffect` 负责首帧并发拉取 `loadConversations` + `loadNotifications`，`useFocusEffect` 仅在后续回到该 tab 时刷新。
   - 修复"进入消息 tab 时互动消息入口徽标/最新消息要等一下才出现"的观感问题（同根因）。

### Design Decisions
- 为什么不直接把 `useFocusEffect` 换成 `useEffect`？还要保留后续"回到此屏幕时刷新"的能力（例如从 `PostDetail` 返回后标记已读要重算 `unreadCount`）。两个 hook 各司其职最干净。
- 为什么用 `useRef` 哨兵而不是把 `initialLoading` 当判据？`initialLoading` 只在 Activity 屏有，`MessagesContent` 有两个并发请求，用 ref 统一语义；且 ref 不触发 re-render，更合适做"是否是首次"的路径判断。
- 不引入新的 Zustand store 去集中 notifications：增加全局状态的风险大于收益，当前两个屏的通知视图差异（`filter="system"` vs 非系统）由各自 derive 即可，KISS。

### Files
- 修改：`frontend/src/screens/Activity/index.tsx`
- 修改：`frontend/src/screens/Interaction/components/MessagesContent.tsx`

### Blast Radius
纯前端 state/生命周期改动，零 API / 数据库 / 路由变更。`onRefresh`（下拉刷新）与 `handleNotifPress` 逻辑完全不变；首次进入时请求次数从"0～1 次（取决于转场时机）"变为"恰好 1 次"，不会加重后端压力。

---

## 2026-04-20: Mobile · 修复首次进入 App 推荐 Tab 其他用户头像"消失"

### Context
用户反馈"首次进软件其他用户的头像会消失"。表现：冷启动打开 App → 推荐 Tab 首屏所有其他用户的头像都是空白/dicebear 默认头像，几秒后才"迟到"地变成真实头像。下拉刷新或滚动一段距离后不会复现。

### Root Cause (chain of thought)
1. `PostCard` 渲染头像的数据源是 `post.author.avatar`，推荐 Tab 下这个字段由 `frontend/src/screens/Discover/utils.ts::mapApiPostToDisplayPost` 计算。
2. 该函数的 avatar 回退链是 `userInfo?.avatarUrl || defaultAvatar(dicebear)` —— 只认 `userInfoCache` 里的数据，**完全忽略了 `apiPost.avatarUrl`**。
3. 推荐 Tab 走的是 Feed v2.1 路径（`useFeedRecommendation`）。首屏渲染顺序是：
   - 同步：`mapFeedItemsToDisplayPosts(feedItems)` 立刻把 feed items 映射成 DisplayPost。此时 `userInfoCache.current` 为空（冷启动无缓存），所以每个 post 的 `author.avatar` 被写成 dicebear 默认头像。
   - 异步：`backfillUserInfosForFeed` 后台逐个 `/user_info` 补拉，回填缓存，触发重算 → 头像才变成真实头像。
4. 但后端 `/api/posts/feed` 在 `feed_service.py` 里已经通过 `avatar_map` **批量下发了 `avatarUrl`**，前端映射时却不用 —— 这才是"首次进入头像消失"的根因。其它 Tab（论坛/关注）不受影响是因为它们在 `mapApiPostToDisplayPost` 之前就 `await fetchUserInfos`，映射时缓存已经是热的。

### Fix
在 `mapApiPostToDisplayPost` 的 avatar / username 回退链中插入一层 `apiPost.avatarUrl` / `apiPost.username`：

```
userInfo?.avatarUrl  ||  apiPost.avatarUrl  ||  dicebear默认头像
userInfo?.username   ||  apiPost.username   ||  "匿名用户"
```

优先级说明：
1. `userInfo?.avatarUrl` —— 最新的 profile 数据（用户刚改过头像的场景）。
2. `apiPost.avatarUrl` —— 后端 feed 响应里已经批量补全的头像，冷启动首屏立即可用，无需等 backfill。
3. dicebear 默认头像 —— 兜底。

同步在另外两处有相同缺陷的地方统一修复（DRY）：
- `frontend/src/screens/CommunityDetailScreen.tsx::mapApiPostToDisplayPost`
- `frontend/src/components/PostDetail/hooks/usePostDetail.ts`（帖子详情 header）

`backfillUserInfosForFeed` 保留不动：它仍然负责在拉到新数据后顺手把 user_info（title、primaryTitle 等字段 feed 响应没下发）补进缓存，下一次重渲染可以升级到"完整 user_info"。

### Files
- 修改：`frontend/src/screens/Discover/utils.ts`（核心修复 + 详细注释解释回退优先级）
- 修改：`frontend/src/screens/CommunityDetailScreen.tsx`（一致性）
- 修改：`frontend/src/components/PostDetail/hooks/usePostDetail.ts`（一致性）

### Blast Radius
纯 JS 改动，零 API / 数据库变更。所有已经能拿到 `userInfoCache` 命中的路径行为不变（优先级 1 保持不变），只是在缓存 miss 的窗口里从"直接掉到 dicebear"变成"先用后端下发的真实头像"。论坛/关注 Tab 因为本来就先 `await fetchUserInfos` 再映射，这层新增的回退对它们是 no-op。

---

## 2026-04-20: Web · 图片/视频封面加载期间的 shimmer 骨架

### Context
`FadeImage` 与 `VideoCover` 原本的加载体验只依赖父容器的 `bg-[#f0f0f0]/dark:bg-[#252525]` 背景色 + 解码完成后的 `opacity-0 → 100` 淡入。在弱网/首屏冷启动下，这段空白时间没有任何"正在加载"的视觉反馈，大图 / 瀑布流尤其明显。用户要求图片加载过程中加上 loading。

### Change
引入一个共享的 shimmer 骨架层作为所有封面媒体的统一 loading 反馈：
- 新增 `web/src/components/MediaSkeleton.tsx`：一个 `absolute inset-0` 的装饰性 `<span aria-hidden>`，内部是一条 `w-1/2` 的渐变高光带，通过 `animate-shimmer` 从 `translateX(-100%)` 扫到 `translateX(200%)`。`visible` 为 `false` 时做 500ms `opacity` fade-out，避免 pop。
- `FadeImage` 与 `VideoCover` 各自在原有 `loaded` state 上复用同一个骨架（`<MediaSkeleton visible={!loaded} />`），返回 fragment，骨架作为图片/视频的兄弟元素渲染在同一个 `relative` 父容器里。
- `tailwind.config.ts` 新增 `shimmer` keyframe + animation（1.8s ease-in-out infinite）。

### Design Decisions
- **DRY**：骨架逻辑只此一处 (`MediaSkeleton`)，两个调用方都不重复写渐变/动画 class —— 未来微调 loading 视觉只改一个文件。
- **契约不变**：原来 `FadeImage` 的 JSDoc 就写明"父容器 MUST 有 `relative` + 背景色 + `overflow-hidden`"，骨架沿用这一契约，所有已有调用方（`PostCard`、`communities/*`、`archive/*`、`users/[id]`、`posts/[id]` 等）都已满足，不需要改 call site。
- **`pointer-events-none` + `aria-hidden`**：骨架纯装饰，不拦截 `VideoCover` 的 hover 播放事件，也不污染屏幕阅读器语义。
- **扫光而非 `animate-pulse`**：editorial 风格下 shimmer 比 opacity 脉冲更"有加载意图"；暗色模式下高光从 `white/55` 降到 `white/6%`，避免在 `#252525` 底上过于刺眼。
- **兼容 `fill` 与显式 `width/height`**：`next/image` 在 `fill` 下是 `position: absolute; inset: 0`；显式尺寸时走文档流。两种情况下骨架都是 `absolute inset-0` 覆盖父容器，在图片 `opacity-0` 阶段盖住那段空白；`loaded=true` 后骨架与图片同步做 500ms 交叉淡入淡出。

### Files
- 新增：`web/src/components/MediaSkeleton.tsx`
- 修改：`web/src/components/FadeImage.tsx`（返回 fragment，附加骨架）
- 修改：`web/src/components/VideoCover.tsx`（返回 fragment，附加骨架）
- 修改：`web/tailwind.config.ts`（`shimmer` keyframe + animation）

### Blast Radius
仅触达两个叶子组件 + tailwind 主题；`PostCard`、archive、communities、users、posts 详情页无需改动。`npx tsc --noEmit` 通过。运行时只多挂一个 `<span>`（loading 结束后虽保留 DOM 但 `opacity: 0 + pointer-events: none`，零交互成本）。

---

## 2026-04-20: Data · 历史帖子封面尺寸回填脚本（migration 037 的兜底）

### Context
migration 037 下沉封面宽高的前提是：**新帖发布时写入** `cover_width` / `cover_height`，**老帖保持 NULL** 由前端回退到 3/4。但现在 144 条老帖全部 NULL，导致前端在它们身上依然走 `Image.getSize` 异步路径，瀑布流滚动过程中还是会被这批"尺寸未知"的卡片拖累。需要一次性把历史数据的封面实际像素尺寸抓回来补上。

### Tool
新增 `backend/scripts/backfill_post_cover_dimensions.py`，一次性数据回填脚本：
- 输入：Supabase Studio 导出的 `posts_rows.csv`。
- 对每行 `image_urls[0]`：JPEG/PNG/WebP 等图片走 `PIL.Image.open`（只解析 header，不 decode body），`.mp4`/`.mov` 走 `ffprobe` 取第一个视频流的 `width,height`。
- 并发 `ThreadPoolExecutor`（默认 8 workers），单请求 15s 超时 + 1 次重试。
- 输出两份文件到 `cover_backfill/`：
  - `cover_dimensions.sql`：`BEGIN; UPDATE posts SET cover_width=W, cover_height=H WHERE id=N AND cover_width IS NULL AND cover_height IS NULL; ... COMMIT;` —— 每条 UPDATE 都带 `IS NULL` 守卫，**重入安全**，不会覆盖期间新发布的帖子已经写入的尺寸。
  - `cover_dimensions.csv`：逐行审计（`post_id / asset_type / width / height / status / error / url`），便于应用前 spot-check。
- 脚本不直接写 DB，完全走 "生成 SQL → 人肉 review → Supabase Studio 里应用" 流程，避免一次性脚本误操作生产数据。

### Design Decisions
- **不入 requirements**：这是一次性工具，`Pillow` 已在后端 `requirements.txt`（10.2.0），`httpx` 也在（0.28.1），`ffprobe` 是 system-level 依赖（`brew install ffmpeg`），无需额外封装。
- **`--limit` 冒烟参数**：大规模跑之前可以 `--limit 10` 先过一遍，观察 audit CSV 再放量。
- **`ffprobe` 输出宽容解析**：初版只接受 "W,H" 严格格式，遇到某个 `.mov` 输出 `668,1552,\n`（尾逗号 / 多流）就炸。改成"抓第一行里前两个连续数字"，对所有 container 都鲁棒。
- **幂等保护落在 SQL 层**：`WHERE id = N AND cover_width IS NULL AND cover_height IS NULL` —— 即使用户再次重跑脚本并应用 SQL，后入库的新帖不会被老数据覆盖。

### Result（本次跑出来的数据画像）
144 条历史帖子全部解析成功（`ok=144`）。宽高比分布：
- `3:4 portrait`（0.6-0.85）：83 条（58%）
- `square`（0.85-1.15）：32 条（22%）
- `landscape`（1.15-1.6）：17 条（12%）
- `ultra-wide`（≥1.6）：7 条（5%）
- `tall`（<0.6）：5 条（3%）

说明前端 `clampAspectRatio([3/4, 16/9])` 的 clamp 范围确实会裁掉一部分"过窄/过宽"的极端值（~8%），但大多数帖子落在自然可显示区间内。

### Apply Workflow
```bash
cd backend && source venv/bin/activate
python scripts/backfill_post_cover_dimensions.py \\
    --csv ~/Downloads/posts_rows.csv \\
    --out-dir ~/Downloads/cover_backfill
# 人肉 review ~/Downloads/cover_backfill/cover_dimensions.csv
# Supabase Studio → SQL Editor → 粘贴 cover_dimensions.sql → Run
```

### Files
- 新增：`backend/scripts/backfill_post_cover_dimensions.py`

### Blast Radius
脚本本身只读 CSV + 抓取公开 Storage URL，不触达数据库；生成的 SQL 被 `IS NULL` 守卫 + `BEGIN/COMMIT` 事务包住，应用后单次 144 行 UPDATE 对 `posts` 表负载可忽略。应用成功后，前端下次 `getFeed` 拉到的老帖已经带上 `coverAspectRatio`，`useMediaAspectRatio` 走 `knownRatio` 分支，彻底跳过 `Image.getSize` —— 滚动掉帧的最后一块短板被补上。

---

## 2026-04-20: Chore · 静音 "Task orphaned for request" dev 噪音

### Context
调试 Discover 滚动性能时，Metro 日志被大量 iOS `NSURLSession` 的 `Task orphaned for request <NSMutableURLRequest ...>` warning 刷屏（URL 全部指向 Supabase Storage 上的帖子封面）。

### What It Means
`NSURLSessionTask` 在飞，但持有它的上层（`expo-image` 或 `Image.getSize`）在 MasonryFlashList 回收卡片时丢失了引用。iOS debug 版会提示"无主任务"，release 包不报、不崩、不影响任何功能 —— 纯 dev 日志污染。上游已知问题：expo#24614、RN#31837。

### Fix
`frontend/index.js` 在 `__DEV__` 下 `LogBox.ignoreLogs([/Task orphaned for request/])`，以正则静音，精准到这一条、不误伤其他 warning。生产构建分支完全不碰。

### Blast Radius
仅影响 dev 日志显示；不修改任何运行时行为，不触达组件树，不影响 release 包。日后若真遇到"图片请求泄漏"的正经问题，仍可通过 Instruments 的 Network 面板或自定义埋点诊断。

---

## 2026-04-20: Bugfix · 放弃 `optimizeItemArrangement`，改用客户端预平衡

### Symptom
即使堵住了 `onEndReached` 连环 fire、一页 26 条数据也会复现「顶部大片空白 + 卡片挤到屏幕最底部只露一角」。

### Root Cause
`MasonryFlashList` 的外层 `FlashList` 对自身 `estimatedItemSize` 的取值是硬编码的（见 `node_modules/@shopify/flash-list/src/MasonryFlashList.tsx:176-194`）：

```ts
const firstColumnHeight =
  (dataSet[0]?.length ?? 0) * (props.estimatedItemSize ?? defaultEstimatedItemSize);

// ...
<FlashList ... estimatedItemSize={firstColumnHeight || estimatedListSize.height} />
```

即「`dataSet[0].length × 320`」，它完全**忽略**我们喂给 `overrideItemLayout` 的精确高度。
`optimizeItemArrangement` 恰好会让两列的 `.length` 产生显著偏差（把矮图集中到 A 列、高图集中到 B 列），于是外层按粗糙估算得到的 contentSize 和内层列 FlashList 按精确 layout 算出来的实际高度口径不一致 → 外层 ScrollView 把第一屏定位到错误位置，视觉上就是顶部空白、卡片挤底。

### Fix
放弃 `optimizeItemArrangement`，改成**客户端预重排（pre-balance）+ naive `i % 2` 分列**：
- `arrangeForNaiveMasonry(posts)`：本地贪心模拟 2 列装箱，按估算高度把每条帖子放进"当前更矮"的那一列；
- 再把两列"zip"回一个数组，偶数位对应"概念左列"、奇数位对应"概念右列"；
- `MasonryFlashList` 继续走 `i % 2` naive 分列 → 每条帖子落到我们已经平衡过的那一侧；
- **两列 `.length` 必然相差 ≤ 1**，外层粗糙估算和内层精确测量就对齐了，布局 bug 消失。

同时保留 `overrideItemLayout` —— 它不会再参与 column 分配（naive 不看它），但仍会传给内层列 FlashList 用于精准回收，对滚动性能是正向的。

### Why Not …
- ❌ **继续用 `optimizeItemArrangement`**：就是本次 bug 的根因。
- ❌ **后端预排帖子**：会改变推荐排序的稳定性；预排 key 只是视觉高度，本应该由渲染层负责。
- ❌ **只靠 naive `i % 2`，不做预排**：回到最初的列失衡症状（用户已拒绝）。

### Files
- `frontend/src/screens/Discover/components/TabContent.tsx`
  - 新增 `arrangeForNaiveMasonry(posts)` + `MASONRY_COLUMNS` 常量；
  - `useMemo(currentPosts)` 在非 forum tab 下对 `tabPosts.map(convertToPost)` 做一次预排；
  - `<MasonryFlashList>` 去掉 `optimizeItemArrangement`，保留 `overrideItemLayout`；
  - `numColumns={2}` → `numColumns={MASONRY_COLUMNS}` 让常量成为单一事实源。

### Blast Radius
- `arrangeForNaiveMasonry` 只对 `recommend` / `following` 两个瀑布流 Tab 生效，`forum` 单列不动。
- 帖子在全局顺序上没变，仅**左右列位置**被决定性地重排（同一列内部的相对顺序仍严格按推荐顺序）。
- 复杂度 `O(N)`，N=当前 feed 总条数，对 146 条的极端情况也就 0.01ms 级别，不影响 JS-FPS。
- 保留了这一轮前面加的 momentum gate，`loadMore` 仍然只在用户真正滚动时触发。

---

## 2026-04-20: Bugfix · `optimizeItemArrangement` 开启后 `onEndReached` 连环 fire

### Symptom
用户刚进首页、没有任何手势操作，日志里就连发 5 次 `loadMore` —— `skip=0 → 26 → 56 → 86 → 116`，一口气把 146 条帖子抽了下来；视觉上要么顶部卡片只剩 footer、封面消失，要么整屏大片空白只有最底下露出卡片的一角。

### Root Cause
三条线叠加：
1. 今天早些时候开启了 `MasonryFlashList.optimizeItemArrangement` 做列平衡。
2. `MasonryFlashList` 内部在第 0 列首次 `onLoad` 时会**合成**一个 scroll 事件，并且每次 `data` 变化都会触发列重切分（`useDataSet` 依赖 `sourceData`）。
3. 在列表刚挂载 / 数据刚到达的一瞬间，外层 FlashList 报告的 `contentSize` 比最终真实高度小得多（内层列的 FlashList 还没测完），"距离底部"一度看起来 < `onEndReachedThreshold × viewport`，于是 `onEndReached` 在用户没滑动的情况下也能被触发。
4. `useFeedRecommendation.loadMore` 只用 `requestInFlight` 门防并发，不防"响应完了立刻又被调用"—— 于是每轮请求回来，紧接着又是一次 fire，链式雪崩。数据越灌越多、`useDataSet` 每次全量重切、帧丢得更多、合成 scroll 更频繁，恶性循环直到 `hasMore=false`。

### Fix
在 `TabContent` 层给 `onEndReached` 加一个 **momentum-scroll 门**（RN 社区防连环 `onEndReached` 的标准写法）：
- `onMomentumScrollBegin` 时把 `endReachedArmedRef` 置 `true`；
- `onEndReached` 只有在 armed 时才调用上层 `loadMore`，调用后立即 disarm；
- 合成 scroll 不带 momentum，所以永远不会 arm → 挂载态 / 数据到达态下的假 `onEndReached` 被整体挡住；
- 真用户滑到底时每次 momentum 只 fire 一次 loadMore，下一次 momentum 再 arm，自然的翻页节奏。

### Why Not …
- ❌ **回退 `optimizeItemArrangement`**：会回到"一列堆满一列空"的原始症状，用户已经拒绝过这个视觉。
- ❌ **在 `loadMore` 里加时间间隔 cooldown**：治标不治本，初始挂载那几次 fire 已经把 feed 污染完了；且时长难调（太短挡不住、太长影响真实翻页）。
- ❌ **调小 `onEndReachedThreshold`**：同样只是降低概率；合成 scroll 在 `contentSize` 极小时仍能触发。

### Files
- `frontend/src/screens/Discover/components/TabContent.tsx`
  - 新增 `useRef` 导入；
  - `endReachedArmedRef` + `handleMomentumScrollBegin` + `handleEndReached`；
  - `<MasonryFlashList>` 的 `onEndReached={handleEndReached}` + `onMomentumScrollBegin={handleMomentumScrollBegin}`。

### Blast Radius
- 仅影响推荐 / 关注 Tab 的 `MasonryFlashList` 分支；论坛 Tab 走 `FlatList`，行为不变。
- 初次进页不再自动预拉后续页 —— 这本来就是用户没要求的行为，属于修复噪声。
- 真用户滑到底时的翻页体验与原来一致（每次 momentum 触发一次 `loadMore`）。

---

## 2026-04-20: Perf · Discover 瀑布流两列失衡（新帖只追加到一列）

### Symptom
滚动到底部 `loadMore` 之后，Discover 推荐瀑布流经常出现「一列已经堆到新帖、另一列下方大段留白」的观感。首屏也偶尔能看到左列空着、右列才显示第一张卡（实机截图佐证）。

### Root Cause
`MasonryFlashList` 默认按 `i % numColumns` 把 item 机械分列（见 `@shopify/flash-list/src/MasonryFlashList.tsx` 的 `useDataSet`），**只关心奇偶、不关心列高**。一旦相邻帖子的 `coverAspectRatio` 差异明显（16:9 扁 vs 3:4 高 vs 4:5 竖），两列累计高度就会持续漂移；`loadMore` 到来时新 item 继续按奇偶落位，短的那列永远补不上来。

### Fix
启用 `optimizeItemArrangement` + 提供 `overrideItemLayout`，让 Masonry 每次都把新 item 分配到「当前最矮的列」。高度估算直接复用 migration 037 下沉的 `content.coverAspectRatio`，老帖 (`NULL` → `undefined`) 回退到 `3/4`，与 `PostCard` 的 fallback 对齐。

### Design Decisions
- **不引入新的测量路径**：`overrideItemLayout` 只是同步读 `coverAspectRatio`，不触发 `Image.getSize`，与 "封面尺寸下沉到后端" 的优化方向一致，不把 JS 线程再拖下来。
- **高度常量集中一处**：`CARD_WRAPPER_PADDING_H` / `CARD_WRAPPER_MARGIN_B` / `CARD_CHROME_HEIGHT` 放在 `TabContent.tsx` 顶部并写明含义，和 `masonryItemStyles.wrapper` + `PostCard` 的 title/author 行对齐；任何一端改样式时在同一个文件里就能看到。
- **`clampAspectRatio` 复用**：估算时 clamp 到 `[3/4, 16/9]`，与 `PostCard` 渲染时使用的 clamp 上下界保持一致，避免估算值和真实渲染高度脱节。
- **不动 forum tab**：论坛是单列 `FlatList`，天然不存在列间失衡问题。
- **不动 `ESTIMATED_ITEM_SIZE`**：它是 `MasonryFlashList` 交给内层 FlashList 回收器用的保守预估；`overrideItemLayout` 提供更精确值后，这个常量只剩「兜底」语义，保持 320 即可。

### Files
- `frontend/src/screens/Discover/components/TabContent.tsx`:
  - 新增 `estimateCardHeight(post)` 与相关布局常量；
  - `useCallback` 包出 `overrideItemLayout`；
  - `MasonryFlashList` 启用 `optimizeItemArrangement` + `overrideItemLayout`；
  - import `clampAspectRatio`。

### Blast Radius
- `MasonryFlashList` 在仓库里仅 `TabContent.tsx` 一处真正使用（其余是 doc string 引用），无连锁改动。
- 首次升级后已加载的 feed 会按新算法重排一次（同一条 item 可能换列），属一次性视觉调整；`key` 不变，React Query 缓存、点赞态、滚动位置均保留。
- 老帖 `coverAspectRatio = undefined` → 用 `3/4` 估算，与它们实际渲染的 fallback 比例一致，不会引入新偏差。

---

## 2026-04-20: DX · 实时 FPS HUD（滚动帧率可视化）

### Motivation
刚落地 "封面尺寸下沉到后端" 的 Discover 滚动优化，需要一个直观信号验证 `MasonryFlashList` 在滑动时的 JS 线程帧率是否真的回到 60。Expo/RN 自带的 PerfMonitor 只在 debug 菜单里，且信息密度低。做一个始终可见的浮层更适合边滑边看。

### Implementation
- 新增 `frontend/src/components/FpsMonitor.tsx`：
  - `requestAnimationFrame` 循环累帧，每 500ms 刷一次 `setState`（测量本身不会每帧触发 re-render）。
  - 显示 **当前 FPS + 窗口内最小 FPS**（min 用来捕获掉帧瞬间），颜色分级 `≥55` 绿 / `30-54` 黄 / `<30` 红。
  - 基于 `PanResponder` + `Animated.ValueXY` 可拖拽，落点会被 clamp 到可视安全区内；点击胶囊即可重置 min。
  - `pointerEvents="box-none"`：HUD 空白区域透传事件，不影响下层列表滑动。
  - 整个组件用 `if (!__DEV__) return null` 包住 —— release 包零运行时开销。
- `frontend/App.tsx` 在根 `View` 末尾挂一次 `<FpsMonitor />`，位于 `MaintenanceOverlay` 之后、`NavigationContainer` 同级，覆盖所有路由。

### Design Decisions
- **测 JS-FPS 而不是 UI-FPS**：RN 的 RAF 节拍由 JS 线程驱动；当瀑布流里的 `PostCard` / `useMediaAspectRatio` 之类在 JS 线程做重活时，RAF 会被拖慢，这正是本项目当前最关心的指标。UI 线程 FPS 需要原生模块，超出 "加个数字看一下" 的诉求。
- **500ms 采样 + 窗口 min**：100ms 噪声太大，1s 又掩盖短促掉帧；500ms 折中，min 再把窗口内谷值保留下来。
- **`__DEV__` 门禁 & 默认右上 safe-area 下**：保证不污染生产构建，且默认位置不挡顶部返回键 / 状态栏图标。

### Files
- 新增：`frontend/src/components/FpsMonitor.tsx`
- 修改：`frontend/App.tsx`（import + 根节点挂载）

### Blast Radius
仅 dev 构建可见；不引入任何新依赖（用现有 `react-native-safe-area-context`）；HUD 自身每秒触发 ~2 次 re-render，渲染树仅一个 `Animated.View` + `Pressable`，对 FPS 本身影响可忽略。

---

## 2026-04-20: Perf · Discover Masonry 滚动掉帧 —— 封面尺寸下沉到后端

### Symptom
移动端 `frontend/src/screens/Discover/components/TabContent.tsx` 的 `MasonryFlashList` 在首次滚动时会明显掉帧、抖动。原因链很清楚：
1. `PostCard` 通过 `useMediaAspectRatio` 在挂载后异步 `Image.getSize` / `getVideoThumbnail` 取封面自然比例；
2. 每张卡片从 `fallback = 3/4` 跳到真实比例时都会触发 `aspectRatio` 变化，进而重排瀑布流列；
3. 30 张卡片并行解码 + 重算 `MasonryFlashList` 列高，全落在 JS 线程上 —— 就是典型的"滚动到屏外的卡片一边解码一边把整列往下推"。

### Fix · 后端把封面尺寸一次性吐给客户端
把每个帖子的 `imageUrls[0]` 的 `width / height` 作为两列 `cover_width` / `cover_height` 存进 `posts`，在 feed / 详情 RPC 一并返回；发帖时由客户端 `ImagePicker` / `getVideoThumbnail` 拿到像素尺寸后写入。打开 feed 时 `PostCard` 直接拿 `post.content.coverAspectRatio`，彻底跳过 `Image.getSize` 异步路径。老帖子（尚未回填）保留 `3/4` fallback，不做一次性脚本回填 —— 随着用户编辑/重发自然过渡。

### Design Decisions
- **只存封面一张**：相册和内容段的图片尺寸不影响瀑布流布局，多存徒增写入成本。
- **`NULL` 合法 + 前端 clamp 到 `3/4`**：兼容 migration 037 前的历史帖子，避免后端批处理脚本；`useMediaAspectRatio` 仍作为降级通道继续测量。
- **`useMediaAspectRatio` 新增 `knownRatio` 参数**：调用方（`PostCard`）把 `coverAspectRatio` 作为 `knownRatio` 传入时，hook 立刻把值同步写入内部 state 并登记共享缓存，**完全跳过 `Image.getSize` 的 effect 分支**。这样不违反 Rules-of-Hooks（无条件调用），又能在有后端数据时零异步。
- **缓存沿用**：命中 `knownRatio` 时同步播种 `aspectRatioCache`，让详情页预取、兄弟卡片、视频缩略图等复用同一比例。

### Files · Backend
- `backend/app/db/migrations/037_add_post_cover_dimensions.sql`（新）：给 `posts` 加 `cover_width` / `cover_height`，并重建 `get_feed_scored` / `get_feed_longtail` RPC 返回这两列。
- `backend/app/db/init_tables.sql`：初始化新实例时带上两列。
- `backend/app/schemas/post.py`：`Post` / `CreatePostRequest` / `UpdatePostRequest` 加 `coverWidth` / `coverHeight`（`Optional[int]`，`Field(..., ge=1)` 校验）。
- `backend/app/services/post_service.py`：`_format_post` 透传，`create_post` / `update_post` 接收并入库。
- `backend/app/services/feed_service.py`：`format_post` 把 `cover_width/_height` 转成驼峰 `coverWidth/coverHeight`。
- `backend/app/api/routes/post.py`：`POST /api/posts` / `PUT /api/posts/:id` 把 `request.coverWidth/Height` 传给 service。

### Files · Frontend · Publish 路径
- `frontend/src/utils/useMediaAspectRatio.ts`：
  - 新增 `resolveCoverDimensions(uri, localDims?)` —— 发帖前同步/异步拿到封面 `{width, height}`，优先命中 picker 已有的 `localDims`，次之共享缓存，最后落到 `Image.getSize`。
  - 给 `useMediaAspectRatio` 加第三个参数 `knownRatio`，命中时 bypass 整个异步测量路径。
- `frontend/src/services/postService.ts`：`Post` / `CreatePostParams` / `UpdatePostParams` 补 `coverWidth/coverHeight`（JSDoc 指向 `Post.coverWidth` 的单一事实源）。`createPost` / `updatePost` 直接 `JSON.stringify(params)`，字段自动落到请求体。
- `frontend/src/store/uploadStore.ts`：`UploadPayload` 的 `createParams` / `updateParams` 类型由 `CreatePostParams` / `UpdatePostParams` 派生，因此新字段无需额外改动即可透传。
- 四个发布入口都调用 `resolveCoverDimensions(coverUri, imageDimensions)`：
  - `frontend/src/screens/PublishLookbookScreen.tsx`
  - `frontend/src/screens/PublishOutfitScreen.tsx`
  - `frontend/src/screens/PublishReviewScreen.tsx`
  - `frontend/src/screens/PublishForumPostScreen.tsx`
  - `handlePublish` 与 `handleSaveDraft` 两条路径都处理，草稿 → 发布 同样携带尺寸。

### Files · Frontend · 消费路径
- `frontend/src/screens/Discover/types.ts`：`DisplayPost.content.coverAspectRatio?: number`。
- `frontend/src/screens/Discover/utils.ts`：`mapApiPostToDisplayPost` 把 `apiPost.coverWidth / coverHeight` 转成 `coverAspectRatio`（除零安全）。
- `frontend/src/screens/Discover/components/TabContent.tsx`：`convertToPost` 沿着 `content.coverAspectRatio` 透传进 `PostCard.Post`。
- `frontend/src/components/PostCard.tsx`：`Post.content.coverAspectRatio?` 加上；渲染时 `useMediaAspectRatio(uri, 3/4, post.content?.coverAspectRatio)`，命中即零异步，未命中走原测量路径。
- `frontend/src/screens/CommunityDetailScreen.tsx`：`convertToPost` 开始填充 `content` 完整字段（原本只填 top-level），让社区页也受益。
- `frontend/src/screens/FavoritesScreen.tsx` / `MyLikesScreen.tsx` / `UserProfileScreen.tsx` / `Profile/hooks/useProfileData.ts` / `SearchScreen.tsx`：所有 API → Display/Card 的 mapper 都补上 `coverAspectRatio`。

### Blast Radius
- 既有帖子 `cover_width/_height = NULL` → 前端 `coverAspectRatio = undefined` → `useMediaAspectRatio` 走原 `Image.getSize` 分支，行为与改动前完全一致。
- 新帖 / 草稿编辑 → 自动写入尺寸 → 下一次进入 feed 直接跳过异步测量。
- Web 端未引用 `coverWidth/Height`，零影响；Web `DiscoverFeed` 已有自己的 onLoad 测量链路。
- RPC 重建是 `CREATE OR REPLACE`，无迁移风险；旧客户端忽略新字段。

---

## 2026-04-20: Bugfix · `/discover` 滚动加载时老帖子被打乱列位

### Symptom
用户反馈：滚动到底部触发 `loadMore` 后，之前已经看过的帖子会在列之间来回跳，新帖子并不是单纯"从下面长出来"。视觉上像整个瀑布流重新洗牌。

### Root Cause
上一版用 CSS `columns-1 sm:columns-2 lg:columns-3 xl:columns-4 [column-fill:_balance]` 做瀑布流。CSS 多列布局默认会 **balance** —— 每次 DOM 内容变化（例如 append 30 条新帖子），浏览器重新把**全部**帖子按列高均衡再分配一次，老帖子从 col 1 跑到 col 2 是 spec 定义的行为。`column-fill: auto` 在没有固定 `height` 约束下也走 balance 路径，救不了。

### Fix
换成纯 JS 的"按 index 静态分列"瀑布流，append-only by construction：

- 第 i 个 post 永远渲染在 `i % columnCount` 那一列。
- 数组尾部追加新 post → 老 post 的 index 不变 → 它的列不变 → **物理上不可能换列**。
- 用 flex 横排 N 列，每列内部再 flex 纵排；列内部是阅读顺序（col 0 第 1、2、3 个对应原列表 index 0、N、2N…）。

为什么**不用**"测量 DOM 高度 + greedy 分到最短列"这种更贴近移动端 `MasonryFlashList` 的方案？
1. 这个算法需要 `useEffect` + `ResizeObserver`，SSR 渲染时列里是空的 —— **直接掉 SEO**。
2. 批次到来到 effect 跑完之间有 1 帧空窗。
3. 高度差只来自图片自然比例，每张 PostCard 都已经 clamp 在 `[3/4, 16/9]`，`index % N` 分布在 40+ 条帖子后视觉上列高差不超过一张卡，肉眼几乎看不出差别；换来的是完全 deterministic 的布局。

唯一会重新洗牌的时机：viewport 穿过响应式断点（4→3→2→1 列），`columnCount` 变化 → `useMemo` 重算。这是 resize 场景下符合预期的行为。

### Files
- `web/src/components/discover/DiscoverFeed.tsx`：删掉 CSS `columns` 布局，新增 `useColumnCount` hook + `MasonryGrid` 子组件（纯 `useMemo` partition，无 ref / 无 effect）。
- `PostCard` 的 `masonry` 模式照旧 —— 封面 aspect-ratio 跟随图片自然比例，夹紧到 `[3/4, 16/9]`，提供视觉上的瀑布感。

### Blast Radius
只动了 `/discover` 的布局组件。`推荐` tab 的无限滚动分页逻辑（skip / excludeIds / sentinel）完全不受影响。`关注` tab 同步换成新布局。其他用 `PostCard` 的页面（`/users/[id]` / `/communities/[slug]` / `/archive/*` / `/me/*`）仍用等高 grid，零改动。

---

## 2026-04-20: Feature · `/discover` 推荐 Tab 无限滚动（Feed v2.1 三段式对接）

### Summary
把 Web 端 `/discover` 的 `推荐` tab 从"30 条封顶"升级为无限滚动，完整对齐移动端 `frontend/src/screens/Discover/hooks/useFeedRecommendation.ts` 的 Feed v2.1 客户端契约。`关注` tab 因后端 `GET /api/posts/following` 没有 skip/offset（仅支持 `limit ≤ 200`），维持"单次拉最多 100 条 + 结束分割线"。

### Design
- **分页契约对齐移动端**：
  - `skip` = **已消耗的帖子条数**（不是总 items 数）—— 后端据此决定走 Stage 1+2 还是 Stage 3。
  - `excludeIds` = 滑动去重窗口，上限 200；负数 ID 编码已看过的 Show 卡，防止 Stage 2 的 show-interleave 重复发券。
  - "已经没有更多" 判定：`newPostCount === 0` 才真的结束；`skip < STAGE2_END (26)` 下短页是"设计内短页"，继续乐观 hasMore；进入 Stage 3 后用 `newPostCount >= PAGE_SIZE` 判终点。
- **SSR 握手**：服务端 prefetch 首页（30 条，posts + show cards），把完整 `FeedItem[]` 透传给客户端。客户端渲染时只展示 `type === "post"`，但 show IDs 仍进 `excludeIdsRef`，保证第二页不会再拿到同样的 Show 卡。
- **触发方式**：`IntersectionObserver` 观察列表末尾的 sentinel，`rootMargin: "0 0 400px 0"` —— 在视口到达底部前约 400px 就开始预取，用户感知不到"加载等待"。
- **请求互斥**：`requestInFlightRef` 防止观察者在滚动中连发；`hasMore` 关闭后自动断开 observer。
- **失败软降级**：`loadMore` 失败不清空已渲染列表，只在底部展示"加载更多失败 + 重试"按钮；用户滚动位置不丢。
- **客户端分页走 `apiClient`**（非 Next.js 缓存的 SSR helper）—— 附 Bearer Token 做个性化，第二页起绕过边缘缓存。

### Files
- `web/src/lib/services/post.ts`：新增 `getFeedPage({ limit, skip, excludeIds })`，镜像 `frontend/src/services/postService.ts` 的 `getFeed` 但走 `apiClient`。
- `web/src/components/discover/DiscoverFeed.tsx`：改为持有 `FeedItem[]` + `skipRef` + `excludeIdsRef` + `hasMore`，挂一个 sentinel 做无限滚动；`关注` tab 不变（单次 `limit=100` 拉取）。
- `web/src/app/discover/page.tsx`：SSR 预取改成透传完整 `FeedItem[]`（不再提前过滤掉 show cards），这样 dedup 窗口初值正确。

### Blast Radius
- `推荐` tab：首屏仍是 SSR 的 30 条（SEO/首屏无变化），滚动到近底部开始无限叠加。
- `关注` tab：行为不变（+ 底部加了条"你关注的全部更新"分隔线）。
- 其它用到 `PostCard` / `getFeed` 的页面：零改动。`lib/api.ts` 的服务端 `getFeed` 未动，只加了并行的 `postService.getFeedPage` 做客户端分页。

---

## 2026-04-20: Feature · `/discover` 推荐/关注 Tabs + Masonry 瀑布流

### Summary
把 Web 端 `/discover` 从等高 `aspect-[3/4]` 四列网格升级到与移动端 `MasonryFlashList` 对齐的瀑布流，并加入 `推荐 / 关注` 双 Tab。

### Design
- **Masonry**：使用 CSS `columns-1 sm:columns-2 lg:columns-3 xl:columns-4` + 子节点 `break-inside-avoid mb-3`。无需 JS 测量、无需布局抖动、子节点保持可 SSR。
- **Card 高度差**：`PostCard` 新增 `masonry` 模式 —— 封面 `aspect-ratio` 跟随图片/视频自然比例，夹紧到 `[3/4, 16/9]`。这段夹紧区间与移动端 `frontend/src/components/PostCard.tsx` 的 `clampAspectRatio` 完全一致，两端视觉节奏保持一致。
- **SSR 分边**：`推荐` tab 在服务端 `getFeed()` 预取，保留 SEO 与首屏零客户端请求；`关注` tab 需要 Bearer Token，所以改在客户端按需拉 `/api/posts/following`（新增 `postService.getFollowingPosts`，镜像 `frontend/src/services/postService.ts`）。
- **未登录态**：`关注` tab 在 `hydrated && !isAuthenticated` 时渲染登录 CTA（`/auth/login?next=/discover`），与站内其他 auth-gated 入口一致。
- **登出兜底**：会话期间登出时清空 `followingPosts` 缓存，避免匿名访客看到陈旧列表。

### Cover aspect-ratio 测量
- 图片：`FadeImage` 原本就透传 `onLoad`，新回调里读 `e.currentTarget.naturalWidth/Height`。
- 视频：`VideoCover` 新增 `onAspectRatio?: (r: number) => void`，在 `onLoadedMetadata` 里从 `videoWidth/videoHeight` 派发。
- 初始占位用 `MIN_ASPECT = 3/4`（即原来的固定比例），测量到真实比例后一次性替换，不做过渡动画 —— 与 lazy-loaded 图片的惯常行为一致，避免竖变横时出现拉伸。

### Files
- `web/src/app/discover/page.tsx`：服务端只预取 `推荐`，交给 `DiscoverFeed` 客户端组件。
- `web/src/components/discover/DiscoverFeed.tsx`（新）：Tab 开关、masonry 容器、`关注` 按需拉取 + 登录 CTA。
- `web/src/components/PostCard.tsx`：加 `masonry` prop，封面 aspect-ratio 动态化；保持默认 `aspect-[3/4]` 不变以不影响用户主页、社区页等等高网格调用方。
- `web/src/components/VideoCover.tsx`：新增 `onAspectRatio` 回调。
- `web/src/lib/services/post.ts`：新增 `getFollowingPosts`。

### Blast Radius
`PostCard` 的 `masonry` 默认 `false`，所有既有调用方（`/users/[id]`、`/communities/[slug]`、`/archive/*`、`/me/*`、首页 `PostCard`）保持原等高网格行为；`VideoCover` 的 `onAspectRatio` 也是可选回调，现有静态比例的调用方零改动。

---

## 2026-04-20: UI · `/users/[id]` header 重排 —— 修复 cover 覆盖用户名 + 去重 follower 计数

### Symptom
视觉审查时看到 Avant Regard 官方主页 header 多处崩坏：
- 头像漂在 cover 中段，像没定位好的浮岛；
- `@username` 被拖进 cover 背景里（白字黑底所以"消失"了）；
- bio 挤在头像右侧一个窄列；
- `FollowButton` 内部还渲染了一次 "N 关注者"，和下方 stats 行里的"关注者"完全重复。

### Root Cause
旧结构把头像 + 文本块塞进同一个 `flex md:items-end`，再整体加 `-mt-12` 往上顶。结果是头像和用户名**一起**往上走，用户名就撞进 cover 里了。叠加 `FollowButton` 自带一份 follower 计数，就有了两份同义数字。

### Fix — Layout
`web/src/app/users/[id]/page.tsx` header 彻底分层，按信息层级重排：
1. Cover 独立为 hero，不再承载任何文字。
2. 下方先单独一行：头像（`-mt-14 md:-mt-16`，压住 cover 1/2，描边色对齐容器底色 `#f9f9f9 / #111`，而不是纯白，暗色下更协调）+ 右侧的 `FollowButton`。这一行用 `flex items-end justify-between`，关闭跨行拖拽。
3. 身份块（`@username` → bio → location）独占后续段落，`max-w-2xl` 给 bio 舒展空间，不再被头像挤。
4. Stats 行（帖子 / 关注者 / 关注中）作为唯一的数据行，保留原 divider。

头像尺寸也适度放大到 `h-28 w-28` / `md:h-32 w-32`，和放大后的 cover（`h-44 md:h-64`）比例更合。

### Fix — Data ownership
`web/src/components/user/FollowButton.tsx` 删掉内嵌的 `N 关注者` span 和 `initialFollowerCount` prop：
- 按钮只负责 follow / unfollow 状态（乐观更新 `已关注 / + 关注` 文案）；
- follower 数由页面 stats 行作为 single source of truth 持有；
- 代价：点完关注后 stat 数字要等页面 revalidate 才更新，可接受（比两个数字互相漂移好）。

### Files
- `web/src/app/users/[id]/page.tsx`
- `web/src/components/user/FollowButton.tsx`

---

## 2026-04-20: Bugfix · `/users/[id]` 关注按钮打到 `/is-following/undefined`

### Symptom
打开他人主页时控制台报错 —— `GET /api/follow/user/1/is-following/undefined` 直接 500/无法解析。关注按钮因 `targetUserId=undefined` 永远拿不到正确状态，也会让初次点击"关注"写入错误的 body。

### Root Cause
后端 `UserInfoVO` 返回的主键字段名是 `userId`（和移动端 `frontend/src/services/userInfoService.ts` 的 `UserInfo.userId` 一致），但 web 端 `web/src/lib/types.ts` 里把同名类型错写成了 `id: number`。`/users/[id]/page.tsx` 读的是 `user.id`，在运行时就是 `undefined`，被拼进 URL 后就成了 `…/is-following/undefined`。TypeScript 没有报错，因为类型谎报了结构。

### Fix
对齐 web `UserInfo` 与真实后端响应形状，消除"假类型"：
- `web/src/lib/types.ts`：`UserInfo` 改为 `userId: number`（再加 `infoId?: number` / `primaryTitle?: string` 和移动端保持一致），并加了注释警告 primary key 是 `userId` 而非 `id`。
- `web/src/app/users/[id]/page.tsx`：两处 `user.id` → `user.userId`（canonical URL + `FollowButton targetUserId`）。

### Blast Radius
`UserInfo` 的其他消费点（`/me`、`/settings/profile`）本来只读 `username / bio / location / avatarUrl / coverUrl`，不依赖主键字段，所以这次改动零副作用。`UserProfileInfo`（`web/src/lib/services/user-info.ts`）以前就在自己声明里用 `userId`，刚好覆盖对齐，不需要再改。

### Files
- `web/src/lib/types.ts`
- `web/src/app/users/[id]/page.tsx`

---

## 2026-04-20: Feature · `/stores` 默认"附近模式"—— 基于定位裁剪列表 + 地图聚焦

### Summary
之前 `/stores` 无差别把所有买手店一口气渲染到列表和地图上（几百条、DOM marker 炸渲染），体验极差。改成"**默认附近模式**"：
- 浏览器授权定位成功 → 按大圆距离排序取最近 20 家；地图以"你 + 这 20 家"的外接框自动 fit，并在你的真实坐标处放一个蓝色脉冲点。
- 用户手动输入任何筛选（国家 / 城市 / 品牌 / 关键词 / 仅营业中）→ 视筛选结果为意图，退出附近模式、完整展示筛选命中的店。
- 未授权 / 超时 / 浏览器不支持 → 默认仍只截取前 20 家，列表旁给出"未开启定位"提示。
- 头部新增状态条 + "显示全部 N 家 / 只显示附近" 切换按钮，用户可随时展开回全量视图。

### Why
直接上全量有三个问题：
1. `maplibre-gl` 用 DOM marker 渲染，500+ 家一次性挂载会卡主线程。
2. 右侧列表纵滚动几百条无人会看，遮蔽了"找附近的店"这个核心动机。
3. 第一次进来地图落在数据集第 0 家（北京 fallback），和用户实际位置脱节。
地图类产品的标准范式就是"跟随位置 + 视窗内列表"，这里按最小代价接入。

### Key Changes
- `web/src/components/stores/StoreMap.tsx`
  - 导出新类型 `LngLat`。
  - `StoreMap` 新增可选 `userPosition?: LngLat | null`：
    - 渲染一个蓝色脉冲 DOM marker（`bg-[#2F6BFF]` + 柔光圈）表示用户所在；
    - 参与 `fitBounds` —— 即便只有一个店也会一起 `padding: 56, maxZoom: 13` 做 fit，确保用户点和店点同时在屏幕里；
    - 当 `userPosition` 变化时只替换 user marker，不重建 map 实例；
    - 没有店但有定位时 `jumpTo(userPosition, 11)`，避免退化到北京 fallback。
- `web/src/app/stores/page.tsx`
  - 加 `distanceKm(a, b)` 纯函数（Haversine）+ `hasCoords` 谓词，集中坐标有效性判断。
  - 新增三段 state：
    - `userPos: LngLat | null`
    - `geoStatus: "idle" | "pending" | "granted" | "denied"` —— 用于提示条
    - `showAll: boolean` —— 显式"展开全部"切换
  - `useEffect` 挂载时单次调用 `navigator.geolocation.getCurrentPosition`，一次超时 8s、缓存 5min，失败不阻塞。
  - 新派生量 `visibleStores = useMemo(...)`，优先级链：
    1. `showAll=true` → 全量；
    2. 有任何筛选条件 → 尊重筛选，展示全部命中；
    3. 拿到定位 → 按距离排序取前 `NEARBY_LIMIT = 20`；
    4. 兜底 → 无序前 20 家。
  - `StoreMap` 和列表都读 `visibleStores` 而不是 `stores`；列表计数也从 `visibleStores.length / total` 显示。
  - 地图上方新增一行提示 + 切换按钮：根据 `geoStatus` / `hasActiveFilters` / `showAll` 三状态组合出文案（"正在获取当前位置…" / "已按距离显示你附近的 N 家门店" / "未开启定位，默认展示前 N 家门店" / "按筛选条件匹配 N 家门店"）。

### Dependencies Impacted
- 0 新增 npm 依赖，纯前端逻辑 + 已有 `maplibre-gl` marker API。
- `StoreMap` 现在导出 `LngLat`；当前唯一使用者是 `/stores/page.tsx`，已同步使用。
- 筛选行为 / URL 参数 / 后端 `fetchAllStores` 分页逻辑**无改动**——附近模式只影响前端呈现，依然基于完整数据集做距离排序。
- iOS / App 无影响（此变更仅在 web）。

### Verification
- `npx tsc --noEmit` 通过。
- `ReadLints` 对 `stores/page.tsx`、`StoreMap.tsx` 零报错。
- 三条回归路径预期表现：
  1. 浏览器允许定位 → 页面顶部"已按距离显示你附近的 20 家门店"，地图 fit 到你 + 20 家；点击任意卡切换选中 + map `flyTo`。
  2. 浏览器拒绝 / 超时 → "未开启定位，默认展示前 20 家门店"；地图按头 20 家 fit。
  3. 在搜索框输入品牌/城市 → 顶部提示变为"按筛选条件匹配 N 家门店"；列表和地图完整展示筛选结果。
- 切换"显示全部 N 家"按钮按预期展开 / 收起。

### Heads-up
- 浏览器地理位置 API 在非 HTTPS 环境下只允许 `localhost` 调用，部署到真实域名后务必保证 HTTPS。
- 若后续接入后端"地理半径查询"（服务端按 lng/lat/radius 过滤），只需把 `useSWR` 的 key 改成带 lng/lat 的，并用服务端结果替代前端的 `distanceKm + slice`，其他结构不需动。

---

## 2026-04-20: Bugfix · `/archive/brands` 500 —— next/image 拒绝非白名单 http 主机

### Summary
紧跟上一条「品牌档案 422」修复之后，品牌档案改从 `getAllBrands()` 正常拉到全量数据，但打开 `/archive/brands` 立刻 500：`Invalid src prop (http://www.oscardelarenta.com/cdn/shop/files/Logo.jpg?...) on next/image, hostname "www.oscardelarenta.com" is not configured under images in your next.config.js`。只要品牌数据里有任何一张外域 **http** logo，整页 SSR 就会抛错并进入 `NotFoundErrorBoundary` → `GlobalError`。

### Why
- `next.config.js` 原本已有 `{ protocol: "https", hostname: "**" }` 作为 catch-all，覆盖了全部 **https** 外域；但 brand 数据里还有不少品牌自建站 / 老 Shopify 商店（例如 `oscardelarenta.com`）以明文 `http://` 提供 logo —— 这些请求完全绕过了 catch-all。next/image 是一个 render-time 守卫，只要 src 不在白名单里就直接 throw，于是整张页面 500。
- brand cover URL 来自第三方爬取，协议、路径格式都不可控，未来还会遇到更奇怪的情况（相对路径 / data URI / 空串）。只改 `next.config.js` 能治 http，但不能治"别的畸形 src 又炸一次"；所以还叠一层前端守卫。

### Key Changes
- `web/next.config.js`
  - `images.remotePatterns` 在现有 `{ protocol: "https", hostname: "**" }` catch-all 之后追加一条 `{ protocol: "http", hostname: "**" }`。
  - 加注释说明：Next.js 自己会把上游 http 图拉下来再以 https 发给客户端，所以终端用户仍然是全链路 HTTPS；这样做只是让服务端 Image Optimizer 愿意代理这些老域名的 logo，安全面没有变化。
- `web/src/app/archive/brands/page.tsx`
  - 新增 `isRenderableImage(src)` 守卫：只认 `http(s)://…` 开头的绝对 URL，其他（空串 / `/foo.jpg` / `data:` / 非法协议）一律跳过 `<FadeImage>`，落到占位灰圆点。
  - 品牌列表每一项原来的 `{b.coverImage && <FadeImage …>}` 改为 `{isRenderableImage(b.coverImage) && <FadeImage …>}`，其余渲染逻辑不变。

### Dependencies Impacted
- 0 新增 npm 依赖。
- `next.config.js` 变更生效需要**重启 dev server**（Next 的 config 只在启动时读一次）。生产构建同理——部署时会自动重新读取，不需要额外操作。
- 其他页面（`/archive/brands/[id]`、`/archive/shows`、`/stores` 等）也会间接受益：它们即便将来拿到 http logo，也不会再 500，因为 next/image 的白名单扩大了；但本次未把 `isRenderableImage` 守卫扩散到所有页面——只有在目前明确已知会遇到畸形 src 的位置（brands A–Z 列表）加了守卫，避免大范围改动带来 regression。
- 对 mobile 端无影响。

### Verification
- `npx tsc --noEmit` 全量通过。
- `ReadLints` 对 `web/src/app/archive/brands/page.tsx`、`web/next.config.js` 零报错。
- 回归路径：重启 `npm run dev` 之后访问 `/archive/brands`，完整 A–Z 列表渲染；含 http logo 的品牌（例如 Oscar de la Renta）自动通过 Next Image Optimizer 被重新编码为 AVIF/WebP 并以 HTTPS 返回浏览器，不再抛 `Invalid src prop`。

### Heads-up
- dev 服务器需要**手动重启一次**，才能让新的 `next.config.js` 生效。热刷新只覆盖源码、不覆盖 Next 配置。

---

## 2026-04-20: Bugfix · 品牌档案 & 买手店列表 HTTP 422 —— 超出 backend `pageSize` 上限

### Summary
`/archive/brands` 打开报错「品牌档案加载失败：GET /api/brands?page=1&pageSize=1000 → HTTP 422」。根因：web SSR 端请求一次性拉全量品牌传了 `pageSize=1000`，而后端 `GET /api/brands` 的 `pageSize` 被 FastAPI 约束成 `Query(50, ge=1, le=200)`，任何 > 200 的值都会被 422 打回。同样的坑还埋在 `/stores`（客户端请求 `pageSize=500` 打 `/api/buyer-stores`，后端同样 `le=200`）。本次一并修掉，后端约束保持不动。

### Why
- 后端对 brands / shows / buyer-stores 三个列表的 `pageSize` 都硬编码为 `ge=1, le=200`，是合理的服务端防护；web 端一次要拉全量是前端偏好，不该越界。
- brands A–Z 索引页、stores 全球地图页都需要"所有符合条件的条目一次性渲染"，不能退化成分页 UI——解决思路是**把分页做在调用方而不是参数上**：以后端允许的最大 pageSize（200）为步长循环，直到 `running_count >= total` 或服务端返回短页。

### Key Changes
- `web/src/lib/api.ts`
  - 新增常量 `BRAND_PAGE_MAX = 200`、`STORE_PAGE_MAX = 200`，并导出 `STORE_MAX_PAGE_SIZE`。
  - `getBrands()` 默认 `pageSize` 从 500 改为 50，并 `Math.min(pageSize, BRAND_PAGE_MAX)` 兜底——调用方即便手滑传了 1000，也会被压回 200，永远不会触发 422。
  - 新增 `getAllBrands({ keyword?, category? })`：内部循环 `getBrands({ page, pageSize: 200 })` 直到把 `total` 条全部取完或收到短页为止。A–Z 索引页专用。
  - `getStores()` 同步：默认 `pageSize` 从 200 改为 50，并 `Math.min` 兜底。
- `web/src/app/archive/brands/page.tsx`
  - `getBrands({ pageSize: 1000 })` → `getAllBrands()`；A–Z 分组、字母索引条、渲染逻辑保持不变。
- `web/src/app/stores/page.tsx`
  - 在页面内新增客户端 `fetchAllStores(filters)` 工具：按 `STORE_PAGE_MAX = 200` 步长循环调 `/api/buyer-stores`，累加直到达到 `total` 或返回短页为止。
  - SWR fetcher 从 `apiClient.get(..., { pageSize: 500 })` 改为 `fetchAllStores(filters)`，彻底避开 422。

### Dependencies Impacted
- 0 新增 npm 依赖。
- 后端不动（继续维持 `le=200` 的 pageSize 硬约束）。
- 数据量：对于 N 条品牌，请求次数 = `ceil(N/200)`。品牌库约 200–400 条量级，最多 2 次请求；stores 类似。SSR 端的 Next.js `fetch` 缓存（`revalidate: 300`）对每一页独立缓存 5 分钟，累计成本可控。
- 对 mobile 端完全无影响（mobile 本来就是 50 per page + 分页 UI）。

### Verification
- `npx tsc --noEmit` 全量通过。
- `ReadLints` 对 `web/src/lib/api.ts`、`web/src/app/archive/brands/page.tsx`、`web/src/app/stores/page.tsx` 零报错。
- 回归路径：访问 `/archive/brands`，不再看到 422，A–Z 索引能正常渲染全量品牌；访问 `/stores`，地图 + 列表可以拿到超过 200 条店铺（若数据库里有这么多）。

---

## 2026-04-20: iOS Dev Client 修复 —— 解决 `AutoLayoutView was not found in UIManager`

### Summary
Discover 页打开即 crash 报 `requireNativeComponent: "AutoLayoutView" was not found in the UIManager`（调用栈 `MasonryFlashList → FlashList → ProgressiveListView → AutoLayoutView`）。根因是本地 iOS 工程的 CocoaPods 从未成功安装完整：`Podfile.lock` 里声明了 `RNFlashList 1.6.4`，但 `ios/Pods/` 下只有 20 个纯 C/Obj-C 第三方 Pod（DoubleConversion、SDWebImage、libavif 等），所有 React / Expo / RNFlashList / RNScreens 的 headers 与 target support files 都缺失。模拟器里跑着的是一份更早的 EAS dev build，不含 FlashList 原生代码，于是 JS 端 `MasonryFlashList` 一注册原生组件就抛 Invariant。

### Why
JS 端 import 的 `@shopify/flash-list` 只是薄壳，`AutoLayoutView` 是 iOS 原生组件，必须编译进 app 二进制。只重启 Metro 不会重建原生，必须走 `pod install` + `expo run:ios`，让 Xcode 把 RNFlashList 打进 `AvantRegard.app`。

### Key Changes
- **清理构建产物**：`rm -rf ios/Pods ios/build ~/Library/Developer/Xcode/DerivedData/AvantRegard-* node_modules/.cache .expo`，并 `watchman watch-del-all` 让 Metro 重建索引。
- **重装 Pods**：`cd ios && pod install --repo-update`，从 20 个 Pod 扩充到 99 个（新增 React-Core / RNFlashList / RNScreens / ReactCommon / expo-dev-launcher 等完整依赖）。
- **本地原生构建**：`npx expo run:ios --device <iPhone 16 Pro iOS 26.0 UDID>`，Xcode 编译成功（0 error，4 warnings，约 4 分钟），产物落在 `~/Library/Developer/Xcode/DerivedData/AvantRegard-fqyerispvcjwhubjinalwrflaysb/Build/Products/Debug-iphonesimulator/AvantRegard.app`。
- **安装并启动 app**：用 `xcrun simctl install` 把新 .app 装进模拟器，用 `xcrun simctl launch` 启动 `com.yanggg96.avant-regard`（bundle id 来自 `Info.plist`）；通过 deep link `exp+avant-regard://expo-development-client/?url=...` 让 dev-client 直连本机 Metro。
- **Metro 启动修正**：发现当前 shell 环境里有残留的 `CI=1`，`expo start` 会提示 "Metro is running in CI mode, reloads are disabled"，热重载被禁。改用 `env -u CI npx expo start --clear` 启 Metro，恢复 watch 模式。

### Dependencies Impacted
- 不新增任何 npm 依赖；`@shopify/flash-list@1.6.4` 早在 `package.json` 与 `Podfile.lock` 中声明，只是原生侧从未真正安装。
- 仅重建本地 Xcode 工件与 CocoaPods 依赖树，`Podfile.lock` 哈希未变。

### Verification
- Metro log：`iOS Bundled 6095ms index.js (2869 modules)`、`Auth store rehydrated: success`、`Token refreshed successfully`，不再出现 `AutoLayoutView` Invariant。
- Discover 页（`TabContent` 内的 `MasonryFlashList`）正常渲染。

### Follow-ups
- 若后续再出现 `requireNativeComponent: "<SomeView>" was not found`，先查 `ios/Pods/Target Support Files/` 是否有对应 target、再决定是否重跑 `pod install` + `expo run:ios`；**只改 JS / TS** 时绝不需要重建原生，按 `r` 重载即可。
- 需要排查 shell 为什么默认 `CI=1`（可能是之前某次 CI 测试残留），否则每次开 Metro 都要手动 `unset CI`。

---

## 2026-04-20: Web 功能移植 · Phase 6 + Phase 7 —— `/me` 个人中心 + `/settings` 设置（登录态全量互动入口）

### Summary
把移动端「我的」与「设置」两个 tab 全部搬到 web：`/me` 是个人中心概览（我的头像、昵称、粉丝/关注/发布/未读数、六个快捷入口），`/me/likes` · `/me/favorites` · `/me/wants` 是三条互动内容列表（复用同一个 `MyPostList` 组件），`/me/follows` 是关注 / 粉丝两 tab 列表，`/me/chats` + `/me/chats/[id]` 是 DM 会话列表 + 对话详情（REST 轮询 3 s，乐观发送），`/me/notifications` 是通知中心（乐观标记已读、一键全部已读、单条删除）。`/settings` 默认重定向到 `/settings/profile`，另有 `/settings/password`、`/settings/blocked`、`/settings/reports` 四个子页，全部接入 backend 真实端点。新引入一个客户端路由守卫 `AuthRequired`，未登录用户访问 /me 或 /settings 会被自动带上 `?next=` 跳去 `/auth/login`。

### Why
- Phase 1–5 已经把「公开浏览 + 互动写」都打通了，但用户没有任何一个"看自己"的入口——点过的赞、关注的人、私信、通知全部只能在 app 里看。Phase 6 就是补上这个缺口。
- Phase 7 (设置) 紧跟 Phase 6：既然已经允许用户在 web 上登录、互动、聊天，就必须允许他在 web 上改资料、改密码、管理屏蔽列表、查看自己的举报记录。这也是合规的最低要求（Apple 1.2 UGC policy 要求用户能随时看到自己举报的处理状态）。
- 一次性交付 Phase 6 + 7 是因为两者共用同一套 sidebar、同一个 `AuthRequired` 守卫、同一套 service 层——拆两次发版只会带来重复的 review 噪声。

### Key Changes
- **认证与布局层**
  - `web/src/components/auth/AuthRequired.tsx`（新增）—— 客户端路由守卫：等 Zustand 水合完成再判断，未登录跳 `/auth/login?next=<encoded>`；水合中显示 skeleton 文案。
  - `web/src/components/me/MeNav.tsx`（新增）—— 侧边导航组件：按 `group` 分组，`pathname.startsWith` 命中高亮，嵌套路由（`/me/chats/123`）也能点亮父项。
  - `web/src/components/me/nav-items.ts`（新增）—— `/me` 与 `/settings` 共用的 11 条 nav 单一来源，后续新增入口只改这一个文件。
  - `web/src/app/me/layout.tsx`、`web/src/app/settings/layout.tsx`（新增）—— 2 列布局 `[200px] + [minmax(0,1fr)]`，外面包 `AuthRequired`，侧栏读同一份 `ME_NAV_ITEMS`。
- **Service 层（全部走 web `apiClient`，自动带 Bearer、自动 401 refresh）**
  - `web/src/lib/services/chat.ts`（新增）—— REST-only chat service：getConversations / createConversation / getMessages / sendMessage / markRead / markUnread / deleteConversation / getUnreadCount。WebSocket 意图省略（web 场景用轮询更稳，后续可挂 `chatService.ws`）。
  - `web/src/lib/services/notification.ts`（新增）—— `NotificationResponse` → `Notification` 转换函数（携带 actorAvatar、postImage、navigate\* 字段）；`getAll / getUnread / getUnreadCount / markAsRead / markAllAsRead / delete / clearAll`。
  - `web/src/lib/services/user-info.ts`（新增）—— `get / update / getProfile / updateProfile / getPrivacy / updatePrivacy`；有意**不**包含 avatar / cover 的文件上传（web 写作用范围内不做 binary upload，只允许粘贴外链 URL）。
  - `web/src/lib/services/moderation.ts`（新增）—— `reportContent / blockUser / unblockUser / getBlockedUsers / getMyReports`，类型与 mobile 端对齐。
- **Phase 6 —— /me 页面**
  - `web/src/app/me/page.tsx` ——　概览：头像 + 昵称 + bio + location、4 张 Stat 卡（发布 / 关注中 / 粉丝 / 待读）、6 张 Tile（点赞 / 收藏 / 愿望单 / 关注与粉丝 / 私信 / 通知）；未读消息和未读通知各用 SWR `refreshInterval: 30s` 自动刷新。
  - `web/src/components/me/MyPostList.tsx` —— DRY 抽象：接受 `fetcher` + `swrKey` + `title/description/emptyCopy`，用于 likes/favorites/wants 三页。空态文案写得足够具体，避免出现"列表为空"式的空壳。
  - `web/src/app/me/likes/page.tsx`、`favorites/page.tsx`、`wants/page.tsx` —— 各 8 行胶水代码，指向 `postService.getLiked/Favorite/WantedPostsByUserId`。
  - `web/src/app/me/follows/page.tsx` —— Tabs 通过 `?tab=following|followers` URL 驱动，从 `/me` 页的 stat 卡深链过来直接命中对应 tab；列表用 `followService.getFollowingUsers / getFollowers`。
  - `web/src/app/me/chats/page.tsx` —— 会话列表：SWR `refreshInterval: 15s`，显示对方头像、昵称、最后一条消息预览、未读数 badge。
  - `web/src/app/me/chats/[id]/page.tsx` —— 会话详情：SWR `refreshInterval: 3s` 轮询拉 `getMessages(conversationId, 100)`，进入页面立刻 `markRead` 并 invalidate 会话列表未读数；发送消息 **乐观更新**（临时 id = -Date.now()），失败回滚 + 错误提示；Enter 发送 / Shift+Enter 换行；自动滚到底部。
  - `web/src/app/me/notifications/page.tsx` —— 通知列表：未读用浅底色 + 红点，点击自动 markAsRead + 按 `actionData` 跳转（externalUrl 新窗口 / postId → `/posts/:id` / userId → `/users/:id`）；「全部标为已读」一次调用、本地同步置 isRead = true；单条删除按钮乐观隐藏该行。
- **Phase 7 —— /settings 页面**
  - `web/src/app/settings/page.tsx` —— `redirect("/settings/profile")`。
  - `web/src/app/settings/profile/page.tsx` —— 编辑资料：用户名、所在地、简介（240 字上限计数）、头像 URL、封面 URL。头像实时预览（`next/image` + `unoptimized` 防止陌生域名被拒）。保存成功后同时 `authStore.updateUser()` 与 SWR `mutate`，头部 UserMenu 头像/昵称立即刷新。
  - `web/src/app/settings/password/page.tsx` —— 修改密码：三字段 + 本地校验（长度 ≥ 6、两次一致）+ 调 `/api/auth/change-password` 带 Bearer token；失败显示 backend message，成功清空表单且不登出用户。
  - `web/src/app/settings/blocked/page.tsx` —— 屏蔽用户列表：`moderationService.getBlockedUsers`；「取消屏蔽」按钮乐观移除行，失败回滚并 alert。
  - `web/src/app/settings/reports/page.tsx` —— 我的举报：`moderationService.getMyReports(page, 20)`，分页通过 `?page=N`；每行显示 targetType 中文标签（帖子 / 评论 / 私信 / 用户）+ 标题或用户名 + 原因 + 描述 + 状态徽章（PENDING 黄、REVIEWED 灰、RESOLVED 绿、DISMISSED 红）+ 创建时间。

### Dependencies Impacted
- 不新增任何 npm 依赖——所有功能都用已安装的 `swr`、`zustand`、`next/image` 即可。
- 后端端点全部已经存在（`/api/user-info/*`、`/api/follow/*`、`/api/chat/*`、`/api/notifications/*`、`/api/moderation/*`、`/api/auth/change-password`）；不需要任何后端改动。
- `SiteHeader` 里的 `UserMenu` 早已链接 `/me` / `/me/chats` / `/me/notifications` / `/settings`（Phase 1 搭好）；本阶段终于把这些链接的目标页建好，点击不再 404。
- `lib/types.ts` 的 `UserInfo` 被新增的 `user-info.ts` service 直接复用，不做 shape 变更。
- 安全：所有 `/me/*` 与 `/settings/*` 经 `AuthRequired` 在客户端强制 redirect；Server-side 还额外依赖 `apiClient` 的 401 → refresh → 再失败则 logout 链路，双保险。
- 写作用范围：严格遵守此前对齐的 "web 只做互动类写操作"：头像 / 封面 / 封面 URL 编辑，个人资料编辑，改密码，屏蔽管理——全部是对**自己账号**或对**关系**的写；**不**做发帖、发评论以外的内容创作（评论发表在 Phase 2.2 已打通、发帖仍留在 app）。

### Verification
- `npx tsc --noEmit` 全量通过。
- `ReadLints` 对 `web/src/app/me/**`、`web/src/app/settings/**`、`web/src/components/me/**`、`web/src/lib/services/**` 零报错。
- 手工路由图：`/me` → 4 stat + 6 tile · `/me/likes` · `/me/favorites` · `/me/wants` · `/me/follows?tab=following|followers` · `/me/chats` → `/me/chats/:id` · `/me/notifications` · `/settings` → 302 `/settings/profile` · `/settings/password` · `/settings/blocked` · `/settings/reports`。匿名访问任何一个都会被带上 `?next=` 跳登录。

---

## 2026-04-20: Web 功能移植 · Phase 5 —— `/stores` 买手店地图（maplibre-gl + SSR 详情页）

### Summary
把移动端的 Buyer Store Map 功能移植到 web：`/stores` 是一个客户端渲染的「地图 + 列表 + 筛选」一体化页面，地图部分基于 `maplibre-gl` + OpenStreetMap 光栅瓦片（零 API Key 依赖），列表使用 SWR 按当前筛选条件拉取后端 `/api/buyer-stores`；`/stores/[id]` 是 SSR 的店铺详情页，承载店名、地址、电话、营业时间、图集、品牌与风格标签、Google Maps 跳转。筛选（国家 / 城市 / 品牌 / 关键词 / 仅营业中）全部落在 URL 查询参数里，支持浏览器前进后退与链接分享。

### Why
- 移动端 buyer-store 地图已经验证是高价值 feature：全球 400+ 家独立买手店是 Avant Regard 的差异化资产；web 作为"独立内容站"也必须能查。
- 按本轮移植范围决策：web 不做 upload / submissions 写操作，只做读取 + 互动；地图 + 详情正好是纯读取侧，优先级最高。
- 用 OSM 光栅 Style 代替 Mapbox，避免再引入一条付费 API Key 的生产依赖。

### Key Changes
- `web/src/lib/api.ts`
  - 新增 `BuyerStore` 接口、`StoreListResponse` 类型和 SSR 端拉数方法：`getStores(filters)`、`getStoreById(id)`、`getStoreCountries()`、`getStoreCities(country?)`，全部走 Next.js `fetch` 缓存（`revalidate: 300`，打上 `buyer-stores` / `store-${id}` / `store-countries` / `store-cities` 等 tag，方便后续 revalidate）。
- `web/src/components/stores/StoreMap.tsx`（新增，`"use client"`）
  - 内联 OSM raster `style.json`（`https://a.tile.openstreetmap.org/{z}/{x}/{y}.png`，带 attribution），0 API Key。
  - 首次挂载：按第一个有效坐标或兜底（北京 `116.4074, 39.9042`）建图；多于 1 个 store 时自动 `fitBounds`（padding 56、maxZoom 12）。
  - Markers 用纯 DOM `<button>` + Tailwind 样式渲染（圆点 + 白描边 + hover 放大 + focus ring），避免引入额外 sprite。
  - 对外暴露 `selectedId` / `onSelect` 受控接口：列表点选 → `flyTo` + marker 视觉高亮；地图点 marker → 通知列表选中并 scroll。
  - 仅 side-effect 引入 `maplibre-gl/dist/maplibre-gl.css`，只在 /stores 路由被访问时才加载进 bundle。
- `web/src/app/stores/page.tsx`（新增，`"use client"`）
  - 顶部筛选条：`q` 搜索、`country`、`city`、`brand`、`openOnly`、清除按钮，全部 `router.replace` 把状态写回 URL。
  - 数据层用 SWR，key = `["buyer-stores", JSON.stringify(filters)]`，fetcher 调用 `apiClient.get("/api/buyer-stores", { ...filters, pageSize: 500 })`——同一个 envelope 解包 + 401 刷新的 client。
  - 布局：`lg:grid-cols-[minmax(0,1fr)_360px]`，左地图右列表，列表项显示店名、Open 徽章、国家/城市、地址截断、"查看详情"内部跳转。
  - 双向联动：列表点 item → 设 `selectedId` → 地图 flyTo；地图点 marker → 同样设 `selectedId` → 列表高亮当前行。
- `web/src/app/stores/[id]/page.tsx`（新增，Server Component）
  - `generateMetadata` 基于真实店铺生成 `title` / `description`；未查到则 404。
  - Hero 双列：左 4:3 封面（首张图或 No image 占位），右列为店名、国家城市 meta、描述、地址 / 营业 / 电话 / 评分 / 休息的 `dt/dd` 表、Google Maps 外链。
  - 若 `images.length > 1` 额外渲染 2～n 张图的 3 列图集；品牌与风格标签分别以 outline / soft 两种 chip 呈现。
  - Footer 提供"返回买手店地图"内部出口。
- 依赖：`maplibre-gl ^5.23.0` 已在仓库根 `package.json` 里登记并安装（monorepo 顶层 `node_modules/maplibre-gl`）。

### Dependencies Impacted
- 新增运行时依赖：`maplibre-gl`（顶层仓库已安装）。CSS 通过 side-effect import 随 `/stores` chunk 自动加载，不污染全站 bundle。
- 不新增后端端点；沿用 `/api/buyer-stores`、`/api/buyer-stores/:id`、`/api/buyer-stores/countries`、`/api/buyer-stores/cities`。
- `SiteHeader` 中「买手店」导航项早在 Phase 1.5 就已加入，本阶段终于落地可用。
- 认证：店铺列表与详情不要求登录（SSR + 匿名 SWR 均可）；一旦登录用户 token 存在，`apiClient` 会带上，以便后续加入「收藏店铺 / 评价」互动写操作时直接复用同一条链路。

### Verification
- `npx tsc --noEmit` 全量通过（先修掉 maplibre `attributionControl: true` → `{}` 的类型错误）。
- `ReadLints` 对 `web/src/app/stores/page.tsx`、`web/src/app/stores/[id]/page.tsx`、`web/src/components/stores/StoreMap.tsx`、`web/src/lib/api.ts` 零报错。
- 路由手验：`/stores` 地图 + 列表 + 筛选 + 查询参数回显；`/stores/[id]` SSR 数据齐、Google Maps 链接正确使用 `lat,lng`。

---

## 2026-04-20: 新增 `/app` iOS App Landing 页 —— 把所有 app 介绍集中到一个专属入口

### Summary
继上一次"整个 web 去 app 引导"之后，保留一个**唯一的、集中化的** App Landing 页 `/app`：把 App Store 上 Avant Regard 的完整介绍（定位、四大能力、受众、v1.1 更新、基础信息）整合到这一页。主站的首页、Discover、Post、User、Header、Footer 仍然保持 app-agnostic，不从任何 UI 位置跳向 `/app`——这个页面存在的意义是：被外部渠道（二维码、社媒 bio、媒体投放、新闻稿、邮件签名）直接链过来，可以独立作为一份"产品 Brief / Press Kit"承接流量。

### Why
- 用户要求：把整个 app 介绍集中到一个 App Landing 页，并提供真实下载链接 `https://apps.apple.com/us/app/avant-regard/id6756938671`。
- App Store 实际定位是 **Archive 典藏（发现 Archive · 连接买手店 · 移动时装档案）**，并非此前文案里模糊的"先锋时装社区 app"。集中页是一次机会，把 app 的产品定位、差异点、目标人群精准表达清楚（Archivist、买手、藏家、造型师、研究者、旅行者）。
- 与此前"主站去 app 引导"的方向不冲突：主站负责承接"搜索 + 内容浏览"，`/app` 负责承接"外部导流 → 安装"，两条路分离，各司其职。

### Key Changes
- `web/src/app/app/page.tsx`（**新增**，唯一页面，不引用任何 app 外的私有组件）
  - **Hero**：chip `iOS App · v1.1` + 大标题「Archive，随身携带。」+ 副标题（直译 App Store 首段 slogan）+ 主 CTA（真实的 App Store 下载按钮，`target="_blank" rel="noopener noreferrer"`）+ 副 CTA「了解能力」锚点跳到 `#features` + 元信息行 `Free · iOS 13.4+ · ★ 5.0 · 3 Ratings`。
  - 右侧是纯 CSS 渲染的方形 app icon 卡（黑底 + Playfair 双行 `Avant / Regard` + Inter `ARCHIVE` micro-label），用 `animate-scale-in`，不依赖任何外部图片资产，便于后续替换真实图标时直接 swap。
  - **Tagline bar**：一条细分隔带，承载 App Store 副标题「发现 Archive · 连接买手店 · 移动时装档案」作为品牌定位。
  - **Features（#features）**：2×2 栅格，4 张卡对应 App Store 介绍里的四大能力（400+ 买手店 / 200+ 设计师 · 9000+ 秀场 / Archivist 社区 / Archive 文化学习）。视觉结构与首页 Features 网格完全对齐（`gap-px` + hover 微灰背景 + 数字水印），保证站点内部两处 Features 体系一致。
  - **Who it's for**：2 列列表，严格照搬 App Store 的受众画像 5 条，右下附引语「加入 Avantregard Archive，成为一名真正的 Archivist，拥有属于你的时装史入口」。
  - **What's New · v1.1**：顺序呈现 5 条更新（对话与社交 / 视觉与体验 / 创作者称号 / 通知能力 / 买手店地图更新），每条三栏布局 `序号 · 标题 · 描述`，便于未来加 v1.2/v1.3 时同样结构复用。
  - **Information**：10 条 `dt/dd` meta（类别 / 价格 / 版本 / 大小 / 系统要求 / 语言 / 评分 / 年龄分级 / 开发者 / Copyright），数据全部来自 App Store 页面，用于严肃场景引用时避免信息错漏。
  - **Final CTA**：黑底大字「拥有属于你的时装史入口。」+ 反色 App Store 按钮 + 「返回首页 →」内部链接，给访客一个出口。
  - 所有 section 使用已有的 `AnimateIn`（IntersectionObserver 渐显）、`chip`、`btn-secondary`、`text-hero`、`text-display`、`animate-slide-up`、`animate-scale-in`、`font-serif / font-label` 等站内既有 token，0 新增依赖、0 新增组件。
  - 内部实现了一个局部 `AppStoreButton`（两个 variant：黑底白字 / 白底黑字）替代此前的 `DownloadCTAs`。该按钮**仅出现在这一页**，避免再次扩散到主站。
- `web/src/lib/config.ts`
  - 重新加回 `appStoreUrl`，默认值 = `https://apps.apple.com/us/app/avant-regard/id6756938671`（App Store US 区真实链接，id 6756938671），可被 `NEXT_PUBLIC_APP_STORE_URL` 环境变量覆盖（例如做中国大陆区切换 / 渠道追踪时）。注释里明确写"仅被 `/app` 引用"，避免未来又被散出到主站。
- `web/.env.example`
  - 重新加回 `NEXT_PUBLIC_APP_STORE_URL` 一条（不再保留 Play Store 相关变量——目前 App Store 是唯一上线端）。
- `web/src/app/sitemap.ts`
  - `/app` 以 priority 0.6 加入 sitemap（首页 1.0 / Discover 0.9 / App 0.6，符合内容为主、下载为辅的优先级定义）。
- `web/src/app/app/page.tsx` 的 `<title>` / `<meta description>` / OG：
  - `title` 模板命中 `iOS App · Avant Regard`。
  - `description` 使用 app-store 真实文案的浓缩版：`Avant Regard 是为真正时装爱好者打造的 Archive 典藏 app：全球 400+ 买手店地图、200+ 设计师与 9000+ 秀场档案、专业 Archivist 社区。iOS 端免费下载。`。
  - `alternates.canonical = /app`、`openGraph.url = ${siteUrl}/app`，避免与主域 OG 冲突。

### Dependencies Impacted
- 不新增 / 不升级任何 npm 依赖。
- 不新增任何 `/web/public` 资产；app icon 区块用纯 CSS + 字体渲染，等有官方 icon 素材时，直接在 Hero 右侧 mockup 容器内换成 `<Image />` 即可。
- 对后端 / `frontend/` 移动端完全无影响。
- 环境变量方面：部署环境（Vercel / CI）如需覆盖默认 App Store URL（例如把 `us` 切到 `cn` 或带 `mt=8` 渠道参数），只需设置 `NEXT_PUBLIC_APP_STORE_URL`；不设置就走默认值，生产可直接跑。
- SEO：`/app` 已被 sitemap 覆盖；主站 Header/Footer 故意不加链接，继续保持主站"内容站"调性。若后续想要一个轻量入口（比如 Footer 里的「iOS App」），可单独再加一次，不阻塞本次交付。

### Verification
- `ReadLints` 对 `web/src/app/app/page.tsx`、`web/src/lib/config.ts`、`web/src/app/sitemap.ts` 零报错。
- `npx tsc --noEmit`（清掉旧 `.next/types` 缓存后）全量通过。
- 人工走查：`/app` 页的每一处事实性陈述（Free / iOS 13.4+ / 126.8 MB / 5.0 · 3 Ratings / 200+ 设计师 · 9000+ 秀场 / 400+ 买手店 / v1.1 的 5 条更新 / 开发者 Shanghai Nanteke Industrial Co., Ltd. / Copyright © 2026 Avantregard）均直接对应 App Store 官方页面，避免后续被用户 / 用户的用户当作"虚标"。
- App Store 链接直接使用用户给定的 `https://apps.apple.com/us/app/avant-regard/id6756938671`，button 带 `target="_blank" rel="noopener noreferrer"`，避免 tab 劫持。

---

## 2026-04-20: Web 站点全面去除 app 下载引导 —— 从"落地页导流"定位切到"独立内容站点"

### Summary
此前 web 几乎每个页面都带有"下载 App 互动 / 在 App 中关注 / 打开 app 即可点赞评论"一类跳转 CTA（Hero、About、Discover 头部/底部/空态/错误态、Post 详情底部、User 主页、SiteHeader、SiteFooter、error、not-found、/download 页）。本次按业务方向调整：整个 web 不再承担"把用户引到 app"的职责，而是作为 Avant Regard 的独立内容与品牌站点存在。所有 app 下载入口、"在 App 中…"文案、`/download` 页以及配套的 SmartRedirect / DownloadCTAs 组件、App Store / Play Store 环境变量全部移除，对应位置替换为 web 站点内部动线（Discover、Features、About）或直接删除。

### Why
- 用户反馈：「整个 web，不需要和 app 相关的引导」——当前把 web 当作 app 的营销落地页会割裂用户在网页内深度浏览的体验。
- 跨端产品定位上，web 与 app 互为补充而非从属；web 端拥有完整的 Discover / Post / User 浏览能力，没有必要在每个页面都强推下载。
- 以独立站点的视角看，每个页面应给出在 web 内可以「下一步做什么」的答案（Discover / Features / 返回首页），而不是把用户推到应用商店。

### Key Changes
- `web/src/app/page.tsx`（Home）
  - 移除 `DownloadCTAs` import 与两处调用（Hero 主 CTA、About 节 inverted CTA）。
  - Hero 原来的「App Store 按钮 + iOS 15+ · 先在网页上逛逛」行替换为两个 web 原生 CTA：主按钮「浏览 Discover」→ `/discover`、副按钮「了解功能」→ `/#features`，保留 `animate-slide-up` 节奏与 `animationDelay: 360ms`。
  - Features 标题由「一个 app，涵盖 / 先锋时装的全部动线。」改为「一处聚合 / 先锋时装的全部动线。」，去掉「一个 app」的移动端暗示。
  - Discover preview 子文案「打开 app 即可点赞、评论与关注。」改为「社区每天都在更新。」。
  - About 节右下角的 inverted DownloadCTAs 替换为单个 inverted 风格的「进入 Discover →」链接，沿用原来 `md:items-end / md:self-end` 的栅格占位，视觉不塌。
- `web/src/app/posts/[id]/page.tsx`
  - 移除 `DownloadCTAs` import。
  - 底部 footer 的「在 App 中点赞 / 评论」按钮替换为「返回 Discover →」细链，保持与导航里的「← 返回 Discover」首尾呼应。
  - 移除整个「在 Avant Regard 中继续探索 / 下载 App 加入社区」黑卡 section。
- `web/src/app/users/[id]/page.tsx`
  - 移除 header 右侧「在 App 中关注」按钮。容器仍保留 `md:justify-between` 但只剩左侧头像信息，视觉上自然左对齐。
- `web/src/app/discover/page.tsx`
  - Header 从「标题 + 下载 App 互动按钮」的两列布局改为单列标题 + 描述；子文案去掉「在 app 内可以点赞、收藏、私信作者…」这一段。
  - 错误态从「… 或直接下载 app 查看最新动态」改为「… 请稍后重试」。
  - 空态从「欢迎下载 app 成为第一批分享者」改为「敬请期待最新的先锋穿搭与单品测评」。
  - 底部「想看更多？在 App 中继续浏览 →」section 整块删除，因为 feed 本身已经是完整浏览列表。
  - 同步清理不再使用的 `Link` import。
- `web/src/components/SiteHeader.tsx`
  - 右上角两个「免费下载 / 下载」按钮替换为一个桌面端「进入 Discover」按钮，指向 `/discover`；移动端不再显示额外按钮（ThemeToggle 已能放下）。
- `web/src/components/SiteFooter.tsx`
  - 产品导航里的「下载 App」替换为站内锚点「功能」→ `/#features`，保持两个条目的视觉平衡。
- `web/src/app/error.tsx`
  - 正文里「… 可直接下载 App」改为引导用户返回首页 / Discover。
- `web/src/app/not-found.tsx`
  - 「或内容已在 app 中被创作者删除。」→「或内容已被创作者删除。」。
- `web/src/app/layout.tsx`
  - `<meta description>` 中「面向先锋时装爱好者的社区 app」→「面向先锋时装爱好者的社区」。
  - OG description 中「下载 Avant Regard 加入社区。」→「发现设计师品牌、浏览秀场、穿搭与单品测评的社区。」。
- `web/src/app/sitemap.ts`
  - 移除 `/download` 条目。
- `web/src/lib/config.ts`
  - 移除 `appStoreUrl` / `playStoreUrl` 两个 config 字段（已无使用方）。
- `web/.env.example`
  - 移除 `NEXT_PUBLIC_APP_STORE_URL` / `NEXT_PUBLIC_PLAY_STORE_URL` 两个变量及其注释。
- **删除**：
  - `web/src/components/DownloadCTAs.tsx`（所有调用方已清零）。
  - `web/src/components/SmartRedirect.tsx`（仅在 `/download` 使用，同步删除）。
  - `web/src/app/download/page.tsx` 及 `web/src/app/download/` 目录（整页下线）。

### Dependencies Impacted
- 不新增 / 不升级任何 npm 依赖。
- 没有 API / 后端 schema 变更；删除的仅是 web 客户端文案、组件与环境变量。
- 部署配置：如有 CI/CD 或 Vercel 环境变量配置了 `NEXT_PUBLIC_APP_STORE_URL` / `NEXT_PUBLIC_PLAY_STORE_URL`，可在下一次部署窗口一并清理（保留不会造成错误，只是空闲）。
- SEO：`/download` 不在 sitemap 里不再被重新抓取；如果该 URL 已有外部反向链接，可在 `next.config` 层面加一条 301 → `/`，但这不是本次必须的动作，留作后续优化点。
- 移动端（`frontend/` 目录）完全不受影响，仍然是独立的 Expo app 仓库。

### Verification
- `ReadLints` 对所有改动文件零报错。
- `npx tsc --noEmit`（在 `web/` 下）通过。一开始有 `.next/types/app/download/page.ts` 的残留类型引用报错，是 Next.js 早先生成的 typed routes 缓存，在 `rm -rf .next/types/app/download` 后重新 `tsc --noEmit` 已通过；下一次 `next build` 也会自然重建 typed routes 目录，无需手工干预。
- 使用 `rg` 对 `web/src` 做 `DownloadCTAs / SmartRedirect / /download / appStoreUrl / playStoreUrl / 下载 / App Store / Google Play / 打开 app / 在 App / 免费下载` 全量检索：零剩余匹配；仅剩的几处 `app` 字样全部出现在代码注释中（例如 `globals.css` 的 color token 注释、`media.ts` 指向 `frontend/` 的架构注释），不是用户可见文案。

---

## 2026-04-20: Web 落地页 Hero —— 标题从写死的单句改成循环切换的 slogan 动画

### Summary
`web/src/app/page.tsx` 里 Hero 的 `<h1>` 原本是硬编码的"为先锋时装 / 而生的社区。"。本次把它抽成一个独立的客户端组件 `RotatingHeadline`，按 `为 X / 而生的 Y。` 的统一句式在 5 条 slogan 之间循环切换，使用 opacity + 轻量 translateY 的交叉渐变，既保持 Avant Regard 一贯的编辑化节奏，又让落地页的第一屏活起来。

### Why
- 用户反馈：hero 的 slogan 希望有文字切换动画，并且能生成不同文案。
- 落地页第一屏是品牌表达最重要的位置，单一静态句子表达力有限；轮播多句 slogan 可以一次覆盖"社区 / 档案 / 入口 / 灵感 / 记忆"等多个产品切面，立住品牌定位。
- 为避免切换时版面抖动：所有 slogan 都锁定在同一个句式 `为 XXXXX / 而生的 XXXXX。`，且字数一致，换句时 bounding box 不变。

### Key Changes
- `web/src/components/RotatingHeadline.tsx`（**新增**）
  - `"use client"` 组件，内部用 `setInterval` 以 `HOLD_MS + FADE_MS`（3000 + 700ms）为周期切换 index。
  - 渲染结构：一个 `relative` 的 `<h1>` 外壳 + 一个 `invisible` 占位层（用 `PHRASES[0]` 撑出两行高度）+ 每条 slogan 作为 `absolute inset-0` 的图层，只对激活层给 `opacity:1 / translateY(0)`，其它给 `opacity:0 / translateY(14px)`。
  - 尊重 `prefers-reduced-motion`：`globals.css` 已对全局 `transition-duration` 统一降到 0.01ms，这里无需额外分支。
  - 通过 `aria-label={PHRASES[0].join("")}` 给屏幕阅读器一个稳定的可访问名，未激活层用 `aria-hidden` 隐藏，避免 a11y 朗读重复多句。
  - 以 `className` / `style` 作为可选 props，完全继承原 `<h1>` 的 `mt-6 animate-slide-up font-serif text-hero font-semibold ...` 样式与 `animationDelay: 120ms` 入场动画。
- `web/src/app/page.tsx`
  - 新增 `import { RotatingHeadline } from "@/components/RotatingHeadline"`。
  - Hero 区域硬编码的 `<h1>` 替换为 `<RotatingHeadline className=... style=... />`，其余 DOM、入场动画、mockup 布局完全不变。

### Dependencies Impacted
- 不引入新的 npm 依赖（沿用现有 React 18 + Tailwind CSS + next-themes 栈）。
- 现有元数据 / SEO 文案（`layout.tsx` 的 `<title>` / OG description、`SiteFooter`、`download/page.tsx`、`README.md`）仍然保留 "为先锋时装而生的社区" 作为品牌主句，不做多句化——只有视觉 hero 做轮播，SEO 主句保持唯一，避免搜索引擎抓取到 5 句不同的 title 造成品牌定位模糊。

### Verification
- `ReadLints` 对两个改动文件无报错。
- `npx tsc --noEmit` （在 `web/` 目录下）通过，无类型错误。

---

## 2026-04-17: 用户 / 我的 / 点赞 帖子网格 —— 改成双列瀑布流（真正按自然比例排版）

### Summary
用户主页（`UserProfileScreen` / `Profile/PostsContent`）与「我点赞的」页（`MyLikesScreen`）的帖子网格之前用 `HStack flexWrap="wrap"` + `Box width="48%"` 做两列。虽然 `PostCard` 本身已经按自然比例渲染，但 flex-wrap 会强制同一行的两张卡片顶部对齐，一旦左右高度不同，就会在较矮那侧产生大片视觉空白。本次把三处网格统一改成双列瀑布流（Masonry），每列独立纵向堆叠，视觉上向小红书这类双列信息流靠齐。

### Why
- 用户反馈：看图二的排版——内容按自身尺寸和比例排版，两列错落而不是整齐的「行」。
- 根因：`flex-wrap` 天然就是网格（grid），不是瀑布流（masonry）。要实现图二那种自由堆叠必须走「两列分别渲染」的路子。
- 我们 feed 里的 `MasonryFlashList` 不能直接塞进 `AnimatedScrollView`（会破坏滚动委托 / 估算）；写一个轻量的「拆列 + 每列独立 VStack」算法就足够，而且没有额外依赖。

### Key Changes

- `frontend/src/utils/useMediaAspectRatio.ts`
  - 导出 `peekMediaAspectRatio(uri)`：同步读取共享缓存中的自然比例，供父容器做列高平衡时用。不会触发测量、不会订阅变化。
- `frontend/src/utils/masonryLayout.ts`（**新增**）
  - `splitIntoMasonryColumns(items, getMediaUri, columnCount = 2, fallbackRatio = 3/4)`：
    - 已缓存比例的条目按「当前最矮列」策略插入，估算项相对高度 = `1 / ratio + 0.3`（`+0.3` 留给标题 + 底部条，避免正方形 / 横图被低估）；
    - 尚未测量的条目按下标交替分配（`index % columnCount`），首帧仍能得到一个漂亮的错位布局，等比例陆续解析后，各卡片各自在原位增高，不会触发重排。
- `frontend/src/screens/UserProfileScreen.tsx`
  - 「笔记 / 收藏 / 赞过 / 愿望单」Tab：`HStack flexWrap + Box width=48%` 换成 `HStack space=sm` + 两个 `VStack flex=1`，用 `splitIntoMasonryColumns` 分列。
  - 「贡献」Tab：把 `renderCard` 重构为 `buildContribCard`，返回 `{ post, onPress }`；外层走同样的双列瀑布流，保留秀场 / 品牌 / 买手店各自的点击跳转。
- `frontend/src/screens/Profile/components/PostsContent.tsx`（我的主页）
  - 与上面完全同构的两处改造（Contribution 子页 + 其他 Tab）；长按删除（published / draft / pending）逻辑提炼到 `isEditableTab`，语义更清晰。
  - 移除不再使用的 `Box` 导入。
- `frontend/src/screens/MyLikesScreen.tsx`
  - 「我点赞的帖子」列表同样改成双列瀑布流；长按解除点赞（`onLongPress={() => handleUnlikePost(post)}`）保留在每列里的 `Pressable` 上。

### Dependencies Impacted

- 所有调用方统一走 `splitIntoMasonryColumns`；未来新增双列信息流（秀场详情内嵌帖子等）可直接复用，不必再各自写一份 flex-wrap 逻辑。
- `PostCard` 不需要任何改动：其内部 `useMediaAspectRatio` 仍然按自然比例驱动高度，现在在瀑布流里更能发挥出来。
- `Discover` Tab 使用的是 `MasonryFlashList`，那里已经原生支持瀑布流，不受本次改动影响。

### Verification

- `ReadLints` 对 5 个文件无报错。
- `tsc --noEmit` 过滤本次改动的文件后无类型错误（仓库原有 5 处前置错误与本次改动无关）。

---

## 2026-04-17: 品牌页帖子网格 —— 视频封面不再显示为灰底

### Summary
在品牌详情页（`BrandDetailScreen`）的「帖子」Tab 下，视频类型的帖子封面一直显示为灰色占位块。原因是该处直接用 `OptimizedImage` 渲染 `post.imageUrls[0]`，遇到 `.mp4` 链接时 `expo-image` 无法解码，就只剩下背景色。

### Why
- 之前已经在发现页 `PostCard` 里为视频帖子接入了 `VideoThumbnailView`，但同样的「图片 / 视频二选一」分支在品牌详情里是独立重写的一段，没跟上。这种跨文件重复最容易漏修，违反 DRY。
- 统一封装成一个共享组件后，后续任何新增的「帖子网格」入口（秀场页、用户主页等）直接复用即可，杜绝同类 bug 再次出现。

### Key Changes

- `frontend/src/components/PostCoverMedia.tsx`（**新增**）
  - 单一职责：给一个帖子的首图 URI 渲染封面。内部根据 `isVideoUrl(uri)` 分派到 `VideoThumbnailView` 或 `OptimizedImage`，外层只暴露 `uri / style / size / contentFit / lazy`。
  - 通过 `StyleProp<ViewStyle & ImageStyle>` 让同一套 `aspectRatio / width / backgroundColor` 布局样式在 View 和 Image 两条分支上都可复用，调用方无需关心差异。
- `frontend/src/components/PostCard.tsx`
  - 把内部的 `isVideoUrl ? <View><VideoThumbnailView/></View> : <OptimizedImage/>` 折叠成单个 `<PostCoverMedia>`，移除不再需要的 `View` / `VideoThumbnailView` / `isVideoUrl` 导入，纯视觉行为与之前保持一致。
- `frontend/src/screens/BrandDetailScreen.tsx`
  - 帖子网格的 `<OptimizedImage uri={post.imageUrls[0]} ... />` 替换为 `<PostCoverMedia uri={post.imageUrls[0]} style={styles.postImage} />`。`styles.postImage` 的固定 3:4 保持不变，仅负责在视频帖子上补出缩略图。

### Dependencies Impacted

- `PostCoverMedia` 当前有两个调用方（`PostCard` / `BrandDetailScreen`）。后续秀场详情、收藏列表等类似网格新增时应优先复用此组件。
- `BrandDetailScreen` 品牌 Hero (`brand.coverImages`) 与秀场卡片 (`show.coverImage`) 是管理后台上传的静态图，不是用户视频帖，继续用 `OptimizedImage`。
- 未触达其它已按自然比例渲染的视频入口（发现页瀑布流 / 帖子详情 / 发帖预览），本次改动是纯增量修复。

### Verification

- `ReadLints` 对 3 个文件无报错。
- `tsc --noEmit` 过滤本次改动的文件后无类型错误（仓库原有 5 处前置错误与本次改动无关，保留现状）。

---

## 2026-04-17: 视频与图片 —— 全链路按原始比例展示，取消固定容器裁切

### Summary
上传 16:9 视频过去会被 `contentFit="cover"` 裁进 3:4 / 4:5 / 16:9 等固定容器，侧边或上下被切掉。现在发现页卡片、帖子详情（内嵌块 / 单图单视频 / Lookbook 轮播）、发帖预览（论坛 / 搭配 / Lookbook）统一按媒体自然长宽比撑满，不再二次裁切。

### Why
- 产品规格：视频的原始尺寸是创作意图的一部分，不应被前端布局强行裁掉关键内容。用户明确反馈「上传了 16:9 视频被裁成 4:3」。
- 图片布局早已基于 `Image.getSize` 算自然比例（见 PublishOutfit/Lookbook 的 `previewHeight`），视频却没走这条路径，两种媒介行为不一致。这次把两边收敛到同一个 hook 上，符合 DRY / KISS。

### Key Changes

- `frontend/src/utils/videoThumbnail.ts`
  - `getVideoThumbnail` 的返回类型由 `string | null` 升级为 `VideoThumbnail | null`（`{ uri, width, height }`），直接透传 `expo-video-thumbnails` 已有的原始像素尺寸，避免再用 `Image.getSize` 二次解码。
- `frontend/src/utils/useMediaAspectRatio.ts`（**新增**）
  - `useMediaAspectRatio(uri, fallback)`：图片走 `Image.getSize`、视频走 `getVideoThumbnail` 的 width/height，模块级 `Map<string, number>` 缓存避免重复测量。
  - `rememberMediaAspectRatio(uri, w, h)`：对外暴露的写缓存 API，支持带 pub/sub —— 已订阅的组件在其它组件解析完同一个 URI 后会实时更新（解决 Android 上 HTTP 直链 `getThumbnailAsync` 会失败、但 `VideoThumbnailView` 的「先下载再抽帧」回退分支能成功的场景）。
  - `clampAspectRatio(ratio, min=3/4, max=16/9)`：给 feed / Lookbook 这类瀑布流/轮播做防护阈，防止单张超宽超高媒体打乱排版。
- `frontend/src/components/VideoThumbnailView.tsx` / `frontend/src/components/PostDetail/VideoPlayer.tsx`
  - 适配新的 `getVideoThumbnail` 返回值；拿到帧后同步调用 `rememberMediaAspectRatio` 向共享缓存写入真实尺寸。
- `frontend/src/components/PostCard.tsx`（发现页瀑布流卡片）
  - 去掉 `styles.image` 固定 `aspectRatio: 3 / 4`，改成运行时注入 `clampAspectRatio(useMediaAspectRatio(...))` 的结果，16:9 视频 / 1:1 截图 / 3:4 竖图都能按原比例撑满，`MasonryFlashList` 原生支持异高单元格无需额外改动。
- `frontend/src/components/PostDetail/PostContentSection.tsx`
  - 新增 `VideoBlockRenderer` / `ImageBlockRenderer`，内嵌媒体块的 `height = SCREEN_WIDTH / ratio`，并用 `contentFit="contain"` 兜底；删除不再使用的 `blockImage`、`blockImageContain` 固定样式。
- `frontend/src/components/PostDetail/ImageGrid.tsx`
  - 单张（图片或视频）走新增的 `SingleMediaItem` 按自然比例展示；两张 / 多张网格仍保留固定 3:4 / 4:5 的拼图规格（统一的格子仍然有更好的视觉秩序，不在此次范围内）。
- `frontend/src/components/PostDetail/LookbookContent.tsx` + `frontend/src/components/PostDetail/styles.ts`
  - 轮播容器高度从 `SCREEN_HEIGHT * 0.55` 改为以**封面图自然比例 (clamp 到 3:4 ~ 16:9)** 推导；其余与封面比例不同的 slide 用 `contentFit="contain"` 保证不被裁切；删除 `lookbookImageWrapper` / `lookbookImage` 硬编码样式。
- `frontend/src/screens/PublishForumPostScreen.tsx`
  - 抽出 `MediaBlockPreview` 组件，内嵌图 / 视频按自然比例渲染；移除 `imageBlock: { height: 200 }` 固定高度样式，和帖子详情预览保持一致。
- `frontend/src/screens/PublishLookbookScreen.tsx` / `frontend/src/screens/PublishOutfitScreen.tsx`
  - `handleVideoSelection` 里把 `thumbnail.width/height` 同时写进 `imageDimensions`（同时键入 `videoUri` 与 `thumbnail.uri`，因为发帖态 cover 取值路径两者都可能命中）。原有基于 cover 尺寸算 `previewHeight` 的逻辑现在对视频也生效，视频不会再被裁进 300px 的兜底框。

### Dependencies Impacted

- `getVideoThumbnail` 的返回类型是 breaking change，已逐一更新 5 个调用点：`PublishForumPostScreen.tsx`、`PublishLookbookScreen.tsx`、`PublishOutfitScreen.tsx`、`PostDetail/VideoPlayer.tsx`、`VideoThumbnailView.tsx`。原本直接 `thumbnail` 当字符串用的地方都改成 `thumbnail.uri`。
- `frontend/src/screens/Discover/components/TabContent.tsx` 的 `ESTIMATED_ITEM_SIZE = 320` 是 `MasonryFlashList` 的高度估值，仅用于首屏渲染优化、不会决定最终布局，动态比例下无需调整。
- `frontend/src/screens/Discover/styles.ts` 的 `skeletonImage` 保留 3:4 占位比（loading 态不知道真实尺寸，保持统一瀑布流形态）。
- `VideoPreviewModal` 已经是 `contentFit="contain"` 的全屏预览，本次不变。

### Verification

- `ReadLints` 对本次改动的 12 个文件无报错。
- `tsc --noEmit` 过滤本次改动涉及的文件后无类型错误（仓库原有 5 处前置错误 `RelatedLooks.tsx` / `OptimizedImage.tsx` / `UserAvatar.tsx` / `BrandDetailScreen.tsx` / `deepLinking.ts` 与本次改动无关，保留现状）。
- 手工核对所有 `aspectRatio:` 出现点、`getVideoThumbnail(` 调用点、`VideoPlayer` / `VideoThumbnailView` 使用点，确认没有遗漏的固定比例容器。

---

## 2026-04-17: 互动页会话列表 —— 秀场 / 名片分享回退到原始 JSON 的修复

### Summary
互动页「消息」列表的会话预览 `formatLastMessage` 只识别 `postId / storeId / brandId` 三种分享载荷，遇到后续新增的 `show_card`（`showId`）与 `user_card`（`userId+username`）会直接 fall-through，把整段 JSON 作为最后一条消息渲染出来（截图里 `客服` 会话显示 `{"showId":"...","title":"A...` 即为此症状）。

### Why
`ShareToChatModal` / `MessageBubble` 的分享体系共有 5 种卡片类型：`post_card / store_card / brand_card / show_card / user_card`。后加入的两种没有同步到会话列表预览的格式化逻辑上，导致消息预览与聊天详情的语义不一致，用户体验上就是「chat list 里的文字还是 JSON」。

### Key Changes

- `frontend/src/screens/Interaction/utils.ts`
  - 重写 `formatLastMessage`：将原本基于 `text.includes('"postId"')` 的字符串匹配改成 `JSON.parse` + 字段类型校验，和 `MessageBubble.tryParseXxx` 同一套判定规则（`postId: string` / `storeId: string` / `brandId: number` / `showId: string` / `userId: number & username: string`），避免误判嵌套字符串。
  - 补齐 `[秀场分享]`、`[名片分享]` 两个兜底预览文本；解析失败时保留原始文本展示（与旧行为一致）。

### Dependencies Impacted

- `ConversationRow`（互动页主列表）和 `StrangerMessagesScreen`（陌生人消息页）都通过 `formatLastMessage` 渲染 `lastMessageText`，改动同时覆盖两处，无需额外修改调用方。
- 后端 `Conversation.lastMessageText` / `last_message_text` 透传的是消息原文，不区分 `messageType`，因此仍由前端根据 payload 结构推断类型，保持现有契约。

### Verification

- `ReadLints` 对 `Interaction/utils.ts` 无报错。
- 手动对照 `MessageBubble` 中 `tryParsePostCard / tryParseStoreCard / tryParseBrandCard / tryParseShowCard / tryParseUserCard` 五组判定条件，保证预览文案与详情气泡类型一一对应。

---

## 2026-04-17: 贡献榜 / 个人贡献 —— 取消两个隐性上限

### Summary
Archive 贡献榜两处上限被放开：
1. Discover/Archive Leaderboard Tab 的总榜，从只显示 **Top 10** 放宽到 **Top 100**（前端请求参数调整，后端 `limit` 本身无硬上限）。
2. 个人贡献 Tab 中「买手店」子页的 **pageSize=100 硬上限**被去掉，用户自己或他人贡献数 >100 时不再被截断。

### Why
- 榜单 Top 10 对活跃用户区分度太低，中腰部贡献者完全看不到自己；改成 Top 100 后榜单长度更接近实际激励场景。
- 买手店列表之前唯一命中 `pageSize le=100` 约束的就是个人贡献视图，导致头部贡献者的 stores 子页存在「第 101 条之后消失」的隐性截断——是纯粹的 pagination cap 残留，不是业务意图。秀场与品牌链路本来就没有这一层限制，三条子页现在行为对齐。

### Key Changes

- `frontend/src/screens/Discover/components/ArchiveLeaderboard.tsx`
  - `getContributionLeaderboard(10)` → `getContributionLeaderboard(100)`。组件外层已经包在 `LeaderboardTab.tsx` 的 `ScrollView` 里，100 条的垂直滚动体验不受影响，不需要改成 FlatList。
- `backend/app/api/routes/buyer_store.py`
  - `GET /submissions/my` 与 `GET /submissions/user/{target_user_id}` 的 `pageSize: int = Query(20, ge=1, le=100)` 去掉 `le=100`，仅保留 `ge=1`。其它 `submissions/pending`、`submissions/all` 等管理员接口不动——那些是后台分页，保持 le=100 是合理的。
- `frontend/src/services/buyerStoreService.ts`
  - 新增导出常量 `CONTRIBUTION_PAGE_SIZE = 1000`，集中表达「个人贡献一次性拉取」的语义。
- `frontend/src/screens/UserProfileScreen.tsx`、`frontend/src/screens/Profile/hooks/useProfileData.ts`、`frontend/src/screens/Archive/components/MyContributionTab.tsx`
  - 三处 `buyerStoreService.getMySubmissions(1, 100)` / `getSubmissionsByUser(userId, 1, 100)` 统一改用 `CONTRIBUTION_PAGE_SIZE`，消除 magic number 与重复（DRY）。

### Dependencies Impacted

- 后端同一文件里 `/submissions/pending`、`/submissions/all` 等管理员分页接口保留 `le=100`，未受波及。
- `show_service.get_shows_by_user` / `get_approved_shows_by_user`、`brand_service.get_user_submissions` / `get_approved_user_submissions` 本来就无 `pageSize` 参数，只受 Supabase 客户端默认上限（1000 行）影响——在目前业务量级下不会触达，暂不动。

### Verification

- 读取三个前端调用点 + 服务常量 + 后端两个 route + Leaderboard 组件，`ReadLints` 无 lint 报错。
- `grep "getMySubmissions(1, 100|getSubmissionsByUser.*, 100)"` 全仓无残留。

---

## 2026-04-17: Web — 支持帖子视频渲染（卡片封面 + 详情页播放器）

### Summary
后端把图片和视频混存在 `Post.imageUrls: string[]` 里（通过文件扩展名区分，与 App 端的 `isVideoUrl` 一致），Web 端之前完全没处理，遇到 `.mp4/.mov/...` URL 会被 `next/image` 当图片加载，控制台持续刷屏 `The requested resource isn't a valid image ... received video/quicktime`，封面直接空白。本次给 Web 加上视频识别与渲染：`PostCard` 的网格卡片在视频封面下改用 `<video>` 元素（hover 自动静音循环播放、右上角加 play 徽标），`/posts/[id]` 详情页按项分支，视频走带原生 controls 的 `VideoPlayer`；`isVideoUrl` 抽到共享的 `lib/media.ts`，扩展名集合与 `frontend/src/services/postService.ts` 同步。

### Why
dev server 的错误日志直接暴露了 bug：`https://.../videos/20260417/....mov` 被当图片请求 → Next.js Image Optimization 返回 `MIME type mismatch` → 封面渲染失败。用户本次明确提到 "PostCard 里面可能有视频" —— 确认后端早已存在 `/upload-video` 接口与 videos 桶，App 端也早已支持视频上传和展示（`isVideoUrl` + `VideoThumbnailView`），只有营销站 web 端漏了这条路径，属于跨端一致性缺口。

### Key Changes

- `web/src/lib/media.ts`（新增）
  - `isVideoUrl(uri)`：扩展名集合 `mp4/mov/m4v/webm/avi`，与 `frontend/src/services/postService.ts#isVideoUrl` **完全镜像**（扩展名集合显式注释"任何一边增加格式都要同步另一边"，避免未来漂移）。
  - `withPosterFragment(url)`：追加 `#t=0.1` 媒体片段，让浏览器在 `preload="metadata"` 下直接把首帧作为静止海报帧渲染——无需额外的缩略图资源，也无需运行时生成（App 端用的是 `expo-video-thumbnails`，Web 无等价库，借浏览器能力是最 KISS 的方案）。
  - 函数实现对 `null/undefined` 和带 query/hash 的 URL 都做了防御。

- `web/src/components/VideoCover.tsx`（新增，client 组件）
  - `VideoCover`：网格卡片专用视频缩略图。`muted` + `loop` + `playsInline` + `preload="metadata"`，`onMouseEnter/Leave` 自控 `play/pause` 并在离开时 `currentTime = 0`。触屏设备保持静止首帧——与 App 端"缩略图 + 点开详情"的交互一致。
  - 因为 PostCard 整张卡是一个 `<Link>`，直接用 video 元素自身的 mouse 事件就能覆盖卡片主视觉区域，**不需要**把 hover state 上提到 PostCard（PostCard 得以继续保持纯 server component，SSR 不打折）。
  - `VideoBadge`：独立导出的小徽标（右上角圆形毛玻璃 + 白色 play 三角 SVG）。和 PostCard 的 `typeLabel`（左上角）错开位置避免视觉打架。

- `web/src/components/VideoPlayer.tsx`（新增，client 组件）
  - 详情页全尺寸播放器，**原生 controls**（无自定义 UI 层）—— a11y、键盘控制、全屏、画中画全部交给浏览器。
  - `priority` 映射到 `preload="auto"`（只对帖子第一条媒体开启），非首条走 `preload="metadata"`——首帧出得来、但不预下载整段视频，对流量友好。

- `web/src/components/PostCard.tsx`
  - 引入 `isVideoUrl` 判断 `cover`，视频时渲染 `<VideoCover>`（`absolute inset-0 h-full w-full object-cover` 保持和 `FadeImage fill` 完全一致的布局表现），图片时维持原 `<FadeImage>` 分支。
  - 视频封面再叠一层 `<VideoBadge>`，和原有的 `typeLabel` / 渐变遮罩 / hover overlay 共存。
  - 删掉了未使用的 `import Image from "next/image"`（原本 import 了但组件内只用 FadeImage，顺手清理）。

- `web/src/app/posts/[id]/page.tsx`
  - `images.map` 内部加 `isVideoUrl(src) ? <VideoPlayer> : <FadeImage>` 分支，`priority={index === 0}` 规则对两种类型都生效。
  - `generateMetadata` 里 `openGraph.images` 用 `find((u) => !isVideoUrl(u))` 取第一张**图片**作为分享卡封面—— OG/Twitter 卡只接受静态图，之前直接用 `imageUrls[0]` 遇到视频会让 Facebook/微信分享显示空白卡片。

### Dependencies Impacted

- `web/src/app/discover/page.tsx`、`web/src/app/users/[id]/page.tsx`、`web/src/app/page.tsx` —— 都是 `PostCard` 的消费者，props 形状未变（`post: Post`、`priority?: boolean`），**零改动**。
- `next.config.js` —— `remotePatterns` 是给 `next/image` 用的，`<video>` 元素不经过 Image Optimization，直接 `GET` 源文件，不需要新增 allow-list。
- Supabase `videos` 桶 —— 已在 `backend/app/services/file_service.py` 创建并且是 public 桶，CORS 默认允许 `<video>` 直接拉取。

### Verification

dev server (`npm run web:dev`, port 3100) 日志对比：

- **fix 前**（第 152-175 行）：每次访问 `/discover` 或 `/posts/128` 都刷 2-3 条 `⨯ The requested resource isn't a valid image for .../.mov received video/quicktime`。
- **fix 后**（第 183-184 行）：`GET /discover 200 in 915ms` + `GET /posts/128 200 in 533ms`，**零错误**。

### Design Principles

- **DRY**：`isVideoUrl` 的扩展名集合在 web 和 frontend 两侧通过显式注释约束同步（源头是后端 `ALLOWED_VIDEO_TYPES`）；如果未来后端放开新格式，这是明确的单点扩散路径。
- **KISS**：没引入 `expo-video-thumbnails` 的 web 等价库（如 `video-thumbnails` / ffmpeg.wasm），仅用 `#t=0.1` 媒体片段让浏览器自己出首帧——零依赖、零打包体积影响。
- **SOLID（SRP）**：`VideoCover`（网格 hover 自动播放）和 `VideoPlayer`（详情页原生 controls）是两个不同 use case，拆成两个组件而不是一个带 mode 参数的"万能组件"——避免将来其中一侧需求变化污染另一侧。
- **Holistic**：不只改 PostCard，一并修了详情页渲染循环和 OG metadata 里的同源缺陷（两处都会 404/空白）；检查了 PostCard 的全部消费者确认 props 契约不变。

---

## 2026-04-17: Release — iOS v1.3.0 (App Store 提交准备)

### Summary
把 `frontend/app.json` 的 `expo.version` 从 `1.2.2` 升到 `1.3.0`，`frontend/package.json` 同步到 `1.3.0`；清理一个被 Expo 误生成在 monorepo 根目录的空壳 `app.json`（`{"expo": {}}`）。iOS `buildNumber` 由 `eas.json` 的 `production.autoIncrement: true` 自动处理，无需手动填。

### Why
本轮累积了一批面向用户的明显变化——聊天内多类型卡片分享（含全新 `user_card`）、聊天撰写态的极简交互（隐藏 `+`、移除 Cancel、tap-outside 退出）、`SharePickerSheet` 的黑白单色重设计、以及后端补齐 `USER_CARD` 枚举修复分享 422——属于新功能 + 设计语言升级，符合 minor bump 的语义。

### Key Changes
- `frontend/app.json` — `expo.version: 1.2.2 → 1.3.0`
- `frontend/package.json` — `version: 1.0.0 → 1.3.0`（与 app.json 对齐，避免未来 semver 工具困惑）
- `app.json`（根目录）— 删除（空壳 `{"expo": {}}`，Expo CLI 在 workspace root 误生成，保留会让外部工具误以为根也是一个 Expo 工程）

### Release Plan
1. 本地 commit + push 到 `origin/main`
2. `cd frontend && eas build --platform ios --profile production`
3. 构建完成后 `eas submit --platform ios --profile production`（上传到 App Store Connect）
4. 在 App Store Connect 选择分发到 TestFlight 或提交审核

### Design Principles
- **Holistic**：版本号三处（app.json、package.json、PROGRESS_LOG）同步更新，避免割裂。
- **KISS**：iOS buildNumber 交给 EAS 自增，不手写，减少人为错配。

---

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

## 2026-04-17: Fix user_card Share Request Failure (修复用户卡片分享 422 错误)

### Bug
在聊天中分享「用户」卡片时，REST 请求 422 失败，前端报 `Failed to send message: Error: Request failed`。
WebSocket 路径能通过（因为那条路径把 `message_type` 当裸字符串透传），但一旦落到 REST 回退，就被 Pydantic 验证拒绝。

### Root Cause
`backend/app/schemas/chat.py` 的 `MessageType` 枚举缺少 `USER_CARD`：
```
TEXT / IMAGE / SYSTEM / POST_CARD / STORE_CARD / BRAND_CARD / SHOW_CARD
```
前端 `SharePayload` 已包含 `user_card`，`MessageBubble` 也已经有渲染逻辑（`tryParseUserCard` / `handleUserCardPress`），但后端枚举没有同步扩展。

### Fix
- `backend/app/schemas/chat.py` — 在 `MessageType` 枚举追加 `USER_CARD = "user_card"`
- 其他路径无需改动：`chat_service.send_message` 直接把 `message_type` 作为字符串写入 DB；WebSocket 路径本来就不走 enum；`MessageBubble` 已有完整支持

## 2026-04-17: SharePickerSheet Monochrome Restyle (聊天分享选择器极简化)

### Problem
`SharePickerSheet` 底部的 5 个分类图标（帖子/买手店/品牌/秀场/用户）使用了饱和度极高的彩色（`#FF6B6B`、`#4ECDC4`、`#FFA94D`、`#845EF7`、`#339AF0`），与 app 整体黑白极简的编辑风格严重冲突。

### Changes
- `frontend/src/screens/Chat/components/SharePickerSheet.tsx`
  - 移除 `CategoryConfig.color` 字段
  - 图标气泡统一使用 `theme.colors.gray50` 背景 + `theme.colors.gray100` 描边
  - 图标颜色统一为 `theme.colors.black`
  - 圆角从 14 调整为 `theme.borderRadius.md`（8px），与 app 卡片/按钮一致
  - 气泡尺寸 52→48，图标尺寸 24→22，整体更收敛

## 2026-04-22: 推荐列表下拉刷新改为增量加载（Prepend instead of Replace）

### Problem
推荐 Tab 下拉刷新时，`useFeedRecommendation.refresh()` 会清空 `excludeIds` 和 `postSkip`，然后用全新数据**替换**整个列表。用户滑到顶部刷新后，之前浏览的内容全部消失，体验不佳。

### Changes
- `frontend/src/screens/Discover/hooks/useFeedRecommendation.ts`
  - **首次加载**（`excludeIdsRef` 为空）：行为不变，正常填充列表
  - **后续刷新**：保留已有 `excludeIds`，调用 `getFeed({ skip: 0, forceFresh: true, excludeIds: existing })` 让后端返回 Stage 1+2 的新推荐内容（自动排除已见帖子），然后将新数据 **prepend** 到列表头部
  - `postSkipRef` 和 `excludeIdsRef` 累加而非重置，确保底部 `loadMore` 分页不受影响
  - 后端无需改动：`exclude_ids` + `force_fresh` 已有完整去重 + 缓存刷新支持

### Result
用户在推荐列表顶部下拉刷新时，新推荐内容从上方插入，已浏览内容保持在下方，实现类似 Twitter/微博的增量刷新体验。

## 2026-04-22: 推荐首页冷启动首滑卡顿修复 (PostCard Perf Optimization)

### Problem
App 冷启动后，推荐列表首次向下滑动时出现明显卡顿和掉帧。

### Root Cause
1. **PostCard 使用 11+ 个 gluestack `styled()` 组件**（Box ×3, Text ×4, Pressable ×3, HStack ×2）。每个 styled() 在渲染时做 React Context 读取 + token 解析 + 样式合并 + 新对象分配。首屏 26+ 张卡片 = **280+ 次不必要的 styled() 解析**，全部在 JS 线程执行，与图片解码和滚动事件竞争。
2. **PostCard 外层 `sx={{...shadow...}}` prop** 在每次渲染时创建新对象并触发 gluestack 运行时解析，是 styled() 中最重的模式。
3. **OptimizedImage 的 `containerHeight` 状态** 每张图片挂载时 `onLayout` → `setContainerHeight()` → 触发一次额外重渲染，仅为判断是否显示 "加载中…" 文字。30 张图片 = 30 次不必要的重渲染。

### Changes
- `frontend/src/components/PostCard.tsx`
  - **全部 gluestack 组件替换为 RN 原生组件**：`Box` → `View`，`Text` → `RNText`，`Pressable` → RN `Pressable`，`HStack` → `View` + `flexDirection: 'row'`
  - `sx={{shadow}}` 动态解析 → `theme.shadows.sm` 静态 StyleSheet
  - 所有样式通过 `StyleSheet.create()` 预编译，零运行时开销
  - 保持 `React.memo` 包裹和 `useCallback` 稳定引用
  - 保持所有 interface/type 导出不变，消费方零影响

- `frontend/src/components/ui/OptimizedImage.tsx`
  - `containerHeight` 从 `useState` 改为 `useRef`，不再因 `onLayout` 触发重渲染
  - 保留 `onLayout` 写入 ref（前向兼容），spinner 仍正常显示

### Impact
- 首屏 26 张卡片挂载：减少 ~280 次 styled() 解析 + ~30 次 onLayout 重渲染
- 滚动回收/复用新卡片：每张卡片减少 ~11 次 styled() 解析 + 1 次 onLayout 重渲染


## 2026-04-23: 管理面板增长趋势图表 (Admin Dashboard Growth Charts)

### Problem
管理面板仅显示静态的汇总数字，缺少用户、帖子、评论随时间的增长趋势可视化。

### Changes

**后端**
- `backend/app/services/admin_service.py` — 新增 `get_growth_stats(days)` 方法，查询 `users`、`posts`、`post_comments` 三张表的 `created_at`，按天聚合为 series 数据
- `backend/app/api/routes/admin.py` — 新增 `GET /api/admin/stats/growth?days=30` 端点（支持 7–90 天范围），需管理员权限

**前端**
- `web/src/components/admin/LineChart.tsx` — 纯 SVG 折线图组件（零依赖），支持多条线、hover tooltip、自适应 Y 轴、网格线，三种线型（实线/虚线/点线）区分数据系列
- `web/src/lib/services/admin.ts` — 新增 `statsApi.getGrowth()` 接口
- `web/src/app/admin/page.tsx` — 仪表盘新增「近 30 天增长趋势」图表区块

### Design Decisions
- 图表使用纯 SVG 实现，不引入 recharts/chart.js 等第三方库，保持极简
- 三条线用实线/虚线/点线 + ink/ink-muted/border 三种灰度区分，不引入颜色


## 2026-04-23: Web 管理后台完整移植 (Admin Panel Migration to Web)

### Problem
管理员功能仅在移动端 App 中可用（通过 `AdminScreen` 的 16 个 Tab），没有 Web 版管理后台。在浏览器上管理内容、审核帖子、配置系统参数等操作非常不便。

### Changes

**基础架构 (3 个新文件)**
- `web/src/lib/services/admin.ts` — Admin API 服务层，使用 `apiClient` 封装所有管理接口（帖子、用户、评论、社区、品牌、秀场、店铺、Banner、广播、客服、推荐、维护模式），共 11 个 API 命名空间
- `web/src/components/admin/AdminRequired.tsx` — Admin 权限守卫组件，扩展 AuthRequired 增加 `is_admin` 校验
- `web/src/components/admin/AdminNav.tsx` — 侧栏导航组件，5 个分组、17 个导航项，使用 lucide-react 图标

**UI 组件库 (1 个新文件)**
- `web/src/components/admin/ui.tsx` — 管理后台通用组件：PageHeader、SearchBar、FilterChips、StatusBadge、Pagination、ConfirmDialog、FormDialog、FormField、TextInput、Toggle、Button、EmptyState、LoadingState、PromptDialog

**页面路由 (17 个新页面)**
- `web/src/app/admin/layout.tsx` — 管理后台布局（固定左侧栏 + 右侧内容区）
- `web/src/app/admin/page.tsx` — 概览仪表盘（统计卡片 + 待审核队列）
- `web/src/app/admin/posts/pending/page.tsx` — 待审核帖子（批量审核、拒绝原因）
- `web/src/app/admin/posts/page.tsx` — 帖子管理（搜索、筛选、评级、批量重新评级）
- `web/src/app/admin/comments/page.tsx` — 评论管理（分页表格、删除）
- `web/src/app/admin/users/page.tsx` — 用户管理（搜索、头衔管理、删除）
- `web/src/app/admin/reports/page.tsx` — 举报管理（状态筛选、解决/驳回）
- `web/src/app/admin/communities/page.tsx` — 社区管理（CRUD、图标/封面上传、启停）
- `web/src/app/admin/brands/page.tsx` — 品牌管理（搜索、编辑、删除）
- `web/src/app/admin/brands/submissions/page.tsx` — 品牌审核（通过/拒绝）
- `web/src/app/admin/brands/images/page.tsx` — 品牌图片审核（通过/拒绝/删除）
- `web/src/app/admin/shows/page.tsx` — 秀场管理（搜索、筛选、CRUD）
- `web/src/app/admin/shows/review/page.tsx` — 秀场审核（通过/拒绝）
- `web/src/app/admin/stores/page.tsx` — 买手店管理（搜索、CRUD、坐标、封面上传）
- `web/src/app/admin/banners/page.tsx` — Banner 管理（CRUD、链接类型、排序、启停）
- `web/src/app/admin/broadcast/page.tsx` — 广播通知（编辑、链接配置、预览、发送结果）
- `web/src/app/admin/customer-service/page.tsx` — 客服设置（自动回复开关、消息、邮箱）
- `web/src/app/admin/recommend/page.tsx` — 推荐配置（池比例、等级选择、冷启动）
- `web/src/app/admin/maintenance/page.tsx` — 维护模式（开关、自定义消息、恢复默认）

**导航集成**
- `web/src/components/auth/UserMenu.tsx` — 管理员用户下拉菜单新增「管理后台」入口

**新增依赖**
- `lucide-react` — 图标库（已在 next.config.js 的 optimizePackageImports 中配置）

### Design Decisions
- **Web 优先布局**: 采用固定侧栏 + 表格视图替代移动端的横向 Tab + 卡片列表，信息密度更高
- **单色体系**: 全部使用 ink/canvas CSS 变量，不引入语义颜色（无绿/红/蓝），与网站整体极简黑白风格保持一致
- **文字操作按钮**: 表格操作列使用文字按钮（通过/拒绝/删除/编辑）而非彩色图标，减少视觉噪音
- **无装饰图标**: 侧栏导航和操作按钮均不使用图标，仅保留 SearchBar/Pagination 等功能性 UI 控件的图标
- **统一组件库**: 所有 admin 页面共享 `ui.tsx` 中的原子组件，保持视觉一致性
- **API 复用**: 使用已有 `apiClient` 处理认证、Token 刷新、错误包装，无需重复实现

### Impact
- 管理员可在浏览器中完成所有后台管理操作，无需打开移动端 App
- 表格视图在大屏上一次性展示更多数据，操作效率显著提升
- 所有 16 个移动端管理功能模块均已完整移植


## 2026-04-22: 论坛封面图支持多比例裁剪 (Forum Cover Multi-Ratio Crop)

### Problem
论坛帖子封面图固定使用 1:1 比例，不像其他发布类型（穿搭、Lookbook、评测）支持自由裁剪和多种比例选择。

### Changes
- `frontend/src/components/SingleImageUploader.tsx`
  - 新增 `enableCropper` 和 `defaultCropAspect` props
  - 当 `enableCropper=true` 时，选择图片后进入自定义 `ImageCropper`，支持 自由裁剪/1:1/4:3/16:9/9:16 五种比例
  - 已有图片可通过「裁剪」按钮重新进入裁剪器调整比例
  - 未开启 cropper 时行为完全不变（向后兼容）

- `frontend/src/screens/PublishForumPostScreen.tsx`
  - 封面图 `SingleImageUploader` 启用 `enableCropper={true}`，默认裁剪比例 `1:1`
  - 提示文字更新为「支持自由裁剪、1:1、4:3、16:9、9:16」

### Impact
论坛帖子封面图现在与穿搭/Lookbook/评测等发布类型一致，用户可自由选择裁剪比例。


## 2026-04-24: 支持分享用户主页给聊天对象 (Share User Profile to Chat)

### Problem
在其他用户的个人主页上，无法将该用户的主页分享给聊天对象。已有帖子、买手店、品牌、秀场的分享到聊天功能，但缺少用户主页的分享入口。

### Changes
- `frontend/src/components/ShareToChatModal.tsx`
  - `ShareToChatModalProps` 新增 `user?: ShareableUser | null` prop
  - `SharePreview.messageType` union 新增 `"user_card"` 类型
  - `resolvePreview()` 增加 user 分支，使用 `buildUserSharePayload` 构建 payload
  - 预览卡片对 `user_card` 类型显示圆形头像（新增 `previewImageRound` 样式）

- `frontend/src/screens/UserProfileScreen.tsx`
  - 导入 `ShareToChatModal` 组件
  - 新增 `showShareToChat` state 控制弹窗显隐
  - 透明封面叠层和吸顶白色 Header 右侧均添加 "..." 按钮（仅他人主页显示）
  - 页面底部渲染 `ShareToChatModal`，传入当前浏览用户的信息

### Architecture
- 复用已有的 `buildUserSharePayload` / `UserSharePayload` 类型和 `MessageBubble` 中已实现的 `user_card` 渲染逻辑，无需新增聊天消息渲染代码
- 遵循 DRY 原则，与 post/store/brand/show 的分享流程完全一致

### Impact
用户在浏览他人主页时，可通过右上角 "..." 按钮将该用户的主页卡片分享到任意聊天对话中。


