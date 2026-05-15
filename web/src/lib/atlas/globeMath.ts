/**
 * Pure math + projection helpers for the Avant-Garde Fashion Atlas globe.
 *
 * Everything here is deterministic, side-effect-free, and SSR-safe — it
 * never touches `window`, `document`, or `canvas`. That makes the file
 * trivially testable and lets the Globe component be tree-shaken safely
 * during SSR.
 */

import type { AtlasCity } from "./cities";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  /** Camera-space z; positive = facing the viewer (visible hemisphere). */
  z: number;
}

export interface FocusTarget {
  yaw: number;
  pitch: number;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

/** Pitch is clamped to roughly ±66° to avoid pole singularities. */
export const MAX_PITCH = 1.15;

/** Globe initial orientation — slight tilt towards the viewer. */
export const INITIAL_ROTATION: Readonly<FocusTarget> = {
  yaw: -0.45,
  pitch: 0.12,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

/** Wrap longitude into the canonical (-180, 180] interval. */
export function normalizeLongitude(value: number): number {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

/** Wrap any angle into (-π, π] — used to take the *short* path between yaws. */
export function normalizeAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

/** Convert a (lat, lng) pair on the unit sphere to a 3-D direction vector. */
export function latLngToVector(lat: number, lng: number): Vec3 {
  const safeLat = clamp(lat, -90, 90);
  const safeLng = normalizeLongitude(lng);
  const latRad = degToRad(safeLat);
  const lngRad = degToRad(safeLng);
  const cosLat = Math.cos(latRad);
  return {
    x: cosLat * Math.sin(lngRad),
    y: Math.sin(latRad),
    z: cosLat * Math.cos(lngRad),
  };
}

/** Apply yaw (around Y) then pitch (around X) to a direction vector. */
export function rotateVector(vector: Vec3, yaw: number, pitch: number): Vec3 {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const yawX = vector.x * cosYaw + vector.z * sinYaw;
  const yawZ = -vector.x * sinYaw + vector.z * cosYaw;
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  return {
    x: yawX,
    y: vector.y * cosPitch - yawZ * sinPitch,
    z: vector.y * sinPitch + yawZ * cosPitch,
  };
}

/** Project a unit vector to a circle of `radius` around (centerX, centerY). */
export function projectVector(
  vector: Vec3,
  centerX: number,
  centerY: number,
  radius: number,
): ProjectedPoint {
  return {
    x: centerX + vector.x * radius,
    y: centerY - vector.y * radius,
    z: vector.z,
  };
}

/** Compute the yaw/pitch that puts a city at the screen center. */
export function focusForCity(city: AtlasCity): FocusTarget {
  return {
    yaw: -degToRad(city.lng),
    pitch: clamp(degToRad(city.lat), -MAX_PITCH, MAX_PITCH),
  };
}

/** Convert the live yaw/pitch back to lat/lng for the LAT/LON readout. */
export function rotationToCoordinates(rotation: FocusTarget): Coordinates {
  return {
    lat: clamp(radToDeg(rotation.pitch), -90, 90),
    lng: normalizeLongitude(-radToDeg(rotation.yaw)),
  };
}

export function formatCoord(
  value: number,
  positive: string,
  negative: string,
): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const sign = safeValue >= 0 ? positive : negative;
  return `${sign}${Math.abs(safeValue).toFixed(2)}°`;
}

/**
 * Continent silhouette polygons (lat, lng pairs). Deliberately simplified —
 * we only want a hint of land masses behind the grid, not a Mercator atlas.
 */
export const CONTINENTS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[72, -168], [70, -142], [62, -118], [56, -98], [50, -76], [44, -62], [31, -81], [20, -98], [22, -112], [33, -126], [49, -141], [60, -158]],
  [[15, -83], [11, -72], [2, -68], [-10, -73], [-22, -66], [-38, -60], [-54, -69], [-35, -78], [-9, -80]],
  [[72, -10], [70, 28], [63, 54], [58, 92], [63, 128], [52, 154], [38, 142], [24, 119], [8, 104], [11, 78], [24, 61], [35, 42], [42, 18], [54, 8]],
  [[37, -17], [35, 10], [27, 29], [12, 45], [-7, 42], [-18, 31], [-35, 19], [-34, 4], [-17, -12], [5, -16], [21, -17]],
  [[-11, 112], [-20, 139], [-32, 153], [-43, 145], [-36, 116], [-23, 113]],
  [[83, -52], [77, -28], [63, -42], [59, -60], [71, -72]],
  [[66, -24], [63, -13], [54, -8], [50, -16], [58, -25]],
];

/** Tiny self-tests run once at module load to guard against bad refactors. */
export function runGlobeMathSelfTests(): boolean {
  // Longitude wrap-around
  if (normalizeLongitude(190) !== -170) return false;
  if (normalizeLongitude(-190) !== 170) return false;
  if (normalizeLongitude(0) !== 0) return false;

  // (lat=0, lng=0) projects straight through +Z (towards camera)
  const center = latLngToVector(0, 0);
  if (Math.abs(center.x) > 1e-6) return false;
  if (Math.abs(center.y) > 1e-6) return false;
  if (Math.abs(center.z - 1) > 1e-6) return false;

  // Rotating the camera by π around yaw should put (lat=0, lng=0) on -Z
  const rotated = rotateVector(center, Math.PI, 0);
  if (rotated.z > 0) return false;

  // Projection sanity: (0,0,1) → (cx, cy)
  const proj = projectVector({ x: 0, y: 0, z: 1 }, 100, 50, 30);
  if (proj.x !== 100 || proj.y !== 50 || proj.z !== 1) return false;

  // Clamp and angle wrap basics
  if (clamp(5, 0, 3) !== 3) return false;
  if (clamp(-1, 0, 3) !== 0) return false;
  if (Math.abs(normalizeAngle(Math.PI * 3) - Math.PI) > 1e-6) return false;

  return true;
}
