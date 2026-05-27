# Avant Regard · Design System

> _「为先锋时装而生的社区」_
> 极简、克制、画廊感 —— 黑白灰底色 + Playfair Display 衬线 + 4pt 网格 + 极轻阴影。

App / Web / 营销页共享同一套视觉语言。Native 端的真正源头是
`frontend/src/theme/index.ts`，Web 端在 `web/tailwind.config.ts` +
`web/src/app/globals.css` 里 1:1 镜像。

---

## 1. 设计基调（Design Philosophy）

| 关键词 | 体现 |
| --- | --- |
| **Editorial / Gallery** | Playfair Display 衬线作为唯一字族；首屏 Hero 用 48px 衬线大字 + 字距压缩，像时装杂志封面 |
| **Monochrome-first** | 全产品没有任何品牌彩色，仅在「会员金」「评分星」等极少语义点用单一暖金 `#F5A623` |
| **Quiet UI** | 阴影极淡（最大 `opacity 0.15`），分割线优先用 `#EFEFEF` 发丝线，而非粗描边 |
| **4pt grid** | `xs/sm/md/lg/xl/xxl = 4/8/16/24/32/48`，避免任何非 4 倍数间距 |
| **统一小圆角** | 非圆形组件全部 `radius: 4`，刻意不分梯度，营造一致的「卡片切角感」（`borderRadius.full = 9999` 仅用于头像 / pill） |
| **Cinematic micro-motion** | Web 首页签名字蝶变拼接 / 手机 hero 浮动；App 内交互保持轻量，避免抢戏 |

---

## 2. 调色板（Color Tokens）

### 2.1 Light（默认）

| Token | Value | 用法 |
| --- | --- | --- |
| `background` | `#FFFFFF` | 页面背景 |
| `card` / `cardElevated` | `#FFFFFF` | 卡片底色（与背景同色，靠间距与发丝线分隔） |
| `surface` | `#F5F5F5` | 输入框 / 二级面板底色 |
| `text` | `#000000` | 主文字、主操作按钮底色（黑底白字） |
| `textSecondary` | `#666666` | 次级文字 |
| `textInverted` | `#FFFFFF` | 主操作按钮文字 |
| `border` | `#F5F5F5` | 卡片轮廓 |
| `divider` | `#EFEFEF` | 列表分割发丝线 |
| `placeholder` | `#9A9A9A` | 输入占位 |
| `overlay` | `rgba(0,0,0,0.45)` | Modal 遮罩 |
| `scrim` | `rgba(0,0,0,0.40)` | Sheet 半透明背幕 |
| `accent` | `#000000` | 强调色刻意等于黑（reinforce monochrome） |
| `error` | `#FF3B30` | 错误 / 删除 |
| `success` | `#34C759` | 成功 |
| `plusGold` / `starRated` | `#F5A623` | Plus 会员、评分星 —— 整个产品中**唯二**的彩色用例 |

### 2.2 Gray Scale（语义反转，非线性）

```
gray50  #F9F9F9     gray400 #444444
gray100 #F5F5F5     gray500 #222222
gray200 #AAAAAA     gray600 #111111
gray300 #666666     gray700 #000000
```

> 命名为「数值越大颜色越深」遵循 Material/Tailwind 习惯；但注意 `gray200` 已经是中等灰（`#AAAAAA`），不要当作浅色用。

### 2.3 Dark Mode（语义保持，亮度反转）

`white/black/gray*` 全部翻转，但语义 token 名保持不变 —— 这意味着任何写
`theme.colors.text` 的代码在两个模式下都会自动变成「该模式下的主文字色」。

| Token | Light | Dark |
| --- | --- | --- |
| `background` | `#FFFFFF` | `#000000` |
| `card` | `#FFFFFF` | `#000000` |
| `cardElevated` | `#FFFFFF` | `#1A1A1A` |
| `surface` | `#F5F5F5` | `#161616` |
| `text` | `#000000` | `#FFFFFF` |
| `textSecondary` | `#666666` | `#A0A0A0` |
| `border` | `#F5F5F5` | `#262626` |
| `inputBackground` | `#FFFFFF` | `#161616` |
| `plusGold` | `#F5A623` | `#FFC04C` (提亮以保证暗背景上的对比度) |

Web 端额外用「暖近黑」`#0A0A0A` + 「暖近白」`#EDEDED` 而非纯黑纯白，避免 OLED 焦灼感（见 `globals.css`）。

---

## 3. 字体（Typography）

**唯一字族：`Playfair Display`** — Bold / Medium / Regular 三档。

> Playfair 是高对比度衬线，本身自带「时装周节目单」的质感。整个 App / Web 都不用无衬线，只在 Web 的极个别 label / utility class 上使用 Inter（`.font-label`）。

| Token | Font | Size / Line / Letter |
| --- | --- | --- |
| `hero` | Playfair Bold | 48 / 52 / `-0.5` |
| `h1` | Playfair Bold | 32 / 38 |
| `h2` | Playfair Regular | 24 / 30 |
| `h3` | Playfair Medium | 18 / 24 |
| `h4` | Playfair Medium | 16 / 22 |
| `body` | Playfair Regular | 16 / 24 |
| `bodySmall` | Playfair Regular | 14 / 20 |
| `caption` | Playfair Regular | 12 / 16 |
| `button` | Playfair Medium | 16 / 20 / `+0.5` |

**字距规律：**
- 标题正常或负字距（`-0.5 ~ -0.02em`）—— 给衬线更紧凑的杂志感
- 按钮 / 标签 / Tagline 使用正字距（`+0.3 ~ +3`）—— 模拟时装 Lookbook 的间隔印刷

---

## 4. 间距 / 圆角 / 阴影（Spacing · Radius · Shadow）

### 4.1 Spacing（4pt grid）

```
xs 4 · sm 8 · md 16 · lg 24 · xl 32 · xxl 48
```

约束：所有间距值 **必须** 落在这条标度上；不存在 6 / 10 / 18 之类的「中间值」。

### 4.2 Border Radius（统一 4）

```ts
{ sm: 4, md: 4, lg: 4, xl: 4, full: 9999 }
```

这是有意为之的设计决定 —— 设计要点注释在 `theme/index.ts:170-179`：
> 所有非「圆形」组件的圆角统一为 4，避免大小不一的视觉割裂。
> `full: 9999` 仅用于头像 / pill。

> ⚠️ 本仓库存在历史遗留：少数较老组件（`AlertSheet`、`BottomSheet`、登录主按钮 `borderRadius: 16`）未归一到 4。新组件务必沿用 `t.borderRadius.md`。

### 4.3 Shadows（极轻）

```ts
sm: opacity 0.05, offset (0,1), radius 2
md: opacity 0.10, offset (0,2), radius 4
lg: opacity 0.15, offset (0,4), radius 8
```

FAB / 发布按钮可以加重到 `opacity 0.30, radius 8`，是产品中最重的阴影了。

---

## 5. 核心组件语汇（Components Lexicon）

### 5.1 Buttons

| 类型 | 视觉 |
| --- | --- |
| **Primary（solid）** | `bg = text(纯黑)` / `fg = textInverted(白)` / `radius = 4`，整页主行为按钮（登录、发布、提交） |
| **Outline** | `transparent` + `border 1px = colors.border` + `fg = text` |
| **Ghost** | 无背景，`fg = text`，主要用于头部副操作 |
| **Apple Sign-In** | 严格遵循 Apple 品牌：light 模式 `#000000` 黑底白字，dark 模式 `#FFFFFF` 白底黑字 |
| **Disabled** | 主按钮变 `gray100` 灰底 + `gray300` 灰字 |

按钮高度通过 `paddingVertical` 控制（`xs/sm/md/lg = 4/8/16/24`）；状态遵循
`:active opacity 0.8`、`:disabled opacity 0.5`。

### 5.2 Cards / Feed

`PostCard`（瀑布流核心组件）：

```
┌──────────────────────┐
│   COVER (3:4 default)│  ← 角标位 top-8 left-8（社区/店铺/驳回/审核）
│                      │
├──────────────────────┤
│  Title (Playfair Med │
│   14/20, 2 lines)    │
│  ──────────────────  │
│  ◯ Author · badge    │  ❤ count
└──────────────────────┘
```

- 卡片底色 = `card`（与页面同色），靠 `shadows.sm` + `borderRadius.md` 与背景区隔
- 角标：`rgba(0,0,0,0.6)` 半透明黑底 + 白字（社区）/ 暖橘 `rgba(255,165,0,0.9)`（审核中）/ 红 `rgba(220,38,38,0.95)` + 警告图标（驳回）
- Cover 默认 3:4 比例；用 `MasonryFlashList` 做瀑布流时通过 `coverAspectRatio` 同步预先计算高度避免 jank

### 5.3 Headers

`ScreenHeader` 三种 variant：
- `default` — 16px 居中标题（Playfair Medium），左侧 `arrow-back` / 右侧 action
- `large` — 32px 衬线大标题，加大上下 padding，做为各 Tab 主页的发布感开篇
- `minimal` — 18px Medium，常用于 Modal / Sheet

`DiscoverHeader`：动态 logo（亮/暗模式两个 GIF）+ 通知 bell + 用户头像 +
搜索 bar（`gray50` 底，圆角 4，placeholder Playfair Regular）。

### 5.4 Tab Bars

`CenteredTabBar`：
- 底色 `background`，下边 `border 1px = gray100` 发丝线
- 激活态：`text` 主色 + 字重 600，下方 24×2 短下划线指示器（`borderRadius 1`）
- 非激活态：`gray300`，字重 500
- 自动居中滚动 —— 切换 tab 时 ScrollView 自动 scrollTo 把激活 tab 居中

底部主 Tab 的「+」`PublishTabButtonV2`：56×56 黑色 `radius:4` 方钮（**不是圆形**，刻意区别于 IG / 小红书的 FAB），上浮 -10px，重阴影。

### 5.5 Modals / Bottom Sheets

- 顶部 16px 圆角（**这是仓库内少数允许 16 圆角的位置**），`backdrop = scrim`
- 顶部居中 36×4 的 `border` 色 grabber handle
- 内容首行 17px Playfair Bold 标题
- 列表项行高 14 padding，左侧 40×40 圆形 icon 占位（`radius: 20`，`bg = surface`）
- 关闭按钮：底部居中 40×40 圆形 `surface` 底 + `close` icon

### 5.6 Inputs

- `inputBackground = gray100` 底，`radius: 12`（auth 流程历史值，新组件归一到 4）
- 13px Playfair Regular 输入字
- Label 13px Playfair Medium，`letterSpacing 0.3`
- 占位 `placeholder = #9A9A9A`

### 5.7 Skeletons

骨架屏遵循卡片真实结构：3:4 cover (`skeleton = #EFEFEF`) + 标题块 +
作者圆头 —— 而不是通用的 box loader。带 `useSkeletonAnimation` 微弱 opacity 呼吸。

### 5.8 Avatar

`UserAvatar` 默认正方形 → `borderRadius.full` 即圆形；列表里常见 20px / 32px / 64px 三档。无头像时回落为首字母 + `text` 底色。

---

## 6. 角标 / 状态色规范（Status Tokens）

| 状态 | 视觉 |
| --- | --- |
| 帖子审核中 | `rgba(255,165,0,0.9)` 橘底 + 白字「审核中」 |
| 帖子被驳回 | `rgba(220,38,38,0.95)` 红底 + `alert-circle` icon + 白字 |
| 社区角标 | `rgba(0,0,0,0.6)` 半透黑 + 白字 `# 社区名` |
| 买手店角标 | `rgba(20,20,20,0.78)` 半透黑 + `storefront` icon + 白字 |
| 通知红点 | `error` 红 + 白字，min 16×16，圆形 |
| 点赞激活 | `#FF3040` 红心 + 同色数字（**这个红刻意比 error 红更鲜，与品牌中性色彻底分离**） |

---

## 7. 主题机制（Theming Architecture）

```
ThemePreference (system/light/dark)
        │
        ▼
useColorScheme() ──► resolveThemeMode() ──► AppTheme(light|dark)
        │                                          │
        │                                          ▼
        │                              ThemeProvider (React Context)
        │                                          │
        ▼                                          ▼
setActiveThemeMode() ──► global mutable + Proxy   useAppTheme() / useThemedStyles()
        │
        └─► Inline `theme.colors.*` 在每次 render 自动读最新值
```

关键约束（`theme/index.ts` 注释里写得很硬）：

1. **`StyleSheet.create({...})` 会冻结颜色** —— 模块加载时把当时的 Proxy 值固化为字符串，之后切主题不会重渲染。任何静态 stylesheet 必须改写为
   ```ts
   const styles = useThemedStyles((t) => StyleSheet.create({...}))
   ```
2. **Inline 样式可以直接写 `theme.colors.x`** —— Proxy 读取永远返回最新主题值。
3. **不要使用 Gluestack `$white` / `$black` token** —— 它们和 ThemeProvider 不同步会在切换瞬间出现「白底白字」。所有 UI 组件（`Button`/`CenteredTabBar` 等）已经迁移到 `useAppTheme()` 注入。
4. **图片资源也分主题**：`header-logo.gif` / `header-logo-dark.gif` 通过 `theme.mode` 切换。

Web 端用 `next-themes` 的 `darkMode: "class"`，CSS 变量同名同义。

---

## 8. 动效（Motion）

### App
- 主交互保持克制：按钮 `:active opacity 0.8`，无缩放反弹
- Modal `animationType="fade"`，发布 sheet `slide-up`
- 列表 / 瀑布流不加入场动画，避免与图片解码竞争主线程
- 切换 Tab：横向 PagerView 原生滑动，Header 通过 Reanimated 做收起 / 露出

### Web（更戏剧化，承担营销角色）
- `signature-shard-in` —— 首页 Wordmark 字符碎片化拼接（每个字符 CSS 变量持有偏移角度，SSR-safe）
- `hero-float-a/b/c/d/phone` —— 首屏 phone mockup 与 cards 错相浮动 6–8px
- `marquee` —— 50s 循环品牌 logo 横滚
- `slide-up` / `fade-in` / `scale-in` —— 滚动入场，标准 0.6–0.8s ease-out
- `prefers-reduced-motion` —— 全部动画降到 0.01ms

---

## 9. Iconography & Imagery

- **图标**：`@expo/vector-icons` 的 **Ionicons** 全产品统一，line-style outline 优先（`heart-outline`、`notifications-outline`、`pricetag-outline`），命中态切实心 (`heart`)
- **尺寸**：内联 16 / 列表 20 / Tab 22 / Header 24 / FAB 内 28
- **颜色**：默认 `colors.text`；非激活 `colors.gray400`；点赞激活 `#FF3040`
- **品牌 logo**：Playfair 大写字体的「AVANT REGARD」字标（splash 黑底 + GIF header）
- **图像**：Cover 默认 `aspectRatio: 3/4`（杂志开本），统一通过 `OptimizedImage` + Storage 原图直读避免 proxy resize 缓存腐化（详见 `PostCoverMedia` 文件级注释）

---

## 10. 一致性检查清单（PR Review Checklist）

新增 / 改动 UI 时请对照：

- [ ] 颜色全部来自 `t.colors.*` 或 `theme.colors.*`（**禁止硬编码 `#FFFFFF` / `#000000`**，会破坏 dark mode）
- [ ] 字体一律 `PlayfairDisplay-Regular/Medium/Bold` 或 `playfairFonts.*`
- [ ] 间距用 `t.spacing.xs/sm/md/lg/xl/xxl`，不写 `marginTop: 10`
- [ ] 非圆形圆角用 `t.borderRadius.md`（= 4），头像 / pill 用 `full`
- [ ] 阴影用 `t.shadows.sm/md/lg`，不自己写 `shadowOpacity`
- [ ] `StyleSheet.create` 包在 `useThemedStyles((t) => …)` 中
- [ ] 主操作按钮 = 黑底白字 `radius:4`；副操作 = outline 或 ghost
- [ ] 角标位置 / 颜色遵循「社区/店铺/审核/驳回/通知」既有规范
- [ ] 在 light + dark 双模式真机各检查一次（gluestack `$white` 会在切换时回潮）

---

## 11. 文件索引

| 内容 | 路径 |
| --- | --- |
| App 主题源 | `frontend/src/theme/index.ts` |
| Web Tailwind tokens | `web/tailwind.config.ts` |
| Web 全局 CSS / 动画 | `web/src/app/globals.css` |
| 主按钮 | `frontend/src/components/ui/button.tsx` |
| 屏幕头部 | `frontend/src/components/ScreenHeader.tsx` |
| 瀑布流卡片 | `frontend/src/components/PostCard.tsx` |
| 居中可滑 Tab | `frontend/src/components/CenteredTabBar.tsx` |
| 发布悬浮按钮 | `frontend/src/components/PublishTabButtonV2.tsx` |
| Alert / Modal | `frontend/src/components/CustomAlert.tsx` |
| 字体文件 | `frontend/assets/fonts/PlayfairDisplay-{Regular,Medium,Bold}.ttf` |
