# Edventures Pet Sitting — Website Roadmap

**Business:** Edventures Pet Sitting — Edward, Philadelphia
**Services:** Dog walks, cat visits, medication administration, nail trims, overnight stays
**Service area:** 19102, 19104, 19106, 19107, 19123, 19130, 19143, 19145, 19146, 19147, 19148
**Contact:** Text 610-888-4541 · edventurespetsitting@gmail.com · IG/FB @edventurespetsitting

> **Canonical email is `edventurespetsitting@gmail.com`.**
> `starting-assets/Contact us.jpg` carried a typo (`edventurespe**titting**`) and has been **deleted**; [content-draft/contact.md](content-draft/contact.md) is now the record for that content. Recoverable from git history at `d300fbd`. Copies already posted to social or printed still need tracking down — see F1 in [go-back-to-ed.md](go-back-to-ed.md).

> **Photo permissions: cleared.** Edward has permission for all client pets shown in `starting-assets/`.

---

## Guiding decisions

These are settled. Everything below follows from them.

| Decision | Choice |
|---|---|
| Booking, v1 | **Request → Edward confirms.** No real-time availability. |
| Booking, later | Third-party tool (Calendly / Square / Time To Pet) |
| Booking, much later | Real-time self-serve + online payment |
| Payments | Not online. Price list is published; Edward collects directly. |
| Maintenance | TJ maintains. Near-zero monthly cost. |
| CMS | Not now. Eventually something *rudimentary* — no Sitecore/AEM class tooling. |

**The load-bearing principle:** the booking form is the only part with a real data model. Design it once, well, so Phases 4 and 6 are swaps — not rewrites.

---

## Recommended stack

| Layer | Choice | Why | Cost |
|---|---|---|---|
| Framework | **Astro** | Ships static HTML by default — fast, free to host. Components kill the copy-pasted nav/footer. Content Collections give a near-free CMS path in Phase 5. | $0 |
| Styling | Tailwind CSS | Brand is already defined (deep green, cream, brown). Tokenize once. | $0 |
| Hosting | Cloudflare Pages or Vercel | Free tier, git-push deploys, automatic HTTPS. | $0 |
| Form backend | One serverless function on the same host | Needed to send the booking email. Avoids a third-party form service. | $0 |
| Transactional email | Resend or Postmark | Reliable delivery of booking requests to Edward's inbox. Free tier covers this volume. | $0 |
| Domain | e.g. `edventurespetsitting.com` | The one real expense. | ~$12/yr |
| Analytics | Cloudflare Web Analytics or Plausible | Cookie-free — no consent banner needed. | $0 |

**Simpler alternative:** hand-written HTML/CSS, no build step. Viable for ~6 pages, but you'll regret it at Phase 5. Astro's learning curve is about an afternoon.

### Why Astro and not Next.js

TJ is a React developer, so this deserves a real answer rather than a preference.

**On SEO — SSR does not help here, and would marginally hurt.** The belief that SSR aids SEO comes from the era when the alternative was a client-rendered SPA shipping an empty `<div id="root">`. Astro is not that: it renders to **static HTML at build time and ships zero JavaScript by default**. Static output is the ceiling SSR is trying to reach, not a step below it.

| | Astro (static) | Next (SSR) |
|---|---|---|
| Crawler receives | Final HTML from the CDN edge | Final HTML from a server render |
| TTFB | ~10–30ms | ~100–300ms (cold start + render) |
| JS shipped | 0 KB | ~90 KB framework baseline |
| Breaks if the server hiccups | No server exists | Yes |

SSR earns its keep when HTML must differ per request — logged-in dashboards, personalized feeds, live inventory. Every page here is identical for every visitor. (Next *can* static-export, but then it's Astro with a larger dependency tree and a hydration payload.)

**The blunter point:** framework choice is close to irrelevant to the actual ranking problem. Edventures competes for "dog walker near me" in ~11 zip codes. That is decided by **Google Business Profile, review count and recency, NAP consistency, and local structured data** — not rendering strategy. See the post-launch checklist; GBP outranks everything else on this page.

**On maintenance — this is the stronger argument.** TJ maintains this indefinitely, for free, on a site that will rarely change. What matters is *churn*, not developer experience. Astro's static output means **nothing runs in production**: no server to patch, no Node version to keep current, no cold starts. Next has been through several substantial architectural migrations; none are hard, but you'd be absorbing them at 11pm on a site that hasn't changed since launch.

**React skills transfer directly.** Astro supports React components as first-class islands:

```
npx astro add react
```

`<BookingForm client:load />` is then a real React component with hooks and state, while the rest of the site stays zero-JS. That is exactly the right shape for Phase 3 — the multi-step form is the *one* place interactivity is warranted.

- [ ] Add `@astrojs/react` at the start of Phase 3, not before — the static pages don't need it

---

# Phase 0 — Setup & asset preparation

*Goal: repo, domain, and a clean asset pipeline. No markup yet.*

### 0.1 — Repository & hosting

- [x] Initialize the project structure on the `claude/dog-walking-website-roadmap` branch
- [x] Create `.gitignore` — covers `.env`, `.dev.vars`, `node_modules`, `dist`, `.astro`, `.wrangler`
- [x] Scaffold Astro 7 (built by hand — `npm create astro` requires an empty directory and would have clobbered `README.md` and `starting-assets/`)
- [x] Add Tailwind 4 via `@tailwindcss/vite`; brand tokens live in `src/styles/global.css` `@theme`
- [x] Verify `npm run build` passes and brand tokens compile to utilities
- [x] Verify `npm run dev` serves 200 at localhost
- [ ] Create the hosting account (Cloudflare Pages — better free tier, no bandwidth caps)
- [ ] Connect the repo for auto-deploy on push to main
- [ ] Confirm the first deploy succeeds on the host's temporary URL

> **Local gotcha — nested worktrees.** The git worktrees live at `.claude/worktrees/…`, *inside* the main repo. Once `tsconfig.json` exists on `main`, a build inside a worktree walks up, finds the parent's `tsconfig.json`, and fails with `Tsconfig not found astro/tsconfigs/strict` if the parent has no `node_modules`. Fix: run `npm install` at the repo root too. A clean CI/Cloudflare checkout is unaffected.

> **Deploy subtasks deferred.** They depend on 0.2 (the domain isn't purchased yet) and creating a Pages project publishes a public URL — worth a deliberate go-ahead rather than a side effect. Credentials are in `.env` in the primary worktree and confirmed git-ignored.

### 0.2 — Domain

- [ ] Check availability of `edventurespetsitting.com` (matches the IG/FB handle — strongly prefer this)
- [ ] Fallbacks if taken: `edventurespetsitting.net`, `edventurespets.com`, `edventuresphilly.com`
- [ ] Purchase (Cloudflare Registrar sells at cost — no markup, no renewal games)
- [ ] Point DNS at the host
- [ ] Verify HTTPS resolves and `www` redirects to apex (or vice versa — pick one, be consistent)

### 0.3 — Brand tokens

**Already sampled from `Flyer.png` and `LOGO.png` — use these:**

| Token | Hex | Role |
|---|---|---|
| `brand-green` | `#163E1F` | Primary — logo, headings, buttons, ribbons |
| `brand-cream` | `#F6EDE5` | Page background (warm off-white, not grey) |
| `brand-brown` | `#4E3216` | Accent — subtitles, paw dividers |
| `brand-green-muted` | `#353F23` | Olive variant in the logo mark; optional |
| `brand-ink` | `#1A1A18` | Body text |

- [ ] Write these into `tailwind.config.mjs` as named colors
- [ ] Card surface: ~`#FBF7F2` on cream with a soft border (matches the price list treatment)
- [ ] Identify the fonts. The flyer pairs a high-contrast display serif (Cormorant Garamond / Playfair family) with a clean humanist sans. Free equivalents: **Cormorant Garamond + Inter**.
- [ ] Note the letterspaced small-caps treatment on headings — it's a brand signature, preserve it
- [ ] Contrast is already verified: green-on-cream measures ~12:1, passing AA and AAA at any size. No need to darken.

### 0.4 — Logo

- [ ] Ask Edward's designer for the logo as **SVG**. Raster will look soft in the header and favicon.
- [ ] If no SVG exists: trace it, or use `LOGO.png` at 3× and accept the tradeoff
- [ ] Produce favicon set: `favicon.svg`, `favicon.ico` (32px), `apple-touch-icon.png` (180px)
- [ ] Produce a horizontal lockup for the site header (the stacked logo is too tall for a nav bar)

### 0.5 — Photo pipeline

- [ ] Create `src/assets/photos/`
- [ ] Rename all photos to web-safe slugs — lowercase, hyphens, no spaces
  - [ ] `Kisses from Jackie.jpeg` → `kisses-from-jackie.jpg`
  - [ ] **Watch the uppercase extensions:** `ME and Stellaluna.JPG`, `Smooches.JPG`, `Stellaluna at the Park.JPG` — case-sensitive Linux hosts will 404 on `.JPG` if referenced as `.jpg`
- [ ] Build a slug → caption mapping file (the original filenames carry the captions — preserve that information before renaming destroys it)
- [ ] **Apply EXIF rotation, then strip the tag.** Nine photos carry orientation tags (listed in [photo-captions.md](content-draft/photo-captions.md)). They display correctly in browsers today, but a naive resize bakes in the wrong rotation — they'd break *during* optimization. In `sharp`, a bare `.rotate()` handles it.
- [ ] Stripping EXIF also removes **GPS coordinates** — several photos were taken at clients' homes. Do not publish location metadata.
- [ ] Convert to WebP with JPEG fallback
- [ ] Resize: max 1600px wide for gallery, 800px for inline, 400px for thumbnails
- [ ] Target under 200KB each. ~21 phone-camera photos will otherwise make the gallery painful on mobile.
- [ ] Verify orientation visually after processing — this bug is invisible until someone looks
- [ ] Copy `First Aid Certificate.pdf` to `public/` for direct linking

### 0.6 — Content requests to Edward

**→ Consolidated in [go-back-to-ed.md](go-back-to-ed.md).**

That file is the single working list of everything only Edward can answer — grouped by what it blocks (launch / booking form / polish), with the reasoning behind each so the conversation can be one sitting rather than five texts.

- [ ] Walk Edward through `go-back-to-ed.md`
- [ ] Record answers in that file and propagate them into `content-draft/`
- [ ] Fix the remaining source-file errors in section F, and track down any circulating copies of the deleted `Contact us.jpg` — that one is actively losing business

---

# Phase 0.5 — Best-guess content transcription

*Goal: every word currently trapped in an image becomes editable text. TJ corrects afterward.*

Claude transcribes from the image assets into Markdown, marking anything uncertain. This is explicitly a **draft** — accuracy is TJ's pass, not Claude's.

### 0.5.1 — Set up

- [x] Create `content-draft/` at the repo root (separate from `src/` — a working area, not shipped code)
- [x] Add a `README.md` explaining these are unverified drafts pending review

### 0.5.2 — Transcribe

- [x] `about.md` — **both bios.** `About me.png` and `AboutMe.jpeg` turned out to be *different drafts*, not duplicates. Both transcribed verbatim, plus a proposed merge. Needs Edward's decision.
- [x] `pricing.md` ← from `Price list.jpg` — verified against two independent reads
- [x] `services.md` ← from `Flyer.png` — five services + trust badges
- [x] `service-area.md` ← from `Locations served.jpg` — 11 zip codes + travel-fee note
- [x] `contact.md` ← from `Contact us.jpg` — email typo corrected; source image since deleted
- [x] `photo-captions.md` — 21 photos, slug map, draft alt text

### 0.5.3 — Mark uncertainty

- [x] Flag every uncertain reading inline as `<!-- VERIFY: ... -->`
- [x] Verification checklists at the top of `pricing.md`, `service-area.md`, and `contact.md`
- [x] Every price and zip code listed individually for tick-off

### 0.5.4 — TJ's review pass

- [ ] Open each image side by side with its transcription
- [ ] Verify all prices digit by digit
- [ ] Verify all 11 zip codes
- [ ] Verify the phone number
- [ ] Correct wording and tone where the transcription is stiff
- [ ] Remove every `VERIFY` comment as it's resolved
- [ ] Have **Edward** do a final read — he may want to revise copy he wrote a while ago

### 0.5.5 — Promote to source of truth ✅

- [x] Content promoted to `src/content/` as Astro Content Collections
- [x] Structured data as JSON: `services.json`, `addons.json`, `fees.json`, `photos.json`
- [x] Prose as Markdown: `pages/about.md`, `pages/service-area.md`, `pages/contact.md`
- [x] **Schemas in `src/content.config.ts` validate at build time** — verified by negative test: a mistyped price fails the build naming the exact entry and field
- [x] `content-draft/` retained as the derivation record; `src/content/` is canonical
- [x] `starting-assets/` is archival — never re-derive content from an image again

> Doing the schemas now rather than at Phase 5 means the CMS work later is just adding an editing UI over an already-validated shape, and Phase 3's estimator reads prices from data instead of hardcoding them.

---

# Phase 1 — Design & information architecture

*Goal: agree on what the site says and where, before building.*

### 1.1 — Sitemap

```
/                 Home — hero, services at a glance, trust badges, CTA
/about            Edward's story + personal photos + First Aid cert
/services         Full service list + price table
/gallery          Photo library
/book             Booking request form  ← the main event
/contact          Phone, email, socials, service area, FAQ
```

- [x] Decide: separate `/service-area` page, or fold the zip codes into `/contact`? → **Keep it separate.** Reversed from the original "fold it in" recommendation on local-SEO grounds — see 2.6.2. "Dog walker Fairmount" is a query people type, and a page naming all 11 neighborhoods as text is the thing that answers it. This is the rare case where a thin page pays for itself.
- [ ] Decide: separate `/gallery`, or fold photos into `/about`? (Recommend keeping separate — there are ~25 good photos and they're genuinely persuasive.)

### 1.2 — Wireframes

- [ ] Wireframe mobile-first at 375px. Pet-sitting traffic is overwhelmingly phone traffic.
- [ ] Home page block order:
  - [ ] Hero: logo, tagline ("Adventurous care. Tailored for your pet."), a strong photo, primary CTA
  - [ ] Trust strip: *15 years · Insured · CPR & First-Aid Certified · Background checked*
  - [ ] Services grid (5 cards, icons from the flyer)
  - [ ] About teaser + photo, linking to `/about`
  - [ ] Testimonials
  - [ ] Service area summary
  - [ ] Final CTA
- [ ] Wireframe each remaining page
- [ ] Review with TJ before building

> **Shortcut available:** [design.prompt.md](design.prompt.md) is a self-contained brief ready to paste into Claude Design. It carries the sampled palette, typography, voice, page-by-page structure, real prices, and the booking-form spec. Running it can replace or jump-start 1.2 and 1.3.

### 1.3 — CTA strategy

- [ ] Primary CTA on every page: **Book a walk** → `/book`
- [ ] Secondary: **Text 610-888-4541** as a `tel:` link (one tap on mobile — meaningfully higher conversion than a form for some customers)
- [ ] Sticky mobile footer bar with both, or a sticky header CTA
- [ ] Ensure the trust strip is above the fold on mobile — it's Edward's strongest differentiator

### 1.4 — Pricing presentation

- [ ] Build as a real HTML table from `pricing.md`, never an embedded image
- [ ] Decide on layout: grouped cards (mirrors the existing flyer design) vs a single table (easier to scan and compare)
- [ ] Make the "additional fees" section clearly visible but not alarming
- [ ] Include the insulin exclusion note — it sets expectations honestly and avoids a bad conversation later

---

# Phase 2 — Build the static site

*Goal: a complete, live site that converts. No booking form yet.*

### 2.1 — Shared layout

- [ ] `src/layouts/Base.astro` — html shell, meta tags, font loading
- [ ] `Header.astro` — logo, nav, CTA button, mobile hamburger
- [ ] `Footer.astro` — contact, socials, service area, copyright
- [ ] `SEO.astro` — per-page title, description, Open Graph tags
- [ ] Reusable components: `Button`, `Card`, `TrustBadge`, `PhotoGrid`, `Testimonial`

### 2.2 — Pages

- [ ] Home
- [ ] About (bio + photos + First Aid certificate link)
- [ ] Services (service list + price table)
- [ ] Gallery
- [ ] Contact (phone, email, socials, zip codes, FAQ)
- [ ] `/book` placeholder — "To book, text or email" until Phase 3
- [ ] 404 page

### 2.3 — Responsive pass

- [ ] 375px (iPhone SE — the real floor)
- [ ] 390px / 430px (modern iPhone)
- [ ] 768px (tablet)
- [ ] 1280px+ (desktop)
- [ ] Verify no horizontal scroll at any width
- [ ] Verify tap targets are at least 44×44px

### 2.4 — Accessibility pass

- [ ] Alt text on every image, from `photo-captions.md`
- [ ] Verify color contrast passes AA everywhere
- [ ] Keyboard-navigate the entire site — every interactive element reachable, visible focus states
- [ ] Correct heading hierarchy (one `h1` per page, no skipped levels)
- [ ] Test with a screen reader on at least the home and book pages
- [ ] Respect `prefers-reduced-motion` if any animation is added

### 2.5 — Performance pass

- [ ] Lazy-load gallery images below the fold
- [ ] Preload the hero image
- [ ] Subset fonts, `font-display: swap`
- [ ] Lighthouse mobile: target 90+ on all four categories
- [ ] Verify on a throttled 3G connection

### 2.6 — SEO

*The site is a static brochure. Nearly all of the SEO win here is **local** SEO, and most of it happens off-site.*

**2.6.1 — Technical foundation (table stakes)**

- [ ] `sitemap.xml` — use `@astrojs/sitemap`, generated at build so it can't go stale
- [ ] `robots.txt` — allow everything, point at the sitemap. Nothing here needs hiding.
- [ ] Canonical `<link>` on every page, absolute URL — prevents `www`/apex and trailing-slash variants splitting ranking signal
- [ ] Pick apex-vs-`www` once (0.2) and 301 the other; never serve both
- [ ] Unique `<title>` per page, under ~60 chars, each ending `· Edventures Pet Sitting`
- [ ] Unique meta description per page, 140–160 chars, written as ad copy rather than a summary — it's the click-through pitch
- [ ] One `h1` per page containing the real subject, not the logo
- [ ] Descriptive `alt` on every image (already sourced from `photos.json`) — also feeds Google Images, which matters more than expected for pet businesses
- [ ] Verify no page is orphaned — every page reachable from the nav or footer

**2.6.2 — Local SEO (where the actual ranking comes from)**

- [ ] **NAP consistency.** Name, address/service area, and phone must be byte-identical across the site, Google Business Profile, Instagram, and Facebook. Formatting mismatches (`610-888-4541` vs `(610) 888-4541`) genuinely weaken local signal — pick one format and record it here.
- [ ] Put the phone number in the footer of every page as real text, not an image, inside a `tel:` link
- [ ] Keep a real `/service-area` page after all, listing all 11 zip codes with neighborhood names as text — this is the one case where a thin page earns its keep, because "dog walker Fairmount" is a query people actually type
  - [ ] Supersedes the 1.1 recommendation to fold it into `/contact`; the SEO value outweighs the thinness
  - [ ] **Do not** generate one page per zip code. That's doorway-page territory and is against Google's guidelines.
- [ ] Name Philadelphia and the neighborhoods naturally in body copy — the photos taken at Rittenhouse Square are genuine local proof, caption them as such
- [ ] Target realistic queries: `dog walker philadelphia`, `cat sitter rittenhouse`, `overnight pet sitting philadelphia`, `dog walker near me`

**2.6.3 — Structured data**

- [ ] `LocalBusiness` JSON-LD on the homepage — ideally the `ProfessionalService` subtype
  - [ ] `name`, `telephone`, `email`, `url`, `image`, `logo`
  - [ ] `areaServed` as the 11 postal codes
  - [ ] `sameAs` → Instagram and Facebook URLs
  - [ ] `openingHoursSpecification` — **blocked on C1** (Edward's real hours)
  - [ ] `priceRange` (e.g. `$$`)
- [ ] `Service` schema per offering, with `offers` carrying the real prices from `services.json`
- [ ] `FAQPage` schema on `/contact` once the FAQ is written
- [ ] `BreadcrumbList` on interior pages
- [ ] Generate all JSON-LD **from the content collections**, never hand-written — otherwise the markup and the visible prices drift apart, which is both an SEO penalty and a customer-facing lie
- [ ] Validate every page in Google's Rich Results Test

**2.6.4 — Social / sharing**

- [ ] Open Graph tags: `og:title`, `og:description`, `og:image` (1200×630), `og:url`, `og:type`
- [ ] `twitter:card` = `summary_large_image`
- [ ] Per-page OG images where it's cheap — the hero photo for `/`, a pet photo for `/gallery`
- [ ] Test a real paste into Facebook Messenger and iMessage. Links to this site will overwhelmingly be *texted*, and a broken preview costs more here than a ranking position.

**2.6.5 — Off-site (highest leverage, lowest effort)**

- [ ] **Google Business Profile** — claim, verify, complete 100%. For a local service business this outperforms the entire website.
- [ ] Set GBP as a **service-area business** (no storefront address) — Edward should not publish his home address
- [ ] Upload the best 10 photos to GBP; it weights recent photo activity
- [ ] Ask satisfied clients for Google reviews — review count and recency are the dominant local ranking factor
- [ ] Bing Places (cheap, five minutes, non-zero traffic)
- [ ] Link the site from the IG and FB bios
- [ ] Consistent listings on Yelp and Nextdoor — Nextdoor is disproportionately effective for neighborhood pet care

**2.6.6 — Measurement**

- [ ] Google Search Console: verify the domain, submit the sitemap
- [ ] Check the Core Web Vitals report after two weeks of real traffic
- [ ] Track which queries actually surface the site, and rewrite titles to match reality

> **Expectation setting.** A new domain ranks for essentially nothing for the first 1–3 months regardless of technical quality. Google Business Profile can start producing calls in *days*. If time is short, do 2.6.5 before 2.6.1.

### 2.7 — AI readiness

*People increasingly find local services by asking an assistant instead of searching. The site should answer well when a model reads it — and the work overlaps almost entirely with 2.6.*

**2.7.1 — `llms.txt`**

- [ ] Publish `/llms.txt` — a Markdown summary of the business for language models: what Edventures does, services with real prices, service area, contact details, and links to the key pages
- [ ] Generate it **from the content collections at build time**, so prices can never drift from the site
- [ ] Keep it short and factual. It's a briefing document, not marketing copy.
- [ ] Optionally publish `/llms-full.txt` with the full page text concatenated
- [ ] Serve as `text/plain; charset=utf-8`

> `llms.txt` is a community convention, not a standard, and support is uneven. It costs ~20 lines of build script and can't hurt — but don't treat it as the main mechanism. Clean semantic HTML is what actually gets read today.

**2.7.2 — Make the real pages machine-legible**

- [ ] Prices, hours, and service area must exist as **text in the HTML** — never in an image, never assembled by JavaScript. (Phase 0.5 already fixed this; the rule is: don't regress it.)
- [ ] Semantic landmarks: `<main>`, `<nav>`, `<article>`, `<address>` for contact details
- [ ] Question-shaped headings on `/contact` — *"Do you administer medication?"*, *"What areas do you serve?"* — models extract answers far more reliably from an explicit Q&A structure
- [ ] Keep the structured data from 2.6.3 accurate; it's the highest-confidence source a model has
- [ ] State constraints explicitly rather than implying them — the insulin exclusion, the 24-hour last-minute threshold, the `+$15` holiday surcharge. An assistant that confidently invents a policy creates a real customer conversation Edward has to walk back.

**2.7.3 — Crawler policy (a decision, not a default)**

- [ ] Decide whether to allow AI crawlers in `robots.txt`: `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`
- [ ] **Recommendation: allow them.** A pet-sitting business wants to be discoverable, and there's no proprietary content to protect. The trade-off that makes publishers block these does not apply here.
- [ ] Note the distinction: `Google-Extended` controls *training* use, not Search indexing — blocking it does not remove the site from Google
- [ ] Confirm the decision with Edward; it's his business, and it's a one-line reversal either way

**2.7.4 — Verify**

- [ ] Ask a few assistants *"who walks dogs in Rittenhouse, Philadelphia?"* after launch and see whether the site surfaces
- [ ] Paste the live URL into an assistant and ask it to state the prices and service area — **wrong answers here are a content bug, not an AI quirk**
- [ ] Re-check after any price change

### 2.8 — Launch

- [ ] Final content review with Edward
- [ ] Deploy to the real domain
- [ ] Verify HTTPS, redirects, and every internal link
- [ ] **Site is live.**

> **Ship here.** A live site with a phone number beats a perfect site that launches two months later.

---

# Phase 3 — The booking request form

*Goal: the calendar hurdle, solved the simple way.*

The UI is a calendar; the backend is an email. **There is no availability to compute, so there is no hard problem.** Edward remains the source of truth.

### 3.1 — Data model (do this first)

- [ ] Define `BookingRequest` as a TypeScript type in **one file**, `src/types/booking.ts`
- [ ] Define the service catalog as data (id, name, durations, prices) — derived from `pricing.md`, not hardcoded in the form
- [ ] Define add-ons as data (medication +$5, nail trim +$8)
- [ ] Define surcharge rules as data (additional dog +$7, additional cat +$5, holiday +$15, last-minute +$8)
- [ ] Define the served-zip list as data

> This single step is what makes Phases 4 and 6 swaps instead of rewrites. Don't skip it.

### 3.2 — Form fields

| Group | Fields |
|---|---|
| Service | Service type; duration (15/30/60); add-ons; recurring (one-time / weekly / specific days) |
| Schedule | Date or date range; time window; flexibility notes |
| Pets | Name, species, breed, age, temperament, medical/medication needs, gets along with other animals? |
| Customer | Name, phone, email, street address, **zip code** |
| Logistics | Home entry method; first-time client?; emergency contact; vet name & phone |
| Consent | Checkbox agreeing to the cancellation policy |

### 3.3 — Time windows, not exact times

- [ ] Offer windows: Morning 7–11, Midday 11–2, Afternoon 2–6, Evening 6–9
- [ ] Confirm these windows match Edward's actual working day
- [ ] Add a free-text "flexibility notes" field

> Windows match how walks actually get scheduled and set honest expectations. Exact-minute selection implies a precision Edward can't guarantee.

### 3.4 — Multi-step UX

- [ ] Step 1: Service & add-ons
- [ ] Step 2: Schedule
- [ ] Step 3: Pet details
- [ ] Step 4: Your info & logistics
- [ ] Progress indicator
- [ ] Preserve state when navigating back
- [ ] Persist to `localStorage` so a dropped connection doesn't lose the form

> A single page with 20 fields kills mobile conversion.

### 3.5 — Live price estimate

- [ ] Calculate as options are selected, from the Phase 3.1 catalog
- [ ] Auto-flag the last-minute surcharge when the date is under 24h out (+$8)
- [ ] Auto-flag holiday pricing (+$15) — needs a holiday date list
- [ ] Label clearly as **an estimate, not a quote**
- [ ] Show the line-item breakdown, not just a total

### 3.6 — Zip code handling

- [ ] Validate client-side against the 11 served zips
- [ ] **Do not block out-of-area submissions.** Show *"We may still be able to help — travel fees may apply"* and let them submit.
- [ ] Flag out-of-area requests visibly in Edward's email

> Turning away a nearby customer is worse than a slightly awkward email.

### 3.7 — Backend

- [ ] Serverless function at `/api/booking`
- [ ] **Validate server-side.** Never trust the client.
- [ ] Rate-limit by IP
- [ ] Send Edward's notification email via Resend
- [ ] Send the customer a confirmation email restating their request
- [ ] Return clear success/failure to the form
- [ ] Handle the failure path in the UI — show the phone number as a fallback if submission fails

### 3.8 — Spam protection

- [ ] Honeypot field
- [ ] Cloudflare Turnstile
- [ ] Minimum time-to-submit check (bots submit instantly)
- [ ] **No image CAPTCHA.** Don't punish real customers.

### 3.9 — Edward's notification email

- [ ] Scannable on a phone — service, date, time window, customer name, and phone in the **first three lines**. He'll read it while walking a dog.
- [ ] Full details below the fold
- [ ] `Reply-To` set to the customer's email so replying just works
- [ ] Prominent out-of-area flag when applicable
- [ ] Prominent first-time-client flag (may need a meet-and-greet)
- [ ] Subject line format: `New booking: [Service] — [Date] — [Customer]`

### 3.10 — Durable logging

- [ ] Write every submission to durable storage (Cloudflare KV, or a Google Sheet via webhook)
- [ ] Log before attempting the email, so a mail failure still leaves a record
- [ ] Alert TJ if the email send fails

> If an email silently fails, a lost booking is a lost customer. This is cheap insurance.

### 3.11 — Deliverability

- [ ] Configure SPF on the sending domain
- [ ] Configure DKIM
- [ ] Configure DMARC
- [ ] Verify with a mail tester tool
- [ ] Send a test to Gmail specifically — **check the spam folder**

> Skipping this is the single most likely way this project quietly fails.

### 3.12 — Testing

- [ ] Submit as a real customer, on a real phone
- [ ] Confirm Edward's email lands in his actual inbox
- [ ] Confirm the customer confirmation arrives
- [ ] Test the out-of-area path
- [ ] Test the last-minute surcharge path
- [ ] Test with JavaScript disabled (graceful degradation to the phone number)
- [ ] Test the failure path with the API forced to error
- [ ] **Edward does a full dry run** and confirms the email is genuinely usable to him

### 3.13 — Go live

- [ ] Replace the `/book` placeholder
- [ ] Set the expectation on the success screen: *"Edward typically replies within X hours"* — use his real answer from 0.6, then hold him to it
- [ ] Monitor the first week of submissions closely

---

# Phase 4 — Third-party booking tool

*Trigger: Edward is spending too much time on confirmation back-and-forth, or missing requests.*

- [ ] Evaluate against his actual workflow at that time:
  - [ ] **Time To Pet** — pet-sitting specific: client portal, pet profiles, invoicing, GPS-tracked visits. Best fit if the business has grown enough to justify the fee.
  - [ ] **Square Appointments** — free tier, general-purpose, payments built in. Best if budget is still the constraint.
  - [ ] **Calendly** — simplest, weakest fit for recurring pet care.
- [ ] Decide integration style:
  - [ ] Embed on `/book`, or
  - [ ] Keep the custom form and use the tool only as Edward's internal calendar
- [ ] Recommend the latter — it preserves the pet-specific intake fields that no generic tool handles well
- [ ] Migrate existing client data if the tool supports it
- [ ] **Keep the custom form live until the replacement is proven.** Don't cut over blind.

---

# Phase 5 — Rudimentary CMS

*Trigger: you're tired of getting texts asking to change a price.*

Deliberately small. Content changes rarely — the goal is "Edward can fix a typo," not a publishing platform.

- [ ] Move prices, services, testimonials, and FAQ into Astro Content Collections (the Phase 0.5 Markdown files are already most of the way there)
- [ ] Add schema validation so a malformed edit fails the build instead of breaking the site
- [ ] Pick the lightest editor:
  - [ ] **Decap CMS** or **Pages CMS** — git-backed admin UI, free, no database, no server. Edward edits in a browser, it commits, the site rebuilds.
  - [ ] Or: content in a Google Sheet, pulled at build time. Edward already knows how to use a spreadsheet.
- [ ] Write Edward a one-page how-to with screenshots
- [ ] Set up a preview deploy so he can see changes before they go live

> **Do not** reach for Sitecore, AEM, Contentful, or Sanity. Wildly disproportionate.

---

# Phase 6 — Real-time booking + payments

*Trigger: the business genuinely can't run on confirmation-by-hand.*

Scoped only so earlier phases don't paint you into a corner. This is a real application, not a website feature.

- Database (Postgres/Supabase): bookings, clients, pets, availability
- Edward-facing admin: set availability, block dates, view the day's schedule
- Availability engine: travel time between appointments, per-window capacity, buffers
- Timezone and DST correctness (an underrated source of bugs)
- Customer accounts, saved pet profiles, cancel/reschedule
- Stripe for deposits or full payment; refund and cancellation-fee policy
- Automated email/SMS reminders

**Honest assessment:** by the time this is justified, Time To Pet from Phase 4 probably does all of it for less than the cost of building and maintaining it. Revisit build-vs-buy seriously before starting.

---

## Cross-cutting checklist

### Before launch (end of Phase 2)

- [ ] Favicon + Apple touch icon
- [ ] **SEO — see 2.6.** Sitemap, robots, canonicals, per-page meta, structured data, and Open Graph now live there in full rather than as a checklist afterthought.
- [ ] **AI readiness — see 2.7.**
- [ ] Privacy policy — the booking form collects home addresses and phone numbers, so this isn't optional
- [ ] Terms / service agreement + cancellation policy, linked from the form
- [ ] Test on a real iPhone and a real Android, not a resized desktop browser

### After launch

- [ ] **Google Business Profile.** For a local service business this drives more traffic than the website itself — the highest-leverage single post-launch task. Full steps in 2.6.5.
- [ ] Remaining off-site listings and measurement — 2.6.5 and 2.6.6
- [ ] Verify how assistants answer questions about the business — 2.7.4
- [ ] Uptime monitoring on the homepage and the form endpoint
- [ ] Analytics — track book-page visits and form completion rate

---

## Sequencing

| Phase | Blocking on |
|---|---|
| 0 — Setup & assets | Domain purchase; logo SVG from Edward |
| 0.5 — Transcription | Phase 0.5 assets; TJ's verification pass |
| 1 — Design & IA | Phase 0.5 verified content |
| 2 — Static site → **LAUNCH** | Phase 1; Edward's testimonials |
| 3 — Booking form | Phase 2 live; Edward's cancellation + meet-and-greet policies |
| 4 — Third-party tool | Demand |
| 5 — Rudimentary CMS | Your patience |
| 6 — Real-time + payments | Genuine business need |

**Phases 0–3 are the real project.** Everything after is optional and demand-driven.

---

## Risks

| Risk | Mitigation |
|---|---|
| Booking email lands in spam; customer lost silently | Phase 3.11 deliverability + 3.10 durable logging + customer confirmation email |
| A transcribed price is wrong on the live site | Phase 0.5.3 digit-level flagging + 0.5.4 TJ verification + Edward's final read |
| Content from Edward stalls the build | Build Phase 2 with placeholder testimonials; swap in later |
| Published prices go stale | Single source-of-truth content file from Phase 0.5; CMS at Phase 5 |
| Double-booking | Deferred entirely by the Phase 3 design — Edward is the source of truth until Phase 6 |
| Logo looks soft on retina | Get the SVG in Phase 0.4, before design work depends on it |
| Structured data / `llms.txt` drifts from the real prices, so search results and AI answers quote a stale number | Generate both from the content collections at build time (2.6.3, 2.7.1) — never hand-write them |
| Site ranks for nothing and the project reads as a failure | Google Business Profile (2.6.5) produces calls in days; a new domain takes 1–3 months regardless. Do the off-site work first. |
