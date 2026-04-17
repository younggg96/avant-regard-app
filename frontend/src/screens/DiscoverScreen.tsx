/**
 * 发现页屏幕
 * 此文件为导出入口，实际实现已拆分到 Discover 目录中
 *
 * 目录结构：
 * - Discover/
 *   - index.tsx          - 主组件
 *   - types.ts           - 类型定义
 *   - utils.ts           - 工具函数
 *   - constants.ts       - 常量
 *   - styles.ts          - 样式
 *   - components/
 *     - SkeletonPostCard.tsx    - 骨架屏组件
 *     - PopularCommunities.tsx  - 热门社区组件
 *     - DiscoverTabBar.tsx      - Tab 栏组件
 *     - TabContent.tsx          - Tab 内容组件
 *   - hooks/
 *     - useDiscoverData.ts      - 数据获取 Hook
 *     - useHeaderAnimation.ts   - Header 动画 Hook
 */
export { default } from "./Discover";
