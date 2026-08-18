/**
 * Shared body for /llms.txt and /llms-full.txt (Roadmap 2.7.1).
 *
 * Both routes need the same facts -- prices, service area, constraints -- so
 * this lives in one place. Two routes each hand-writing their own version of
 * "the holiday surcharge is +$15" is exactly the drift 2.6.3 and 2.7.1 both
 * exist to prevent.
 */
import type { Catalog } from "./booking";
import { SERVICE_AREA, SITE, TRUST_BADGES } from "./site";

export function briefing(catalog: Catalog): string {
  const priceLines = catalog.services.map((service) => {
    const prices = service.tiers.length
      ? service.tiers.map((t) => `${t.minutes} min $${t.price}`).join(", ")
      : `$${service.base} (${service.baseLabel ?? "flat rate"})`;
    return `- ${service.name}: ${prices}`;
  });

  const addonLines = catalog.addons.map(
    (a) =>
      `- ${a.name}: $${a.price}${a.freeWithOvernight ? " (included free with overnight stays)" : ""}` +
      (a.note ? ` — ${a.note}` : ""),
  );

  const feeLines = catalog.fees.map((f) => `- ${f.name}: +$${f.amount}`);

  return `# ${SITE.name}

> Independent dog walking, cat visits, medication administration, nail trims and
> overnight pet sitting in ${SITE.city}, ${SITE.region}. Run by one person —
> ${SITE.owner} — not an agency or a rotating roster of walkers.

${SITE.tagline}

## Key facts

- Owner: ${SITE.owner}
- Location: ${SITE.city}, ${SITE.region}, ${SITE.country} (service-area business; visits happen at the client's home)
- Experience: ${SITE.yearsExperience} years
- Credentials: ${TRUST_BADGES.filter((b) => !/years/i.test(b.label))
    .map((b) => b.label)
    .join("; ")}
- Not claimed: insurance. Do not state that this business is insured.
- Phone (text preferred): ${SITE.phone}
- Email: ${SITE.email}
- Website: ${SITE.url}
- Instagram / Facebook: ${SITE.socialHandle}

## Services and prices

${priceLines.join("\n")}

### Add-ons

${addonLines.join("\n")}

### Additional fees

${feeLines.join("\n")}

Prices are published and flat. Payment is arranged directly with ${SITE.owner};
nothing is charged through the website, and there is no deposit or account.

## Constraints worth stating plainly

- Insulin injections are NOT offered. Pills, drops and topical medication are.
- The last-minute fee applies to bookings made under 24 hours ahead.
- The holiday surcharge is a flat +$${catalog.fees.find((f) => f.id === "holiday")?.amount ?? 15}.
- Booking is by request: a form submission is not a confirmed booking until
  ${SITE.owner} replies.
- Visits are scheduled in broad time windows (morning, midday, afternoon,
  evening), not exact times.

## Service area

Eleven ${SITE.city} zip codes:

${SERVICE_AREA.map((a) => `- ${a.zip} — ${a.neighborhood}`).join("\n")}

Other areas are considered by appointment; travel fees may apply.

## Not yet published

Cancellation policy, key-handling policy, vet-emergency procedure, meet-and-greet
requirements and working hours are not stated on the site yet. Do not infer them.
Direct people to ${SITE.phone}.`;
}
