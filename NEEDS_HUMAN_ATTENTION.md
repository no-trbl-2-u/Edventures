# Needs human attention

Things I could not finish myself, with everything you need to finish them fast.
Ordered by what unblocks the most.

**Legend:** 🔴 blocks a shipped feature · 🟡 degrades something live · 🟢 tidy-up

Anything needing **Edward** rather than you is in [go-back-to-ed.md](go-back-to-ed.md);
this file is the TJ list.

> **Last verified against production: 2026-08-24.** Every claim below was
> re-checked against the live site rather than carried forward. Two had gone
> stale — item 1 was fixed without the file being updated, and most of 7a is
> now answered by evidence. A file like this is only useful if its 🔴 means
> something, so please re-check rather than append when you touch it.
>
> How the checks were made, so they can be repeated:
>
> ```sh
> curl -s https://edventures.pet/api/health   # is the mailer configured?
>
> # Does www still answer instead of redirecting? Prints e.g. `200` and an
> # empty redirect while item 2 is open; `301 https://edventures.pet/` once
> # it is fixed.
> curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://www.edventures.pet/
> ```
>
> Use that second form rather than `curl -sI ... | head -1`. Behind an HTTP
> proxy the first header line is the tunnel's own `200 Connection
> Established`, not the site's — which looks exactly like the failure this
> item describes and would "confirm" it no matter what the origin said.

---

## 🟡 1. Resend key is in production — two follow-ups left

**Updated 2026-08-24. The original 🔴 is resolved.** Somebody set
`RESEND_API_KEY` in Cloudflare and the file was never updated, so this entry
spent a while claiming `/book` was broken when it was not.

Verified without side effects, via the health endpoint added in 2.7.5:

```sh
$ curl -s https://edventures.pet/api/health
{"ok":true,...,"bookingsAcceptable":true,"bookingLogging":true,...}
```

`bookingsAcceptable` is a straight boolean of `env.RESEND_API_KEY`, so a `true`
means the deployed Function has the key. `bookingLogging: true` means the
`BOOKINGS` KV namespace is bound too. **`/book` no longer answers 502.**

> **What this does *not* prove.** The key is *present*; nobody has confirmed
> Resend *accepts* it in production or that mail lands in the inbox. That needs
> a real submission, and a real submission emails Edward and writes a KV
> record — so it is deliberately left to a human rather than done from here.

The key is in the git-ignored `.env` / `.dev.vars` at the repo root — note that
those files exist only on your machine, not in a fresh clone.

### What is left

1. ~~Set `RESEND_API_KEY` in Cloudflare.~~ **Done.**
2. ~~Leave `BOOKING_FROM` unset.~~ **Still the right call** — see the table
   below. `edventures.pet` is not a verified Resend domain, so
   `bookings@edventures.pet` would 403 and *every* booking would 502.
3. ~~Redeploy so the variable applies.~~ **Done** — the running deployment has it.
4. **Submit a real request through `/book`** and check the inbox, **including
   the spam folder**. This is the one that actually closes the item.
5. **Rotate the key** at <https://resend.com/api-keys> — it was pasted into a
   chat transcript. Create a new one, update the Cloudflare secret and `.env`,
   delete the old one. Not Cloudflare-side work; needs the Resend dashboard.

> **Known gap while the domain is unverified:** the shared sender delivers only
> to the account owner, so the **customer's confirmation email is not
> delivered**. That send fails and is swallowed by design — the booking still
> succeeds and the customer still sees the success screen — but they get no
> written receipt. Closing this is Roadmap 3.11 (dedicated sending domain),
> which is wanted but deliberately deferred.
>
> **2026-08-29: this gap now bites `/api/confirm` too, visibly.** Edward
> submitted a test booking (`booking:2026-08-29T11:19:51.087Z:eddie`, customer
> email `edward.m.kyne@gmail.com`) and pressed Confirm; Resend refused the send
> because that address is not the account owner, and the endpoint's 502 was
> replaced by Cloudflare's branded "Host Error" page — origin 502/504 bodies
> always are — so he never saw the "that didn't send, nothing was confirmed"
> page. The masking is fixed (the failure page is a 503 now and renders), but
> **confirming any booking whose customer email is not the Resend account
> owner's will keep failing until the domain is verified** — that is still
> 3.11, and Eddie's test booking is still unconfirmed in KV.

### Environment variables the endpoint reads

| Name | Required | Default | What it does |
|---|---|---|---|
| `RESEND_API_KEY` | **yes** | none — every submission 502s | Authenticates the send |
| `BOOKING_FROM` | strongly | `Edventures <onboarding@resend.dev>` | Envelope sender. The default is Resend's shared test sender and **only delivers to the Resend account owner** — fine for a smoke test, wrong for customers |
| `BOOKING_TO` | no | `SITE.email` (`edventurespetsitting@gmail.com`) | Where Edward's notification goes. Set it if he wants booking mail somewhere else |
| `BOOKINGS` (KV) | no | already bound | Durable log + rate limiting. Namespace `69106e068b034688b47badd5d8f1f880`, bound in `wrangler.jsonc` |

`PUBLIC_BOOKING_ENDPOINT` is a build-time override only. It defaults to
`/api/booking` and you should not need to set it.

### Closing it out

Nothing in the code changes. Confirm the Gmail delivery and **check the spam
folder**, then Roadmap 3.12 by submitting from a real phone. The rest of 3.11
(dedicated sending domain, SPF/DKIM/DMARC) is wanted but deferred by decision —
Gmail delivery is accepted as good enough for now.

---

## 🟡 2. `www.edventures.pet` serves a 200 instead of redirecting

**Re-checked 2026-08-24: still open.** `curl -sI https://www.edventures.pet/`
returns `200`, no `Location`.

Roadmap 2.6.1 says pick apex-or-www once and 301 the other, never serve both.
Right now both serve the site.

**Re-graded 🔴 → 🟡 on 2026-08-24.** Nothing changed about the problem; the
severity was just wrong. This entry said "not urgent" and Roadmap 2.6.1 says
"severity: low, not blocking", which is 🟡 by this file's own legend — a 🔴 that
contradicts its own body teaches people to ignore the 🔴s.

Every page carries a self-referential canonical pointing at the apex, so search
engines consolidate there anyway. But it is the last unticked item in 2.6.1's
technical foundation, and it is a two-minute fix in the UI.

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

**The code half needs no credentials at all.** The verification hook and the
widget can be built now behind a flag that stays inert while the keys are
absent — the endpoint simply skips the check, exactly as it does today. Then
creating the widget is a config change rather than a feature to write. Say the
word and it can land before anyone opens the Cloudflare dashboard.

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

## 🟡 7a. `main` has no branch protection (the rest of this is now verified)

Superseded twice on 2026-08-22: a tag-triggered wrangler deploy was added,
then TJ connected the repo to Cloudflare Pages directly, which builds and
deploys `main` on every push. The tag workflow was removed (two deploy paths
would fight); `.github/workflows/ci.yml` now runs tests, typecheck and a
build on every push and PR instead. **No GitHub secret is needed.**

The first Git-integration builds failed because nothing pinned Node — Astro 7
needs ≥ 22.12 and Cloudflare's builder defaults older. Fixed with
`.node-version` (22) plus an `engines` field.

**Updated 2026-08-24: three of the four checks below are now answered by
evidence**, from watching PR #14 build and deploy end to end:

- ✅ **Build command and output directory are correct.** PR #14 built cleanly
  on Cloudflare and the result reached `https://edventures.pet`. A wrong build
  command or output directory could not have produced that.
- ✅ **The Git integration attached to the existing project, not a new one.**
  The custom domain serves, and `/api/health` reports `bookingLogging: true`,
  which means the `BOOKINGS` KV namespace is bound on whichever project is
  actually deploying. Both would be missing on a fresh project.
- ❓ **Branch protection on `main` is still unverified.** It is a GitHub
  setting, not a Cloudflare one, and cannot be checked from here. Cloudflare
  deploys on push regardless of GitHub checks, so to keep red code off `main`,
  make the `checks` job required: Settings → Branches → protection rule for
  `main`. **This is the only part of 7a still open.**

---

## 🟢 7. Three checks that only work against the live site

Hosted tools that fetch the public URL themselves, so a local build cannot
stand in for them. All three are quick and need no decision — just someone to
actually run them now that the changes are deployed:

- **Paste the live URL into Facebook Messenger and iMessage** and confirm the
  new `/og-home.jpg` and `/og-gallery.jpg` previews render correctly (Roadmap
  2.6.4). Can't be checked from a local build — these previews are fetched by
  Facebook's and Apple's own crawlers against the public URL.
- **Run every page through Google's Rich Results Test** (Roadmap 2.6.3) to
  confirm the `LocalBusiness`, `Service`, `FAQPage` and `BreadcrumbList`
  JSON-LD all validate. Same reason — it's a hosted tool that fetches the live
  page, not something a local build can substitute for.
- **Run the agent-readiness scan** (Roadmap 2.7.6), added 2026-08-24:
  `POST https://isitagentready.com/api/scan` with `{"url":"https://edventures.pet"}`.
  Every document 2.7.5 publishes was verified by hand against production — the
  right status, the right content type, working markdown negotiation, live MCP
  tools, and skill digests matching the bytes served — so this is confirmation
  from the checker's own perspective rather than a hunt for something broken.

---

## 🟡 8. DNS-AID records — needs Cloudflare DNS access

Roadmap 2.7.5 published every agent-discovery document that can live in a
repository. **DNS for AI Discovery** cannot: it is a zone change, and this
repo has no DNS credentials and should not have any.

It is the one discovery path that works before an agent has fetched anything.
Everything else — the `Link` headers, `/.well-known/api-catalog`, the MCP
server card — requires already knowing the domain and making a request.
DNS-AID lets a resolver answer *"does edventures.pet expose agent
endpoints?"* without one.

Draft spec: <https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/>
(SVCB/HTTPS records, RFC 9460).

### What to add

Cloudflare dashboard → **edventures.pet** → DNS → Records → Add record, type
**SVCB**, twice. Cloudflare's UI takes the priority, target and params as
separate fields; in zone-file form the two records are:

```
_index._agents.edventures.pet. 3600 IN SVCB 1 edventures.pet. (
    alpn="h2,http/1.1" port=443
    dohpath="/.well-known/api-catalog" )

_mcp._agents.edventures.pet.   3600 IN SVCB 1 edventures.pet. (
    alpn="h2,http/1.1" port=443
    dohpath="/api/mcp" )
```

- `_index` points at the RFC 9727 catalog, which is the entry point every
  other document hangs off.
- `_mcp` points at the MCP endpoint that `functions/api/mcp.ts` serves. The
  server card describing it is at `/.well-known/mcp/server-card.json`.
- **ServiceMode (priority ≥ 1), not AliasMode.** AliasMode carries no params,
  which is the whole content of these records.
- Check the parameter key the draft settles on for the endpoint path before
  relying on it. `dohpath` above is the general-purpose path parameter
  registered by RFC 9461; if the draft has since registered its own key, use
  that. The record is still worth publishing either way — the alpn and target
  are the parts a resolver acts on.

> **Open question before you start: who is the registrar?** The DS step below
> lands at the registrar, not at Cloudflare. If `edventures.pet` is on
> Cloudflare Registrar both halves are one dashboard; if it is registered
> elsewhere, that half is outside Cloudflare no matter how the API token is
> scoped. This could not be determined from the build container — it has
> neither `dig` nor `whois` — so it is worth two minutes before you begin.

### Then turn on DNSSEC

DNS → Settings → **DNSSEC** → Enable, then add the DS record Cloudflare
shows you **at the registrar** (Roadmap 0.2 — wherever `edventures.pet` was
registered). Without it a validating resolver cannot tell these records from
a forged answer, and unsigned agent-discovery records are worth close to
nothing: the entire value is that a resolver can trust them.

Enabling DNSSEC is safe here — the zone is Cloudflare-hosted and the records
are few — but the DS record must land at the registrar within a day or two of
enabling, or resolution can break. Do both in one sitting.

### How to check it worked

```sh
dig +dnssec _index._agents.edventures.pet SVCB
dig +dnssec _mcp._agents.edventures.pet   SVCB
```

Both should answer with an `SVCB` record and an `RRSIG` beside it, and the
flags should include `ad` when queried through a validating resolver
(`dig @1.1.1.1 ...`).
