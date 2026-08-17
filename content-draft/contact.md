---
source: starting-assets/Contact us.jpg (REMOVED — see note)
status: unverified
---

> **This file is now the only record of that content.**
> `Contact us.jpg` was deleted because its email address was misspelled. The details below were transcribed before removal, with the spelling corrected. The original is still recoverable from git history at commit `d300fbd` if it's ever needed.

# Contact

## ⚠️ Verification checklist

- [ ] Phone: `610-888-4541` — check every digit
- [ ] Confirm this number accepts SMS from unknown numbers
- [ ] Confirm Edward wants this number published publicly
- [ ] Email: `edventurespetsitting@gmail.com` — **see the typo note below**
- [ ] Social handle: `@edventurespetsitting` on both Instagram and Facebook

---

**Text:** 610-888-4541

**Email:** edventurespetsitting@gmail.com

**Instagram / Facebook:** @edventurespetsitting

---

## ✅ Email typo — resolved by deleting the source image

`Contact us.jpg` read:

```
edventurespetitting@gmail.com
```

Missing the `s` in "sitting" — `pe-titting` rather than `pet-sitting`. Anyone typing that address off the image would have sent mail into the void.

Every other asset (`Flyer.png`, `Price list.jpg`) reads correctly:

```
edventurespetsitting@gmail.com
```

**Resolution:** TJ removed the image from `starting-assets/` rather than correcting it, since its content is fully captured here and the file's only unique contribution was the error.

**Still worth checking with Edward:** whether that image was ever posted to Instagram or Facebook, or printed. Deleting our copy doesn't recall the ones already in circulation — and that's where the actual lost inquiries would come from. Tracked as F1 in [`../go-back-to-ed.md`](../go-back-to-ed.md).

---

## Notes for implementation

- Phone must be a `tel:` link on mobile — `tel:+16108884541`. One tap to text converts better than any form for some customers.
- The 610 area code is suburban PA rather than Philadelphia's 215/267. That's fine and common, but worth confirming it's the business line Edward wants public.
- Email should be a `mailto:` link.
- Consider light obfuscation of the email address against scrapers, but never at the cost of it being selectable and copyable.

<!-- VERIFY: The source image lists Text and Email only - no phone-call option. Confirm whether Edward takes voice calls, or text only. This changes the CTA wording ("Text us" vs "Call or text us"). -->
