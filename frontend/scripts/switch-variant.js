#!/usr/bin/env node
/**
 * Switch the iOS / Android build between CN (中国版) and NA (北美版) flavors,
 * then optionally run Metro or rebuild and install the dev client.
 *
 * Why this script exists
 * ----------------------
 * `app.config.js` already reads `APP_VARIANT === "na"` to flip bundle id,
 * scheme, app name and `LSApplicationQueriesSchemes`, and `eas.json` mirrors
 * that via the `production-na` build profile. Locally there are two further
 * frictions:
 *   1. `react-native-dotenv` bakes `.env` into the JS bundle (see
 *      babel.config.js → `module:react-native-dotenv`), so the CN / NA API
 *      URL and WeChat keys can't be swapped via a shell env var — the actual
 *      `.env` file has to change.
 *   2. `expo prebuild` writes a single native folder at `frontend/ios/` whose
 *      Xcode project name depends on `app.config.js → name`. Switching flavors
 *      therefore overwrites the native folder and requires `pod install`.
 *
 * What this script does
 * ---------------------
 *   1. Copies `frontend/.env.<variant>` over `frontend/.env`.
 *   2. Detects the currently materialised native flavor by checking which of
 *      `frontend/ios/AvantRegard.xcworkspace` or `AvantRegardNA.xcworkspace`
 *      exists. If it doesn't match the target variant, runs
 *      `expo prebuild --clean --platform ios` (passing `APP_VARIANT`) and
 *      `pod install` so the binary on the simulator matches the JS bundle.
 *   3. If `action` is `ios`, runs `expo run:ios` with the requested device.
 *      If `action` is `start`, runs `expo start --dev-client -c`.
 *      If `action` is `prebuild`, stops after step 2 (useful before EAS build).
 *
 * Usage
 * -----
 *   node scripts/switch-variant.js cn ios
 *   node scripts/switch-variant.js na start
 *   node scripts/switch-variant.js cn prebuild
 *
 * Conventional wrappers live in package.json: `npm run ios:cn`, `npm run
 * start:na`, etc.
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const FRONTEND_DIR = path.resolve(__dirname, "..");

const VARIANTS = {
  cn: {
    appVariantEnv: "", // empty → IS_NA === false
    iosWorkspace: "AvantRegard.xcworkspace",
    label: "China (中国版)",
  },
  na: {
    appVariantEnv: "na",
    iosWorkspace: "AvantRegardNA.xcworkspace",
    label: "North America (北美版)",
  },
};

const ACTIONS = new Set(["ios", "start", "prebuild", "none"]);

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function usage() {
  console.log(`
Usage:
  node scripts/switch-variant.js <variant> [action] [...extra args]

Variants:  cn | na
Actions:   ios       — run :ios with the dev client (default)
           start     — start Metro with --dev-client -c
           prebuild  — only refresh .env + native project + pods (no run/metro)
           none      — only refresh .env (skip native + run)

Examples:
  node scripts/switch-variant.js cn ios -d "iPhone 17"
  node scripts/switch-variant.js na start
  node scripts/switch-variant.js cn prebuild
`);
}

function copyEnv(variant) {
  const envSrc = path.join(FRONTEND_DIR, `.env.${variant}`);
  const envDst = path.join(FRONTEND_DIR, ".env");

  if (!fs.existsSync(envSrc)) {
    const example = path.join(FRONTEND_DIR, `.env.${variant}.example`);
    const hint = fs.existsSync(example)
      ? `\n  Template exists at frontend/.env.${variant}.example — copy it and fill in real secrets:\n    cp frontend/.env.${variant}.example frontend/.env.${variant}\n  Then re-run this script.`
      : "";
    fail(
      `Missing frontend/.env.${variant} — required to switch to the "${variant}" flavor.${hint}`,
    );
  }

  fs.copyFileSync(envSrc, envDst);
  console.log(`📄 Copied .env.${variant} → .env`);
}

function currentIosFlavor() {
  const iosDir = path.join(FRONTEND_DIR, "ios");
  if (!fs.existsSync(iosDir)) return null;
  for (const [variant, meta] of Object.entries(VARIANTS)) {
    if (fs.existsSync(path.join(iosDir, meta.iosWorkspace))) return variant;
  }
  return null;
}

function run(cmd, args, { env, cwd } = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: cwd || FRONTEND_DIR,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    fail(`Command failed (${cmd} ${args.join(" ")}) — exit code ${result.status}`);
  }
}

function ensureNativeMatchesVariant(variant) {
  const target = VARIANTS[variant];
  const current = currentIosFlavor();

  if (current === variant) {
    console.log(`✅ Native iOS project already matches ${variant} (${target.iosWorkspace})`);
    return;
  }

  if (current) {
    console.log(
      `🔁 Native iOS project is "${current}", target is "${variant}" — running expo prebuild --clean to regenerate.`,
    );
  } else {
    console.log(`🛠️  No native iOS project found — running expo prebuild for ${variant}.`);
  }

  // expo prebuild needs APP_VARIANT in its environment so app.config.js
  // produces the correct bundle id / scheme / name when writing native files.
  run("npx", ["expo", "prebuild", "--clean", "--platform", "ios"], {
    env: { APP_VARIANT: target.appVariantEnv },
  });

  if (process.platform !== "darwin") {
    console.log("⚠️  Skipping `pod install` — only runs on macOS.");
    return;
  }

  run("pod", ["install"], { cwd: path.join(FRONTEND_DIR, "ios") });
}

function runAction(action, variant, extraArgs) {
  const target = VARIANTS[variant];
  const env = { APP_VARIANT: target.appVariantEnv };

  if (action === "ios") {
    run("npx", ["expo", "run:ios", ...extraArgs], { env });
  } else if (action === "start") {
    run("npx", ["expo", "start", "--dev-client", "-c", ...extraArgs], { env });
  } else if (action === "prebuild" || action === "none") {
    console.log(`\n✅ Done. APP_VARIANT=${target.appVariantEnv || "(empty)"} ready for ${target.label}.`);
    console.log(
      `   Next: \`APP_VARIANT=${target.appVariantEnv || ""} npx expo run:ios\` or \`npm run start:${variant}\``,
    );
  }
}

function main() {
  const [variant, actionArg, ...extra] = process.argv.slice(2);

  if (!variant || !VARIANTS[variant]) {
    usage();
    fail(`Unknown variant "${variant ?? ""}". Use "cn" or "na".`);
  }

  const action = actionArg || "ios";
  if (!ACTIONS.has(action)) {
    usage();
    fail(`Unknown action "${action}". Use one of: ${[...ACTIONS].join(", ")}`);
  }

  const target = VARIANTS[variant];
  console.log(`\n🔀 Switching to ${target.label} [APP_VARIANT="${target.appVariantEnv}"]`);

  copyEnv(variant);

  if (action !== "none") {
    ensureNativeMatchesVariant(variant);
  }

  runAction(action, variant, extra);
}

main();
