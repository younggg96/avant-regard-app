import { Post as DisplayPost } from "../../components/PostCard";
import { StoreProduct } from "../../services/storeProductService";
import type { OrderStatus } from "../../services/orderService";

/** 一级 tab —— Profile 主页 3 个一级 tab: 笔记 / 购买 / 在售。
 *
 *  笔记 = 用户原创内容侧 (PostsContent + 9 个 sub chip)
 *  购买 = 买家订单侧
 *  在售 = 卖家订单侧
 *
 *  之前曾经设计成「笔记 + 交易 → (购买/出售)」两层结构, 但用户的
 *  Profile 主页其实只有这 3 个并列页面, 拍平成一级 tab 减少层级,
 *  也方便 TopTabBar 左对齐放在屏幕顶部 (类似小红书 / 闲鱼)。
 */
export type TopTabType = "notes" | "buying" | "selling";

/** 「笔记」一级 tab 下的二级 chip —— 历史叫法为 TabType, 保留兼容。 */
export type TabType = "published" | "pending" | "draft" | "saved" | "liked" | "forum" | "archive" | "wishlist" | "storeActivity";

/**
 * 「交易 → 购买」下的状态过滤 chip。
 *  - all = 不过滤;其余每一项映射到一组允许的 OrderStatus, 在前端筛选。
 *  - 「待评价」=== delivered (买家已收货, 后续等待评价/确认收货)。
 */
export type BuyingFilterType =
  | "all"
  | "pending_payment"
  | "paid"
  | "shipped"
  | "delivered";

/**
 * 「交易 → 出售」下的状态过滤 chip。
 *  - in_progress = paid + shipped (货已发出, 仍在运送中)
 *  - canceled = refunded + refunded_auto (买家取消 / 系统超时回滚)
 */
export type SellingFilterType =
  | "all"
  | "in_progress"
  | "pending_payment"
  | "paid"
  | "delivered"
  | "completed"
  | "canceled";

export const BUYING_FILTER_TO_STATUSES: Record<BuyingFilterType, OrderStatus[] | null> = {
  all: null,
  pending_payment: ["pending_payment"],
  paid: ["paid"],
  shipped: ["shipped"],
  delivered: ["delivered"],
};

export const SELLING_FILTER_TO_STATUSES: Record<SellingFilterType, OrderStatus[] | null> = {
  all: null,
  in_progress: ["paid", "shipped"],
  pending_payment: ["pending_payment"],
  paid: ["paid"],
  delivered: ["delivered"],
  completed: ["completed", "settled"],
  canceled: ["refunded", "refunded_auto"],
};

export type ContribSubTab = "show" | "brand" | "store";

// 4 个一级 sub-tab：前 3 个是 "店铺级" 互动（来源 buyer_stores 系列表），
// 第 4 个 `products` 是 "商品级"，再展开成 3 个 sub-sub-tab（likes/saved/wishlist）
// —— 商家商品评论/喜欢/收藏/想要 都属于 store_products 模型，专门分一组更清晰。
export type StoreActivitySubTab = "favorites" | "comments" | "ratings" | "products";

export type ProductActivitySubTab = "likes" | "saved" | "wishlist";

/** 商品类活动的列表数据；与 TabData 区分开因为它装的是 StoreProduct 而不是 DisplayPost。 */
export type ProductListState = {
  products: StoreProduct[];
  isLoading: boolean;
  hasLoaded: boolean;
  total: number;
};

export const initialProductListState: ProductListState = {
  products: [],
  isLoading: false,
  hasLoaded: false,
  total: 0,
};

export type TabData = {
  posts: DisplayPost[];
  isLoading: boolean;
  hasLoaded: boolean;
  count: number;
};

export const initialTabState: TabData = {
  posts: [],
  isLoading: false,
  hasLoaded: false,
  count: 0,
};
