#!/usr/bin/env bash
# Registers the Lumen helper with Chrome (macOS and Linux).
# Usage: ./install.sh [extension-id ...]
# With no ids it allows both the unpacked build and the Chrome Web Store build.
set -euo pipefail
DEV_ID="ffjconacpmnbadoeegamifkellcddfja"   # unpacked build (fixed manifest key)
STORE_ID=""                                 # Chrome Web Store build: fill in after the first upload
if [[ $# -gt 0 ]]; then IDS=("$@"); else IDS=("$DEV_ID"); [[ -n "$STORE_ID" ]] && IDS+=("$STORE_ID"); fi
ORIGINS=""
for ID in "${IDS[@]}"; do ORIGINS+="${ORIGINS:+, }\"chrome-extension://$ID/\""; done
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE="$(command -v node)"
CLAUDE="$(command -v claude || true)"
WRAPPER="$DIR/lumen-host.sh"
cat > "$WRAPPER" <<SH
#!/usr/bin/env bash
export PATH="$(dirname "$NODE"):\$PATH"
${CLAUDE:+export LUMEN_CLAUDE_BIN="$CLAUDE"}
exec "$NODE" "$DIR/lumen-host.mjs"
SH
chmod +x "$WRAPPER" "$DIR/lumen-host.mjs"
if [[ "$(uname)" == "Darwin" ]]; then
  BASE="$HOME/Library/Application Support"
  TARGETS=("$BASE/Google/Chrome/NativeMessagingHosts" "$BASE/BraveSoftware/Brave-Browser/NativeMessagingHosts" "$BASE/Arc/User Data/NativeMessagingHosts" "$BASE/Microsoft Edge/NativeMessagingHosts" "$BASE/Chromium/NativeMessagingHosts")
else
  TARGETS=("$HOME/.config/google-chrome/NativeMessagingHosts" "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts" "$HOME/.config/chromium/NativeMessagingHosts" "$HOME/.config/microsoft-edge/NativeMessagingHosts")
fi
for TARGET in "${TARGETS[@]}"; do
  [[ -d "$(dirname "$TARGET")" ]] || continue
  mkdir -p "$TARGET"
  cat > "$TARGET/dev.lumen.host.json" <<JSON
{
  "name": "dev.lumen.host",
  "description": "Lumen helper: runs claude -p for the Lumen extension",
  "path": "$WRAPPER",
  "type": "stdio",
  "allowed_origins": [$ORIGINS]
}
JSON
  echo "Registered for: $TARGET"
done
echo "Installed. Restart the browser, then pick Claude in Lumen settings and press Test connection."
[[ -z "$CLAUDE" ]] && echo "Note: claude was not found on PATH. Install Claude Code first."
