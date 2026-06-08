import AsyncStorage from "@react-native-async-storage/async-storage";

export const CRASH_STORAGE_KEY = "__last_js_crash__";

export type CrashInfo = {
  name: string;
  message: string;
  stack: string;
  isFatal: boolean;
  at: string;
  origin: "global" | "moduleLoad" | "render";
};

export function toCrashInfo(
  error: unknown,
  origin: CrashInfo["origin"],
  isFatal = true,
  extraStack?: string | null,
): CrashInfo {
  const err = error as { name?: string; message?: string; stack?: string } | undefined;
  return {
    name: String(err?.name ?? "Error"),
    message: String(err?.message ?? error ?? "Unknown error"),
    stack: String(err?.stack ?? extraStack ?? ""),
    isFatal,
    at: new Date().toISOString(),
    origin,
  };
}

export function persistCrash(info: CrashInfo): void {
  AsyncStorage.setItem(CRASH_STORAGE_KEY, JSON.stringify(info)).catch(() => {
    // Intentionally ignore — persistence is best-effort.
  });
}

// ---------------------------------------------------------------------------
// Live crash channel
//
// In release builds installCrashGuard() swallows fatal JS errors to keep the
// process alive, which means the user never sees them until the *next* launch
// (and only if Bootstrap routes to <CrashScreen>). For on-device debugging we
// also want the error drawn on screen the instant it happens. This tiny
// pub/sub lets the non-React crash handler push the error to a React component
// (Bootstrap) so it can overlay <CrashScreen> immediately.
type CrashListener = (info: CrashInfo) => void;

let liveCrash: CrashInfo | null = null;
const crashListeners = new Set<CrashListener>();

/** Persist the crash AND notify any live subscriber so it can render on screen. */
export function reportCrash(info: CrashInfo): void {
  liveCrash = info;
  persistCrash(info);
  crashListeners.forEach((listener) => {
    try {
      listener(info);
    } catch {
      // A listener throwing must never re-enter the crash path.
    }
  });
}

export function getLiveCrash(): CrashInfo | null {
  return liveCrash;
}

export function clearLiveCrash(): void {
  liveCrash = null;
}

export function subscribeToCrash(listener: CrashListener): () => void {
  crashListeners.add(listener);
  return () => {
    crashListeners.delete(listener);
  };
}

export async function readPersistedCrash(): Promise<CrashInfo | null> {
  try {
    const raw = await AsyncStorage.getItem(CRASH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CrashInfo;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPersistedCrash(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CRASH_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
