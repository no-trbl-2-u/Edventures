---
source: starting-assets/ filenames
status: unverified — ALT TEXT IS INFERRED, NOT OBSERVED
---

# Photo captions & alt text

## ⚠️ Read this first

**The alt text below was inferred from filenames, not from looking at the photos.** It is a starting point for editing, not a description of what's actually in each image.

Before shipping, someone must open each photo and confirm the alt text describes what's really there. Wrong alt text is worse than none — it actively misleads screen-reader users.

- [ ] Open each photo and correct its alt text
- [ ] Confirm the caption reads well publicly
- [ ] Decide which photos make the gallery (not all 21 need to)
- [ ] Resolve the "Harry" and "Hubert" question below

---

## Why the filenames matter

The original filenames carry the captions — they're the only record of each animal's name. **Capture that before renaming destroys it.** That's what this file is for.

## Renaming rules (Phase 0.5)

- Lowercase, hyphens, no spaces, no ampersands
- **Normalize `.JPG` → `.jpg`.** Case-sensitive Linux hosts will 404 on a mismatch — this bites three files below.

---

## The photos

| # | Original filename | New slug | Draft caption | Inferred alt text |
|---|---|---|---|---|
| 1 | `A fun day with Cows.jpeg` | `a-fun-day-with-cows.jpg` | A fun day with cows | ⚠️ Edward with cows — **verify: is this a farm visit, or a dog named Cows?** |
| 2 | `Angel and I, RIP.jpg` | `angel-and-i.jpg` | Angel | ⚠️ Edward with Angel — **see memorial note below** |
| 3 | `Cuddling with Auggy.jpg` | `cuddling-with-auggy.jpg` | Cuddling with Auggy | Edward cuddling with Auggy |
| 4 | `Harry and I.jpg` | `harry-and-i.jpg` | Harry and I | ⚠️ **see "Harry" note below** |
| 5 | `Jackie and I.jpg` | `jackie-and-i.jpg` | Jackie and I | Edward with Jackie |
| 6 | `Kisses from Jackie.jpeg` | `kisses-from-jackie.jpg` | Kisses from Jackie | Jackie licking Edward's face |
| 7 | `Kisses from Tecate.jpeg` | `kisses-from-tecate.jpg` | Kisses from Tecate | Tecate licking Edward's face |
| 8 | `ME and Clancy.jpeg` | `me-and-clancy.jpg` | Clancy and I | Edward with Clancy |
| 9 | `ME and Stellaluna.JPG` | `me-and-stellaluna.jpg` | Stellaluna and I | Edward with Stellaluna |
| 10 | `Me & Regina.jpeg` | `me-and-regina.jpg` | Regina and I | Edward with Regina |
| 11 | `Me & Taco.jpeg` | `me-and-taco.jpg` | Taco and I | Edward with Taco |
| 12 | `Me and Goy Pouting.jpeg` | `me-and-goy-pouting.jpg` | Goy, pouting | Edward with Goy, who is pouting |
| 13 | `My godchild Hubert.jpeg` | `hubert.jpg` | Hubert | ⚠️ **see "Hubert" note below** |
| 14 | `My son Harry and I.jpg` | `my-son-harry-and-i.jpg` | Harry and I | ⚠️ **see "Harry" note below** |
| 15 | `Playing with Xenon.jpg` | `playing-with-xenon.jpg` | Playing with Xenon | Edward playing with Xenon |
| 16 | `Proud Cat Dad.jpeg` | `proud-cat-dad.jpg` | Proud cat dad | Edward holding a cat |
| 17 | `Selfie with Tecate.jpeg` | `selfie-with-tecate.jpg` | Selfie with Tecate | Selfie of Edward with Tecate |
| 18 | `Smooches.JPG` | `smooches.jpg` | Smooches | Edward being kissed by a pet |
| 19 | `Stellaluna and I.jpeg` | `stellaluna-and-i.jpg` | Stellaluna and I | Edward with Stellaluna |
| 20 | `Stellaluna at the Park.JPG` | `stellaluna-at-the-park.jpg` | Stellaluna at the park | Stellaluna at a park |
| 21 | `Zoe and I.jpg` | `zoe-and-i.jpg` | Zoe and I | Edward with Zoe |

**Uppercase-extension files (must be normalized):** #9, #18, #20.

**Duplicate-subject candidates:** #9 and #19 are both "Stellaluna and I" — likely near-duplicates. Compare and keep the better one. #4 and #14 may also overlap.

---

## Flags needing Edward's input

### "Harry" — pet or person?

Two files: `Harry and I.jpg` and `My son Harry and I.jpg`. "My son" suggests either a human child or an affectionate term for his own pet.

- [ ] If Harry is a **human child**, these almost certainly should not go in a public gallery of client work.
- [ ] If Harry is **Edward's own pet**, they're great About-page material — showing he's a pet owner himself builds trust.

### "Hubert" — godchild?

`My godchild Hubert.jpeg` — same question. "Godchild" suggests a person, but is also a common affectionate term for a friend's pet.

- [ ] Confirm before publishing.

### `Angel and I, RIP.jpg` — memorial photo

The filename indicates Angel has passed away.

TJ has confirmed Edward has permission for all client pets shown. This flag is not about permission — it's about **placement**. A memorial photo on a sales page can land wrong, and it may be painful for the family to encounter unexpectedly.

- [ ] Edward's call. Options: leave it out; include it in the gallery unremarked; or give it an intentional spot on the About page as part of his story. The middle option is the one to avoid — it's the only one that reads as careless.
- [ ] Note the slug drops the `, RIP` — a public URL ending in `rip` is not the right register.

---

## Notes for implementation

- Alt text should describe the image, not repeat the caption. If the caption already says "Kisses from Jackie," the alt can be `Jackie, a golden retriever, licking Edward's face` — once someone has actually looked.
- These are candid phone photos of mixed quality and aspect ratio. The gallery design must flatter imperfect photos rather than demand studio ones (see `design.prompt.md` §8).
- Every photo needs the Phase 0.5 pipeline: WebP + JPEG fallback, max 1600px, under 200KB.
