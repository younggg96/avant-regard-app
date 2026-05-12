import AsyncStorage from "@react-native-async-storage/async-storage";
import { FeedItem, Post } from "./postService";

/**
 * On-device tab caches for the Discover screen — backs the
 * "open app, see content immediately, refresh quietly in background"
 * (a.k.a. stale-while-revalidate) flow.
 *
 * Storage layout
 * --------------
 * Each cached tab is one AsyncStorage key holding a `CacheEntry<T>` JSON
 * blob. We trim to `CACHE_MAX_ITEMS` (~one screen-worth) so the JSON stays
 * small enough that AsyncStorage's per-key write stays well below 100 ms
 * even on cold devices — large blobs here would silently push the
 * hydration past the splash screen and defeat the whole point.
 *
 * Backward compat
 * ---------------
 * The recommend feed cache predates the other tabs and shipped under an
 * un-prefixed key. We can't migrate it without forcing every existing
 * user to eat one cold-start cache miss, so `getStorageKey("feed")`
 * deliberately still resolves to the legacy key. New tabs use the
 * prefixed `avant-regard-tab-cache:<name>` namespace.
 */

// Bound the persisted slice to roughly one viewport — the user's first
// scroll triggers a real network page anyway, so caching more is wasted
// disk + a slower hydration read. 30 ≈ MasonryFlashList "above the fold"
// (16) + one buffer page.
const CACHE_MAX_ITEMS = 30;

interface CacheEntry<T> {
  items: T[];
  cachedAt: number;
}

interface TabCache<T> {
  /** Returns the cached items, or `null` on miss / parse failure. */
  get(): Promise<T[] | null>;
  /** Persist a slice (`<= CACHE_MAX_ITEMS`) atomically. Failures are swallowed. */
  set(items: T[]): Promise<void>;
  /** Drop the cache entry. Used by the Settings → Storage tools. */
  clear(): Promise<void>;
}

function getStorageKey(name: string): string {
  // Legacy un-prefixed key — see "Backward compat" above.
  if (name === "feed") return "avant-regard-feed-cache";
  return `avant-regard-tab-cache:${name}`;
}

function makeTabCache<T>(name: string): TabCache<T> {
  const storageKey = getStorageKey(name);
  return {
    async get(): Promise<T[] | null> {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!raw) return null;
        const entry: CacheEntry<T> = JSON.parse(raw);
        if (!Array.isArray(entry.items) || entry.items.length === 0) {
          return null;
        }
        return entry.items;
      } catch {
        // Corrupt JSON / schema mismatch — treat as miss; the fresh fetch
        // will overwrite with a clean entry on success.
        return null;
      }
    },

    async set(items: T[]): Promise<void> {
      try {
        const entry: CacheEntry<T> = {
          items: items.slice(0, CACHE_MAX_ITEMS),
          cachedAt: Date.now(),
        };
        await AsyncStorage.setItem(storageKey, JSON.stringify(entry));
      } catch {
        // Non-critical — next cold start falls back to network.
      }
    },

    async clear(): Promise<void> {
      try {
        await AsyncStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    },
  };
}

/** Recommend tab cache — stores `FeedItem[]` (post + show cards). */
export const feedCacheService = makeTabCache<FeedItem>("feed");

/** Forum tab cache — stores raw `Post[]` from `getForumPosts`. */
export const forumPostsCacheService = makeTabCache<Post>("forum");

/** Following tab cache — stores raw `Post[]` from `getFollowingPosts`. */
export const followingPostsCacheService = makeTabCache<Post>("following");
