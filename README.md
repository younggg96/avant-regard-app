# Avant Regard - Fashion Runway Archive Mobile App

一个受 Vogue 启发的高端时装秀场归档移动应用，具有结构化收藏、Lookbook 和市场功能。使用 React Native 和 Expo 构建。

## 🎨 产品概览

**Avant Regard** 是一个高端时装内容聚合平台，提供：

- 结构化秀场归档（设计师 → 品牌分支 → 季节 → Lookbook → Look → 单品）
- UGC 笔记和市场列表
- 基于关注设计师的个性化 Feed
- 针对 iOS 和 Android 优化的原生移动体验

## 🏗️ 项目架构

```
avant-regard-app/
├── packages/core/          # 共享类型、API 客户端、模拟数据
├── src/                    # React Native 应用源码
│   ├── screens/           # 页面组件
│   ├── components/        # 可重用组件
│   ├── store/             # 状态管理
│   └── theme/             # 设计系统
├── assets/                # 静态资源
├── scripts/               # 项目脚本
└── App.tsx                # 应用入口
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn
- Expo CLI（用于移动开发）

### 安装步骤

1. 克隆仓库：

```bash
git clone https://github.com/yourusername/avant-regard-app.git
cd avant-regard-app
```

2. 安装依赖：

```bash
npm install
```

3. 构建核心包：

```bash
npm run build:core
```

### 运行移动应用

```bash
npm run dev
```

然后：

- 按 `i` 启动 iOS 模拟器
- 按 `a` 启动 Android 模拟器
- 使用手机上的 Expo Go 应用扫描二维码

其他命令：

```bash
npm run ios      # 在 iOS 模拟器上运行
npm run android  # 在 Android 模拟器上运行
```

## 📱 功能特色

- **Tab 导航**：发现、设计师、收藏、个人资料
- **发现 Feed**：混合 PGC 秀场内容和 UGC 笔记
- **设计师库**：带搜索的 A-Z 索引设计师目录
- **Lookbook 浏览**：按季节筛选的系列
- **Look 详情**：高分辨率图片和单品分解
- **单品页面**：列表、定价和可用性
- **收藏系统**：保存和整理 Look 和单品
- **响应式设计**：针对各种屏幕尺寸优化
- **离线支持**：核心功能可离线工作

## 🎨 设计系统

### 色彩调色板

- **主色**：#000000（纯黑）
- **次色**：#FFFFFF（纯白）
- **强调色**：#C7A27C（香槟金）
- **灰度**：#111, #222, #666, #AAA, #F5F5F5

### 字体系统

- **衬线标题**：Playfair Display
- **无衬线正文**：Inter
- **Hero**：48-60px，行高 1.1
- **正文**：16-18px，行高 1.6

### 组件库

- `RunwayShowCard`：全宽度 Hero 卡片
- `LookCard`：网格优化图片卡片
- `ItemCard`：带定价的产品展示
- `FilterBar`：粘性筛选导航
- `NoteCard`：用户生成内容卡片

## 📊 数据模型

### 核心实体

- **Designer**：品牌创作者和时装屋
- **BrandBranch**：子品牌（如 Y's、Ground Y）
- **Season**：FW24、SS24 等
- **Lookbook**：秀场系列
- **Look**：个别秀场造型
- **Item**：特定服装/配饰
- **Listing**：市场可用性
- **Note**：用户注释和评论

## 🔌 API 结构

### REST 端点

```
GET /designers?initial=Y
GET /designers/:id/branches
GET /lookbooks?season=FW24
GET /looks/:id
GET /items/:id/listings
POST /notes
POST /listings
```

### 模拟数据

应用包含全面的模拟数据，包括：

- 3 位设计师（Yohji Yamamoto、Rei Kawakubo、Maison Margiela）
- 5 个品牌分支
- 3 个季节
- 3 个 Lookbook
- 5 个带详细描述的 Look
- 带列表的示例单品

## 🛠️ 开发

### 项目结构

#### 核心包（`packages/core/`）

```typescript
src/
├── types/          # TypeScript 接口
├── api/            # API 客户端
└── mocks/          # 种子数据
```

#### 移动应用（`apps/mobile/`）

```typescript
src/
├── screens/        # 屏幕组件
├── components/     # 可重用组件
├── store/          # Zustand 状态管理
└── theme/          # 设计令牌
```

### 状态管理

- **本地状态**：Zustand 用于收藏和用户偏好
- **数据获取**：TanStack Query（React Query）带缓存
- **持久化**：AsyncStorage 用于离线数据

### 样式

- **React Native StyleSheet** 带集中化主题对象
- **设计令牌** 确保间距、颜色和字体的一致性
- **平台特定** 针对 iOS 和 Android 的优化

## 🚢 部署

### 移动端（Expo）

```bash
cd apps/mobile
eas build --platform ios
eas build --platform android
```

应用商店提交：

```bash
eas submit --platform ios
eas submit --platform android
```

## 📈 性能优化

- **虚拟列表**：用于大型集合
- **图片懒加载**：渐进式图片加载
- **缓存**：API 查询 5 分钟缓存时间
- **骨架屏**：加载占位符

## 🔐 安全与合规

- 无版权 Vogue 内容
- 所有图片都是占位符
- 用户数据本地存储
- GDPR 合规数据处理

## 🔄 未来增强

### 第二阶段

- [ ] 价格下降实时通知
- [ ] 带筛选的高级搜索
- [ ] 用户认证
- [ ] 社交功能（关注、分享）

### 第三阶段

- [ ] AR 试穿功能
- [ ] AI 驱动推荐
- [ ] 买卖双方直接消息
- [ ] 支付集成

## 🤝 贡献

1. Fork 仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 打开 Pull Request

## 📄 许可证

此项目仅用于教育目的。所有时装内容均为虚构，仅用于演示。

## 🙏 致谢

- 设计灵感来自 Vogue Runway
- 字体来自 Google Fonts
- 图标来自 Expo Vector Icons
- 状态管理使用 Zustand

## 📞 支持

如有问题或支持需求，请在 GitHub 仓库中开启 issue。

---

**注意**：这是一个演示项目。所有设计师姓名、品牌和内容仅用于教育目的。不包含任何实际时装屋内容或商标。
