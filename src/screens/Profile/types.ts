import { Post as DisplayPost } from "../../components/PostCard";

export type TabType = "published" | "pending" | "draft" | "saved" | "liked" | "forum" | "archive" | "wishlist";

export type ContribSubTab = "show" | "brand" | "store";

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
