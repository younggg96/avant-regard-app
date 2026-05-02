import { Post as DisplayPost } from "../../components/PostCard";
import { StoreProduct } from "../../services/storeProductService";

export type TabType = "published" | "pending" | "draft" | "saved" | "liked" | "forum" | "archive" | "wishlist" | "storeActivity";

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
