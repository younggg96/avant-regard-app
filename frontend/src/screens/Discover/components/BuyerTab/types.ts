/**
 * BuyerTab 专用类型定义。
 *
 * 2026-04-29 起，买手店 Tab 已完全改为消费真实后端数据：
 *   - 单品：`/api/store-products/store/{storeId}`（Phase 5 商品系统）；
 *   - 主页配置 / 入口卡片：`/api/store-products/store/{storeId}/profile-config` +
 *     `.../entry-cards`；
 *   - 特色 Banner：`/api/store-merchants/store/{storeId}/banners`（商家在
 *     `MerchantManageScreen` → Banner Tab 发布的 Banner）。
 *
 * 任意资源缺失时 UI 走空态（CategoryCards 返回 null、ProductGrid 展示"暂无
 * 匹配的单品"、NewArrivalBanner 不挂载），不再由前端合成 Mock 图片 / 标题 /
 * 粉丝数。
 */

import type {
  StoreProfileConfig as BackendStoreProfileConfig,
  StoreEntryCard as BackendStoreEntryCard,
  EntryCardType as BackendEntryCardType,
  StoreProductCategory as BackendStoreProductCategory,
} from "../../../../services/storeProductService";

export type ProductBadge = "NEW" | "SALE" | "EVENT";

/**
 * 买手店 Tab 单品卡片的统一 View 模型。
 *
 * 数据来源：`/api/store-products/store/{storeId}` 返回的 `StoreProduct`，
 * 经 `useBuyerTabData.buildProductsFromRemote` 映射到本 View。
 *
 * 金额统一按"分"为单位（`priceCents`）存，和后端 `store_products.price_cents`
 * 对齐；渲染侧根据"整数元 → 千分位"/"含小数 → 2 位小数"自行格式化，避免业务
 * 层重复写 `price / 100` 和四舍五入。
 */
export interface BuyerStoreProduct {
  id: string;
  /** 对应 `store_products.id`，用于点击跳转 StoreProductDetail。 */
  realProductId: number;
  title: string;
  brand: string;
  /** 商品首图；商家没上图时为空串，UI 走 OptimizedImage 自带的灰块占位。 */
  image: string;
  /** 商家定价 —— 若有折扣，这是"原价"。 */
  priceCents: number;
  /** 折扣价（存在即代表 has_discount = true，UI 会把原价划线）。 */
  discountPriceCents?: number;
  badge?: ProductBadge;
  /**
   * 卡片上的心形图标语义 = "点赞" (back-end `store_product_likes`)，与
   * StoreProductDetailScreen 顶部 like 按钮指向同一张表 —— 保证用户在详情
   * 页点的赞，回到买手店列表能立即看到红心。Detail/List 共用一份后端真值，
   * UI 上的"收藏 (favorite)"和"想要 (want)"另有独立按钮，不在卡片上展示。
   */
  isFavorited?: boolean;
}

/**
 * 顶部店铺选择条的一项。
 *
 * `coverImage` 兜底成第一张 images，若仍为空则由渲染层用首字母占位圆。
 */
export interface BuyerStoreShortcut {
  storeId: string;
  name: string;
  coverImage?: string;
}

// ============================================================================
// 入口卡片（CategoryCards）
// ============================================================================

/**
 * 入口卡片的类型 key。和后端 `EntryCardType` 枚举一致，但在前端为了 JSX
 * 里好写成 `card.cardType === "DISCOUNT"`，直接用后端字面量。
 */
export type EntryCardKey = BackendEntryCardType;

/**
 * 统一 View 模型：不管数据是真实 `StoreEntryCard`（后端返回）还是
 * Mock 回退时合成的，都先转成这个 shape 交给 UI。
 *
 * 这么做的价值：
 *   - 渲染层不需要区分"真实 vs Mock"，永远吃同一套 props；
 *   - 未来商家后端加字段（比如 badge / CTA 文案），只加进本 View 即可，
 *     UI 自然跟着扩展。
 */
export interface StoreEntryCardView {
  /** 真实数据时是后端 id；Mock 数据时是字符串 key（"products-fallback"）。 */
  id: string;
  cardType: EntryCardKey;
  label: string;
  labelEn?: string;
  image: string;
  /** 仅 CLASSIFICATION 类型，点击后带到商品列表页做分类过滤。 */
  targetCategoryId?: number | null;
  sortOrder: number;
  /** 是否来自后端配置（非兜底 Mock）—— 主要给调试 / 埋点用。 */
  isRemote: boolean;
}

/**
 * 老接口里用到的 CategoryCardConfig 名称仍被 BuyerTab/CategoryCards 老消费方
 * 引用。保留成 StoreEntryCardView 的别名，避免一次性大范围 rename；
 * 长期看逐步迁到 StoreEntryCardView。
 *
 * @deprecated 使用 StoreEntryCardView
 */
export type CategoryCardConfig = StoreEntryCardView;

// ============================================================================
// 商品分类（Phase 4 会用到）
// ============================================================================

export interface ProductCategoryView {
  id: number;
  name: string;
  coverImage?: string | null;
  sortOrder: number;
  productCount?: number | null;
}

// ============================================================================
// 首季上新 Banner —— 保持旧定义
// ============================================================================

/**
 * 特色 Banner 渲染数据。
 *
 * 直接来自 `/api/store-merchants/store/{storeId}/banners`（商家在商家管理
 * 页发布的 `StoreBanner`）。后端模型只保证 `imageUrl`，`title` 选填，
 * `linkUrl` / `subtitle` / `cta` 也不是所有商家都会配，所以这里统一做成
 * optional，由 `NewArrivalBanner` 条件渲染。
 */
export interface BuyerStoreFeatureBanner {
  /** 对应 `store_banners.id`，用于曝光 / 点击埋点。 */
  bannerId: number;
  /** 必填 —— 没有图片根本不会生成这条（hook 里已过滤）。 */
  image: string;
  title?: string;
  subtitle?: string;
  cta?: string;
  /** 商家配置的跳转链接（可选）。 */
  linkUrl?: string;
}

// ============================================================================
// StoreProfileCard View 模型
// ============================================================================

/**
 * 所选买手店需要在页面上展示的所有衍生信息。
 *
 * 数据流（自 2026-04-29 去 mock 起）：
 *   - 主体字段（name / city / description / images / favoriteCount 等）
 *     来自 `buyer_stores` 原始记录；
 *   - Logo / Cover / 长短介绍 / tags 来自商家自助配置的
 *     `store_profile_configs`（由 `StoreProfileConfig` 覆盖）；
 *   - 商家未配置某字段时一律留空，由 UI 侧 StoreProfileCard 做空态呈现
 *     （例如 logoImage 缺失 → 首字母占位；coverImage 缺失 → 灰块；
 *     tags 为空 → 不渲染 chips 行）。
 *
 * 前端不再合成任何 Mock 文案 / 粉丝数 / 促销标签；真实字段齐全前，UI
 * 就按真实数据的"空态"展示，避免误导用户。
 */
export interface BuyerStoreProfileView {
  storeId: string;
  name: string;
  /** 短简介；未配置时为空串，UI 会折叠该段落。 */
  description: string;
  location: string;
  /** 店铺封面大图；未配置时为 undefined，UI 走灰块占位。 */
  coverImage?: string;
  /** 圆形 logo 图；为空时 UI 走首字母占位。 */
  logoImage?: string;
  /** logo 占位字符，永远有值（`logoImage` 优先级高）。 */
  logoLetter: string;
  /**
   * 关注（粉丝）人数。直接来自后端 `buyer_stores.favorite_count` (列表接口的
   * `favoriteCount` 字段) + `useStoreFavoritesStore` 里的乐观计数；
   * UI 侧负责 1k/1w 的 compact 格式化（不在 view-model 里 stringify，
   * 否则 follow 按钮点完之后 label 不会跟着乐观计数变）。
   */
  followerCount: number;
  /**
   * 店铺「关注」数（设计稿 middle 列；例如品牌号关注的人数/同类指标）。
   * 当前后端未返回时由 hook 填 0，仅占位与 UI 对齐。
   */
  followingCount: number;
  /**
   * 该店铺已上架的商品数。来自 `getStoreProducts({...}).total`，
   * 商家未上架商品时为 0，UI 侧仍渲染"0"而不是隐藏整列。
   */
  productCount: number;
  isVerified: boolean;
  tags: string[];
  /** 卡片底部长介绍；未配置时为空串，UI 会折叠。 */
  longDescription: string;
  /** 是否来自后端配置（主要给调试 / 埋点）。 */
  isRemote: boolean;
}

/**
 * 类型重导出，方便 hook / 组件按需单独 import 后端原始 shape。
 */
export type { BackendStoreProfileConfig, BackendStoreEntryCard, BackendStoreProductCategory };
