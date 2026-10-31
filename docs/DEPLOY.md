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

**Domain.** Production is `https://readwithlumen.app`, a Workers custom domain (`routes` in
`wrangler.jsonc`; Cloudflare creates the DNS records and certificate on deploy). `www` and the old
`lumen.brgv95.workers.dev` send public pages there with a 301. The API, `/auth`, `/mcp`, `/billing`
and the app itself still answer on the old address, so older extension installs and saved MCP
configs keep working. Extension 2.6.1 moves a stored old address to the new one.

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

## Test account (persistent)
A seeded account that is not purged like demo sandboxes, for building and testing the extension.
```bash
cd apps/web && npx wrangler secret put DEV_LOGIN_KEY     # type any long random string
```
Then open `https://<host>/auth/dev?key=<that string>`. The first visit creates the account with
sample reading; later visits sign in to the same account. Without the secret the route is off.

## Google Search Console
1. Add a **URL prefix** property for `https://<host>/` and choose the **HTML tag** method.
2. Copy only the `content` value and set it: `npx wrangler secret put GOOGLE_SITE_VERIFICATION`.
3. Press Verify (the tag is injected into `/` and every server rendered page), then submit
   `https://<host>/sitemap.xml` under Sitemaps.

## Extension connect
The unpacked build has a fixed id (`ffjconacpmnbadoeegamifkellcddfja`, from the `key` in
`wxt.config.ts`), so the dashboard can talk to it: Integrations shows Installed or Connected and
**Connect this browser's extension** stores a token in it with one click. The extension's
settings page has **Connect with Lumen**, which opens that flow.

## Billing (Stripe)
Freemium: every account gets 7 days of Pro, then the free plan unless they upgrade. Rules live in
`apps/web/src/worker/lib/plan.ts`. Without Stripe secrets the Upgrade page collects early access
interest instead of taking payment.
```bash
npx wrangler secret put STRIPE_SECRET_KEY        # sk_live_… or sk_test_…
npx wrangler secret put STRIPE_PRICE_ID          # the recurring Pro price
npx wrangler secret put STRIPE_WEBHOOK_SECRET    # whsec_… for https://<host>/billing/webhook
```
Webhook events: `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`.
