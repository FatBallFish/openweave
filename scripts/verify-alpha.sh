#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[verify-alpha] ERROR: macOS is required for alpha packaging verification." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[verify-alpha] Packaging macOS alpha artifacts..."
CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:mac

APP_BUNDLE_PATH="$(find "$ROOT_DIR/release/alpha" -maxdepth 3 -type d -name "OpenWeave.app" | head -n 1)"
if [[ -z "${APP_BUNDLE_PATH}" ]]; then
  echo "[verify-alpha] ERROR: packaged app bundle not found under release/alpha." >&2
  exit 1
fi

APP_EXECUTABLE_PATH="$APP_BUNDLE_PATH/Contents/MacOS/OpenWeave"
if [[ ! -x "$APP_EXECUTABLE_PATH" ]]; then
  echo "[verify-alpha] ERROR: packaged executable is missing or not executable: $APP_EXECUTABLE_PATH" >&2
  exit 1
fi

echo "[verify-alpha] Running packaged app smoke E2E..."
OPENWEAVE_PACKAGED_EXECUTABLE="$APP_EXECUTABLE_PATH" npm run test:e2e -- smoke-alpha.spec.ts

echo "[verify-alpha] PASS"
