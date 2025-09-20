// Core Data Models for Avant Regard Fashion Runway App

export interface Designer {
  id: string;
  name: string;
  aliases?: string[];
  letterIndex: string;
  bio?: string;
  foundedYear?: number;
  country?: string;
  imageUrl?: string;
}

export interface BrandBranch {
  id: string;
  designerId: string;
  name: string;
  era?: string;
  description?: string;
  logoUrl?: string;
}

export type SeasonCode = "SS" | "FW" | "Resort" | "Couture";

export interface Season {
  id: string;
  year: number;
  code: SeasonCode;
  label: string; // e.g., "Spring/Summer 2024"
}

export interface Lookbook {
  id: string;
  brandBranchId: string;
  seasonId: string;
  title: string;
  coverUrl: string;
  location?: string;
  date?: string;
  description?: string;
}

export interface Look {
  id: string;
  lookbookId: string;
  index: number;
  title?: string;
  description: string;
  images: string[];
  silhouette?: string;
  materials?: string[];
  details?: string;
  inspiration?: string;
}

export type ItemCategory =
  | "outerwear"
  | "tops"
  | "bottoms"
  | "dresses"
  | "footwear"
  | "accessories"
  | "bags"
  | "jewelry";

export interface Item {
  id: string;
  lookId: string;
  category: ItemCategory;
  material?: string;
  sizeInfo?: string;
  msrp?: number;
  sku?: string;
  name: string;
  description?: string;
  images: string[];
}

export type ListingType = "for_sale" | "wanted" | "in_stock";

export interface Listing {
  id: string;
  itemId: string;
  type: ListingType;
  price?: number;
  currency?: string;
  link?: string;
  sellerId?: string;
  status: "active" | "sold" | "expired";
  condition?: string;
  size?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export type TargetType = "look" | "item" | "lookbook" | "designer";

export interface Note {
  id: string;
  targetType: TargetType;
  targetId: string;
  authorId: string;
  content: string;
  images: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  nickname: string;
  avatarUrl?: string;
  bio?: string;
  joinedAt: string;
}

export interface UserPreference {
  userId: string;
  designerIds: string[];
  brandBranchIds: string[];
  favoriteSeasons?: string[];
  preferredCategories?: ItemCategory[];
}

export interface Follow {
  id: string;
  userId: string;
  targetType: TargetType;
  targetId: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  userId: string;
  itemId: string;
  rule: "price_drop" | "new_listing" | "back_in_stock";
  threshold?: number;
  active: boolean;
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface FeedItem {
  type: "lookbook" | "look" | "note" | "listing";
  data: Lookbook | Look | Note | Listing;
  timestamp: string;
  engagement?: {
    views: number;
    saves: number;
    shares: number;
  };
}

// Filter Types
export interface FilterOptions {
  designers?: string[];
  branches?: string[];
  seasons?: string[];
  categories?: ItemCategory[];
  hasListings?: boolean;
  priceRange?: {
    min: number;
    max: number;
  };
}
