import { persistCrash, toCrashInfo } from "./crashStorage";

type GlobalErrorUtils = {
  getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

/**
 * Installs a global JS error handler that persists the error to AsyncStorage
 * and logs it to the native console (so Console.app / Xcode can capture it),
 * without ever calling React Native's default fatal handler in release builds.
 *
 * Rationale: in production RN, unhandled JS errors route through
 * `ExceptionsManager.reportFatalException` → `RCTFatal` → ObjC throw → abort(),
 * which produces a `.ips` crash report that does NOT contain the JS error
 * reason. By owning the handler, we prevent the abort and surface the reason
 * on-screen instead (via the Bootstrap component).
 */
export function installCrashGuard(): void {
  const g = globalThis as unknown as { ErrorUtils?: GlobalErrorUtils };
  const errorUtils = g.ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;

  const previous = errorUtils.getGlobalHandler?.();

  errorUtils.setGlobalHandler((error, isFatal) => {
    const info = toCrashInfo(error, "global", !!isFatal);

    // Surface loudly via native console so device logs (Console.app, sysdiagnose)
    // capture the exact JS reason for future forensics.
    // eslint-disable-next-line no-console
    console.error(
      `[CrashGuard][${info.origin}] ${info.name}: ${info.message}\n${info.stack}`,
    );

    persistCrash(info);

    // Only forward to the default (fatal) handler in __DEV__ so we still get
    // the red-box dev overlay. In release, swallow to keep the process alive
    // and let <Bootstrap /> render <CrashScreen /> with the stored info.
    if (__DEV__ && previous) {
      previous(error, isFatal);
    }
  });
}
