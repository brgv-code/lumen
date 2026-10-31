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

## Analytics (PostHog, EU)
1. Create a project at https://eu.posthog.com and copy its **project API key** (`phc_...`, public).
2. `npx wrangler secret put POSTHOG_KEY` (optional `POSTHOG_HOST`, default `https://eu.i.posthog.com`).
   No redeploy needed.

What is sent:
- **Server events** (`lib/analytics.ts`), keyed by account id, never email or content:
  `user_signed_up` (with `trial` and `trial_note`), `user_logged_in`, `demo_started`, `ai_answer`
  (feature, model, small_model, source), `ai_limit_hit`, `agent_call` (tool, client), every
  successful write in `eventFor()` (item_saved, highlight_created, collection_created,
  destination_added, blog_followed, share_created, token_created, checkout_started, ...) with
  `source` web, extension or agent, and revenue from the Stripe webhook (`subscription_started`,
  `payment_received` with `revenue` and `currency`, `subscription_cancelled`).
- **Web app** (`client/lib/analytics.ts`), only after the visitor allows it in the banner or in
  Settings: pageviews, page leave (time on page), autocapture and session replay. The app shell has
  `ph-mask`, so library text is masked in replays; all inputs are masked. Before consent the
  library is not even downloaded. The extension has no analytics code.

Owner page: `/app/owner` for emails in the `OWNER_EMAILS` var (signups, activation, AI per day,
trial decisions).

## Abuse guards
- One trial per person (`lib/abuse.ts`): no trial without a verified email, for disposable
  domains, GitHub accounts younger than 30 days, an email (canonical: no dots or +tags for Gmail)
  that had a trial before (kept after account deletion), a device cookie `lumen_did` that had one
  in 90 days, or a network with 2 trials in 30 days. Those accounts start on Free.
- At most 5 new accounts per network per 24 hours (`/login?error=signup_limit`).
- Hosted AI: 15 a day free, 100 on trial, 500 paid, 30 in the demo. Past `AI_SOFT_CAP` answers
  a day across everyone (default 60) answers use the small model, so the free Workers AI
  allowance lasts the day.

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
