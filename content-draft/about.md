---
source: merged from starting-assets/About me.png and starting-assets/AboutMe.jpeg
status: version chosen (TJ) — one open item for Edward
---

# About Me

> **Version decision: MERGED.** TJ selected the merged bio below as canonical.
> The two source drafts are preserved at the bottom for reference only.
>
> **Vet role: resolved** — "Veterinary Medicine Administration," applied to the copy below.
>
> **⚠️ One item still open — and it blocks publishing this page:** the *"fully insured"* claim. See the section under the copy. If his coverage is Rover's, it likely does not extend to bookings made through this website.

---
<!-- VERIFIED -->
## The copy

Hi! I'm Edward, the owner and founder of **Edventures Pet Sitting**.

Animals have always been a huge part of my life, and I bring **15 years of hands-on experience** caring for pets of all kinds. My background includes pet sitting, animal rescue, and veterinary medicine administration — so I've cared for animals with a wide range of personalities, needs, medical conditions, and routines, and I've seen how veterinary care works from the inside.

<!-- ⚠️ DO NOT PUBLISH THIS PARAGRAPH AS-IS. "fully insured" is unconfirmed, and
     "background-check certified" is awkward phrasing for what is probably a Rover
     screening. See "Still open - the insurance claim" below. -->

I'm **CPR and First-Aid certified**, background-check certified, and fully insured — because your pets deserve the same level of care and attention I'd want for my own.

<!-- Safe interim version, if the insurance question isn't resolved before build:
     "I'm CPR and First-Aid certified and background-checked, because your pets
     deserve the same level of care and attention I'd want for my own."
     Drops only the unverified claim; keeps everything confirmed. -->


I believe pet care is about more than simply feeding a pet or taking them for a walk. It's about building trust, keeping them comfortable and happy, and giving you peace of mind while you're away. Whether your pet is energetic, shy, anxious, elderly, or needs a little extra care, I take the time to get to know them as an individual.

I'm proud to provide dependable, compassionate, and personalized pet care throughout Philadelphia — and I can't wait to meet you and your furry family.

---

## ✅ Resolved — "veterinary medicine administration"

Edward's answer: **Veterinary Medicine Administration.** Neither source draft had it right — `About me.png` said "volunteering in veterinary clinics" (understates it) and `AboutMe.jpeg` said "as a CSR" (jargon most customers won't parse).

**Applied to the copy above.** Note the sentence was restructured, not just word-swapped: an administrative role doesn't by itself give hands-on experience with medical conditions, so the clause now attributes that to pet sitting and rescue, and treats the vet-practice experience as its own distinct credential — *seeing how veterinary care works from the inside*. That's both accurate and a stronger claim than the vague version it replaces.

- [x] "15 years" confirmed current
- [x] Vet role clarified

---

## ⚠️ Still open — the insurance claim

Edward's answer came back as:

> Carrier: "Rover" · Insurance: TBD

**Two things need untangling before this ships**, because the bio currently states *"background-check certified, and fully insured"* as fact.

### 1. Which claim does "Rover" answer?

The question bundled two things. Rover plausibly answers either:

- **Background check** — Rover screens sitters (via Checkr). If that's the source, the honest phrasing is *"background-checked through Rover."*
- **Insurance** — Rover does provide coverage to sitters on its platform.

Given "Insurance: TBD" sits right below it, **"Rover" most likely answers the background-check half** — but that's an inference, and it's a factual claim on a public website. Needs confirming.

### 2. If the insurance *is* through Rover — does it cover this website?

This is the one that matters. **Rover's sitter coverage generally applies only to bookings arranged through Rover.** A booking that comes in through his own site is typically outside it.

If that's the situation, then *"fully insured"* on this website would be inaccurate precisely where customers rely on it most — and the whole point of the site is to take bookings *off* Rover.

Not a wording problem. Either:

- He carries **independent** pet-sitter liability insurance (Pet Sitters Associates, Kennel Pro, Business Insurers of the Carolinas — all common for solo sitters, roughly $200–350/yr), and we name it; **or**
- He doesn't, and the site **must not claim to be insured**, however routine the phrase looks on a competitor's page.

**Until this is confirmed, leave "fully insured" out of any published draft.** Tracked as A3 in [`go-back-to-ed.md`](../go-back-to-ed.md).

---

## Notes for implementation

- The trailing emoji from `About me.png` (🐶🐱🐾) are dropped. They read as informal against the brand's heritage-serif visual language — fine for Instagram, wrong here.
- This page does more conversion work than it looks like it should. People hiring a pet sitter read it closely.
- Link `First Aid Certificate.pdf` from this page as proof of the CPR/First-Aid claim.
- Break the text with photos. Good candidates: `harry-and-i.jpg` and `my-son-harry-and-i.jpg` — Harry is Edward's own cat, and showing he's a pet owner himself builds trust.

---

<details>
<summary><strong>Archive — the two original drafts</strong></summary>

### Version A — `About me.png`

> Hi! I'm Edward, the owner and founder of **Edventures Pet Sitting**.
>
> Animals have always been a huge part of my life, and I bring **15 years of hands-on experience** caring for pets of all kinds. My experience includes pet sitting, animal rescue, and volunteering in veterinary clinics, giving me the opportunity to care for animals with a wide range of personalities, needs, medical conditions, and routines.
>
> I'm **CPR and First-Aid certified**, background-check certified, and fully insured because your pets deserve the same level of care and attention I would want for my own.
>
> At Edventures, I believe pet care is about more than simply feeding a pet or taking them for a walk. It's about building trust, keeping them comfortable and happy, and giving you peace of mind while you're away. Whether your pet is energetic, shy, anxious, elderly, or requires a little extra care, I take the time to get to know them as an individual.
>
> I'm proud to provide dependable, compassionate, and personalized pet care throughout Philadelphia—and I can't wait to meet you and your furry family! 🐶🐱🐾

### Version B — `AboutMe.jpeg`

> Hi, I'm Edward, founder of **Edventures Pet Sitting**. With 15 years of experience caring for cats and dogs, I'm dedicated to providing safe, reliable, and compassionate care for every pet I meet. My background includes work and volunteer experience in animal rescue, as well as veterinary medicine as a CSR, giving me a strong, well-rounded understanding of animal health and comfort.
>
> I'm CPR & First Aid certified and committed to treating every pet as if they were my own. Whether it's a drop-in visit, walk or jog, medication administration, nail trimming, or overnight care, I provide attentive, personalized service and peace of mind while you're away.

</details>
