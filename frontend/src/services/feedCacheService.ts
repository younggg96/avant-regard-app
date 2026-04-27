import AsyncStorage from "@react-native-async-storage/async-storage";
import { FeedItem } from "./postService";

const CACHE_KEY = "avant-regard-feed-cache";
// One screen-worth of items — enough for an instant first paint without
// bloating AsyncStorage (each post serialises to ~2–5 KB).
const CACHE_MAX_ITEMS = 30;

interface FeedCacheEntry {
  items: FeedItem[];
  cachedAt: number;
}

async function get(): Promise<FeedItem[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: FeedCacheEntry = JSON.parse(raw);
    if (!Array.isArray(entry.items) || entry.items.length === 0) return null;
    return entry.items;
  } catch {
    return null;
  }
}

async function set(items: FeedItem[]): Promise<void> {
  try {
    const entry: FeedCacheEntry = {
      items: items.slice(0, CACHE_MAX_ITEMS),
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Non-critical — next cold start falls back to network.
  }
}

async function clear(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

export const feedCacheService = { get, set, clear };
