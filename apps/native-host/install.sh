#!/usr/bin/env bash
# Registers the Lumen helper with Chrome (macOS and Linux).
# Usage: ./install.sh <extension-id>   (find the id on chrome://extensions)
set -euo pipefail
EXT_ID="${1:?Pass the Lumen extension id from chrome://extensions}"
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
  TARGET="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
else
  TARGET="$HOME/.config/google-chrome/NativeMessagingHosts"
fi
mkdir -p "$TARGET"
cat > "$TARGET/dev.lumen.host.json" <<JSON
{
  "name": "dev.lumen.host",
  "description": "Lumen helper: runs claude -p for the Lumen extension",
  "path": "$WRAPPER",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
JSON
echo "Installed. Restart Chrome, then pick Claude in Lumen settings and press Test connection."
[[ -z "$CLAUDE" ]] && echo "Note: claude was not found on PATH. Install Claude Code first."
