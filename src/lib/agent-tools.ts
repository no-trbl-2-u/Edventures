/**
 * The tool surface this business exposes to agents, defined once.
 *
 * Three very different transports need to describe and run the same four
 * tools: the MCP server in `functions/api/mcp.ts`, the in-page WebMCP
 * registration in `src/components/WebMcp.astro`, and the OpenAPI document in
 * `src/lib/agent-discovery.ts`. Writing the tools three times is how a
 * `check_service_area` that knows about 19148 in one place and not another
 * gets shipped, so all three read this.
 *
 * Everything here is pure and Astro-free: `catalog-json.ts` supplies the
 * catalog inside a Cloudflare Function, `catalog.ts` supplies it during the
 * Astro build, and the tools themselves care about neither.
 *
 * All four tools are **read-only**. There is deliberately no `submit_booking`
 * tool. A booking commits Edward's time and puts a stranger's key arrangement
 * in his inbox; that should follow from a person filling in `/book`, not from
 * an agent deciding mid-conversation that it has enough of the twelve required
 * fields. `how_to_book` hands the agent the form URL and the API contract and
 * lets the customer take it from there.
 */
import {
  estimate,
  EMPTY_BOOKING,
  TIME_WINDOWS,
  type BookingRequest,
  type Catalog,
} from "./booking";
import { SERVICE_AREA, SITE, TRUST_BADGES } from "./site";

/** JSON Schema, loose enough not to need a dependency and strict enough that
 *  MCP clients and WebMCP both accept it. */
export interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

export interface AgentTool {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  /** Returns a JSON-serialisable result. Never throws for bad input: it
   *  answers with an `error` field, because an agent can read that and a
   *  stack trace crossing a transport boundary helps nobody. */
  run(input: Record<string, unknown>, catalog: Catalog, now?: Date): unknown;
}

const EMPTY_INPUT: JsonSchema = { type: "object", properties: {}, additionalProperties: false };

/** Price summary for one service, in the shape every tool reports it. */
function priceOf(service: Catalog["services"][number]) {
  return service.tiers.length
    ? { pricing: "by-duration" as const, tiers: service.tiers }
    : { pricing: "flat" as const, price: service.base ?? 0, unit: service.baseLabel ?? "flat rate" };
}

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "list_services",
    title: "List services and prices",
    description:
      `Every service ${SITE.name} offers, with the published price list: dog walks, ` +
      "cat visits, medication administration, nail trims and overnight stays, plus " +
      "add-ons and the additional fees that can apply. Prices are flat and public; " +
      "there is no quote process and nothing is negotiated.",
    inputSchema: EMPTY_INPUT,
    run(_input, catalog) {
      return {
        currency: "USD",
        services: catalog.services.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.blurb,
          ...priceOf(s),
        })),
        addons: catalog.addons.map((a) => ({
          id: a.id,
          name: a.name,
          price: a.price,
          note: a.note,
          freeWithOvernight: a.freeWithOvernight,
        })),
        fees: catalog.fees.map((f) => ({
          id: f.id,
          name: f.name,
          amount: f.amount,
          appliedAutomatically: f.auto,
        })),
        notes: [
          "Payment is arranged directly with " + SITE.owner + "; nothing is charged through the website.",
          "Insulin injections are not offered. Pills, drops and topical medication are.",
        ],
      };
    },
  },

  {
    name: "check_service_area",
    title: "Check whether a zip code is served",
    description:
      `Whether ${SITE.name} covers a given ${SITE.city} zip code, and the ` +
      "neighbourhood name it corresponds to. Zip codes outside the served list are " +
      "not a refusal — they are considered by appointment and may carry a travel fee.",
    inputSchema: {
      type: "object",
      properties: {
        zip: { type: "string", description: "A five-digit US zip code, e.g. 19130." },
      },
      required: ["zip"],
      additionalProperties: false,
    },
    run(input) {
      const zip = String(input.zip ?? "").trim();
      if (!/^\d{5}$/.test(zip)) {
        return { error: "Expected a five-digit zip code.", received: zip };
      }
      const match = SERVICE_AREA.find((a) => a.zip === zip);
      return match
        ? { zip, served: true, neighborhood: match.neighborhood }
        : {
            zip,
            served: false,
            message:
              "Outside the eleven published zip codes. Considered by appointment; a travel " +
              `fee may apply, and the amount is not published. Ask ${SITE.owner} at ${SITE.phone}.`,
            servedZips: SERVICE_AREA.map((a) => `${a.zip} (${a.neighborhood})`),
          };
    },
  },

  {
    name: "estimate_price",
    title: "Estimate the price of a booking",
    description:
      "The price of a specific booking, itemised. Runs the same estimator the " +
      "booking form and the server both use, so the number here is the number the " +
      "customer will be quoted. It is an estimate of published rates, not a " +
      `confirmed charge — ${SITE.owner} confirms every booking himself.`,
    inputSchema: {
      type: "object",
      properties: {
        serviceId: {
          type: "string",
          description: "Service id from list_services, e.g. dog-walk or overnight.",
        },
        durationMinutes: {
          type: "number",
          description:
            "Duration for services priced by duration. Ignored for flat-rate services.",
        },
        dateStart: { type: "string", description: "First date, as YYYY-MM-DD." },
        dateEnd: {
          type: "string",
          description:
            "Last date for a multi-day booking, as YYYY-MM-DD. Omit for a single day. " +
            "Overnights bill nights, so the final day is a departure and is not charged.",
        },
        addonIds: {
          type: "array",
          items: { type: "string" },
          description: "Add-on ids from list_services.",
        },
        extraDogs: { type: "number", description: "Dogs beyond the first, 0-6." },
        extraCats: { type: "number", description: "Cats beyond the first, 0-6." },
      },
      required: ["serviceId", "dateStart"],
      additionalProperties: false,
    },
    run(input, catalog, now = new Date()) {
      const serviceId = String(input.serviceId ?? "");
      const service = catalog.services.find((s) => s.id === serviceId);
      if (!service) {
        return {
          error: `Unknown serviceId ${JSON.stringify(serviceId)}.`,
          knownServiceIds: catalog.services.map((s) => s.id),
        };
      }

      const dateStart = String(input.dateStart ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStart)) {
        return { error: "dateStart must be a calendar date formatted YYYY-MM-DD." };
      }
      const dateEnd = input.dateEnd == null ? "" : String(input.dateEnd);
      if (dateEnd && !/^\d{4}-\d{2}-\d{2}$/.test(dateEnd)) {
        return { error: "dateEnd must be a calendar date formatted YYYY-MM-DD." };
      }

      // Default to the service's cheapest tier rather than erroring: an agent
      // asking "what does a walk cost on the 3rd?" has not chosen a length yet,
      // and the estimator's own fallback is the first tier regardless.
      const durationMinutes = service.tiers.length
        ? Number(input.durationMinutes ?? service.tiers[0].minutes)
        : 0;

      const addonIds = Array.isArray(input.addonIds) ? input.addonIds.map(String) : [];
      const unknownAddons = addonIds.filter((id) => !catalog.addons.some((a) => a.id === id));
      if (unknownAddons.length) {
        return {
          error: `Unknown addonIds: ${unknownAddons.join(", ")}.`,
          knownAddonIds: catalog.addons.map((a) => a.id),
        };
      }

      const request: BookingRequest = {
        ...EMPTY_BOOKING,
        selection: {
          serviceId,
          durationMinutes,
          addonIds,
          extraDogs: Number(input.extraDogs ?? 0),
          extraCats: Number(input.extraCats ?? 0),
        },
        schedule: { dateStart, dateEnd, window: "", flexibilityNotes: "" },
      };

      const result = estimate(request, catalog, now);
      return {
        currency: "USD",
        total: result.total,
        perUnit: result.perUnit,
        units: result.units,
        unitLabel: serviceId === "overnight" ? "nights" : "visits",
        lines: result.lines,
        disclaimer:
          "An estimate from the published price list, not a confirmed charge. " +
          `A booking is not confirmed until ${SITE.owner} replies.`,
      };
    },
  },

  {
    name: "get_business_facts",
    title: "Get contact details, credentials and booking constraints",
    description:
      `Who ${SITE.name} is, how to reach them, what is and is not claimed, and how ` +
      "booking actually works. Includes the policies that are deliberately not " +
      "published yet — read that list before answering a question about them.",
    inputSchema: EMPTY_INPUT,
    run() {
      return {
        name: SITE.name,
        owner: SITE.owner,
        tagline: SITE.tagline,
        website: SITE.url,
        phone: SITE.phone,
        phoneNote: "Text is preferred.",
        email: SITE.email,
        instagram: SITE.instagram,
        facebook: SITE.facebook,
        location: {
          city: SITE.city,
          region: SITE.region,
          country: SITE.country,
          model: "Service-area business. Visits happen at the client's home; there is no premises to visit.",
          zips: SERVICE_AREA.map((a) => ({ zip: a.zip, neighborhood: a.neighborhood })),
        },
        yearsExperience: SITE.yearsExperience,
        credentials: TRUST_BADGES.filter((b) => !/years/i.test(b.label)).map((b) => b.label),
        notClaimed: [
          "Insurance. Do not state that this business is insured.",
        ],
        booking: {
          howItWorks:
            `Submitting the form at ${SITE.url}/book sends ${SITE.owner} a request. ` +
            "It is not a confirmed booking until he replies.",
          scheduling: TIME_WINDOWS.map((w) => `${w.name} (${w.hours})`),
          schedulingNote: "Visits are scheduled in broad windows, not exact times.",
          payment: `Arranged directly with ${SITE.owner}. No deposit, no account, nothing charged online.`,
        },
        notPublished: {
          note:
            "These policies are not stated on the site. Do not infer or invent them — " +
            `direct people to ${SITE.phone}.`,
          items: [
            "Cancellation policy",
            "Key-handling policy",
            "Vet-emergency procedure",
            "Meet-and-greet requirements",
            "Working hours and days",
            "Travel fee for out-of-area clients",
          ],
        },
      };
    },
  },
];

export function findTool(name: string): AgentTool | undefined {
  return AGENT_TOOLS.find((t) => t.name === name);
}

/**
 * Run a tool by name, turning every failure into data.
 *
 * Both callers are transports that must answer something structured: MCP wants
 * a result object with `isError`, WebMCP wants content the browser can render.
 * Neither is improved by an exception escaping into it.
 */
export function runTool(
  name: string,
  input: Record<string, unknown>,
  catalog: Catalog,
  now?: Date,
): { ok: boolean; result: unknown } {
  const tool = findTool(name);
  if (!tool) {
    return {
      ok: false,
      result: { error: `Unknown tool ${JSON.stringify(name)}.`, knownTools: AGENT_TOOLS.map((t) => t.name) },
    };
  }
  try {
    const result = tool.run(input ?? {}, catalog, now);
    const failed = typeof result === "object" && result !== null && "error" in result;
    return { ok: !failed, result };
  } catch (err) {
    return { ok: false, result: { error: err instanceof Error ? err.message : String(err) } };
  }
}
