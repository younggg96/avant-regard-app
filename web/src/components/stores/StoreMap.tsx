"use client";

/**
 * Client-side store map view.
 *
 * Uses maplibre-gl with the free OpenStreetMap raster tiles so we don't need
 * any proprietary API key. Stores are rendered as DOM markers (pure CSS),
 * clicking one emits a `onSelect(store)` callback the parent list uses to
 * highlight and scroll.
 *
 * Lifecycle note: maplibre-gl ships its own CSS + WebGL setup; we side-effect
 * import the CSS inside this client component so it's only bundled when the
 * /stores route is actually loaded.
 *
 * Parity with iOS BuyerMapScreen:
 *  - Marker color reflects `isOpen` and selection state (black / gray / white-w/-ring)
 *  - Dim markers that don't match the current filter (controlled by `filteredIds`)
 *  - `onRegionChange` reports the current viewport bounds so the parent can
 *    fetch only in-view stores from `/api/buyer-stores/viewport` (debounced)
 *  - `autoFit` lets the parent suppress auto-fit once the user pans manually
 */

import { useEffect, useRef } from "react";
import maplibregl, {
  type Map as MLMap,
  type Marker,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BuyerStore } from "@/lib/api";

const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

export interface LngLat {
  longitude: number;
  latitude: number;
}

export interface MapRegion {
  ne_lat: number;
  ne_lng: number;
  sw_lat: number;
  sw_lng: number;
  center: LngLat;
  zoom: number;
}

export interface StoreMapProps {
  stores: BuyerStore[];
  selectedId?: string | null;
  onSelect?: (store: BuyerStore) => void;
  /**
   * Browser-geolocated position of the current user. When provided, a
   * distinctive blue dot is rendered and (the first time) the map auto-fits
   * so the user is in-frame alongside stores.
   */
  userPosition?: LngLat | null;
  /**
   * Subset of store ids that match the active filter. Markers outside this
   * set render dimmed, matching the iOS behavior where an active filter
   * greys out non-matching pins without hiding them.
   */
  filteredIds?: Set<string> | null;
  /**
   * Fires after pan / zoom settles. Parent can debounce + request
   * `/api/buyer-stores/viewport` with the returned bounds.
   */
  onRegionChange?: (region: MapRegion) => void;
  /**
   * When `true` (default) the map auto-fits to the stores + user position
   * whenever the store list changes. Parents that own the camera (e.g. after
   * manual pan, or after a selection fly-to) pass `false` to avoid fighting
   * the user.
   */
  autoFit?: boolean;
  /**
   * If provided, the map jumps to this center / zoom once on mount (before
   * the first fitBounds). Useful for remembering the last viewport across
   * route changes.
   */
  initialCenter?: LngLat;
  initialZoom?: number;
  className?: string;
}

export function StoreMap({
  stores,
  selectedId,
  onSelect,
  userPosition,
  filteredIds,
  onRegionChange,
  autoFit = true,
  initialCenter,
  initialZoom,
  className,
}: StoreMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const userMarkerRef = useRef<Marker | null>(null);
  const hasFittedRef = useRef(false);

  // Latest callback in a ref so the map init effect stays stable (we only
  // want to create a single MapLibre instance for the lifetime of this view).
  const regionChangeRef = useRef(onRegionChange);
  regionChangeRef.current = onRegionChange;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const fallbackCenter: [number, number] = [116.4074, 39.9042];
    const center: [number, number] = initialCenter
      ? [initialCenter.longitude, initialCenter.latitude]
      : fallbackCenter;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center,
      zoom: initialZoom ?? (initialCenter ? 10 : 3),
      attributionControl: {},
    });
    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    const emit = () => {
      if (!regionChangeRef.current) return;
      const b = map.getBounds();
      regionChangeRef.current({
        ne_lat: b.getNorth(),
        ne_lng: b.getEast(),
        sw_lat: b.getSouth(),
        sw_lng: b.getWest(),
        center: {
          latitude: map.getCenter().lat,
          longitude: map.getCenter().lng,
        },
        zoom: map.getZoom(),
      });
    };
    map.on("moveend", emit);
    map.on("zoomend", emit);
    map.once("load", emit);

    // Snapshot the marker registry ref so the cleanup doesn't read a
    // potentially-remounted ref (react-hooks/exhaustive-deps).
    const markerRegistry = markersRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRegistry.clear();
      hasFittedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render / update markers whenever the store list, filter, or selection change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const m of markersRef.current.values()) m.remove();
    markersRef.current.clear();

    const bounds = new maplibregl.LngLatBounds();
    let added = 0;
    const hasFilter = !!filteredIds && filteredIds.size > 0;

    for (const s of stores) {
      if (
        !s.coordinates ||
        s.coordinates.latitude === 0 ||
        s.coordinates.longitude === 0
      )
        continue;

      const isSelected = selectedId === s.id;
      const isDim = hasFilter && !filteredIds!.has(s.id) && !isSelected;

      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", s.name);
      el.className = markerClass({
        isSelected,
        isDim,
        isOpen: !!s.isOpen,
      });
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current?.(s);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([s.coordinates.longitude, s.coordinates.latitude])
        .addTo(map);

      markersRef.current.set(s.id, marker);
      bounds.extend([s.coordinates.longitude, s.coordinates.latitude]);
      added += 1;
    }

    if (userPosition) {
      bounds.extend([userPosition.longitude, userPosition.latitude]);
    }

    // Auto-fit on first render only, and only if parent allows. Once the user
    // pans or a selection fly-to happens, the parent will set autoFit=false
    // to prevent the camera from yanking around.
    if (autoFit && !hasFittedRef.current) {
      if (added > 1 || (added >= 1 && userPosition)) {
        map.fitBounds(bounds, { padding: 64, maxZoom: 13, duration: 0 });
        hasFittedRef.current = true;
      } else if (added === 0 && userPosition) {
        map.jumpTo({
          center: [userPosition.longitude, userPosition.latitude],
          zoom: 11,
        });
        hasFittedRef.current = true;
      }
    }
  }, [stores, filteredIds, selectedId, userPosition, autoFit]);

  // User-location marker: rendered as a pulsing blue dot, kept in sync across
  // prop changes (remove + re-add rather than mutate so CSS stays simple).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (!userPosition) return;

    const el = document.createElement("div");
    el.className =
      "h-4 w-4 rounded-full border-2 border-white bg-[#2F6BFF] shadow-[0_0_0_6px_rgba(47,107,255,0.18)]";
    el.setAttribute("aria-label", "你的位置");
    userMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([userPosition.longitude, userPosition.latitude])
      .addTo(map);
  }, [userPosition]);

  // Fly to the selected store whenever selection changes.
  useEffect(() => {
    if (!selectedId) return;
    const map = mapRef.current;
    const store = stores.find((s) => s.id === selectedId);
    if (!map || !store?.coordinates) return;
    map.flyTo({
      center: [store.coordinates.longitude, store.coordinates.latitude],
      zoom: Math.max(12, map.getZoom()),
      duration: 600,
    });
  }, [selectedId, stores]);

  return (
    <div
      ref={containerRef}
      className={
        className ??
        "h-[calc(100vh-14rem)] min-h-[480px] w-full overflow-hidden rounded border border-[var(--border)] bg-[var(--canvas-raised)]"
      }
    />
  );
}

// Tailwind class for a marker, folded into a helper because the selection /
// dim / open states are combinatorial and easier to read as branching here.
function markerClass({
  isSelected,
  isDim,
  isOpen,
}: {
  isSelected: boolean;
  isDim: boolean;
  isOpen: boolean;
}) {
  if (isSelected) {
    return "h-4 w-4 rounded-full border-[3px] border-black bg-white shadow-lg ring-2 ring-black/30 transition-transform focus:outline-none focus:ring-2 focus:ring-black/80 scale-125 dark:border-white dark:bg-black dark:ring-white/30";
  }
  if (isDim) {
    return "h-3 w-3 rounded-full border-2 border-white bg-[#CCCCCC] opacity-40 shadow-md transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-white/80 dark:border-black";
  }
  if (isOpen) {
    return "h-3 w-3 rounded-full border-2 border-white bg-black shadow-md transition-transform hover:scale-150 focus:outline-none focus:ring-2 focus:ring-white/80 dark:bg-white dark:border-black";
  }
  return "h-3 w-3 rounded-full border-2 border-white bg-[#AAAAAA] shadow-md transition-transform hover:scale-150 focus:outline-none focus:ring-2 focus:ring-white/80 dark:border-black";
}
