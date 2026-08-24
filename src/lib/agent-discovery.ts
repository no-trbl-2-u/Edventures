/**
 * Every machine-readable discovery document the site publishes, built here.
 *
 * There are six of them -- an RFC 9727 API catalog, an ARD capability
 * manifest, an MCP server card, an agent-skills index, an OpenAPI description
 * and the `Link` header set -- and they all describe the *same* handful of
 * URLs. Written separately, they drift: the api-catalog keeps pointing at
 * `/openapi.json` after the OpenAPI document moves, or the ARD manifest
 * advertises an MCP endpoint that was renamed a release ago. So the URLs are
 * declared once in `ENDPOINTS` and every document reads from it.
 *
 * The same rule the rest of the codebase follows applies here: nothing is
 * hand-written that could be derived. Prices in the OpenAPI examples come from
 * the content collections, the tool list comes from `agent-tools.ts`, and the
 * skill digests are computed over the exact bytes the skill routes serve.
 *
 * Astro-free on purpose. The Astro routes call these at build time; the
 * Cloudflare Function in `functions/api/mcp.ts` calls `mcpServerCard()` at
 * request time. Neither may need `astro:content` to be in scope.
 */
import { AGENT_TOOLS } from "./agent-tools";
import { markdownTwin } from "./markdown-negotiation";
import type { Catalog } from "./booking";
import { SERVICE_AREA, SITE } from "./site";

/**
 * The version reported by the MCP server and its card.
 *
 * Bumped by hand, deliberately. It describes the *tool contract*, not the
 * site: adding a tool or changing an input schema is a version change, and
 * rewording a paragraph on /about is not.
 */
export const MCP_SERVER_VERSION = "1.0.0";

/** Every URL an agent might be pointed at, resolved against the canonical origin. */
export const ENDPOINTS = {
  /** Streamable-HTTP MCP endpoint (`functions/api/mcp.ts`). */
  mcp: "/api/mcp",
  /** Booking submission (`functions/api/booking.ts`). */
  booking: "/api/booking",
  /** Liveness plus "can this site actually take a booking right now". */
  health: "/api/health",
  /** OpenAPI 3.1 description of the three above. */
  openapi: "/openapi.json",
  /** Human-readable API reference. */
  apiDocs: "/docs/api",
  /** RFC 9727 catalog. */
  apiCatalog: "/.well-known/api-catalog",
  /** ARD capability manifest. */
  ardCatalog: "/.well-known/ai-catalog.json",
  /** SEP-1649 MCP server card. */
  mcpServerCard: "/.well-known/mcp/server-card.json",
  /** Agent Skills Discovery index. */
  agentSkills: "/.well-known/agent-skills/index.json",
  /** Agent-registration and credential policy. */
  authMd: "/auth.md",
  /** The llms.txt pair. */
  llms: "/llms.txt",
  llmsFull: "/llms-full.txt",
} as const;

/** Absolute form of any path in `ENDPOINTS`, or of any site-relative path. */
export const abs = (path: string): string => new URL(path, SITE.url).href;

/* ------------------------------------------------------------------ *
 * RFC 9727 -- /.well-known/api-catalog
 * ------------------------------------------------------------------ */

/**
 * The API catalog, as an RFC 9264 linkset.
 *
 * Two anchors, because the site genuinely has two APIs with different shapes:
 * a JSON booking endpoint and an MCP endpoint. Both point at the same OpenAPI
 * document and the same health check; only the MCP anchor carries the server
 * card, via `describedby`.
 */
export function apiCatalog() {
  const openapi = [
    { href: abs(ENDPOINTS.openapi), type: "application/vnd.oai.openapi+json" },
  ];
  const docs = [{ href: abs(ENDPOINTS.apiDocs), type: "text/html" }];
  const status = [{ href: abs(ENDPOINTS.health), type: "application/json" }];

  return {
    linkset: [
      {
        anchor: abs(ENDPOINTS.booking),
        "service-desc": openapi,
        "service-doc": docs,
        status,
        author: [{ href: abs("/contact"), type: "text/html", title: SITE.name }],
      },
      {
        anchor: abs(ENDPOINTS.mcp),
        "service-desc": openapi,
        "service-doc": docs,
        status,
        describedby: [{ href: abs(ENDPOINTS.mcpServerCard), type: "application/json" }],
        author: [{ href: abs("/contact"), type: "text/html", title: SITE.name }],
      },
    ],
  };
}

/* ------------------------------------------------------------------ *
 * ARD -- /.well-known/ai-catalog.json
 * ------------------------------------------------------------------ */

/**
 * The ARD capability manifest.
 *
 * `representativeQueries` are the point of this document: registries embed
 * them to decide whether this site can answer a question at all. So they are
 * written as the things people actually ask -- "how much is a 30 minute dog
 * walk in Fairmount" -- rather than as descriptions of the endpoint.
 */
export function ardCatalog() {
  const fqdn = new URL(SITE.url).hostname;
  const urn = (namespace: string, name: string) => `urn:air:${fqdn}:${namespace}:${name}`;

  return {
    specVersion: "1.0",
    host: {
      displayName: SITE.name,
      identifier: `did:web:${fqdn}`,
      description:
        `Independent dog walking, cat visits, medication administration, nail trims ` +
        `and overnight pet sitting in ${SITE.city}, ${SITE.region}.`,
      url: SITE.url,
    },
    entries: [
      {
        identifier: urn("server", "pet-sitting"),
        displayName: `${SITE.name} MCP server`,
        description:
          "Read-only tools for the published price list, the served zip codes, an " +
          "itemised price estimate, and the business facts an assistant needs to " +
          "answer accurately.",
        type: "application/mcp-server-card+json",
        url: abs(ENDPOINTS.mcpServerCard),
        representativeQueries: [
          `how much does a 30 minute dog walk cost in ${SITE.city}`,
          "do they walk dogs in Fairmount 19130",
          "what would three nights of overnight pet sitting come to",
          "is there a holiday surcharge for pet sitting",
        ],
      },
      {
        identifier: urn("api", "booking"),
        displayName: `${SITE.name} booking API`,
        description:
          "Submits a booking request. A request is not a confirmed booking until " +
          `${SITE.owner} replies. Public; no credentials.`,
        type: "application/vnd.oai.openapi+json",
        url: abs(ENDPOINTS.openapi),
        representativeQueries: [
          "book a dog walker in Philadelphia",
          "request a cat sitting visit next weekend",
          "arrange overnight pet care while I travel",
        ],
      },
      {
        identifier: urn("doc", "briefing"),
        displayName: `${SITE.name} briefing for language models`,
        description:
          "Prices, service area, credentials and the constraints worth stating " +
          "plainly -- including the policies that are deliberately not published " +
          "yet and must not be inferred.",
        type: "text/plain",
        url: abs(ENDPOINTS.llmsFull),
        representativeQueries: [
          `who walks dogs in Rittenhouse ${SITE.city}`,
          "what pet sitting services are available near Queen Village",
          "is this pet sitter certified in pet first aid",
        ],
      },
      {
        identifier: urn("skills", "index"),
        displayName: `${SITE.name} agent skills`,
        description:
          "Task-shaped instructions for quoting a price from the published list and " +
          "for walking a customer through a booking request.",
        type: "application/json",
        url: abs(ENDPOINTS.agentSkills),
        representativeQueries: [
          "quote a pet sitting price from the published rates",
          "help me book a dog walk step by step",
        ],
      },
    ],
  };
}

/* ------------------------------------------------------------------ *
 * SEP-1649 -- /.well-known/mcp/server-card.json
 * ------------------------------------------------------------------ */

/**
 * The MCP server card.
 *
 * The tool list is inlined from `agent-tools.ts` rather than summarised: a
 * client that reads the card should not have to open a session to find out
 * whether this server can price an overnight stay.
 */
export function mcpServerCard() {
  return {
    $schema: "https://schema.modelcontextprotocol.io/json-schemas/server-card-1.0.json",
    serverInfo: {
      name: "edventures-pet-sitting",
      title: SITE.name,
      version: MCP_SERVER_VERSION,
      websiteUrl: SITE.url,
      description:
        `Read-only tools over the published price list, service area and booking ` +
        `constraints of ${SITE.name}, an independent pet sitter in ${SITE.city}, ` +
        `${SITE.region}.`,
    },
    transport: {
      type: "streamable-http",
      endpoint: abs(ENDPOINTS.mcp),
    },
    capabilities: {
      tools: { listChanged: false },
    },
    tools: AGENT_TOOLS.map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    })),
    /** No auth of any kind. Stated rather than omitted -- see /auth.md. */
    authentication: { type: "none" },
    documentation: abs(ENDPOINTS.apiDocs),
  };
}

/* ------------------------------------------------------------------ *
 * OpenAPI 3.1 -- /openapi.json
 * ------------------------------------------------------------------ */

/**
 * An OpenAPI description of the three HTTP endpoints.
 *
 * Deliberately not generated from the booking validator: the validator is the
 * authority on what is accepted, and a schema pretending to be exhaustive
 * would be a promise this document cannot keep. It describes the shape and the
 * required fields, and says plainly that the server is the arbiter.
 */
export function openApiDocument(catalog: Catalog) {
  const serviceIds = catalog.services.map((s) => s.id);
  const addonIds = catalog.addons.map((a) => a.id);
  const walk = catalog.services.find((s) => s.id === "dog-walk") ?? catalog.services[0];
  const exampleMinutes = walk.tiers[0]?.minutes ?? 30;

  return {
    openapi: "3.1.0",
    info: {
      title: `${SITE.name} API`,
      version: MCP_SERVER_VERSION,
      summary: "Booking submission, MCP tools and a health check.",
      description:
        `The public HTTP surface of ${SITE.url}. Everything here is unauthenticated ` +
        `and rate-limited by IP; see ${abs(ENDPOINTS.authMd)}.\n\n` +
        "A booking submitted here is a **request**, not a confirmed booking. " +
        `${SITE.owner} confirms every one by hand.`,
      contact: { name: SITE.owner, email: SITE.email, url: abs("/contact") },
    },
    servers: [{ url: SITE.url, description: "Production" }],
    externalDocs: { description: "API reference", url: abs(ENDPOINTS.apiDocs) },
    paths: {
      [ENDPOINTS.health]: {
        get: {
          operationId: "getHealth",
          summary: "Liveness, and whether bookings can currently be accepted.",
          description:
            "Reports whether the booking pipeline is configured. `bookingsAcceptable: " +
            "false` means a submission would fail — offer the phone number instead of " +
            "posting a booking.",
          responses: {
            "200": {
              description: "Service reachable.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Health" },
                  example: {
                    ok: true,
                    service: "edventures-pet-sitting",
                    bookingsAcceptable: true,
                    bookingLogging: true,
                    servedZips: SERVICE_AREA.length,
                  },
                },
              },
            },
          },
        },
      },
      [ENDPOINTS.booking]: {
        post: {
          operationId: "submitBookingRequest",
          summary: "Submit a booking request.",
          description:
            "Validates and prices the request server-side, emails " +
            `${SITE.owner}, and answers with the summary and total he was sent. ` +
            "The client's own total is never trusted.\n\n" +
            "Rate-limited per IP. A `422` carries per-field errors; a `502` means the " +
            "mail could not be sent and the booking did **not** reach him — surface " +
            `${SITE.phone} rather than retrying.`,
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/BookingRequest" } },
            },
          },
          responses: {
            "200": {
              description: "Request accepted and emailed.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { const: true },
                      summary: { type: "string" },
                      total: { type: "number" },
                    },
                    required: ["ok", "summary", "total"],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "405": { $ref: "#/components/responses/Error" },
            "413": { $ref: "#/components/responses/Error" },
            "415": { $ref: "#/components/responses/Error" },
            "422": {
              description: "Validation failed; `errors` names the offending fields.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { const: false },
                      error: { type: "string" },
                      errors: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: { field: { type: "string" }, message: { type: "string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
            "429": { $ref: "#/components/responses/Error" },
            "502": { $ref: "#/components/responses/Error" },
          },
        },
      },
      [ENDPOINTS.mcp]: {
        post: {
          operationId: "mcpRpc",
          summary: "Model Context Protocol endpoint (Streamable HTTP).",
          description:
            "JSON-RPC 2.0. Supports `initialize`, `tools/list` and `tools/call` for the " +
            `${AGENT_TOOLS.length} read-only tools described in ` +
            `${abs(ENDPOINTS.mcpServerCard)}. Stateless: no session id is issued or ` +
            "required, so each request stands alone.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JsonRpcRequest" },
                example: { jsonrpc: "2.0", id: 1, method: "tools/list" },
              },
            },
          },
          responses: {
            "200": {
              description: "JSON-RPC response. Notifications answer `202` with no body.",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/JsonRpcResponse" } },
              },
            },
            "202": { description: "Notification accepted; no body." },
            "400": { $ref: "#/components/responses/Error" },
          },
        },
        get: {
          operationId: "mcpStream",
          summary: "Not supported.",
          description:
            "Answers `405`. Server-initiated SSE streams are not implemented; every " +
            "tool here is a single request/response.",
          responses: { "405": { $ref: "#/components/responses/Error" } },
        },
      },
    },
    components: {
      responses: {
        Error: {
          description: "Request refused.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { ok: { const: false }, error: { type: "string" } },
                required: ["error"],
              },
            },
          },
        },
      },
      schemas: {
        Health: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            service: { type: "string" },
            bookingsAcceptable: {
              type: "boolean",
              description: "False when the mail transport is unconfigured; submissions would 502.",
            },
            bookingLogging: { type: "boolean" },
            servedZips: { type: "integer" },
          },
          required: ["ok", "service", "bookingsAcceptable"],
        },
        JsonRpcRequest: {
          type: "object",
          properties: {
            jsonrpc: { const: "2.0" },
            id: { type: ["string", "number"] },
            method: { type: "string", enum: ["initialize", "tools/list", "tools/call", "ping"] },
            params: { type: "object" },
          },
          required: ["jsonrpc", "method"],
        },
        JsonRpcResponse: {
          type: "object",
          properties: {
            jsonrpc: { const: "2.0" },
            id: { type: ["string", "number", "null"] },
            result: { type: "object" },
            error: {
              type: "object",
              properties: { code: { type: "integer" }, message: { type: "string" } },
            },
          },
          required: ["jsonrpc"],
        },
        BookingRequest: {
          type: "object",
          description:
            "The server validates far more than this schema states — phone shape, " +
            "date sanity, served zip codes, consent. Treat a 422 as authoritative.",
          properties: {
            selection: {
              type: "object",
              properties: {
                serviceId: { type: "string", enum: serviceIds },
                durationMinutes: {
                  type: "integer",
                  description: "0 for flat-rate services.",
                },
                addonIds: { type: "array", items: { type: "string", enum: addonIds } },
                extraDogs: { type: "integer", minimum: 0, maximum: 6 },
                extraCats: { type: "integer", minimum: 0, maximum: 6 },
              },
              required: ["serviceId", "durationMinutes", "addonIds", "extraDogs", "extraCats"],
            },
            schedule: {
              type: "object",
              properties: {
                dateStart: { type: "string", format: "date" },
                dateEnd: {
                  type: "string",
                  description: "Empty string for a single day.",
                },
                window: { type: "string", enum: ["morning", "midday", "afternoon", "evening"] },
                flexibilityNotes: { type: "string" },
              },
              required: ["dateStart", "window"],
            },
            pet: {
              type: "object",
              properties: {
                name: { type: "string" },
                species: { type: "string", enum: ["Dog", "Cat", "Both", "Other"] },
                breed: { type: "string" },
                age: { type: "string" },
                temperament: { type: "string" },
                medical: {
                  type: "string",
                  description: "Insulin injections are not offered; do not request them here.",
                },
                upToDateOnPreventatives: { type: ["boolean", "null"] },
              },
              required: ["name", "species"],
            },
            customer: {
              type: "object",
              properties: {
                name: { type: "string" },
                phone: { type: "string" },
                email: { type: "string", format: "email" },
                address: { type: "string" },
                zip: {
                  type: "string",
                  description: "Must be one of the served zip codes.",
                  enum: SERVICE_AREA.map((a) => a.zip),
                },
                entryMethod: {
                  type: "string",
                  description:
                    "A category only. Never send an actual key code or hiding place; " +
                    "that is settled in person.",
                },
                emergencyContact: { type: "string" },
                vet: { type: "string" },
                firstTime: { type: "boolean" },
              },
              required: ["name", "phone", "email", "address", "zip"],
            },
            consent: {
              const: true,
              description:
                "Acknowledges that this is a request, not a confirmed booking. Must be " +
                "checked by the customer, not asserted on their behalf.",
            },
            photoConsent: { type: "boolean" },
          },
          required: ["selection", "schedule", "pet", "customer", "consent"],
          example: {
            selection: {
              serviceId: walk.id,
              durationMinutes: exampleMinutes,
              addonIds: [],
              extraDogs: 0,
              extraCats: 0,
            },
            schedule: {
              dateStart: "2026-09-14",
              dateEnd: "",
              window: "morning",
              flexibilityNotes: "",
            },
            pet: {
              name: "Hubert",
              species: "Dog",
              breed: "Beagle mix",
              age: "4",
              temperament: "Easy-going",
              medical: "",
              upToDateOnPreventatives: true,
            },
            customer: {
              name: "Sam Rivera",
              phone: "215-555-0134",
              email: "sam@example.com",
              address: "1200 Green St",
              zip: SERVICE_AREA[0].zip,
              entryMethod: "Lockbox",
              emergencyContact: "Alex Rivera 215-555-0199",
              vet: "Fairmount Animal Hospital",
              firstTime: true,
            },
            consent: true,
            photoConsent: false,
          },
        },
      },
    },
  };
}

/* ------------------------------------------------------------------ *
 * RFC 8288 -- the Link header set
 * ------------------------------------------------------------------ */

export interface LinkRelation {
  href: string;
  rel: string;
  type?: string;
  title?: string;
}

/**
 * The relations advertised on every HTML page.
 *
 * Site-relative hrefs, which RFC 8288 permits and which keep the header short
 * and origin-agnostic -- a preview deployment advertises its own copies rather
 * than production's.
 */
export const LINK_RELATIONS: LinkRelation[] = [
  { href: ENDPOINTS.apiCatalog, rel: "api-catalog", type: "application/linkset+json" },
  { href: ENDPOINTS.openapi, rel: "service-desc", type: "application/vnd.oai.openapi+json" },
  { href: ENDPOINTS.apiDocs, rel: "service-doc", type: "text/html" },
  // `text/plain`, not `text/markdown`: the content is markdown-shaped but 2.7.1
  // settled on serving it as plain text, and a `type` hint that disagrees with
  // the response is worse than no hint.
  { href: ENDPOINTS.llms, rel: "describedby", type: "text/plain", title: "llms.txt briefing" },
  { href: ENDPOINTS.ardCatalog, rel: "describedby", type: "application/json", title: "ARD capability manifest" },
  // `application/json` because that is what the asset server sends. The ARD
  // manifest classifies the same file as `application/mcp-server-card+json`,
  // which is the string that spec mandates -- there `type` names what the
  // resource *is*, while here it predicts the response header.
  { href: ENDPOINTS.mcpServerCard, rel: "describedby", type: "application/json", title: "MCP server card" },
  { href: ENDPOINTS.agentSkills, rel: "describedby", type: "application/json", title: "Agent skills index" },
  { href: ENDPOINTS.authMd, rel: "author", type: "text/markdown", title: "Agent authentication policy" },
];

/** One `Link` field value. Quoted-string parameters throughout, per RFC 8288 §3. */
export function formatLink(link: LinkRelation): string {
  const params = [`rel="${link.rel}"`];
  if (link.type) params.push(`type="${link.type}"`);
  if (link.title) params.push(`title="${link.title}"`);
  return `<${link.href}>; ${params.join("; ")}`;
}

/** The whole set as a single comma-separated `Link` field value. */
export function linkHeaderValue(extra: LinkRelation[] = []): string {
  return [...LINK_RELATIONS, ...extra].map(formatLink).join(", ");
}

/* ------------------------------------------------------------------ *
 * Cloudflare Pages `_headers`
 * ------------------------------------------------------------------ */

/**
 * The whole `_headers` file, generated from the page list the build produced.
 *
 * Generated rather than hand-written for the reason every other derived file
 * here is: the `Link` set and the page list both change, and a hand-maintained
 * copy would advertise `rel="api-catalog"` on six of the eight pages after
 * somebody adds a seventh. The build walks `dist` and this writes the rules.
 *
 * It carries three kinds of rule:
 *
 * 1. **Link relations** (RFC 8288) on every HTML page, plus that page's own
 *    markdown alternate and `Vary: Accept` -- without the `Vary`, a cache that
 *    stored the markdown would hand it to a browser.
 * 2. **Content types** that Cloudflare Pages cannot infer. It types static
 *    assets by file extension, and `/.well-known/api-catalog` has none by
 *    design, so `application/linkset+json` has to be stated.
 * 3. **CORS** on the discovery documents, which the ARD spec requires and
 *    which browser-side agents need for all of them.
 *
 * Both lists are discovered by walking `dist`, so a page or a skill added
 * later is covered without anyone remembering to come back here.
 */
export function buildHeadersFile(pagePaths: string[], markdownPaths: string[]): string {
  const out: string[] = [
    "# Generated by scripts/agent-build-assets.ts on every build. Do not edit by hand;",
    "# edit src/lib/agent-discovery.ts instead. See buildHeadersFile() there for why.",
    "",
  ];

  const rule = (pattern: string, headers: string[]) => {
    out.push(pattern, ...headers.map((h) => `  ${h}`), "");
  };

  out.push("# --- RFC 8288 discovery links, on every page an agent might land on ---", "");
  for (const path of pagePaths) {
    const alternate: LinkRelation = {
      href: markdownTwin(path),
      rel: "alternate",
      type: "text/markdown",
      title: "Markdown for agents",
    };
    rule(path === "/" ? "/" : path, [
      `Link: ${linkHeaderValue([alternate])}`,
      // The same URL answers HTML or markdown depending on Accept, so a cache
      // that ignores the header would serve one to the wrong client.
      "Vary: Accept",
    ]);
  }

  out.push("# --- Content types Pages cannot infer, and CORS for the discovery set ---", "");

  // RFC 9727 registers this exact extensionless URI, so nothing about the
  // filename tells the asset server what it is.
  rule(ENDPOINTS.apiCatalog, [
    "Content-Type: application/linkset+json",
    "Access-Control-Allow-Origin: *",
  ]);

  rule(ENDPOINTS.openapi, [
    "Content-Type: application/vnd.oai.openapi+json",
    "Access-Control-Allow-Origin: *",
  ]);

  for (const path of [ENDPOINTS.ardCatalog, ENDPOINTS.mcpServerCard, ENDPOINTS.agentSkills]) {
    rule(path, ["Content-Type: application/json", "Access-Control-Allow-Origin: *"]);
  }

  for (const path of [ENDPOINTS.llms, ENDPOINTS.llmsFull]) {
    rule(path, ["Access-Control-Allow-Origin: *"]);
  }

  // Every `.md` the build produced: the page twins, `/auth.md`, and each
  // published SKILL.md.
  //
  // Enumerated rather than matched with `/*.md`, which looks tidier and is
  // wrong twice over. Cloudflare applies *every* matching rule and concatenates
  // what they set, so a wildcard overlapping the specific `/auth.md` rule
  // produced `Content-Type: text/markdown; charset=utf-8, text/markdown;
  // charset=utf-8` and `Access-Control-Allow-Origin: *, *` -- neither of which
  // is a valid header value. The wildcard also leaked its CORS header onto
  // `/docs/api`, an HTML page. The list is generated, so being explicit costs
  // nothing.
  for (const path of markdownPaths) {
    rule(path, ["Content-Type: text/markdown; charset=utf-8", "Access-Control-Allow-Origin: *"]);
  }

  return out.join("\n");
}
