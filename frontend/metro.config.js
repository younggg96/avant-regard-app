const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// --- Monorepo support -------------------------------------------------------
// Watch the whole monorepo so that Metro picks up edits in sibling workspaces
// (e.g. shared packages we might add later). The order of `nodeModulesPaths`
// is significant: the frontend workspace must win over any hoisted copy at the
// monorepo root.
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// --- Force singleton instances for hook-sensitive packages ------------------
// npm workspaces hoists the `web` workspace's react@18.3.1 stack (Next.js 14)
// to the monorepo root, while Expo SDK 51 pins react@18.2.0 inside `frontend/`.
// When Metro resolves `require("react")` from a caller that happens to live
// under `{root}/node_modules/...`, hierarchical lookup finds the root copy
// first and Metro bundles BOTH Reacts as distinct modules.
//
// React's renderer mutates `ReactCurrentDispatcher.current` on one React
// instance only; hooks resolved against the other instance read `null` and
// throw `Cannot read property 'useRef' of null` at render time
// (reproduced via zustand's `useSyncExternalStoreWithSelector`).
//
// We rewrite `originModulePath` to the frontend entry for every require whose
// module name matches one of these packages (or any subpath thereof), so Metro
// always performs its hierarchical walk from inside `frontend/` and lands on
// the single frontend-local copy. This covers both bare specifiers
// (`"react"`, `"zustand"`) and subpaths (`"react/jsx-runtime"`,
// `"zustand/middleware"`, `"use-sync-external-store/shim/with-selector"`,
// `"scheduler/tracing"`, etc.), which was the gap in the initial fix.
const SINGLETON_PACKAGES = [
  "react",
  "react-dom",
  "react-native",
  "scheduler",
  "use-sync-external-store",
  "zustand",
];

const isSingletonModule = (moduleName) =>
  SINGLETON_PACKAGES.some(
    (pkg) => moduleName === pkg || moduleName.startsWith(pkg + "/"),
  );

// `frontend/index.js` is the RN entry file and always exists; using it as the
// spoofed origin guarantees Metro's hierarchical walk starts at
// `frontend/node_modules/`. We intentionally do NOT hard-code a file path per
// package — delegating to `context.resolveRequest` keeps Metro's platform
// extensions (`.native.js` / `.ios.js`), `package.json#exports` conditions, and
// Haste integration all intact.
const FRONTEND_ENTRY_PATH = path.join(projectRoot, "index.js");

const previousResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (isSingletonModule(moduleName)) {
    return context.resolveRequest(
      { ...context, originModulePath: FRONTEND_ENTRY_PATH },
      moduleName,
      platform,
    );
  }

  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
