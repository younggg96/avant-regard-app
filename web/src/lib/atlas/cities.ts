/**
 * Avant-Garde Fashion Atlas — city dataset & aggregator.
 *
 * Two roles:
 *   1. Provide a tiny mock dataset for SSR / loading / error fallbacks so
 *      the globe always has something valid to render.
 *   2. Aggregate the live `BuyerStore[]` from /api/buyer-stores into city
 *      markers (one marker per unique city, count = stores in that city).
 *
 * The aggregator deliberately does NOT try to be clever about geocoding:
 * we only keep a city if the backend already gave us at least one store
 * with valid coordinates. That avoids drift between the atlas and the
 * /stores map (which is the source of truth).
 */

import type { BuyerStore } from "@/lib/api";
import {
  CITY_TRANSLATIONS,
  COUNTRY_TRANSLATIONS,
} from "@/components/stores/storeI18n";

/** True if the string contains any CJK Unified Ideograph. */
function hasCJK(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value);
}

/**
 * Canonicalize a city name to its Latin form when the live data sends a
 * Chinese alias. The shared `CITY_TRANSLATIONS` map is bi-directional
 * (English→Chinese for Western cities, Chinese→English for CN cities) so
 * we only follow the lookup when the input is CJK and the value is Latin.
 */
function canonicalCityName(raw: string): string {
  const trimmed = raw.trim();
  if (!hasCJK(trimmed)) return trimmed;
  const translated = CITY_TRANSLATIONS[trimmed];
  return translated && !hasCJK(translated) ? translated : trimmed;
}

/** Same idea for country names — `COUNTRY_TRANSLATIONS` is Chinese→English. */
function canonicalCountryName(raw: string): string {
  const trimmed = raw.trim();
  if (!hasCJK(trimmed)) return trimmed;
  return COUNTRY_TRANSLATIONS[trimmed] ?? trimmed;
}

export interface AtlasCity {
  /** Stable identifier (lowercase-kebab); used as React key + selection. */
  id: string;
  name: string;
  country: string;
  /** -90 ≤ lat ≤ 90 (degrees). */
  lat: number;
  /** -180 ≤ lng ≤ 180 (degrees). */
  lng: number;
  /** Number of stores anchored to this city. */
  count: number;
  /** Optional featured store / brand label, when available. */
  featured?: string;
}

/**
 * Bundled fallback cities — used only when the live API hasn't responded
 * yet (or fails). The set still covers the world so the first-paint globe
 * looks complete instead of empty.
 */
export const FALLBACK_ATLAS_CITIES: readonly AtlasCity[] = [
  { id: "tokyo",         name: "Tokyo",         country: "Japan",          lat: 35.6762,  lng: 139.6503,  count: 21 },
  { id: "berlin",        name: "Berlin",        country: "Germany",        lat: 52.52,    lng: 13.405,    count: 21 },
  { id: "paris",         name: "Paris",         country: "France",         lat: 48.8566,  lng: 2.3522,    count: 14 },
  { id: "london",        name: "London",        country: "UK",             lat: 51.5072,  lng: -0.1276,   count: 11 },
  { id: "antwerp",       name: "Antwerp",       country: "Belgium",        lat: 51.2194,  lng: 4.4025,    count: 10 },
  { id: "los-angeles",   name: "Los Angeles",   country: "USA",            lat: 34.0549,  lng: -118.2426, count: 9  },
  { id: "milan",         name: "Milan",         country: "Italy",          lat: 45.4642,  lng: 9.19,      count: 9  },
  { id: "munich",        name: "Munich",        country: "Germany",        lat: 48.1351,  lng: 11.582,    count: 7  },
  { id: "new-york",      name: "New York",      country: "USA",            lat: 40.7128,  lng: -74.006,   count: 6  },
  { id: "osaka",         name: "Osaka",         country: "Japan",          lat: 34.6937,  lng: 135.5023,  count: 5  },
  { id: "copenhagen",    name: "Copenhagen",    country: "Denmark",        lat: 55.6761,  lng: 12.5683,   count: 4  },
  { id: "rome",          name: "Rome",          country: "Italy",          lat: 41.9028,  lng: 12.4964,   count: 4  },
  { id: "san-francisco", name: "San Francisco", country: "USA",            lat: 37.7749,  lng: -122.4194, count: 3  },
  { id: "seoul",         name: "Seoul",         country: "South Korea",    lat: 37.5665,  lng: 126.978,   count: 3  },
  { id: "hong-kong",     name: "Hong Kong",     country: "China",          lat: 22.3193,  lng: 114.1694,  count: 3  },
  { id: "amsterdam",     name: "Amsterdam",     country: "Netherlands",    lat: 52.3676,  lng: 4.9041,    count: 3  },
  { id: "zurich",        name: "Zurich",        country: "Switzerland",    lat: 47.3769,  lng: 8.5417,    count: 2  },
];

export const ATLAS_FALLBACK_CITY: AtlasCity =
  FALLBACK_ATLAS_CITIES[0] ?? {
    id: "tokyo",
    name: "Tokyo",
    country: "Japan",
    lat: 35.6762,
    lng: 139.6503,
    count: 21,
  };

/** Validate a single record (runtime + tests). */
export function isValidAtlasCity(city: AtlasCity | undefined): city is AtlasCity {
  if (!city) return false;
  if (!city.id || !city.id.trim()) return false;
  if (!city.name || !city.name.trim()) return false;
  if (!city.country || !city.country.trim()) return false;
  if (!Number.isFinite(city.lat) || city.lat < -90 || city.lat > 90) return false;
  if (!Number.isFinite(city.lng) || city.lng < -180 || city.lng > 180) return false;
  if (!Number.isFinite(city.count) || city.count < 0) return false;
  return true;
}

/**
 * Lowercase-kebab a free-form city string into a stable React key.
 *
 * Two cities that share a normalized name are considered the same city —
 * matches the behavior of /stores's city filter (case-insensitive).
 */
function cityKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Aggregate a flat list of `BuyerStore`s into one marker per unique city.
 *
 *   - Coordinates: median lat/lng of every store with valid coords in that
 *     city (median, not mean, so a single mis-geocoded store doesn't drag
 *     the marker off-target).
 *   - Country: most common country string seen for the city.
 *   - Count: number of stores in that city (with or without coords).
 *   - Featured: name of the store with the most listed brands (best proxy
 *     for "anchor boutique" available from /api/buyer-stores).
 *
 * Stores without a city or with no valid-coordinate sibling in the same
 * city are excluded — we cannot place them on a globe.
 */
export function aggregateCitiesFromStores(stores: readonly BuyerStore[]): AtlasCity[] {
  if (!stores.length) return [];

  type Bucket = {
    name: string;
    countries: Map<string, number>;
    lats: number[];
    lngs: number[];
    count: number;
    featured?: { name: string; brandCount: number };
  };
  const buckets = new Map<string, Bucket>();

  for (const store of stores) {
    const rawCity = store.city?.trim();
    if (!rawCity) continue;
    // Canonicalize so Chinese aliases ("莫斯科", "蒙特利尔") merge into the
    // same bucket as their Latin twin ("Moscow", "Montreal"). Avoids the
    // "two markers stacked" rendering bug seen in dense regions.
    const cityName = canonicalCityName(rawCity);
    const key = cityKey(cityName);
    if (!key) continue;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        name: cityName,
        countries: new Map(),
        lats: [],
        lngs: [],
        count: 0,
      };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (store.country) {
      const country = canonicalCountryName(store.country);
      bucket.countries.set(
        country,
        (bucket.countries.get(country) ?? 0) + 1,
      );
    }

    const c = store.coordinates;
    if (
      c &&
      Number.isFinite(c.latitude) &&
      Number.isFinite(c.longitude) &&
      c.latitude !== 0 &&
      c.longitude !== 0 &&
      c.latitude >= -90 &&
      c.latitude <= 90 &&
      c.longitude >= -180 &&
      c.longitude <= 180
    ) {
      bucket.lats.push(c.latitude);
      bucket.lngs.push(c.longitude);
    }

    const brandCount = Array.isArray(store.brands) ? store.brands.length : 0;
    if (!bucket.featured || brandCount > bucket.featured.brandCount) {
      bucket.featured = { name: store.name, brandCount };
    }
  }

  const median = (xs: number[]) => {
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const dominantCountry = (m: Map<string, number>) => {
    let best = "";
    let bestCount = -1;
    for (const [country, n] of m) {
      if (n > bestCount) {
        best = country;
        bestCount = n;
      }
    }
    return best;
  };

  const result: AtlasCity[] = [];
  for (const [id, bucket] of buckets) {
    if (bucket.lats.length === 0) continue;
    const city: AtlasCity = {
      id,
      name: bucket.name,
      country: dominantCountry(bucket.countries) || "—",
      lat: median(bucket.lats),
      lng: median(bucket.lngs),
      count: bucket.count,
      featured: bucket.featured?.name,
    };
    if (isValidAtlasCity(city)) result.push(city);
  }

  result.sort((a, b) => b.count - a.count);
  return result;
}

/** Pick the highest-count valid city (default selection). */
export function pickInitialAtlasCity(
  cities: readonly AtlasCity[] = FALLBACK_ATLAS_CITIES,
): AtlasCity {
  const valid = cities.filter(isValidAtlasCity);
  if (valid.length === 0) return ATLAS_FALLBACK_CITY;
  return valid.reduce((best, c) => (c.count > best.count ? c : best), valid[0]);
}

/** Look up a city by id with a guaranteed fallback. Never throws. */
export function findAtlasCity(
  id: string | null | undefined,
  cities: readonly AtlasCity[] = FALLBACK_ATLAS_CITIES,
): AtlasCity {
  if (!id) return pickInitialAtlasCity(cities);
  const match = cities.find((c) => c.id === id);
  return match && isValidAtlasCity(match) ? match : pickInitialAtlasCity(cities);
}
