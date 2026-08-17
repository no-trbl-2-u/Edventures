---
source: starting-assets/Price list.jpg
status: unverified
---

# Services & Pricing

## ⚠️ Verification checklist — check every digit against the image

Read this twice. A wrong price on a live site is a real business problem.

**Dog walks**
- [ ] 15 minutes = `$15`
- [ ] 30 minutes = `$25`
- [ ] 60 minutes = `$40`

**Cat visits**
- [ ] 15 minutes = `$18`
- [ ] 30 minutes = `$25`
- [ ] Confirm there is genuinely **no 60-minute cat visit** (the image lists only two tiers)

**Medication administration**
- [ ] Add-on = `$5`
- [ ] Free with overnight stays
- [ ] Insulin injections unavailable

**Nail trims**
- [ ] Stand-alone visit = `$20`
- [ ] Add-on to any visit = `$8`

**Overnight stays**
- [ ] Starting at `$55`

**Additional fees**
- [ ] Additional dog = `+$7`
- [ ] Additional cat = `+$5`
- [ ] Holiday visits = `+$15` — note the image shows `$15+`, i.e. *fifteen or more*, not exactly fifteen
- [ ] Last-minute booking, under 24 hrs notice = `+$8`

---

## Dog Walks

| Duration | Price |
|---|---|
| 15 minutes | $15 |
| 30 minutes | $25 |
| 60 minutes | $40 |

## Cat Visits

| Duration | Price |
|---|---|
| 15 minutes | $18 |
| 30 minutes | $25 |

<!-- VERIFY: Cat visits list only 15 and 30 minutes - no 60-minute option, unlike dog walks. Confirm this is intentional and not an omission from the flyer. -->

## Medication Administration

**$5** add-on with any visit.

**Included free** with overnight stays.

*Insulin injections unavailable.*

<!-- VERIFY: The insulin note is set in small italics on the image. Confirm the exact wording - "Insulin injections unavailable." is the reading. Worth keeping on the site: it sets expectations honestly and avoids a bad conversation later. -->

## Nail Trims

| Option | Price |
|---|---|
| Stand-alone visit | $20 |
| Add-on to any visit | $8 |

## Overnight Stays

**Starting at $55**, with any additional fees.

<!-- VERIFY: "STARTING AT $55 WITH ANY ADDITIONAL FEES" is the literal reading. The phrasing is ambiguous - does it mean $55 plus applicable fees? Worth rewording for the site once Edward confirms the intent. -->

## Additional Fees

| Fee | Amount |
|---|---|
| Additional dog | +$7 |
| Additional cat | +$5 |
| Holiday visits | +$15 and up |
| Last-minute booking (under 24 hrs notice) | +$8 |

<!-- VERIFY: The image reads "+ $15+" for holiday visits - the trailing plus appears intentional, meaning "fifteen or more". Transcribed as "and up". Confirm with Edward, and confirm WHICH holidays count. The booking form needs a concrete date list to auto-flag the surcharge. -->

---

## Notes for implementation

- These figures feed the `BookingRequest` service catalog in Phase 3.1. Keep this file as the single source of truth — do not hardcode prices into the form.
- The last-minute surcharge (`+$8`, under 24h) and holiday surcharge can be auto-applied by the booking form's live estimate.
- Any estimate shown to a customer must be labelled **an estimate, not a quote**, given the "starting at" and "and up" language above.
