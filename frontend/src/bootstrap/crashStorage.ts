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
