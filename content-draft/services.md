---
source: starting-assets/Flyer.png
status: unverified
---

# Services

## ⚠️ Verification checklist

- [ ] Five services listed — confirm nothing is missing
- [ ] Trust claims: 15 years experience, Reliable, Caring, Insured, CPR & First Aid Certified
- [ ] Tagline wording
- [x] **"Walk or jog" — resolved by TJ.** Jogging falls under Dog Walks. Not a separate service, no separate pricing.

---

## Tagline

**Adventurous care. Tailored for your pet.**

<!-- VERIFY: This tagline is from Locations served.jpg, not the flyer. The flyer's equivalent line is "Flexible scheduling - We'll work around your schedule." Confirm which is the primary tagline. Recommend "Adventurous care. Tailored for your pet." - it plays on the business name and says something about quality rather than logistics. -->

## Trust badges

- **15 years of experience**
- Reliable
- Caring
- **Insured**
- **CPR & First Aid Certified**
- Background checked *(from `About me.png`, not on the flyer)*

<!-- VERIFY: "Background checked" appears in About me.png but NOT on the flyer. Confirm before using it as a badge. It's a strong trust signal and worth including if accurate. -->

> **Design note:** this is Edward's strongest differentiator. It belongs above the fold on mobile (Phase 1.3).

## The five services

### Dog Walks
15, 30, or 60 minute walks. **Jogging available at no extra charge** — same pricing as a walk.

### Cat Visits
15 or 30 minute drop-in visits.

### Medication Administration
$5 add-on with any visit; included free with overnight stays. *Insulin injections unavailable.*

### Nail Trims
Available as a stand-alone visit or as an add-on to any visit.

### Overnight Pet Sitting
In-home overnight care, starting at $55.

<!-- VERIFY: The flyer calls this "OVERNIGHT PET SITTING"; the price list calls it "OVERNIGHT STAYS". Pick one name and use it consistently across the site and the booking form. -->

---

## Jogging — resolved

`AboutMe.jpeg` mentioned "walk or jog." **Per TJ: jogging falls under Dog Walks** — same service, same price, no separate booking option.

Worth surfacing anyway, because it's a real differentiator that few sitters offer:

- [ ] Mention it in the Dog Walks description — *"Walk or jog, at your dog's pace"* or similar
- [ ] Add a **pace preference** field to the booking form's pet section (walk / jog / whatever suits the dog) rather than a separate service type. Captures the same information without cluttering the service list.
- [ ] Do **not** give it its own service card — it isn't separately priced, and implying otherwise invites confusion at payment time.

---

## Notes for implementation

- Full pricing lives in `pricing.md` — that file is the single source of truth. Do not duplicate the numbers here when building.
- The flyer has icons for each service (dog, cat, medication bottle, clippers, house-with-heart). Extract these as SVGs if possible; they're on-brand and better than generic icon-set substitutes.
- "Contact us for pricing" on the flyer is now **obsolete** — prices are published. Don't carry that line over.
