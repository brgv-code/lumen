# Run and deploy

Requires Node 22+ and a Cloudflare account (`npx wrangler login`).

## Local
```bash
npm install
npm run db:migrate:local -w @lumen/web
npm run build -w @lumen/web           # builds the SPA into apps/web/dist
npx wrangler dev --local -c apps/web/wrangler.jsonc   # API + app on http://localhost:8787
# or, for hot reload of the UI: npm run dev:api -w @lumen/web  and  npm run dev -w @lumen/web (port 5173)
npm test                              # core unit tests
npm run typecheck
```
Workers AI always runs remotely, even in local dev.

## Cloudflare
```bash
npx wrangler d1 create lumen-db --location weur      # put the id in apps/web/wrangler.jsonc
npm run db:migrate:remote -w @lumen/web
npm run deploy -w @lumen/web                          # vite build + wrangler deploy
npm run preview -w @lumen/web                         # versions upload: a preview URL, production untouched
```

## SSO
Create the OAuth apps, then set secrets:

| Provider | Where | Redirect URI |
|---|---|---|
| Google | Google Cloud Console → APIs & Services → Credentials → OAuth client (Web) | `https://<host>/auth/google/callback` |
| GitHub | GitHub → Settings → Developer settings → OAuth Apps | `https://<host>/auth/github/callback` |

```bash
cd apps/web
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```
The login page enables each button as soon as its secrets exist. Set `DEMO_ENABLED` to `"false"`
in `wrangler.jsonc` to turn the sandbox off.

## Extension
```bash
npm run build -w @lumen/extension     # → apps/extension/.output/chrome-mv3
```
Load it unpacked from `chrome://extensions`, open its settings, paste a token from
Integrations, and set the Lumen address.

## Claude helper (optional)
```bash
apps/native-host/install.sh <extension-id>
```
Then choose "Claude (local CLI)" in the extension settings and press Test connection.
