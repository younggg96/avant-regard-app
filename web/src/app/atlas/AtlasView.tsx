"use client";

/**
 * AtlasView — Avant-Garde Fashion World page.
 *
 * Layout: full-bleed editorial poster.
 *   ┌── eyebrow                     [TITLE]                stats ──┐
 *   │  hints                       [GLOBE]                         │
 *   ├── capitals          viewing (lat/lon)        controls   ─────┤
 *
 * Theme:
 *   - Dark mode: dark immersive canvas (#0a0a0a) — the editorial poster.
 *   - Light mode: plain site canvas (white). Sphere stays dark either
 *     way (the globe is the focal artefact); labels and chrome flip to
 *     black-on-white via Tailwind's `dark:` variants.
 *
 * Data is live: `useAtlasCities()` aggregates `/api/buyer-stores` into
 * one marker per unique city, with a small bundled fallback for the
 * loading window so the globe never paints empty.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

import {
  AtlasGlobe,
  formatCoord,
  type AtlasGlobeHandle,
  type AtlasGlobeTheme,
} from "@/components/atlas/AtlasGlobe";
import {
  pickInitialAtlasCity,
  type AtlasCity,
} from "@/lib/atlas/cities";
import type { Coordinates } from "@/lib/atlas/globeMath";
import { useAtlasCities } from "@/lib/atlas/useAtlasCities";

const CAPITALS_LIMIT = 15;

export function AtlasView() {
  const { t } = useTranslation();

  // Resolve the page theme — drives the globe halo + rim stroke palette.
  // Default to "dark" before mount so dark-mode users don't see a one-frame
  // light halo on first paint (flip is invisible in light mode).
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const globeTheme: AtlasGlobeTheme =
    !mounted || resolvedTheme !== "light" ? "dark" : "light";

  const { cities, isFallback } = useAtlasCities();

  const initialCity = useMemo(() => pickInitialAtlasCity(cities), [cities]);
  const capitals = useMemo(() => cities.slice(0, CAPITALS_LIMIT), [cities]);
  const hasMoreCities = cities.length > CAPITALS_LIMIT;

  const globeRef = useRef<AtlasGlobeHandle | null>(null);
  const [allCitiesOpen, setAllCitiesOpen] = useState(false);
  const modalCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!allCitiesOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [allCitiesOpen]);

  useEffect(() => {
    if (!allCitiesOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAllCitiesOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [allCitiesOpen]);

  const [selected, setSelected] = useState<AtlasCity>(initialCity);
  const [coords, setCoords] = useState<Coordinates>({
    lat: initialCity.lat,
    lng: initialCity.lng,
  });
  const [autoRotate, setAutoRotate] = useState(true);

  const handleSelectCity = useCallback((city: AtlasCity) => {
    globeRef.current?.selectCity(city);
  }, []);

  const handlePickCityFromModal = useCallback(
    (city: AtlasCity) => {
      handleSelectCity(city);
      setAllCitiesOpen(false);
    },
    [handleSelectCity],
  );
  const handleResetView = useCallback(() => {
    globeRef.current?.resetView();
  }, []);
  const handleToggleAutoRotate = useCallback(() => {
    globeRef.current?.toggleAutoRotate();
  }, []);

  const totalStores = useMemo(
    () => cities.reduce((sum, c) => sum + c.count, 0),
    [cities],
  );
  const totalCountries = useMemo(
    () => new Set(cities.map((c) => c.country)).size,
    [cities],
  );

  const exploreHref = `/stores?city=${encodeURIComponent(selected.name)}`;

  return (
    // No explicit background: inherits `var(--canvas)` from <body> (white in
    // light mode, #0a0a0a in dark mode). Only the dark-mode washes and grid
    // pattern are reintroduced via `dark:` so light mode stays plain white.
    <main className="relative isolate overflow-hidden text-black dark:text-white">
      {/* Dark-mode-only editorial backdrops */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.06),transparent_45%)] dark:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:96px_96px] dark:block"
      />

      {/* min-h subtracts the sticky SiteHeader (h-14 = 3.5rem) so the page
          fills the viewport. Footer is not shown on /atlas. */}
      <section className="relative flex min-h-[calc(100vh-3.5rem)] w-full flex-col px-5 py-5 md:px-8 md:py-7 xl:px-12 xl:py-9">
        {/* ===== Top row: eyebrow / title / stats ===== */}
        <header className="relative z-20 grid grid-cols-1 items-start gap-4 md:grid-cols-3">
          <p className="font-label text-[10px] uppercase tracking-[0.4em] text-black/40 dark:text-white/45">
            {t("atlas.eyebrow")}
          </p>

          <h1 className="text-center font-serif text-2xl uppercase leading-[1.05] tracking-[-0.005em] text-black sm:text-3xl md:text-4xl xl:text-[44px] dark:text-white">
            Avant-Garde{" "}
            <span className="italic font-normal">Fashion World</span>
          </h1>

          <div className="text-left md:text-right">
            <p className="font-label text-[10px] uppercase tracking-[0.32em] text-black/40 dark:text-white/45">
              {t("atlas.statsLabel")}
            </p>
            <p className="mt-1 font-serif text-3xl text-black md:text-4xl dark:text-white">
              {totalStores}
            </p>
            <p className="mt-1 font-label text-[10px] uppercase tracking-[0.28em] text-black/40 dark:text-white/45">
              {t("atlas.statsLine", {
                cities: cities.length,
                countries: totalCountries,
              })}
            </p>
          </div>
        </header>

        {/* ===== Middle row: globe + corner overlays ===== */}
        <div className="relative z-10 mt-6 flex-1 md:mt-4">
          <div className="absolute inset-0">
            <AtlasGlobe
              ref={globeRef}
              cities={cities}
              initialCityId={initialCity.id}
              theme={globeTheme}
              onCityChange={setSelected}
              onCoordinatesChange={setCoords}
              onAutoRotateChange={setAutoRotate}
            />
          </div>

          {/* Left middle: hint copy — hidden on small screens to free space */}
          <div className="pointer-events-none absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 space-y-2 font-label text-[10px] uppercase tracking-[0.28em] text-black/55 md:block dark:text-white/55">
            <p>{t("atlas.hintDrag")}</p>
            <p>{t("atlas.hintScroll")}</p>
            <p>{t("atlas.hintMarker")}</p>
          </div>
        </div>

        {/* ===== Bottom row: capitals / viewing / controls ===== */}
        <footer className="relative z-20 mt-6 flex flex-col gap-5 md:mt-4 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end md:gap-8">
          {/* Capitals — wrap to one or two rows depending on width */}
          <div>
            <p className="font-label text-[10px] uppercase tracking-[0.32em] text-black/40 dark:text-white/45">
              {t("atlas.capitalsTitle")}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {capitals.map((city) => {
                const active = city.id === selected.id;
                return (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => handleSelectCity(city)}
                    className={`font-label text-[11px] uppercase tracking-[0.18em] transition-colors ${
                      active
                        ? "text-black dark:text-white"
                        : "text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white"
                    }`}
                  >
                    {city.name}{" "}
                    <span
                      className={
                        active
                          ? "text-black/75 dark:text-white/80"
                          : "text-black/35 dark:text-white/35"
                      }
                    >
                      {city.count}
                    </span>
                  </button>
                );
              })}
            </div>
            {(hasMoreCities || isFallback) && (
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
              {hasMoreCities && (
                <button
                  type="button"
                  onClick={() => setAllCitiesOpen(true)}
                  aria-haspopup="dialog"
                  className="font-label text-[10px] uppercase tracking-[0.28em] text-black/35 underline-offset-4 transition-colors hover:text-black hover:underline dark:text-white/35 dark:hover:text-white"
                >
                  {t("atlas.allCities", { count: cities.length })}
                </button>
              )}
              {isFallback && (
                <span className="font-label text-[10px] uppercase tracking-[0.28em] text-black/30 dark:text-white/30">
                  {hasMoreCities ? "· " : ""}
                  {t("atlas.fallbackNotice")}
                </span>
              )}
            </div>
            )}
          </div>

          {/* Viewing — LAT / LON */}
          <div className="md:text-center">
            <p className="font-label text-[10px] uppercase tracking-[0.32em] text-black/40 dark:text-white/45">
              {t("atlas.viewing")}
            </p>
            <p className="mt-2 font-label text-[12px] uppercase tracking-[0.22em] text-black/85 dark:text-white/85">
              LAT {formatCoord(coords.lat, "+", "-")} / LON{" "}
              {formatCoord(coords.lng, "+", "-")}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={handleToggleAutoRotate}
              className="rounded border border-black/20 px-4 py-2 font-label text-[10px] uppercase tracking-[0.28em] text-black/85 transition hover:border-black hover:bg-black hover:text-white dark:border-white/20 dark:text-white/85 dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
            >
              {autoRotate ? t("atlas.pause") : t("atlas.autoRotate")}
            </button>
            <button
              type="button"
              onClick={handleResetView}
              className="rounded border border-black/20 px-4 py-2 font-label text-[10px] uppercase tracking-[0.28em] text-black/85 transition hover:border-black hover:bg-black hover:text-white dark:border-white/20 dark:text-white/85 dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
            >
              {t("atlas.resetView")}
            </button>
            <Link
              href={exploreHref}
              className="rounded border border-black bg-black px-4 py-2 font-label text-[10px] uppercase tracking-[0.28em] text-white transition hover:bg-black/85 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/85"
            >
              {t("atlas.viewStoresInCity", { city: selected.name })}
            </Link>
          </div>
        </footer>
      </section>

      {/* All cities — portaled to <body> so the dimmer sits above SiteHeader (z-40); main uses isolation: isolate */}
      {allCitiesOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="atlas-all-cities-title"
            className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8"
          >
            <div
              role="presentation"
              className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
              onClick={() => setAllCitiesOpen(false)}
            />
            <div
              className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-black/[0.08] bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#111]"
              style={{ maxHeight: "min(85vh, 640px)" }}
            >
              <div className="shrink-0 flex items-start justify-between gap-4 border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
                <div>
                  <h2
                    id="atlas-all-cities-title"
                    className="font-serif text-lg font-medium text-black dark:text-white"
                  >
                    {t("atlas.allCitiesModalTitle")}
                  </h2>
                  <p className="mt-1 font-label text-[10px] uppercase tracking-[0.28em] text-black/40 dark:text-white/40">
                    {t("atlas.allCitiesModalSubtitle", { count: cities.length })}
                  </p>
                </div>
                <button
                  ref={modalCloseRef}
                  type="button"
                  onClick={() => setAllCitiesOpen(false)}
                  className="shrink-0 rounded border border-black/[0.12] px-3 py-1.5 font-label text-[10px] uppercase tracking-[0.2em] text-black/70 transition hover:border-black hover:bg-black hover:text-white dark:border-white/[0.16] dark:text-white/70 dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
                >
                  {t("atlas.modalClose")}
                </button>
              </div>
              <ul className="max-h-[min(60vh,500px)] overflow-y-auto overscroll-contain px-2 pb-3">
                {cities.map((city) => {
                  const active = city.id === selected.id;
                  return (
                    <li key={city.id}>
                      <button
                        type="button"
                        onClick={() => handlePickCityFromModal(city)}
                        className={`flex w-full items-baseline justify-between gap-3 rounded border-b border-black/[0.05] px-3 py-3 text-left font-label text-[11px] uppercase tracking-[0.16em] transition last:border-b-0 hover:bg-black/[0.04] dark:border-white/[0.06] dark:hover:bg-white/[0.04] ${
                          active
                            ? "text-black dark:text-white"
                            : "text-black/60 dark:text-white/60"
                        }`}
                      >
                        <span className="min-w-0 truncate">{city.name}</span>
                        <span className="shrink-0 text-[10px] normal-case tracking-normal text-black/40 dark:text-white/35">
                          {city.country}
                        </span>
                        <span
                          className={`shrink-0 tabular-nums ${
                            active
                              ? "text-black/75 dark:text-white/75"
                              : "text-black/35 dark:text-white/35"
                          }`}
                        >
                          {city.count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </main>
  );
}
