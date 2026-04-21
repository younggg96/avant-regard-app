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
 */

import { useEffect, useRef } from "react";
import maplibregl, { type Map as MLMap, type Marker } from "maplibre-gl";
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

export function StoreMap({
  stores,
  selectedId,
  onSelect,
  userPosition,
}: {
  stores: BuyerStore[];
  selectedId?: string | null;
  onSelect?: (store: BuyerStore) => void;
  /**
   * Optional browser-geolocated position of the current user. When provided,
   * a distinctive blue dot is rendered and the map auto-fits so that the
   * user's location is always in-frame alongside the stores.
   */
  userPosition?: LngLat | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const userMarkerRef = useRef<Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const valid = stores.filter(
      (s) =>
        s.coordinates &&
        s.coordinates.latitude !== 0 &&
        s.coordinates.longitude !== 0,
    );

    const initialCenter =
      valid.length > 0
        ? ([
            valid[0].coordinates!.longitude,
            valid[0].coordinates!.latitude,
          ] as [number, number])
        : ([116.4074, 39.9042] as [number, number]);

    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: initialCenter,
      zoom: valid.length > 1 ? 3 : 10,
      attributionControl: {},
    });

    mapRef.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const m of markersRef.current.values()) m.remove();
    markersRef.current.clear();

    const bounds = new maplibregl.LngLatBounds();
    let added = 0;

    for (const s of stores) {
      if (
        !s.coordinates ||
        s.coordinates.latitude === 0 ||
        s.coordinates.longitude === 0
      )
        continue;

      const el = document.createElement("button");
      el.type = "button";
      el.className =
        "h-3 w-3 rounded-full border-2 border-white bg-black shadow-md transition-transform hover:scale-150 focus:outline-none focus:ring-2 focus:ring-white/80 dark:bg-white dark:border-black";
      el.setAttribute("aria-label", s.name);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect?.(s);
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

    if (added > 1 || (added >= 1 && userPosition)) {
      map.fitBounds(bounds, { padding: 56, maxZoom: 13, duration: 0 });
    } else if (added === 0 && userPosition) {
      map.jumpTo({ center: [userPosition.longitude, userPosition.latitude], zoom: 11 });
    }
  }, [stores, onSelect, userPosition]);

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
    for (const [id, marker] of markersRef.current) {
      const el = marker.getElement() as HTMLElement;
      el.classList.toggle("scale-150", id === selectedId);
      el.classList.toggle("ring-2", id === selectedId);
    }
  }, [selectedId, stores]);

  return (
    <div
      ref={containerRef}
      className="h-[calc(100vh-14rem)] min-h-[480px] w-full overflow-hidden rounded border border-[var(--border)] bg-[var(--canvas-raised)]"
    />
  );
}
