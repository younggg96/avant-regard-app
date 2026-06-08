import React from "react";
import { View } from "react-native";
import * as SplashScreen from "expo-splash-screen";

import { CrashScreen } from "./CrashScreen";
import {
  CrashInfo,
  clearLiveCrash,
  clearPersistedCrash,
  getLiveCrash,
  persistCrash,
  readPersistedCrash,
  subscribeToCrash,
  toCrashInfo,
} from "./crashStorage";

type AppComponent = React.ComponentType<Record<string, unknown>>;

// App.tsx calls SplashScreen.preventAutoHideAsync() at module load, but the
// matching hideAsync() only runs inside <App>'s settle(). When Bootstrap
// renders <CrashScreen> instead of <App> (a persisted prior crash, a
// module-load failure, or a render-phase crash), <App> never mounts, so the
// native splash would stay on top forever and hide the crash UI — the user
// just sees the frozen logo. Hide it explicitly here whenever we show crash UI.
function hideNativeSplash(): void {
  SplashScreen.hideAsync().catch(() => {
    // Best-effort: splash may already be hidden.
  });
}

// Whether the detailed crash UI (error name + message + JS stack) is drawn on
// screen. Crashes are ALWAYS captured/persisted/logged regardless — this flag
// only controls on-screen DISPLAY:
//   • __DEV__ (dev / local)  → show the full CrashScreen (debugging).
//   • production / TestFlight → hide it: end users never see raw errors; the
//     app degrades gracefully (swallow live errors, don't block relaunch on a
//     prior crash, neutral dark fallback for unrecoverable cases).
// To debug a release/TestFlight build, temporarily flip this to `true`.
const CRASH_SCREEN_ENABLED = __DEV__;

const FALLBACK_STYLE = { flex: 1, backgroundColor: "#0b0b0b" } as const;

type BootstrapProps = {
  /**
   * Result of a `try { require("./App").default } catch (e) { … }` at entry.
   * We accept it explicitly so Bootstrap can show a CrashScreen even when the
   * root App module throws synchronously at import time (the most likely
   * failure mode for the observed TestFlight startup crash).
   */
  appLoad:
    | { ok: true; App: AppComponent }
    | { ok: false; error: CrashInfo };
};

type BootstrapState = {
  phase: "loading" | "showCrash" | "runApp";
  priorCrash: CrashInfo | null;
  // A fatal error captured live (by installCrashGuard) while the app was
  // already running. Shown as a top-priority overlay so the error is visible
  // on-device the instant it happens, even in release/TestFlight.
  liveCrash: CrashInfo | null;
};

class RenderErrorBoundary extends React.Component<
  React.PropsWithChildren<{ onError: (info: CrashInfo) => void }>,
  { error: CrashInfo | null }
> {
  state = { error: null as CrashInfo | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: toCrashInfo(error, "render", true) };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    hideNativeSplash();
    const crash = toCrashInfo(error, "render", true, info?.componentStack ?? null);
    persistCrash(crash);
    // eslint-disable-next-line no-console
    console.error(
      `[CrashGuard][render] ${crash.name}: ${crash.message}\n${crash.stack}`,
    );
    this.props.onError(crash);
  }

  render() {
    if (this.state.error) {
      // In production the raw error screen is hidden; show a neutral dark
      // fallback instead (rendering children again would re-throw in a loop).
      if (!CRASH_SCREEN_ENABLED) {
        return <View style={FALLBACK_STYLE} />;
      }
      return (
        <CrashScreen
          info={this.state.error}
          onDismiss={() => {
            clearPersistedCrash();
            this.setState({ error: null });
          }}
        />
      );
    }
    return <>{this.props.children}</>;
  }
}

export class Bootstrap extends React.Component<BootstrapProps, BootstrapState> {
  state: BootstrapState = {
    phase: "loading",
    priorCrash: null,
    liveCrash: getLiveCrash(),
  };

  private unsubscribeCrash: (() => void) | null = null;

  async componentDidMount() {
    // Subscribe first so an error thrown during the async read below (or any
    // time after) is surfaced on screen immediately.
    this.unsubscribeCrash = subscribeToCrash((info) => {
      if (!this.isMounted_) return;
      hideNativeSplash();
      this.setState({ liveCrash: info });
    });

    const priorCrash = await readPersistedCrash();
    if (!this.isMounted_) return;

    if (!this.props.appLoad.ok) {
      hideNativeSplash();
      this.setState({ phase: "showCrash", priorCrash: this.props.appLoad.error });
      return;
    }

    if (priorCrash) {
      if (CRASH_SCREEN_ENABLED) {
        hideNativeSplash();
        this.setState({ phase: "showCrash", priorCrash });
        return;
      }
      // Production: a previously captured crash must not block the next launch
      // (that was the "stuck on the splash" symptom). It's already persisted/
      // logged; clear it and start the app normally.
      clearPersistedCrash();
    }

    this.setState({ phase: "runApp", priorCrash: null });
  }

  private isMounted_ = true;
  componentWillUnmount() {
    this.isMounted_ = false;
    this.unsubscribeCrash?.();
  }

  private handleDismissLiveCrash = () => {
    clearLiveCrash();
    clearPersistedCrash();
    this.setState({ liveCrash: null });
  };

  private handleDismissPriorCrash = () => {
    clearPersistedCrash();
    this.setState({ phase: "runApp", priorCrash: null });
  };

  private handleRenderError = (_crash: CrashInfo) => {
    // Already persisted by the boundary; nothing else to do here today.
  };

  render() {
    const { phase, priorCrash, liveCrash } = this.state;

    // The root App module failed to load at import — unrecoverable, there is
    // nothing to run. Show the detailed screen in dev, a neutral fallback in
    // production.
    if (!this.props.appLoad.ok) {
      return CRASH_SCREEN_ENABLED ? (
        <CrashScreen info={this.props.appLoad.error} />
      ) : (
        <View style={FALLBACK_STYLE} />
      );
    }

    // A fatal error captured live while running. Only surfaced on screen when
    // enabled; in production it's swallowed (already persisted) and the app
    // keeps running.
    if (liveCrash && CRASH_SCREEN_ENABLED) {
      return (
        <CrashScreen info={liveCrash} onDismiss={this.handleDismissLiveCrash} />
      );
    }

    if (phase === "loading") {
      return <View style={FALLBACK_STYLE} />;
    }

    if (phase === "showCrash" && priorCrash && CRASH_SCREEN_ENABLED) {
      return (
        <CrashScreen info={priorCrash} onDismiss={this.handleDismissPriorCrash} />
      );
    }

    const AppComp = this.props.appLoad.App;
    return (
      <RenderErrorBoundary onError={this.handleRenderError}>
        <AppComp />
      </RenderErrorBoundary>
    );
  }
}
