# Content drafts — PROMOTED ✅

> ## These drafts have been promoted to `src/content/`.
>
> **`src/content/` is now canonical.** This folder is kept as the working record of how the content was derived, what was verified, and what's still open with Edward. Edit `src/content/`, not here.
>
> Structured data (`services.json`, `addons.json`, `fees.json`, `photos.json`) is schema-validated at build time — a mistyped price fails the build rather than shipping.

---

## Original header


Machine transcriptions of the image assets in `starting-assets/`, produced in **Phase 0.5**.

> ## ⚠️ Do not ship anything from this folder without a human review pass.
>
> These were read off images by a model. Prices and zip codes especially may contain digit errors, and a wrong price on a live site is a real business problem.

## How to use this folder

1. Open each file side by side with its source image.
2. Work through the `## Verification checklist` at the top of the file.
3. Resolve every `<!-- VERIFY: ... -->` comment, deleting each as you go.
4. Have **Edward** read the result — some of this copy is old and he may want to revise it.
5. When a file is clean, move it to `src/content/` (Phase 0.5.5).

Once promoted, **the Markdown is canonical and the images are archival.** Never re-derive content from an image again.

## Status

| File | Source | Verified? |
|---|---|---|
| `about.md` | merged from both bios | ✅ **verified — ready to promote** |
| `pricing.md` | `Price list.jpg` | ☐ **highest risk — check every digit** |
| `services.md` | `Flyer.png` | ☑ jogging resolved — folds into Dog Walks |
| `service-area.md` | `Locations served.jpg` | ☐ **check all 11 zips** |
| `contact.md` | `Contact us.jpg` *(deleted)* | ☐ — **now the only record of that content** |
| `photo-captions.md` | filenames + images | ✅ **all 21 opened and described** |

## Resolved (TJ)

- ✅ **Bio version** — the merged draft is canonical. Both originals archived in `about.md`.
- ✅ **Vet role** — Veterinary Medicine Administration.
- ✅ **Background check** — through Rover.
- ⚠️ **Insurance** — still TBD. The bio deliberately omits any insurance claim rather than hedging it; every remaining claim is verified, so the page ships as written.
- ✅ **"Walk or jog"** — jogging falls under Dog Walks. Not separately priced.
- ✅ **Harry and Hubert** — both animals. Harry is Edward's own cat. Publishable.
- ✅ **Holiday surcharge** — flat `+$15`. The flyer's `$15+` is a typo.
- ✅ **Email** — `edventurespetsitting@gmail.com` is canonical. `Contact us.jpg` carried the typo and has been **deleted** from `starting-assets/`; `contact.md` is now the record. Recoverable from git history at `d300fbd`.
- ✅ **Photo permissions** — Edward has permission for all client pets shown.

## Still open

Everything needing Edward is consolidated in [`../go-back-to-ed.md`](../go-back-to-ed.md).

The one blocking item inside this folder: **alt text in `photo-captions.md` is inferred from filenames, not from looking at the photos.** Someone must open each image before it ships — wrong alt text misleads screen-reader users worse than none.
