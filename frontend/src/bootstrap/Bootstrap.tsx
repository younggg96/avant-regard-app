import React from "react";
import { View } from "react-native";

import { CrashScreen } from "./CrashScreen";
import {
  CrashInfo,
  clearPersistedCrash,
  persistCrash,
  readPersistedCrash,
  toCrashInfo,
} from "./crashStorage";

type AppComponent = React.ComponentType<Record<string, unknown>>;

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
  };

  async componentDidMount() {
    const priorCrash = await readPersistedCrash();
    if (!this.isMounted_) return;

    if (!this.props.appLoad.ok) {
      this.setState({ phase: "showCrash", priorCrash: this.props.appLoad.error });
      return;
    }

    if (priorCrash) {
      this.setState({ phase: "showCrash", priorCrash });
      return;
    }

    this.setState({ phase: "runApp", priorCrash: null });
  }

  private isMounted_ = true;
  componentWillUnmount() {
    this.isMounted_ = false;
  }

  private handleDismissPriorCrash = () => {
    clearPersistedCrash();
    this.setState({ phase: "runApp", priorCrash: null });
  };

  private handleRenderError = (_crash: CrashInfo) => {
    // Already persisted by the boundary; nothing else to do here today.
  };

  render() {
    const { phase, priorCrash } = this.state;

    if (phase === "loading") {
      return <View style={{ flex: 1, backgroundColor: "#0b0b0b" }} />;
    }

    if (phase === "showCrash" && priorCrash) {
      return (
        <CrashScreen info={priorCrash} onDismiss={this.handleDismissPriorCrash} />
      );
    }

    if (!this.props.appLoad.ok) {
      return <CrashScreen info={this.props.appLoad.error} />;
    }

    const AppComp = this.props.appLoad.App;
    return (
      <RenderErrorBoundary onError={this.handleRenderError}>
        <AppComp />
      </RenderErrorBoundary>
    );
  }
}
