# Needs human attention

Things I could not finish myself, with everything you need to finish them fast.
Ordered by what unblocks the most.

**Legend:** 🔴 blocks a shipped feature · 🟡 degrades something live · 🟢 tidy-up

Anything needing **Edward** rather than you is in [go-back-to-ed.md](go-back-to-ed.md);
this file is the TJ list.

---

## 🔴 1. Resend API key — the booking form cannot send without it

**Status:** everything around it is built, deployed and verified. `/book` posts
to `/api/booking`, the request is validated, priced and durably logged to KV.
Then the send fails, because there is no key, and the customer lands on the
failure screen with Edward's phone number.

That is deliberate — the endpoint refuses rather than pretending — but it means
**`/book` is not yet a working booking form.** It is currently no worse than
before: same failure screen, except the attempt is now recorded in KV instead of
vanishing.

### What to do

1. Create a Resend account and add `edventures.pet` as a sending domain:
   <https://resend.com/domains>
2. Resend will give you three DNS records to add to the `edventures.pet` zone in
   Cloudflare — an MX and two TXT (SPF and DKIM). **Set them to DNS-only (grey
   cloud), not proxied.** This is Roadmap 3.11, and skipping it is the single
   most likely way this project quietly fails: mail from an unverified domain
   goes to spam.
3. Create an API key at <https://resend.com/api-keys> (sending permission is
   enough).
4. Set it as a Cloudflare Pages secret:

```bash
npx wrangler pages secret put RESEND_API_KEY --project-name edventures
```

5. Set the verified sender:

```bash
npx wrangler pages secret put BOOKING_FROM --project-name edventures
```

   Value: `Edventures <bookings@edventures.pet>`

6. Redeploy (`npm run deploy`) and submit a real request through `/book`.

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

Nothing in the code changes. Then finish Roadmap 3.11 by sending a test to a
Gmail address and **checking the spam folder**, and 3.12 by submitting from a
real phone.

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

Real alerting needs a channel to alert *to*. Cheapest options, in order: a
second Resend send to your own address on failure (no new dependency, but it
fails for exactly the reason the first one did), a Cloudflare Workers Analytics
alert, or a webhook to wherever you actually get notified. **Tell me which and
I will wire it** — I did not pick one for you because they all involve a service
choice that is yours.

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

## 🟢 5. Two open questions that shape real behaviour

Both are Edward's to answer, repeated here because they are load-bearing and
have been open a while. Full context in [go-back-to-ed.md](go-back-to-ed.md).

- **B5 / G4 — which dates carry the +$15 holiday surcharge.** The estimator
  applies it automatically from a hardcoded list in `src/lib/booking.ts`. If
  that list is wrong, customers see a surcharge Edward does not charge, or miss
  one he does.
- **B4 — does he require a meet-and-greet before a first booking?** If yes, the
  form needs a different path for first-time clients. That is a structural
  change, not a copy change, and it gets more expensive the longer it waits.
  Related: the form does not currently collect a first-time-client flag at all,
  so Roadmap 3.9's "prominent first-time-client flag" in Edward's email cannot
  be built until it does.

---

## 🟢 6. The third testimonial slot is a visible placeholder on the live site

The home page currently shows a dashed third card reading *"Testimonial 3 —
ideally one that mentions medication, an anxious pet, or a key handover. A
repeat client is the most persuasive one to place last."*, with a note beneath
saying one slot is open.

That is a deliberate choice, and there is a real argument for it — an obviously
empty slot is more honest than padding. But it is **internal editorial
direction addressed to Edward, rendered to customers**, and a prospective
client reading it learns that the business has two reviews and wants a third.

I did not remove it, because which way that goes is an editorial call rather
than a bug. I did raise its contrast to pass AA (it was at 2.59:1, and WCAG
does not exempt text for being a placeholder), which has made it slightly more
prominent than before — an argument for deciding this sooner rather than later.

Three options, cheapest first: drop the third card and let two quotes sit as
two; keep the slot but replace the copy with something customer-facing
(*"Your pet could be next"*); or get the third quote and close it (D1 in
[go-back-to-ed.md](go-back-to-ed.md)). Tell me which and it is a two-minute
change.

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
