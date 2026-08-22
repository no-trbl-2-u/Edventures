# Go back to Ed

Running list of things only Edward can answer. Grouped by what they block, so the conversation can be one sitting rather than five texts.

Each item has a **why** — worth having on hand, since several of these sound like nitpicks but change real decisions.

**Legend:** 🔴 blocks launch · 🟡 blocks the booking form (Phase 3) · 🟢 polish

---

## A. Business facts

### 🟡 A3. Insurance — is he covered for work booked off-platform?

Background check is settled (Rover). **Insurance is still open, and separate.**

The site currently says **nothing** about insurance. That's deliberate, and it isn't blocking — the About page ships fine without the claim, and every other claim on it is verified.

Worth raising with him for his own sake rather than the website's:

**If his only coverage is Rover's, it generally applies only to bookings arranged through Rover.** This website exists to take bookings *off* Rover. So work booked through the site may not be covered at all — a gap that's easy to miss, because from the sitter's side nothing about the job looks different.

- [ ] Does he carry pet-sitter liability insurance **independent of Rover**?
- [ ] If yes — who's the carrier? We'll name them. *"Insured through [carrier]"* is evidence; "fully insured" is just an assertion.
- [ ] If no — worth considering. Pet Sitters Associates, Kennel Pro, and Business Insurers of the Carolinas are the usual options for solo sitters, roughly **$200–350/year**. Modest against the downside of one bad afternoon.

*Not legal or insurance advice — just a gap worth checking with whoever wrote his policy.*

### 🟢 A5. Is 610-888-4541 the right public number, and does it take texts from unknown numbers?
The 610 area code is suburban PA rather than Philly's 215/267 — that's common and fine, just confirming it's the business line and not a personal one he'd rather not publish.

### 🟢 A6. Does he take phone calls, or text only?
The contact image says "Text:" — never "Call." Changes the CTA wording across the whole site (*"Text us"* vs *"Call or text us"*).

---

## B. Policies

These are the legal-ish backbone of the booking form. The site can launch without them; the booking form can't.

### 🟡 B1. Cancellation policy
How much notice does he need? Is there a fee? Customers must agree to this at booking, so it needs to exist in writing.

### 🟡 B2. Key handling
How does he receive, store, and return keys or door codes? **This is one of the top two anxieties a new client has** — a confident, specific answer on the site converts.

### 🟡 B3. Vet emergency policy
If something goes wrong: what does he do, who pays, what authorization does he need in advance? The other top anxiety. The booking form should collect the client's vet info and emergency contact, which implies a policy behind it.

### ✅ B4. Meet-and-greet before first booking? — ANSWERED 2026-08-22
**Offered, not required.** Built accordingly: the booking form's final step has a
first-time-client checkbox, Edward's email leads with a `FIRST-TIME CLIENT -
offer a meet-and-greet` flag, the customer's confirmation sets the expectation,
and the contact-page FAQ now answers this for real (it was a placeholder).
Still open for Edward: how long a meet-and-greet takes and whether it's free —
the site deliberately doesn't claim either yet.

### ✅ B5. Which holidays carry the +$15 surcharge? — ANSWERED 2026-08-22
**The standard list plus Easter.** Applied in `src/lib/booking.ts` through
early 2028 (requests can be made 550 days out): New Year's Day, Easter,
Memorial Day, July 4th, Labor Day, Thanksgiving, Christmas Eve, Christmas Day,
New Year's Eve. Surcharge applies when any listed date falls inside the booked
range, day-only (no window around it).

### 🟡 B6. What is the travel fee for out-of-area clients?
`Locations served.jpg` says "travel fees may apply" without a number. Options: publish a figure, or keep it quoted case-by-case. Either is fine — but the site should say which, rather than leaving customers guessing.

---

## C. Scheduling

### 🟡 C1. What are his actual working hours and days?
I proposed these booking windows as a placeholder. **He should confirm or correct them:**

| Window | Hours |
|---|---|
| Morning | 7am – 11am |
| Midday | 11am – 2pm |
| Afternoon | 2pm – 6pm |
| Evening | 6pm – 9pm |

**Why windows and not exact times:** the customer picks a broad window rather than "2:15pm," which matches how walks actually get scheduled and avoids promising a precision he can't hit. It's also the reason the booking system stays simple — see the roadmap.

### 🟡 C2. How fast does he realistically reply to a booking request?
The success screen will say *"Edward typically replies within X hours."* Pick a number he can actually hit — an unmet promise here is worse than a vaguer one. Under-promise.

### 🟢 C3. Does he take overnight bookings on holidays?
Flyer says "flexible scheduling," which may or may not mean Christmas.

---

## D. Content he needs to supply

### 🟡 D1. Testimonials — two in, one slot open
**Live on the homepage:** Anthony Allen (Auggie, boxer) and Dana DiTullio (Xenon, Cane Corso). Published under full names.

Three things still worth chasing:

- [ ] **A third quote.** Neither of the two mentions **medication, an anxious pet, or a key handover** — which are exactly the worries that stop someone booking a stranger. A quote covering one of those is worth more than a fourth "he's great".
- [ ] **Neighborhoods.** The schema has an optional `neighborhood` field, currently unused. *"Anthony · Fairmount"* is a local-SEO signal and reads as more real than a bare name. Needs each client's OK.
- [ ] **Confirm full names are fine to publish.** They're on the site now; some people would rather be "Anthony A." One-line change if so.

> **Their quotes corrected two things we had wrong.** Our alt text called Auggie "a tan and white hound" — he's a **boxer** — and Xenon "a large black dog" — he's a **Cane Corso**. Both fixed. Owners describing their own dogs beat anything inferred from a photograph, which is a good argument for asking the *other* owners what their pets actually are.
>
> Note the spelling: Edward's filename says **Auggy**, Anthony writes **Auggie**. We've gone with the owner's spelling in the caption and alt text. Worth a quick check that Edward's happy with that.

### 🟢 D2. Logo as an SVG
If his designer has the vector file, the header and favicon will be noticeably crisper. `LOGO.png` works, just softer on retina screens.

### 🟢 D3. Is there a 60-minute cat visit?
Dog walks have 15/30/60; cat visits list only 15/30. Probably intentional, but worth confirming it isn't an omission.

---

## E. Judgment calls — his to make

### 🟢 E1. `Angel and I, RIP.jpg` — where does this go?
Permission isn't the question; placement is. A memorial photo dropped unremarked into a sales gallery can land badly, and could be painful for the family to come across unexpectedly.

Three options: leave it out, give it an intentional place in his story on the About page, or include it in the gallery unmarked. **The third is the one to avoid** — it's the only one that reads as careless. His call entirely.

### 🟢 E2. Which tagline leads?
- *"Adventurous care. Tailored for your pet."* — plays on the business name, says something about quality
- *"Flexible scheduling — we'll work around your schedule."* — logistics

Recommend the first as the headline, with the second as supporting copy.

### 🟢 E3. "Overnight Stays" or "Overnight Pet Sitting"?
The flyer and the price list disagree. Pick one and use it everywhere, including the booking form.

### 🟢 E4. `A fun day with Cows.jpeg` — is "Cows" a dog's name, or actual cows?
Changes the caption entirely. Genuinely unclear from the filename.

---

## F. Fixes to his source files

Not website work — these are his originals, and the errors will keep propagating into print and social if they aren't fixed at the source.

### 🔴 F1. The `Contact us.jpg` email typo — where else is that image?
It read `edventurespe**titting**@gmail.com` — missing the `s`. **Anyone who typed the address off that image sent mail into the void.**

We've deleted our copy, so it can't reach the website. **But that doesn't recall the copies already out there**, and that's where the real damage would be:

- [ ] Was it ever posted to **Instagram** or **Facebook**? Delete or replace those posts.
- [ ] Was it ever **printed** — flyers, cards, a noticeboard?
- [ ] Was it sent directly to any clients?
- [ ] Worth checking whether `edventurespetitting@gmail.com` is registerable — if it's free, **claiming it and forwarding to the real inbox** would recover any misdirected mail permanently. Cheap insurance.

Still the highest-value item on this list. It may already have cost him inquiries, and unlike everything else here, it's actively losing business right now.

### 🟢 F2. `Price list.jpg` renders holiday visits as `$15+`
Confirmed the real figure is a flat **+$15**. The trailing plus should come off.

### 🟢 F3. Flyer says "contact us for pricing"
Obsolete now that prices are published. Worth updating before it's reprinted.

---

## G. Raised by the website build

The Claude Design comp proposed copy that reads better than ours but describes things Edward may or may not actually do. **We shipped the verified wording instead**, because a promise made on the homepage becomes a promise on the first booking. Each of these is a straight yes/no — if yes, the better copy goes in.

### 🟡 G1. Does he send an update after each visit?
The comp's dog-walk card reads *"Leash manners, water, and a note when I leave."* If he really does leave a note or send a text after every walk, **say so** — it's one of the strongest differentiators a solo walker has over an agency. If he doesn't, it can't go on the site.

### 🟡 G2. Does he send a photo before bed on overnight stays?
Same question, from the overnight card: *"I stay at your place, keep the routine, and send a photo before bed."* Lovely if true. A complaint waiting to happen if not.

### 🟢 G3. Should the site say "Insured"?
Currently it does **not** — the trust strip and footer list *15 years · CPR & First-Aid Certified · Background checked* only. The design comp included an "Insured" badge, and the flyer claims it, but this stays off until A3 is resolved. **A published insurance claim that turns out to be wrong is a much bigger problem than a missing badge.** One line to add back once there's a policy number.

### ✅ G4. Which dates count as holidays? — ANSWERED 2026-08-22 with B5
The standard list plus Easter, applied through early 2028 in `src/lib/booking.ts`. See B5 above.

### 🟢 G5. Is he happy for AI assistants to read the site?
`robots.txt` currently **allows** GPTBot, ClaudeBot, PerplexityBot and friends, and the site publishes an `llms.txt` summary. Reasoning: he wants to be findable, and there's no proprietary content to protect — being the answer when someone asks an assistant *"who walks dogs in Rittenhouse?"* is worth more than withholding six pages of public copy. It's his call and a one-line reversal.

### 🟢 G6. Zoe's eye
Still open from the photo pass. In `Zoe and I.jpg` her left eye appears closed or absent. The alt text stays general until he confirms. If she's a special-needs dog and her owner is happy for it to be mentioned, **that's a genuine trust signal** — "he looks after a blind chihuahua" says more than any badge.

---

## Answered ✅

- **"15 years of experience"** — confirmed current
- **Veterinary role** — *Veterinary Medicine Administration*. Applied to the bio, with the sentence restructured so the hands-on-care claim attributes to pet sitting and rescue, and the vet-practice experience stands as its own credential.
- **Background check** — through **Rover**. Phrased as "background-checked through Rover," which is clearer than "background-check certified" and names a provider customers recognize.
- **Bio version** — merged draft is canonical
- **"Walk or jog"** — jogging falls under Dog Walks, same price, not a separate service
- **Harry and Hubert** — both animals; Harry is Edward's own cat
- **Holiday surcharge** — flat +$15
- **Email** — `edventurespetsitting@gmail.com`
- **Photo permissions** — cleared for all client pets
