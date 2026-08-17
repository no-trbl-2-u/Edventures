---
source: starting-assets/ — every image opened and described
status: verified — alt text observed, not inferred
---

# Photo captions & alt text

**All 21 photos have been opened and described from what's actually in them.** The earlier filename-inferred draft has been replaced — it was wrong in at least one case (see `proud-cat-dad`).

---

## ⚠️ EXIF orientation — read before building the image pipeline

Eight photos carry an **EXIF orientation tag**. They are *not* broken: browsers apply EXIF rotation automatically, so they display correctly on a web page as-is.

**The hazard is the optimization step.** Many resize pipelines read raw pixels and discard EXIF, which bakes in the wrong rotation — the images would come out sideways *after* processing, having looked fine before.

| File | EXIF orientation |
|---|---|
| `Kisses from Jackie.jpeg` | Rotate 90° CW |
| `Kisses from Tecate.jpeg` | Rotate 90° CW |
| `Me & Regina.jpeg` | Rotate 90° CW |
| `Me & Taco.jpeg` | Rotate 90° CW |
| `Me and Goy Pouting.jpeg` | Rotate 90° CW |
| `Proud Cat Dad.jpeg` | Rotate 90° CW |
| `Selfie with Tecate.jpeg` | Rotate 90° CW |
| `ME and Clancy.jpeg` | Rotate 180° |
| `Stellaluna and I.jpeg` | Rotate 180° |

**Required:** whatever resizes these must *apply* EXIF rotation, then strip the tag. In `sharp`, a bare `.rotate()` with no argument does exactly this. Verify visually after processing — this class of bug is invisible until someone looks.

*(`Cuddling with Auggy.jpg` and `Playing with Xenon.jpg` have no EXIF block at all — fine, they're already upright.)*

---

## The animals

Names come from the filenames; species and appearance are observed.

| Name | Animal |
|---|---|
| Jackie | Black Labrador |
| Auggy | Beagle/hound, tan and white |
| Zoe | Cream chihuahua — **see note below** |
| Xenon | Large black dog, boxer/cane corso type |
| Taco | Tan chihuahua |
| Clancy | Brown dog, pit/lab type |
| Goy | Long-haired chihuahua or papillon, brown and white |
| Harry | **Edward's own cat** — grey/brown tabby |
| Hubert | Orange and white tabby cat |
| Stellaluna | Grey tabby cat |
| Tecate | Fluffy grey and white cat |
| Regina | Orange tabby cat |
| Angel | Tabby/calico cat — **now passed away** |

---

## The photos

| # | Original | Slug | Caption | Alt text (observed) |
|---|---|---|---|---|
| 1 | `Smooches.JPG` | `smooches.jpg` | Smooches | Edward in a grey hoodie, eyes closed, kissing the head of a tan-and-white speckled hound who is curled against his chest |
| 2 | `Stellaluna at the Park.JPG` | `stellaluna-at-the-park.jpg` | Stellaluna at the park | Edward in sunglasses holding Stellaluna, a grey tabby cat, on the grass at Rittenhouse Square, city buildings behind them |
| 3 | `Zoe and I.jpg` | `zoe-and-i.jpg` | Zoe and I | Edward holding Zoe, a small cream chihuahua in a blue harness, outside Penn Medicine Rittenhouse |
| 4 | `Jackie and I.jpg` | `jackie-and-i.jpg` | Jackie and I | Edward cheek to cheek with Jackie, a black Labrador with her tongue out, on a sofa by a sunlit window |
| 5 | `Cuddling with Auggy.jpg` | `cuddling-with-auggy.jpg` | Cuddling with Auggy | Auggy, a tan and white hound, asleep across Edward's lap while he strokes her head |
| 6 | `My son Harry and I.jpg` | `my-son-harry-and-i.jpg` | My son Harry | Edward holding Harry, a large grey tabby cat, in a bright room with framed art and a trailing houseplant |
| 7 | `Harry and I.jpg` | `harry-and-i.jpg` | Harry and I | Edward in a maroon cap on a sofa beside Harry, a grey tabby cat stretched out on the cushion next to him |
| 8 | `My godchild Hubert.jpeg` | `hubert.jpg` | My godchild Hubert | Edward leaning in to kiss Hubert, an orange and white tabby cat perched against his shoulder |
| 9 | `Angel and I, RIP.jpg` | `angel-and-i.jpg` | Angel | Edward in a pink backwards cap, eyes closed, holding Angel, a tabby and white cat, against his cheek |
| 10 | `ME and Stellaluna.JPG` | `me-and-stellaluna.jpg` | Stellaluna and I | Edward holding Stellaluna, a grey tabby cat, against his chest indoors |
| 11 | `Stellaluna and I.jpeg` | `stellaluna-and-i.jpg` | Stellaluna and I | Edward lying on a blue blanket beside Stellaluna, a grey tabby cat, both looking up at the camera |
| 12 | `Kisses from Tecate.jpeg` | `kisses-from-tecate.jpg` | Kisses from Tecate | Tecate, a fluffy grey and white cat, pressing her nose to Edward's face in a wood-panelled room |
| 13 | `Selfie with Tecate.jpeg` | `selfie-with-tecate.jpg` | Selfie with Tecate | Edward grinning next to Tecate, a fluffy grey and white cat, who is looking straight at the camera |
| 14 | `Me & Regina.jpeg` | `me-and-regina.jpg` | Regina and I | Edward kissing the head of Regina, an orange tabby cat draped over his arm |
| 15 | `Me & Taco.jpeg` | `me-and-taco.jpg` | Taco and I | Taco, a small tan chihuahua, resting on Edward's shoulder and leaning against his head |
| 16 | `Playing with Xenon.jpg` | `playing-with-xenon.jpg` | Playing with Xenon | Xenon, a large black dog, gripping one end of a rope toy in a play bow while Edward holds the other end |
| 17 | `A fun day with Cows.jpeg` | `a-fun-day-with-cows.jpg` | A fun day with cows | Edward in sunglasses beside a black and white horned cow leaning over a fence in a green field |
| 18 | `Proud Cat Dad.jpeg` | `proud-cat-dad.jpg` | Proud cat dad | Edward wearing a black cap embroidered "CAT DAD," standing on a tree-lined Philadelphia street |
| 19 | `Me and Goy Pouting.jpeg` | `me-and-goy-pouting.jpg` | Goy, pouting | Edward beside Goy, a long-haired brown and white chihuahua wearing a pink collar, in a dimly lit room |
| 20 | `ME and Clancy.jpeg` | `me-and-clancy.jpg` | Clancy and I | Edward outdoors with Clancy, a brown dog in a pink collar, mid-motion and out of focus |
| 21 | `Kisses from Jackie.jpeg` | `kisses-from-jackie.jpg` | Kisses from Jackie | Jackie, a black Labrador, licking a person's face on a sofa |

---

## Correction from the inferred draft

**`Proud Cat Dad.jpeg` contains no cat.** The earlier filename-inferred alt text said "Edward holding a cat." It's actually Edward alone on a Philadelphia street wearing a hat that reads "CAT DAD."

A screen-reader user would have been told to expect an animal that isn't there. Worth noting as the concrete reason filename-derived alt text isn't safe to ship.

---

## Curation for the gallery

Not all 21 should go in. Ranked by what they do for the site:

### Lead with these

- **`smooches.jpg`** — the best photograph in the set by some margin. Soft natural light, genuine tenderness, clean composition. **Strong hero candidate for the home page.**
- **`stellaluna-at-the-park.jpg`** — visibly Rittenhouse Square. Proves *Philadelphia* better than any copy could, and a cat happily outdoors reads as real competence.
- **`zoe-and-i.jpg`** — Penn Medicine Rittenhouse is legible in the background. More local proof, and a working-day feel.
- **`jackie-and-i.jpg`** — warm, sharp, cheerful. Easy crowd-pleaser.

### About page

- **`my-son-harry-and-i.jpg`** and **`harry-and-i.jpg`** — Harry is Edward's own cat. A sitter who's visibly a devoted pet owner is more persuasive than one who only appears with clients' animals.
- **`proud-cat-dad.jpg`** — personality, and the only photo that reads as "him," not "him with an animal." Useful as a small portrait.

### Fine for the gallery

`cuddling-with-auggy.jpg`, `hubert.jpg`, `me-and-regina.jpg`, `me-and-taco.jpg`, `playing-with-xenon.jpg`, `kisses-from-tecate.jpg`, `selfie-with-tecate.jpg`, `me-and-stellaluna.jpg`, `stellaluna-and-i.jpg`

### Recommend leaving out

- **`me-and-clancy.jpg`** — badly out of focus. Poor quality reads as carelessness, and there are 20 better options.
- **`kisses-from-jackie.jpg`** — blurry, awkwardly framed, and the person in it may not even be Edward. `jackie-and-i.jpg` shows the same dog far better.
- **`me-and-goy-pouting.jpg`** — very dim and muddy. Lovely if Edward can find a brighter shot of Goy.
- **`a-fun-day-with-cows.jpg`** — genuinely charming, but cows aren't the service. Possibly a fun About-page aside; it would only confuse a gallery of client pets.

---

## Two things for Edward

### Zoe's eye

In `Zoe and I.jpg`, Zoe's left eye appears closed or absent. **I'm not confident enough from one photo to describe it**, and getting it wrong in alt text would be worse than staying general.

- [ ] Confirm with Edward. If Zoe is a special-needs dog, that's a meaningful trust signal — clients with elderly or disabled pets look hard for a sitter who's handled it. Worth mentioning with her owner's blessing, and worth describing plainly rather than tiptoeing.
- [ ] If not, the current neutral alt text stands as written.

### Angel

`Angel and I, RIP.jpg` is a tender photograph — Edward's eyes closed, holding her to his cheek. Placement is still his call (E1 in `go-back-to-ed.md`). Having now seen it: it's far better suited to a deliberate spot in his story than to a grid of client photos.

The slug drops the `, RIP` — a public URL ending in `rip` is the wrong register.

---

## Implementation notes

- Alt text above describes the image; captions name the animal. They shouldn't duplicate each other.
- Photos are candid and mixed-aspect. The gallery must flatter imperfect phone photos rather than demand studio ones.
- Pipeline: apply EXIF rotation → strip EXIF → resize (1600px gallery / 800px inline / 400px thumb) → WebP with JPEG fallback → target under 200KB.
- **Stripping EXIF also removes GPS coordinates.** Several of these were taken at clients' homes. Do not publish location metadata.
