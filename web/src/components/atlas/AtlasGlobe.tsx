"use client";

/**
 * AtlasGlobe — Canvas 2-D pseudo-3-D globe for /atlas.
 *
 * Why Canvas 2-D and not Three.js?
 *   - The repo doesn't ship WebGL libraries (`maplibre-gl` is for /stores).
 *   - The visual brief is editorial monochrome: gradients, gridlines, soft
 *     halos. Canvas 2-D nails that look without dragging in ~600 KB of
 *     dependencies.
 *
 * Theme contract:
 *   - The sphere is always dark (it's the editorial focal piece — looks
 *     like a designer object on white paper in light mode, blends with
 *     the page in dark mode).
 *   - The *outer halo* and the rim stroke flip between dark / white so the
 *     ambient glow stays visible against either page background.
 *
 * Performance contract:
 *   - High-frequency state (rotation, focus, pointer, marker hits, zoom)
 *     lives in refs and is mutated inside requestAnimationFrame.
 *   - React state is reserved for values rendered by sibling panels (zoom
 *     %, current selection). Coord readouts are coalesced to ~0.08° steps.
 */

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
  type PointerEvent,
  type WheelEvent,
} from "react";

import {
  ATLAS_FALLBACK_CITY,
  FALLBACK_ATLAS_CITIES,
  findAtlasCity,
  isValidAtlasCity,
  pickInitialAtlasCity,
  type AtlasCity,
} from "@/lib/atlas/cities";
import {
  CONTINENTS,
  INITIAL_ROTATION,
  MAX_PITCH,
  clamp,
  focusForCity,
  formatCoord,
  latLngToVector,
  normalizeAngle,
  projectVector,
  radToDeg,
  normalizeLongitude,
  rotateVector,
  rotationToCoordinates,
  runGlobeMathSelfTests,
  type Coordinates,
  type FocusTarget,
  type ProjectedPoint,
} from "@/lib/atlas/globeMath";

interface MarkerHit {
  cityId: string;
  x: number;
  y: number;
  radius: number;
}

export interface AtlasGlobeHandle {
  selectCity(city: AtlasCity): void;
  resetView(): void;
  toggleAutoRotate(): void;
}

export type AtlasGlobeTheme = "light" | "dark";

/**
 * Cap on how many labels we are *willing* to render in a single frame.
 * Anything past this is just a dot. We intentionally keep this low so
 * dense regions (like Europe) read as constellations instead of a wall
 * of overlapping captions.
 */
const TOP_LABEL_LIMIT = 12;

export interface AtlasGlobeProps {
  /** Initial selected city (id). Defaults to the highest-count city. */
  initialCityId?: string;
  /** Cities to plot. Defaults to the bundled fallback dataset. */
  cities?: readonly AtlasCity[];
  /** Light / dark palette (drives halo + rim stroke colors). */
  theme?: AtlasGlobeTheme;
  onCityChange?: (city: AtlasCity) => void;
  onCoordinatesChange?: (coords: Coordinates) => void;
  onZoomChange?: (zoomPercent: number) => void;
  onAutoRotateChange?: (autoRotate: boolean) => void;
}

/** Module-level self-test — keeps the math pure and the data sane. */
const SELF_TESTS_PASS = runGlobeMathSelfTests();

interface Palette {
  outerHalo: [string, string, string];
  rim: string;
  rimSoft: string;
}

const PALETTES: Record<AtlasGlobeTheme, Palette> = {
  light: {
    // Soft graphite halo that fades into a white page
    outerHalo: [
      "rgba(0, 0, 0, 0.08)",
      "rgba(0, 0, 0, 0.025)",
      "rgba(0, 0, 0, 0)",
    ],
    rim: "rgba(0, 0, 0, 0.18)",
    rimSoft: "rgba(0, 0, 0, 0.06)",
  },
  dark: {
    outerHalo: [
      "rgba(255, 255, 255, 0.09)",
      "rgba(255, 255, 255, 0.03)",
      "rgba(255, 255, 255, 0)",
    ],
    rim: "rgba(255, 255, 255, 0.12)",
    rimSoft: "rgba(255, 255, 255, 0.045)",
  },
};

export const AtlasGlobe = forwardRef<AtlasGlobeHandle, AtlasGlobeProps>(
  function AtlasGlobe(
    {
      initialCityId,
      cities = FALLBACK_ATLAS_CITIES,
      theme = "dark",
      onCityChange,
      onCoordinatesChange,
      onZoomChange,
      onAutoRotateChange,
    },
    ref,
  ) {
    const safeCities = useMemo(
      () => cities.filter(isValidAtlasCity),
      [cities],
    );

    /**
     * IDs of the cities that are *eligible* for an on-globe label this
     * session — the top N by store count. Selected city is always added on
     * top of this in the render loop so it always carries a caption.
     */
    const labelEligibleIds = useMemo(() => {
      const ids = new Set<string>();
      const sorted = [...safeCities].sort((a, b) => b.count - a.count);
      for (let i = 0; i < Math.min(TOP_LABEL_LIMIT, sorted.length); i += 1) {
        ids.add(sorted[i].id);
      }
      return ids;
    }, [safeCities]);
    const initialCity = useMemo(
      () =>
        initialCityId
          ? findAtlasCity(initialCityId, safeCities)
          : pickInitialAtlasCity(safeCities),
      [initialCityId, safeCities],
    );

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationRef = useRef<number | null>(null);
    const rotationRef = useRef<FocusTarget>({ ...INITIAL_ROTATION });
    const focusTargetRef = useRef<FocusTarget | null>(focusForCity(initialCity));
    const pointerRef = useRef({ active: false, moved: false, x: 0, y: 0 });
    const markerHitsRef = useRef<MarkerHit[]>([]);
    const zoomRef = useRef(1);
    const lastTimeRef = useRef(0);
    const coordRef = useRef<Coordinates>({
      lat: radToDeg(INITIAL_ROTATION.pitch),
      lng: normalizeLongitude(-radToDeg(INITIAL_ROTATION.yaw)),
    });
    const autoRotateRef = useRef(true);
    const selectedRef = useRef<AtlasCity>(initialCity);
    const paletteRef = useRef<Palette>(PALETTES[theme]);

    const [selectedId, setSelectedId] = useState(initialCity.id);
    const [autoRotate, setAutoRotate] = useState(true);

    const selected = useMemo(() => {
      const found = safeCities.find((c) => c.id === selectedId);
      return found ?? safeCities[0] ?? ATLAS_FALLBACK_CITY;
    }, [safeCities, selectedId]);

    // Keep refs in sync so the RAF loop reads them without re-subscribing.
    useEffect(() => {
      paletteRef.current = PALETTES[theme];
    }, [theme]);

    useEffect(() => {
      autoRotateRef.current = autoRotate;
      onAutoRotateChange?.(autoRotate);
    }, [autoRotate, onAutoRotateChange]);

    useEffect(() => {
      selectedRef.current = selected;
      onCityChange?.(selected);
    }, [selected, onCityChange]);

    const selectCity = useCallback((city: AtlasCity) => {
      if (!isValidAtlasCity(city)) return;
      setSelectedId(city.id);
      setAutoRotate(false);
      focusTargetRef.current = focusForCity(city);
    }, []);

    const resetView = useCallback(() => {
      rotationRef.current = { ...INITIAL_ROTATION };
      focusTargetRef.current = { ...INITIAL_ROTATION };
      zoomRef.current = 1;
      onZoomChange?.(100);
      setAutoRotate(true);
    }, [onZoomChange]);

    const toggleAutoRotate = useCallback(() => {
      setAutoRotate((prev) => !prev);
    }, []);

    useImperativeHandle(
      ref,
      () => ({ selectCity, resetView, toggleAutoRotate }),
      [selectCity, resetView, toggleAutoRotate],
    );

    // ---------- Canvas sizing ----------
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || typeof window === "undefined") return;

      const resizeCanvas = () => {
        const bounds = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(bounds.width * dpr));
        canvas.height = Math.max(1, Math.round(bounds.height * dpr));
      };

      resizeCanvas();

      let observer: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(resizeCanvas);
        observer.observe(canvas);
      }
      window.addEventListener("resize", resizeCanvas);

      return () => {
        observer?.disconnect();
        window.removeEventListener("resize", resizeCanvas);
      };
    }, []);

    // ---------- Render loop ----------
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || typeof window === "undefined") return;

      const drawPolyline = (
        ctx: CanvasRenderingContext2D,
        points: ProjectedPoint[],
        strokeStyle: string,
        width: number,
        alpha: number,
      ) => {
        let drawing = false;
        ctx.save();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (const point of points) {
          if (point.z <= 0) {
            drawing = false;
            continue;
          }
          if (!drawing) {
            ctx.moveTo(point.x, point.y);
            drawing = true;
          } else {
            ctx.lineTo(point.x, point.y);
          }
        }
        ctx.stroke();
        ctx.restore();
      };

      const drawContinent = (
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        radius: number,
        polygon: ReadonlyArray<readonly [number, number]>,
        yaw: number,
        pitch: number,
      ) => {
        const visiblePoints = polygon
          .map(([lat, lng]) =>
            projectVector(
              rotateVector(latLngToVector(lat, lng), yaw, pitch),
              centerX,
              centerY,
              radius,
            ),
          )
          .filter((point) => point.z > 0);

        if (visiblePoints.length < 3) return;

        ctx.save();
        ctx.beginPath();
        visiblePoints.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      };

      const render = (time: number) => {
        const bounds = canvas.getBoundingClientRect();
        const ctx = canvas.getContext("2d");
        if (!ctx || bounds.width <= 0 || bounds.height <= 0) {
          animationRef.current = window.requestAnimationFrame(render);
          return;
        }

        const dpr = window.devicePixelRatio || 1;
        const width = bounds.width;
        const height = bounds.height;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const delta = lastTimeRef.current
          ? Math.min(time - lastTimeRef.current, 48)
          : 16;
        lastTimeRef.current = time;

        const rotation = rotationRef.current;
        const focusTarget = focusTargetRef.current;
        const dragging = pointerRef.current.active;

        if (focusTarget && !dragging) {
          const yawDelta = normalizeAngle(focusTarget.yaw - rotation.yaw);
          const pitchDelta = focusTarget.pitch - rotation.pitch;
          rotation.yaw = normalizeAngle(rotation.yaw + yawDelta * 0.075);
          rotation.pitch = clamp(
            rotation.pitch + pitchDelta * 0.075,
            -MAX_PITCH,
            MAX_PITCH,
          );
          if (Math.abs(yawDelta) < 0.0025 && Math.abs(pitchDelta) < 0.0025) {
            rotation.yaw = focusTarget.yaw;
            rotation.pitch = focusTarget.pitch;
            focusTargetRef.current = null;
          }
        } else if (autoRotateRef.current && !dragging) {
          rotation.yaw = normalizeAngle(rotation.yaw + delta * 0.00018);
        }

        const centerX = width / 2;
        const centerY = height / 2 + Math.min(height * 0.01, 8);
        const radius = Math.min(width, height) * 0.46 * zoomRef.current;
        const palette = paletteRef.current;

        // Outer halo (theme-aware so it reads on light & dark backgrounds)
        const outerGlow = ctx.createRadialGradient(
          centerX,
          centerY,
          radius * 0.45,
          centerX,
          centerY,
          radius * 1.28,
        );
        outerGlow.addColorStop(0, palette.outerHalo[0]);
        outerGlow.addColorStop(0.58, palette.outerHalo[1]);
        outerGlow.addColorStop(1, palette.outerHalo[2]);
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 1.28, 0, Math.PI * 2);
        ctx.fill();

        // Sphere body — always dark (the focal artefact)
        const sphereGradient = ctx.createRadialGradient(
          centerX - radius * 0.28,
          centerY - radius * 0.32,
          radius * 0.16,
          centerX,
          centerY,
          radius,
        );
        sphereGradient.addColorStop(0, "rgba(41, 41, 41, 0.98)");
        sphereGradient.addColorStop(0.42, "rgba(18, 18, 18, 0.98)");
        sphereGradient.addColorStop(1, "rgba(4, 4, 4, 1)");
        ctx.fillStyle = sphereGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Clip everything else to the sphere
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.clip();

        // Diagonal scanlight wash for depth
        const scanGradient = ctx.createLinearGradient(
          centerX - radius,
          centerY - radius,
          centerX + radius,
          centerY + radius,
        );
        scanGradient.addColorStop(0, "rgba(255, 255, 255, 0.02)");
        scanGradient.addColorStop(0.5, "rgba(255, 255, 255, 0)");
        scanGradient.addColorStop(1, "rgba(255, 255, 255, 0.03)");
        ctx.fillStyle = scanGradient;
        ctx.fillRect(
          centerX - radius,
          centerY - radius,
          radius * 2,
          radius * 2,
        );

        for (const polygon of CONTINENTS) {
          drawContinent(
            ctx,
            centerX,
            centerY,
            radius,
            polygon,
            rotation.yaw,
            rotation.pitch,
          );
        }

        // Meridians
        for (let lng = -150; lng <= 180; lng += 30) {
          const points: ProjectedPoint[] = [];
          for (let lat = -88; lat <= 88; lat += 2) {
            points.push(
              projectVector(
                rotateVector(
                  latLngToVector(lat, lng),
                  rotation.yaw,
                  rotation.pitch,
                ),
                centerX,
                centerY,
                radius,
              ),
            );
          }
          drawPolyline(ctx, points, "rgba(255, 255, 255, 0.16)", 1, 0.72);
        }

        // Parallels
        for (let lat = -60; lat <= 60; lat += 30) {
          const points: ProjectedPoint[] = [];
          for (let lng = -180; lng <= 180; lng += 2) {
            points.push(
              projectVector(
                rotateVector(
                  latLngToVector(lat, lng),
                  rotation.yaw,
                  rotation.pitch,
                ),
                centerX,
                centerY,
                radius,
              ),
            );
          }
          drawPolyline(ctx, points, "rgba(255, 255, 255, 0.14)", 1, 0.68);
        }

        // Surface speckles
        for (let i = 0; i < 120; i += 1) {
          const lat = -86 + ((i * 37) % 172);
          const lng = -180 + ((i * 61) % 360);
          const point = projectVector(
            rotateVector(
              latLngToVector(lat, lng),
              rotation.yaw,
              rotation.pitch,
            ),
            centerX,
            centerY,
            radius,
          );
          if (point.z <= 0) continue;
          ctx.fillStyle = `rgba(255, 255, 255, ${0.03 + point.z * 0.05})`;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 0.7 + point.z * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // City markers — pass 1: glow + dot for every visible city.
        //
        // Labelling rules (kept stricter than the marker dots so dense
        // regions stay legible):
        //   - Only top-N cities by count are *candidates* for a caption.
        //   - The selected city always gets a caption.
        //   - A candidate must sit comfortably inside the sphere
        //     silhouette (`distFromCenter ≤ 0.82 * radius`) so the white
        //     text doesn't bleed onto the page background in light mode.
        //   - Final pass does collision detection in priority order so
        //     overlapping captions are dropped (selected wins; rest by
        //     count descending).
        const labelCullRadius = radius * 0.82;
        markerHitsRef.current = [];
        type Candidate = {
          x: number;
          y: number;
          text: string;
          active: boolean;
          priority: number;
        };
        const labelCandidates: Candidate[] = [];
        const selectedIdLocal = selectedRef.current.id;
        for (const city of safeCities) {
          const point = projectVector(
            rotateVector(
              latLngToVector(city.lat, city.lng),
              rotation.yaw,
              rotation.pitch,
            ),
            centerX,
            centerY,
            radius,
          );
          if (point.z <= 0.05) continue;
          const active = city.id === selectedIdLocal;
          const markerRadius = active ? 5.5 : 3.0;
          const glowRadius = active ? 20 + Math.sin(time * 0.004) * 2.5 : 8;
          ctx.fillStyle = active
            ? "rgba(255, 255, 255, 0.20)"
            : "rgba(255, 255, 255, 0.08)";
          ctx.beginPath();
          ctx.arc(point.x, point.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
          ctx.beginPath();
          ctx.arc(point.x, point.y, markerRadius, 0, Math.PI * 2);
          ctx.fill();
          markerHitsRef.current.push({
            cityId: city.id,
            x: point.x,
            y: point.y,
            radius: Math.max(12, markerRadius + 8),
          });

          if (!active && !labelEligibleIds.has(city.id)) continue;
          const distFromCenter = Math.hypot(
            point.x - centerX,
            point.y - centerY,
          );
          if (!active && distFromCenter > labelCullRadius) continue;
          labelCandidates.push({
            x: point.x + (active ? 10 : 7),
            y: point.y,
            text: `${city.name.toUpperCase()} ${city.count}`,
            active,
            // Selected city wins ties; otherwise more stores → higher priority
            priority: active ? Number.POSITIVE_INFINITY : city.count,
          });
        }

        // Pass 2: render labels in priority order, skip any candidate that
        // would overlap an already-placed label (greedy collision avoidance).
        labelCandidates.sort((a, b) => b.priority - a.priority);
        const drawnRects: Array<{ x: number; y: number; w: number; h: number }> =
          [];
        for (const label of labelCandidates) {
          ctx.save();
          ctx.font = label.active
            ? "500 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            : "500 10px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
          ctx.textBaseline = "middle";
          const metrics = ctx.measureText(label.text);
          const labelHeight = label.active ? 14 : 12;
          const rect = {
            x: label.x - 2,
            y: label.y - labelHeight / 2,
            w: metrics.width + 6,
            h: labelHeight,
          };
          const collides = drawnRects.some(
            (r) =>
              rect.x < r.x + r.w &&
              rect.x + rect.w > r.x &&
              rect.y < r.y + r.h &&
              rect.y + rect.h > r.y,
          );
          if (collides) {
            ctx.restore();
            continue;
          }
          drawnRects.push(rect);
          // Subtle shadow keeps labels legible over occasional bright rim spots
          ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
          ctx.shadowBlur = 4;
          ctx.fillStyle = label.active
            ? "rgba(255, 255, 255, 0.96)"
            : "rgba(255, 255, 255, 0.62)";
          ctx.fillText(label.text, label.x, label.y);
          ctx.restore();
        }

        ctx.restore();

        // Sphere edge halo (theme-aware)
        ctx.save();
        ctx.strokeStyle = palette.rim;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = palette.rimSoft;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 1.05, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        const nextCoords = rotationToCoordinates(rotation);
        const latChanged =
          Math.abs(nextCoords.lat - coordRef.current.lat) >= 0.08;
        const lngChanged =
          Math.abs(nextCoords.lng - coordRef.current.lng) >= 0.08;
        if (latChanged || lngChanged) {
          coordRef.current = nextCoords;
          onCoordinatesChange?.(nextCoords);
        }

        animationRef.current = window.requestAnimationFrame(render);
      };

      animationRef.current = window.requestAnimationFrame(render);

      return () => {
        if (animationRef.current) {
          window.cancelAnimationFrame(animationRef.current);
        }
        animationRef.current = null;
        lastTimeRef.current = 0;
      };
    }, [safeCities, labelEligibleIds, onCoordinatesChange]);

    // ---------- Pointer / wheel handlers ----------
    const handlePointerDown = useCallback(
      (event: PointerEvent<HTMLCanvasElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointerRef.current = {
          active: true,
          moved: false,
          x: event.clientX,
          y: event.clientY,
        };
        focusTargetRef.current = null;
      },
      [],
    );

    const handlePointerMove = useCallback(
      (event: PointerEvent<HTMLCanvasElement>) => {
        if (!pointerRef.current.active) return;
        const deltaX = event.clientX - pointerRef.current.x;
        const deltaY = event.clientY - pointerRef.current.y;
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          pointerRef.current.moved = true;
        }
        rotationRef.current.yaw = normalizeAngle(
          rotationRef.current.yaw + deltaX * 0.0065,
        );
        rotationRef.current.pitch = clamp(
          rotationRef.current.pitch + deltaY * 0.0055,
          -MAX_PITCH,
          MAX_PITCH,
        );
        pointerRef.current.x = event.clientX;
        pointerRef.current.y = event.clientY;
      },
      [],
    );

    const handlePointerUp = useCallback(
      (event: PointerEvent<HTMLCanvasElement>) => {
        const pointerState = pointerRef.current;
        pointerRef.current.active = false;
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // Capture may already be lost (mobile + scroll); harmless.
        }

        if (pointerState.moved) return;

        const bounds = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        const match = markerHitsRef.current.find(
          (hit) => Math.hypot(hit.x - x, hit.y - y) <= hit.radius,
        );
        if (!match) return;
        const city = safeCities.find((item) => item.id === match.cityId);
        if (city) selectCity(city);
      },
      [safeCities, selectCity],
    );

    const handlePointerCancel = useCallback(
      (event: PointerEvent<HTMLCanvasElement>) => {
        pointerRef.current.active = false;
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // No-op
        }
      },
      [],
    );

    const handleWheel = useCallback(
      (event: WheelEvent<HTMLCanvasElement>) => {
        event.preventDefault();
        const nextZoom = clamp(
          zoomRef.current - event.deltaY * 0.0007,
          0.82,
          1.42,
        );
        zoomRef.current = nextZoom;
        onZoomChange?.(Math.round(nextZoom * 100));
      },
      [onZoomChange],
    );

    if (!SELF_TESTS_PASS) {
      return (
        <div className="flex h-full w-full items-center justify-center px-6 py-12 text-center text-black/60 dark:text-white/55">
          <div className="max-w-md border border-black/10 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="font-label text-[11px] uppercase tracking-[0.36em]">
              Atlas unavailable
            </p>
            <p className="mt-4 font-label text-xs uppercase leading-7 tracking-[0.24em]">
              Globe runtime sanity checks failed.
            </p>
          </div>
        </div>
      );
    }

    return (
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        aria-label={`Interactive globe — ${selected.name} selected`}
        role="img"
      />
    );
  },
);

export { formatCoord };
