# Edventures Pet Sitting — Website Roadmap

**Business:** Edventures Pet Sitting — Edward, Philadelphia
**Services:** Dog walks, cat visits, medication administration, nail trims, overnight stays
**Service area:** 19102, 19104, 19106, 19107, 19123, 19130, 19143, 19145, 19146, 19147, 19148
**Contact:** Text 610-888-4541 · edventurespetsitting@gmail.com · IG/FB @edventurespetsitting

> **Canonical email is `edventurespetsitting@gmail.com`.**
> `starting-assets/Contact us.jpg` contains a typo (`edventurespe**titting**`). Never copy the address from that file. Fix it at the source before that image is reused in print or social.

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
- [ ] Convert to WebP with JPEG fallback
- [ ] Resize: max 1600px wide for gallery, 800px for inline, 400px for thumbnails
- [ ] Target under 200KB each. ~25 phone-camera photos will otherwise make the gallery painful on mobile.
- [ ] Copy `First Aid Certificate.pdf` to `public/` for direct linking

### 0.6 — Content requests to Edward

Send these as one message. This is usually the long pole — ask early.

- [ ] 3–5 testimonials: quote, first name, neighborhood, permission to publish
- [ ] Insurance carrier name (the About copy claims "fully insured" — naming the carrier is stronger)
- [ ] Background-check provider name
- [ ] **Cancellation policy** — how much notice, is there a fee
- [ ] **Key-handling policy** — how he receives, stores, and returns keys or codes
- [ ] **Vet emergency policy** — what he does, who pays, what authorization he needs
- [ ] Does he require a **meet-and-greet** before first booking? (Most sitters do — it changes the booking form.)
- [ ] Operating hours / days, and whether he takes holiday bookings
- [ ] Typical response time to a booking request (needed for the form's success message)
- [ ] Confirm 610-888-4541 is the number he wants published
- [ ] Confirm whether that number accepts SMS from strangers

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
- [x] `contact.md` ← from `Contact us.jpg` — with the email typo corrected
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

### 0.5.5 — Promote to source of truth

- [ ] Move verified files into `src/content/`
- [ ] From here on, **the Markdown is canonical and the images are decoration.** Never re-derive content from an image again.
- [ ] Note in the repo README that `starting-assets/` is archival

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

- [ ] Decide: separate `/service-area` page, or fold the zip codes into `/contact`? (Recommend folding — the content is thin, and a dedicated page helps local SEO only marginally.)
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

### 2.6 — Launch

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
- [ ] Open Graph tags + share image — the flyer works well; links get texted and posted to Facebook constantly
- [ ] `sitemap.xml`
- [ ] `robots.txt`
- [ ] Unique meta description per page
- [ ] LocalBusiness structured data (`schema.org`) with service area and hours
- [ ] Privacy policy — the booking form collects home addresses and phone numbers, so this isn't optional
- [ ] Terms / service agreement + cancellation policy, linked from the form
- [ ] Test on a real iPhone and a real Android, not a resized desktop browser

### After launch

- [ ] **Google Business Profile.** For a local service business this drives more traffic than the website itself — the highest-leverage single post-launch task.
- [ ] Link the site from the IG and FB bios
- [ ] Submit the sitemap to Google Search Console
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
