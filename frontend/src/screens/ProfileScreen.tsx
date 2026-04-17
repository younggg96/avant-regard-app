/**
 * 个人主页
 * 此文件为导出入口，实际实现已拆分到 Profile 目录中
 *
 * 目录结构：
 * - Profile/
 *   - index.tsx                       - 主组件
 *   - types.ts                        - 类型定义
 *   - constants.ts                    - 布局常量
 *   - styles.ts                       - 样式
 *   - hooks/
 *     - useProfileData.ts             - 数据加载 Hook
 *   - components/
 *     - CoverSection.tsx              - 封面区域组件
 *     - CollapsedHeader.tsx           - 吸顶头部组件
 *     - ProfileInfo.tsx               - 用户信息组件
 *     - FollowedBrands.tsx            - 关注品牌组件
 *     - ProfileTabBar.tsx             - Tab 栏组件
 *     - PostsContent.tsx              - 帖子/贡献内容组件
 *     - DeletePostDialog.tsx          - 删除确认弹窗组件
 */
export { default } from "./Profile";
