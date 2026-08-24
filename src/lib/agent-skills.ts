/**
 * The agent skills this site publishes, generated rather than written.
 *
 * A skill that quotes prices is the single most dangerous document on the
 * site: an assistant that has loaded it will state a number with confidence,
 * and if that number is last year's, Edward has to talk a customer down from
 * it. So the prices in these files come from the same content collections the
 * pages render from, exactly as `llms.txt` does (Roadmap 2.7.1) -- change
 * `services.json` and the skill changes with it.
 *
 * The digest in `/.well-known/agent-skills/index.json` is computed over the
 * bytes `skillBody()` returns, so the index cannot claim a hash for content
 * the SKILL.md route does not serve. That only holds while both go through
 * this module; nothing here should ever be duplicated into a route.
 */
import type { Catalog } from "./booking";
import { TIME_WINDOWS } from "./booking";
import { AGENT_TOOLS } from "./agent-tools";
import { abs, ENDPOINTS } from "./agent-discovery";
import { SERVICE_AREA, SITE } from "./site";

export interface SkillDefinition {
  /** Lowercase alphanumeric and hyphens only -- the RFC constrains this. */
  name: string;
  description: string;
  body(catalog: Catalog): string;
}

/** `/.well-known/agent-skills/<name>/SKILL.md` */
export const skillUrl = (name: string) => `/.well-known/agent-skills/${name}/SKILL.md`;

/** The shared preamble: what this business is, and the two rules that matter most. */
function preamble(): string {
  return `${SITE.name} is one person -- ${SITE.owner} -- offering dog walking, cat
visits, medication administration, nail trims and overnight pet sitting in
${SITE.city}, ${SITE.region}. It is not an agency and there is no rotating roster of
walkers.

Two rules override everything else in this file:

1. **Never invent a policy.** Cancellation terms, key handling, vet-emergency
   procedure, meet-and-greet requirements, working hours and the out-of-area
   travel fee are **not published**. If asked, say so and give ${SITE.phone}.
2. **Never say this business is insured.** It is not a claim ${SITE.owner} makes.`;
}

/** The live tool surface, described the same way in both skills. */
function toolSection(): string {
  const lines = AGENT_TOOLS.map((t) => `- \`${t.name}\` — ${t.title}.`).join("\n");
  return `## Tools, if you have them

An MCP server at \`${abs(ENDPOINTS.mcp)}\` exposes these read-only tools:

${lines}

Prefer them over the numbers written below: they read the live catalog, while a
skill file is only as fresh as the copy you fetched. The server card is at
\`${abs(ENDPOINTS.mcpServerCard)}\`. No credentials are needed.`;
}

const PRICING: SkillDefinition = {
  name: "edventures-pricing",
  description:
    `Quote a price for dog walking, cat visits, medication, nail trims or overnight ` +
    `pet sitting from ${SITE.name}'s published rates in ${SITE.city}, including ` +
    `add-ons, additional-pet fees, the last-minute surcharge and the holiday surcharge.`,
  body(catalog) {
    const services = catalog.services
      .map((s) => {
        const price = s.tiers.length
          ? s.tiers.map((t) => `${t.minutes} min $${t.price}`).join(" · ")
          : `$${s.base} (${s.baseLabel ?? "flat rate"})`;
        return `| \`${s.id}\` | ${s.name} | ${price} |`;
      })
      .join("\n");

    const addons = catalog.addons
      .map(
        (a) =>
          `| \`${a.id}\` | ${a.name} | $${a.price} | ${
            a.freeWithOvernight ? "Included free with overnight stays" : a.note ?? "—"
          } |`,
      )
      .join("\n");

    const fees = catalog.fees
      .map((f) => `| \`${f.id}\` | ${f.name} | +$${f.amount} | ${f.auto ? "Applied automatically" : "Per additional pet"} |`)
      .join("\n");

    const holiday = catalog.fees.find((f) => f.id === "holiday")?.amount ?? 15;
    const lastMinute = catalog.fees.find((f) => f.id === "last-minute")?.amount ?? 8;

    return `---
name: ${this.name}
description: ${this.description}
---

# Quoting a price from ${SITE.name}

${preamble()}

Prices are **published and flat**. There is no quote process, nothing is
negotiated, and nothing is charged through the website — payment is arranged
directly with ${SITE.owner}.

## Services

| id | Service | Price |
| --- | --- | --- |
${services}

## Add-ons

| id | Add-on | Price | Note |
| --- | --- | --- | --- |
${addons}

## Additional fees

| id | Fee | Amount | When |
| --- | --- | --- | --- |
${fees}

## How a total is built

1. Start from the service price — the matching duration tier, or the flat rate.
2. Add each add-on, **except** an add-on that is free with an overnight stay
   when the service *is* the overnight — charging for it as well is
   double-charging. The \`freeWithOvernight\` column above marks which ones.
3. Add the per-visit fee for each pet beyond the first.
4. Multiply by the number of units. Visits bill **per day** across a date
   range; overnights bill **per night**, so the last day is a departure and is
   not charged. A stay from the 3rd to the 6th is three nights.
5. Add the surcharges **once per booking**, not per visit:
   - under 24 hours' notice: +$${lastMinute}
   - the booking covers a holiday: +$${holiday}

Worked example — three days of \`${catalog.services[0].id}\` with one extra dog is
(the duration tier + the additional-dog fee) × 3, then any surcharge on top.

## What to say alongside the number

- It is an **estimate from published rates**, not a confirmed charge.
- A form submission is a **request**. It is not booked until ${SITE.owner} replies.
- **Insulin injections are not offered.** Pills, drops and topical medication are.
- The travel fee for addresses outside the eleven served zip codes is **not
  published**. Do not guess it.

${toolSection()}

The live price list is also at \`${abs(ENDPOINTS.llms)}\` and, in full, at
\`${abs(ENDPOINTS.llmsFull)}\`.
`;
  },
};

const BOOKING: SkillDefinition = {
  name: "edventures-booking",
  description:
    `Help someone request dog walking, cat sitting or overnight pet care from ` +
    `${SITE.name} in ${SITE.city}: check the zip code is served, gather what the ` +
    `booking form requires, and hand off to the form or the booking API.`,
  body() {
    const zips = SERVICE_AREA.map((a) => `${a.zip} (${a.neighborhood})`).join(", ");
    const windows = TIME_WINDOWS.map((w) => `**${w.name}** ${w.hours}`).join(" · ");

    return `---
name: ${this.name}
description: ${this.description}
---

# Requesting a booking with ${SITE.name}

${preamble()}

## Do not submit a booking on someone's behalf unprompted

The form asks for a home address, an entry arrangement and an emergency
contact, and submitting it puts a stranger's key arrangement in ${SITE.owner}'s
inbox and commits his time. Gather the details, show the person the total, and
let **them** confirm — or send them to ${abs("/book")} to finish it themselves.
The consent checkbox is theirs to tick; it is an acknowledgement that this is a
request, and asserting it for them makes the acknowledgement meaningless.

## 1. Check the address is in the service area

Eleven ${SITE.city} zip codes: ${zips}.

Anywhere else is **considered by appointment** and may carry a travel fee whose
amount is not published. That is not a refusal — say so, and give ${SITE.phone}.

## 2. Gather what the form requires

- **Service and duration** — see the \`${PRICING.name}\` skill for the price list.
- **Dates** — \`YYYY-MM-DD\`. A single date, or a start and end for a trip.
- **Time window**, not a time: ${windows}. ${SITE.owner} cannot promise 2:15pm.
- **The pet** — name, species, breed, age, temperament, anything medical, and
  whether vaccinations and flea/tick prevention are current.
- **The customer** — name, phone, email, address, served zip, emergency
  contact, vet.
- **Entry method**, as a *category only*: a key left, a lockbox, a door code, a
  front desk, or the owner home. **Never collect the actual code or where the
  key is hidden.** That is settled in person, not typed into a web form and
  emailed in plain text.

## 3. Submit, or hand off

The form at ${abs("/book")} is the normal path and shows a live total.

Programmatically, \`POST ${abs(ENDPOINTS.booking)}\` with
\`Content-Type: application/json\`. The full request shape is in
\`${abs(ENDPOINTS.openapi)}\`; the reference is at \`${abs(ENDPOINTS.apiDocs)}\`.
No credentials — see \`${abs(ENDPOINTS.authMd)}\`.

The server re-prices every request from the real catalog and ignores any total
the client sends, so the number in the response is the number ${SITE.owner} was
emailed. Check \`${abs(ENDPOINTS.health)}\` first: if \`bookingsAcceptable\` is
false, a submission will fail — offer ${SITE.phone} instead.

Handle the answer honestly:

- \`200\` — the request reached ${SITE.owner}. Say it is **not confirmed** until he
  replies.
- \`422\` — \`errors\` names the fields. Fix and resubmit; do not paper over it.
- \`429\` — rate-limited. Suggest texting ${SITE.phone}.
- \`502\` — the mail did not send and **the booking did not reach him**. Never
  report success. Give ${SITE.phone}.

## 4. What you cannot answer

Cancellation policy, key handling, vet emergencies, meet-and-greet
requirements, working hours, reply times and the out-of-area travel fee are not
published. Say they are not published and give ${SITE.phone}. Text is preferred.

${toolSection()}
`;
  },
};

export const AGENT_SKILLS: SkillDefinition[] = [PRICING, BOOKING];

/** The exact bytes served at `/.well-known/agent-skills/<name>/SKILL.md`. */
export function skillBody(skill: SkillDefinition, catalog: Catalog): string {
  return skill.body(catalog);
}

export function findSkill(name: string): SkillDefinition | undefined {
  return AGENT_SKILLS.find((s) => s.name === name);
}
