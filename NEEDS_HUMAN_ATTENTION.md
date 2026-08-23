# Needs human attention

Things I could not finish myself, with everything you need to finish them fast.
Ordered by what unblocks the most.

**Legend:** 🔴 blocks a shipped feature · 🟡 degrades something live · 🟢 tidy-up

Anything needing **Edward** rather than you is in [go-back-to-ed.md](go-back-to-ed.md);
this file is the TJ list.

---

## 🔴 1. Resend key — created and proven; production still needs it

**Status, 2026-08-23:** the Resend account exists, the API key works, and the
whole pipeline was verified end to end — a real booking posted to the real
endpoint returned 200 and **both emails sent** (Edward's notification and the
customer copy), with the key supplied locally via `.dev.vars`.

**But the live site still cannot send.** The deployed Function reads its
environment from Cloudflare, and the key is not there yet. Until it is, `/book`
answers 502 and the customer lands on the failure screen with Edward's phone
number — deliberate, but it means **`/book` is not yet a working booking form
in production.**

The key is in the git-ignored `.env` / `.dev.vars` at the repo root.

### What to do

1. Cloudflare dashboard → Workers & Pages → **edventures** → Settings →
   **Variables and Secrets** → Production → add `RESEND_API_KEY`, type
   **Secret**, value from `.env`. (Or `npx wrangler pages secret put
   RESEND_API_KEY --project-name edventures` if you are logged in.)
2. **Do not set `BOOKING_FROM`.** `edventures.pet` is not a verified Resend
   domain yet, so `bookings@edventures.pet` returns 403 and *every* booking
   would 502. Leaving it unset falls back to Resend's shared sender, which
   reaches the Resend account owner — `edventurespetsitting@gmail.com` — so
   Edward's notification arrives.
3. Redeploy: Deployments → latest → **Retry deployment**. Environment variables
   only apply to new builds, so the running deployment will not pick it up.
4. Submit a real request through `/book` and check the inbox, **including the
   spam folder**.
5. **Rotate the key** at <https://resend.com/api-keys> once this works — it was
   pasted into a chat transcript. Create a new one, update the Cloudflare
   secret and `.env`, delete the old one.

> **Known gap while the domain is unverified:** the shared sender delivers only
> to the account owner, so the **customer's confirmation email is not
> delivered**. That send fails and is swallowed by design — the booking still
> succeeds and the customer still sees the success screen — but they get no
> written receipt. Closing this is Roadmap 3.11 (dedicated sending domain),
> which is wanted but deliberately deferred.

### Environment variables the endpoint reads

| Name | Required | Default | What it does |
|---|---|---|---|
| `RESEND_API_KEY` | **yes** | none — every submission 502s | Authenticates the send |
| `BOOKING_FROM` | strongly | `Edventures <onboarding@resend.dev>` | Envelope sender. The default is Resend's shared test sender and **only delivers to the Resend account owner** — fine for a smoke test, wrong for customers |
| `BOOKING_TO` | no | `SITE.email` (`edventurespetsitting@gmail.com`) | Where Edward's notification goes. Set it if he wants booking mail somewhere else |
| `BOOKINGS` (KV) | no | already bound | Durable log + rate limiting. Namespace `69106e068b034688b47badd5d8f1f880`, bound in `wrangler.jsonc` |

`PUBLIC_BOOKING_ENDPOINT` is a build-time override only. It defaults to
`/api/booking` and you should not need to set it.

### Once the key is in

Nothing in the code changes. Confirm the Gmail delivery and **check the spam
folder**, then Roadmap 3.12 by submitting from a real phone. The rest of 3.11
(dedicated sending domain, SPF/DKIM/DMARC) is wanted but deferred by decision —
Gmail delivery is accepted as good enough for now.

---

## 🔴 2. `www.edventures.pet` serves a 200 instead of redirecting

Roadmap 2.6.1 says pick apex-or-www once and 301 the other, never serve both.
Right now both serve the site.

**Not urgent.** Every page carries a self-referential canonical pointing at the
apex, so search engines consolidate there anyway. But it is the last unticked
item in 2.6.1's technical foundation, and it is a two-minute fix in the UI.

**Why I could not do it:** the `CLOUDFLARE_API_TOKEN` in `.env` can *read*
rulesets but not write them. Creating the rule returns
`request is not authorized`. Confirmed independently by the previous agent.

### Fastest fix — dashboard

Rules → Redirect Rules → Create rule, on the `edventures.pet` zone:

- **If:** Hostname equals `www.edventures.pet`
- **Then:** Dynamic redirect to `concat("https://edventures.pet", http.request.uri.path)`
- **Status:** 301, preserve query string

### Or, grant the token and re-run

Add **Zone → Config Rules → Edit** (or Dynamic Redirect edit) to the token at
<https://dash.cloudflare.com/3d3243067c7831c5e8acf512352c6f05/api-tokens>, then:

```bash
curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/db978e899725e7dbba7a64a906376866/rulesets/phases/http_request_dynamic_redirect/entrypoint" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" -d '{"name":"www to apex","kind":"zone","phase":"http_request_dynamic_redirect","rules":[{"action":"redirect","expression":"(http.host eq \"www.edventures.pet\")","description":"Roadmap 2.6.1 - serve one URL shape","action_parameters":{"from_value":{"status_code":301,"target_url":{"expression":"concat(\"https://edventures.pet\", http.request.uri.path)"},"preserve_query_string":true}}}]}'
```

Do **not** "fix" this by deleting the `www` custom domain from the Pages
project. That makes `www` fail to resolve, which is worse than a duplicate.
And do not try `public/_redirects` — Pages matches that file on the path only,
so a hostname source silently never matches. That is the trap the previous
agent already fell into and removed.

---

## 🟡 3. No alerting when a booking email fails

Roadmap 3.10 asks for an alert to you when a send fails. The endpoint currently
logs to `console.error`, visible only if someone is watching:

```bash
npx wrangler pages deployment tail --project-name edventures
```

Every submission is durably logged to KV first, so **nothing is lost** — a
failed booking is recoverable:

```bash
npx wrangler kv key list --namespace-id 69106e068b034688b47badd5d8f1f880 --remote
```

**Decided 2026-08-22: skip for now.** The KV log is the safety net until real
traffic arrives. Revisit once bookings are flowing — the cheapest options
remain a second Resend send to your own address on failure, a Cloudflare
Workers Analytics alert, or a webhook to wherever you actually get notified.

---

## 🟡 4. Turnstile is still unbuilt (Roadmap 3.8)

The honeypot and the minimum-time-to-submit check are live and enforced
server-side. Turnstile was blocked on 3.7 and is now unblocked, but it needs a
widget created under your Cloudflare account to get a site key and secret key.

Doable via the dashboard in a minute: <https://dash.cloudflare.com/?to=/:account/turnstile>.
Add the domain `edventures.pet`, then:

```bash
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name edventures
```

Give me the **site key** (it is public, safe to paste) and I will wire both
sides. The server-side verification hook is a small addition to
`booking-handler.ts`; nothing needs restructuring.

---

## ✅ 5. Two open questions that shaped real behaviour — ANSWERED 2026-08-22

- **B5 / G4 — holiday surcharge dates:** the standard list **plus Easter**,
  now applied through early 2028 in `src/lib/booking.ts`.
- **B4 — meet-and-greet:** **offered, not required.** The form's final step
  collects a first-time-client checkbox, Edward's email leads with a
  `FIRST-TIME CLIENT` flag, and the contact FAQ answers it for real.
  Still Edward's to confirm: how long it takes and whether it's free — the
  site deliberately claims neither yet.

---

## ✅ 6. The third testimonial slot — DECIDED 2026-08-22

The internal-note placeholder is gone; the third card now carries
customer-facing copy (*"Your pet could be next…"*). Swap in the real third
quote when it lands (D1 in [go-back-to-ed.md](go-back-to-ed.md)).

---

## 🟡 7a. Deploys now ride the Cloudflare Pages Git integration

Superseded twice on 2026-08-22: a tag-triggered wrangler deploy was added,
then TJ connected the repo to Cloudflare Pages directly, which builds and
deploys `main` on every push. The tag workflow was removed (two deploy paths
would fight); `.github/workflows/ci.yml` now runs tests, typecheck and a
build on every push and PR instead. **No GitHub secret is needed.**

The first Git-integration builds failed because nothing pinned Node — Astro 7
needs ≥ 22.12 and Cloudflare's builder defaults older. Fixed with
`.node-version` (22) plus an `engines` field. Worth verifying in the Pages
project settings (Settings → Builds & deployments) that:

- **Build command** is `npm run build` (or `npx astro build`) — NOT
  `npm run deploy`, which runs wrangler inside the build and fails.
- **Build output directory** is `dist` (also declared in `wrangler.jsonc`).
- If the Git integration created a **new** Pages project rather than
  attaching to the existing `edventures` one, the custom domains, the
  `BOOKINGS` KV binding and (once created) the `RESEND_API_KEY` /
  `BOOKING_FROM` secrets live on the old project and must be moved.
- Cloudflare deploys on push regardless of GitHub checks. To keep red code
  off `main`, make the `checks` job required: Settings → Branches →
  protection rule for `main`.

---

## 🟢 7. Two SEO checks that only work against the live site

Left over from the PR that added per-page OG images and `/llms-full.txt`
(Roadmap 2.6.3/2.6.4). Both are quick, need no decision, and just need
someone to actually do them once the change is deployed:

- **Paste the live URL into Facebook Messenger and iMessage** and confirm the
  new `/og-home.jpg` and `/og-gallery.jpg` previews render correctly (Roadmap
  2.6.4). Can't be checked from a local build — these previews are fetched by
  Facebook's and Apple's own crawlers against the public URL.
- **Run every page through Google's Rich Results Test** (Roadmap 2.6.3) to
  confirm the `LocalBusiness`, `Service`, `FAQPage` and `BreadcrumbList`
  JSON-LD all validate. Same reason — it's a hosted tool that fetches the live
  page, not something a local build can substitute for.
