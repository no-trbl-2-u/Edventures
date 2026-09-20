# Site takedown, 2026-09-18

`edventures.pet` and `www.edventures.pet` were taken offline and are now
serving `index.html` in this folder in place of the real site.

**Automatic production deployments are turned off** (Cloudflare Pages
project setting `source.config.production_deployments_enabled = false`, set
2026-09-20). This was needed because merging a PR into `main` — even one
that only touched files like this README — triggered Cloudflare's Git
integration to rebuild and redeploy the real site, undoing the takedown.
With this setting off, pushes and merges to `main` no longer auto-deploy;
see "How to bring the real site back" below for how to turn it back on.

## What was done

```sh
npx wrangler pages deploy ops/site-down --project-name edventures --branch main
```

This uploads only the two files in this folder (`index.html`, `logo.png`) as
a new Production deployment on the `main` branch alias, which is what the
custom domains resolve to. Nothing else changed:

- The `edventures` Pages project still exists, with the same custom domains.
- The `BOOKINGS` KV namespace (`wrangler.jsonc`) is untouched.
- The booking API (`functions/api/booking.ts`) is still deployed alongside
  it, since Wrangler bundles `functions/` from the repo root by default —
  it just isn't linked to from the placeholder page.
- DNS is untouched.
- `main` in git still holds the real site's source; this deploy did not
  come from a git push, so git and the live deployment are now out of sync
  on purpose.

## How to bring the real site back

Run:

```sh
npm run deploy
```

This builds `dist` from the current `main` and deploys it directly — it
works regardless of the auto-deploy setting above.

To also restore normal "push to `main` auto-deploys" behavior, re-enable
automatic production deployments:

```sh
curl -X PATCH \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/edventures" \
  --data '{"source":{"type":"github","config":{"production_deployments_enabled":true}}}'
```

(or toggle "Automatic production branch deployments" on in the Cloudflare
dashboard: Pages project → Settings → Builds & deployments). Do this before
or after redeploying `dist` — either order is fine, since nothing pushes to
`main` on its own.

Once the real site is redeployed, this `ops/site-down/` folder can stay in
the repo (it deploys nothing on its own) or be deleted.
