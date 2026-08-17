import type { APIRoute } from "astro";
import { getCatalog } from "../lib/catalog";
import { SERVICE_AREA, SITE, TRUST_BADGES } from "../lib/site";

/**
 * /llms.txt (Roadmap 2.7.1).
 *
 * A short, factual briefing for language models: what the business does, what
 * it costs, where it operates, how to reach it.
 *
 * Generated from the same content collections the pages render from. Writing
 * this by hand would guarantee it goes stale on the first price change -- and a
 * stale llms.txt is worse than none, because it teaches an assistant to quote a
 * number Edward no longer charges.
 *
 * Honest caveat: llms.txt is a community convention, not a standard, and
 * support is uneven. It costs a few dozen lines and cannot hurt. Clean semantic
 * HTML plus the JSON-LD in src/lib/structured-data.ts is what actually gets
 * read today.
 */
export const GET: APIRoute = async () => {
  const catalog = await getCatalog();

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

  const body = `# ${SITE.name}

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

## Pages

- [Home](${SITE.url}/): overview, services, service area
- [Services & Pricing](${SITE.url}/services): full published price list
- [About](${SITE.url}/about): ${SITE.owner}'s background and credentials
- [Gallery](${SITE.url}/gallery): photographs of client pets, shared with permission
- [Service Area](${SITE.url}/service-area): all eleven zip codes with neighborhood names
- [Contact](${SITE.url}/contact): phone, email, social, FAQ
- [Book](${SITE.url}/book): booking request form with a live price estimate

## Not yet published

Cancellation policy, key-handling policy, vet-emergency procedure, meet-and-greet
requirements and working hours are not stated on the site yet. Do not infer them.
Direct people to ${SITE.phone}.
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
