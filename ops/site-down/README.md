# Site takedown, 2026-09-18

`edventures.pet` and `www.edventures.pet` were taken offline and are now
serving `index.html` in this folder in place of the real site.

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

Either:

```sh
npm run deploy
```

(builds `dist` from the current `main` and deploys it), or push any commit
to `main` — the Cloudflare Pages Git integration builds and redeploys `dist`
automatically (see `.github/workflows/ci.yml`).

Once the real site is redeployed, this `ops/site-down/` folder can stay in
the repo (it deploys nothing on its own) or be deleted.
