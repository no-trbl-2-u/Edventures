# Design Prompt — Edventures Pet Sitting

> **How to use this:** paste the whole file into Claude Design. It's written to be self-contained. Attach the assets listed in §9 if the tool accepts uploads — especially `LOGO.png` and `Flyer.png`.

---

## 1. The brief

Design a marketing website for **Edventures Pet Sitting**, a one-person pet care business in Philadelphia. The owner, Edward, has 15 years of experience and does dog walks, cat visits, medication administration, nail trims, and overnight stays.

The site has one job: **convince a pet owner that this specific person is safe to trust with their animal and their house key**, then get them to submit a booking request.

This is not a marketplace, not an app, not a startup. It's a skilled individual's professional presence. The design should feel like it belongs to a real person who is genuinely good at this — not to a venture-backed pet-tech company.

---

## 2. Brand palette

Sampled directly from the existing logo and flyer. Use these exact values.

| Token | Hex | Role |
|---|---|---|
| `brand-green` | `#163E1F` | Primary. Logo, headings, buttons, the banner ribbons. A deep, almost-black forest green. |
| `brand-cream` | `#F6EDE5` | Page background. A warm, slightly pink off-white. **Not** grey, **not** pure white. |
| `brand-brown` | `#4E3216` | Accent. Subtitles, paw-print dividers, small flourishes. Rich and dark, not tan. |
| `brand-green-muted` | `#353F23` | Olive variant found in the logo mark. Optional — good for illustration fills. |
| `brand-ink` | `#1A1A18` | Body text. |

**Palette notes:**

- The cream background is the single most identifying feature of this brand. Never substitute pure white for it on content surfaces.
- Green on cream measures roughly 12:1 contrast — it passes AA and AAA comfortably. You have room to use the green confidently at any text size.
- Cards sit on cream as a *slightly lighter* warm white (around `#FBF7F2`) with a soft border — see the existing price list for the pattern.
- Resist adding a fifth color. The three-color system is doing real work; a bright "CTA orange" would cheapen it immediately.

---

## 3. Typography

The existing flyer pairs a **high-contrast serif display face** (Cormorant Garamond / Playfair Display family) with a **clean humanist sans** for body copy.

- **Display serif** — the wordmark, page headings, section titles. Often set in **letterspaced small caps**, which is a signature of the existing material. Preserve that.
- **Body sans** — paragraphs, prices, form labels, navigation.
- Free equivalents: **Cormorant Garamond** + **Inter**, or **Playfair Display** + **Source Sans 3**.

Set generous line-height on body copy (1.6+). The brand reads as calm and unhurried; tight type would fight that.

---

## 4. Voice & feeling

**Target adjectives:** warm, established, trustworthy, calm, personal, a little classic.

**Anti-adjectives:** startup-y, playful-cartoonish, neon, cluttered, corporate, "disruptive."

The existing material has a quietly upscale, almost *heritage* quality — engraved-looking serif, paw-print dividers used as typographic ornaments, symmetrical layouts, lots of breathing room. It looks closer to a veterinarian's letterhead or an artisanal shop than to a tech product. **Lean into that.** It's the brand's biggest asset and it's rare in this category, where competitors default to bright blue and cartoon dogs.

The tagline is: **"Adventurous care. Tailored for your pet."**

---

## 5. Pages to design

Mobile-first. Pet-sitting traffic is overwhelmingly phone traffic — design 375px first, then scale up to 1280px.

### Home
1. **Hero** — logo, tagline, one strong photo of Edward with a dog, primary CTA
2. **Trust strip** — `15 Years Experience · Insured · CPR & First-Aid Certified · Background Checked`. This is his strongest differentiator. Must be above the fold on mobile.
3. **Services grid** — 5 cards: Dog Walks, Cat Visits, Medication Administration, Nail Trims, Overnight Pet Sitting
4. **About teaser** — a photo of Edward + two sentences + link
5. **Testimonials**
6. **Service area** — Philadelphia, 11 zip codes
7. **Final CTA**

### About
Edward's story, at length, with personal photos. This page does more conversion work than it looks like it should — people hiring a pet sitter read it closely. Design it to be genuinely readable, not a wall of text. Include a link to his First Aid certificate as proof.

### Services & Pricing
The full service list with a real price table (see §6).

### Gallery
~25 photos of Edward with client pets. Warm, personal, phone-camera quality — the design must flatter imperfect photos rather than demand studio ones.

### Contact
Phone (tap-to-text), email, Instagram, Facebook, the 11 zip codes, and an FAQ.

### Book — *the most important page*
A multi-step booking request form. See §7.

---

## 6. The price table

Real prices, to design around:

**Dog Walks** — 15 min $15 · 30 min $25 · 60 min $40
**Cat Visits** — 15 min $18 · 30 min $25
**Medication Administration** — $5 add-on with any visit; free with overnight stays *(insulin injections unavailable)*
**Nail Trims** — stand-alone visit $20 · add-on to any visit $8
**Overnight Stays** — starting at $55
**Additional fees** — additional dog +$7 · additional cat +$5 · holiday visits +$15 · last-minute booking under 24h +$8

Design this as **live HTML text, never an image.** It needs to be scannable on a phone. The "additional fees" block should be clearly visible but not alarming — honest, not defensive.

---

## 7. The booking form

Four steps, with a progress indicator:

1. **Service** — type, duration, add-ons
2. **Schedule** — date or date range, plus a **time window**: Morning 7–11, Midday 11–2, Afternoon 2–6, Evening 6–9
3. **Pets** — name, species, breed, age, temperament, medical needs
4. **You** — name, phone, email, address, zip, home entry method, emergency contact, vet

**Critical design details:**

- The calendar picks a **date and a broad time window**, not an exact minute. Design the window selector as four clear, tappable cards — not a dropdown. This is the honest representation of how the service actually works.
- Show a **live price estimate** that updates as options are selected, with a line-item breakdown. Label it clearly as an estimate, not a quote.
- Show a friendly, non-blocking message for out-of-area zip codes: *"We may still be able to help — travel fees may apply."* Never reject the submission.
- Design the **success state** — it should feel reassuring and set an expectation ("Edward will confirm within a few hours"), not just say "Submitted."
- Design the **failure state** too, falling back to the phone number.
- Large tap targets throughout. People will fill this out one-handed.

---

## 8. Requirements & constraints

**Must:**
- Be responsive from 375px to 1280px+, mobile-first
- Meet WCAG AA contrast everywhere
- Have visible keyboard focus states on every interactive element
- Have a persistent, obvious way to reach the booking form from every page
- Include a **tap-to-text** secondary CTA — `tel:` link to 610-888-4541. For some customers this converts better than any form.
- Handle imperfect, mixed-aspect-ratio phone photos gracefully
- Work with **no images at all** if they fail to load — the layout must not collapse

**Must not:**
- Use stock photography. Every photo is a real client pet, and that's the point.
- Use cartoon dog illustrations or bouncy animation. The paw prints are typographic ornaments, not clip art.
- Introduce a color outside the palette in §2
- Put content inside images
- Use an image CAPTCHA
- Add a cookie consent banner — analytics will be cookie-free

**Technical target:** static site, Astro + Tailwind. Design should be implementable without a JavaScript framework — the booking form is the only genuinely interactive surface.

---

## 9. Reference assets

In `starting-assets/`:

| File | Use |
|---|---|
| `LOGO.png` | The wordmark — an "E" with a dog resting on top and a cat reaching up. Genuinely charming; make it prominent. |
| `Flyer.png` | **The strongest reference for the intended visual language.** Match this. |
| `Price list.jpg` | Existing pricing layout — the card treatment here is worth carrying forward |
| `About me.png` | Edward's bio copy |
| `Locations served.jpg` | Zip codes + "other areas by appointment" |
| `First Aid Certificate.pdf` | Link as credential proof |
| ~25 photos | Edward with client pets and cats. Warm, candid, real. |

**Note on the logo:** the mark is doing a lot of brand work — it's distinctive and warm without being cutesy. The stacked version is too tall for a nav bar, so design a horizontal lockup variant for the header.

---

## 10. What "great" looks like here

A pet owner lands on this site from an Instagram link, on their phone, while deciding whether to trust a stranger with their dog and their house key.

Within five seconds they should feel: *this person is a professional, they've been doing this a long time, and they actually love animals.*

Within thirty seconds they should have found the price for what they need and tapped **Book**.

The design succeeds if it feels like it was made *for Edward* — not adapted from a template. The existing flyer already has real character. **The website should feel like it came from the same hand.**
