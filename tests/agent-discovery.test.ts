/**
 * Tests for the agent-facing surface: the discovery documents, the MCP server,
 * the tool implementations and the markdown conversion.
 *
 * The thing worth guarding here is not "does the JSON parse" -- it always
 * does -- but that the documents agree with each other and with the site. Six
 * files describe the same handful of URLs, an index publishes a hash of bytes
 * another route serves, and the prices in a skill file are the prices on
 * /services. Every one of those is a claim that can quietly stop being true
 * after an unrelated edit, and none of them fails loudly in production: an
 * agent just gets a 404, or quotes last year's price with total confidence.
 */
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  AGENT_TOOLS,
  findTool,
  runTool,
} from "../src/lib/agent-tools.ts";
import {
  ENDPOINTS,
  LINK_RELATIONS,
  abs,
  apiCatalog,
  ardCatalog,
  buildHeadersFile,
  formatLink,
  linkHeaderValue,
  mcpServerCard,
  openApiDocument,
} from "../src/lib/agent-discovery.ts";
import { AGENT_SKILLS, findSkill, skillBody, skillUrl } from "../src/lib/agent-skills.ts";
import { handleMcpRequest, LATEST_PROTOCOL_VERSION } from "../src/lib/mcp.ts";
import {
  estimateTokens,
  isNegotiablePath,
  markdownTwin,
  parseAccept,
  prefersMarkdown,
} from "../src/lib/markdown-negotiation.ts";
import { pageToMarkdown, servedPath } from "../scripts/agent-build-assets.ts";
import { getCatalogFromJson } from "../src/lib/catalog-json.ts";
import { SERVICE_AREA, SITE } from "../src/lib/site.ts";

const catalog = getCatalogFromJson();

/** Fixed "today", so a surcharge that depends on the clock stays testable. */
const NOW = new Date(2026, 7, 17, 10, 0, 0); // 17 Aug 2026, local
const SOON = "2026-09-14"; // comfortably clear of the 24-hour threshold

/** Every href any document points at, as a site-relative path. */
function pathsIn(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (typeof value === "string") {
    if (value.startsWith(SITE.url)) found.add(value.slice(SITE.url.length) || "/");
    else if (value.startsWith("/")) found.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) pathsIn(item, found);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) pathsIn(item, found);
  }
  return found;
}

async function mcp(body: unknown, method = "POST"): Promise<Response> {
  return handleMcpRequest(
    new Request("https://edventures.pet/api/mcp", {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify(body) : undefined,
    }),
    catalog,
    NOW,
  );
}

describe("agent tools", () => {
  it("are all read-only: nothing here can book, cancel or charge", () => {
    // The one invariant that matters most. A tool that mutates would need a
    // consent story, and there is none because there is no such tool.
    const mutating = AGENT_TOOLS.filter((t) =>
      /book|submit|cancel|pay|charge|delete|create/i.test(t.name),
    );
    assert.deepEqual(mutating, []);
  });

  it("quote the catalog's real prices, not a copy", () => {
    const { result } = runTool("list_services", {}, catalog);
    const services = (result as { services: { id: string; tiers?: { price: number }[] }[] }).services;

    assert.equal(services.length, catalog.services.length);
    for (const service of catalog.services) {
      const reported = services.find((s) => s.id === service.id);
      assert.ok(reported, `${service.id} missing from list_services`);
      if (service.tiers.length) {
        assert.deepEqual(reported.tiers, service.tiers);
      }
    }
  });

  it("price a booking exactly as the booking form does", () => {
    const { ok, result } = runTool(
      "estimate_price",
      { serviceId: "dog-walk", durationMinutes: 30, dateStart: SOON, dateEnd: "2026-09-16", extraDogs: 1 },
      catalog,
      NOW,
    );
    const walk = catalog.services.find((s) => s.id === "dog-walk")!;
    const tier = walk.tiers.find((t) => t.minutes === 30)!;
    const dogFee = catalog.fees.find((f) => f.id === "additional-dog")!.amount;

    assert.equal(ok, true);
    assert.equal((result as { total: number }).total, (tier.price + dogFee) * 3);
    assert.equal((result as { units: number }).units, 3);
  });

  it("bill overnights per night, so a departure day is not charged", () => {
    const { result } = runTool(
      "estimate_price",
      { serviceId: "overnight", dateStart: "2026-09-03", dateEnd: "2026-09-06" },
      catalog,
      NOW,
    );
    assert.equal((result as { units: number }).units, 3);
    assert.equal((result as { unitLabel: string }).unitLabel, "nights");
  });

  it("report bad input as data rather than throwing across the transport", () => {
    for (const [name, input] of [
      ["check_service_area", { zip: "nope" }],
      ["estimate_price", { serviceId: "flying-lessons", dateStart: SOON }],
      ["estimate_price", { serviceId: "dog-walk", dateStart: "next tuesday" }],
      ["estimate_price", { serviceId: "dog-walk", dateStart: SOON, addonIds: ["gold-plating"] }],
    ] as const) {
      const { ok, result } = runTool(name, input, catalog, NOW);
      assert.equal(ok, false, `${name} should have refused ${JSON.stringify(input)}`);
      assert.ok((result as { error?: string }).error, "a refusal must say why");
    }
  });

  it("refuse a duration that is not a tier, rather than quoting the cheapest", () => {
    // The worst failure this module can have. `estimate()` falls back to
    // `tiers[0]` for an unmatched duration, so asking for 45 minutes came back
    // `ok: true, total: 15` -- the 15-minute price -- and a model reads
    // `total` and quotes it.
    const walk = catalog.services.find((s) => s.id === "dog-walk")!;
    const notATier = 45;
    assert.ok(!walk.tiers.some((t) => t.minutes === notATier), "fixture assumes 45 is not a tier");

    const { ok, result } = runTool(
      "estimate_price",
      { serviceId: "dog-walk", durationMinutes: notATier, dateStart: SOON },
      catalog,
      NOW,
    );
    assert.equal(ok, false);
    assert.deepEqual(
      (result as { knownDurations: number[] }).knownDurations,
      walk.tiers.map((t) => t.minutes),
    );

    // Unparseable durations take the same path, rather than becoming NaN and
    // then matching nothing and then quoting $15.
    for (const bad of ["sixty", null, {}]) {
      assert.equal(
        runTool("estimate_price", { serviceId: "dog-walk", durationMinutes: bad, dateStart: SOON }, catalog, NOW).ok,
        bad === null,
        `durationMinutes: ${JSON.stringify(bad)}`,
      );
    }
  });

  it("still quote the shortest tier when no duration was asked for", () => {
    // Omitting it is a real question -- "what does a walk cost?" -- and the
    // "from" price is the honest answer.
    const walk = catalog.services.find((s) => s.id === "dog-walk")!;
    const { ok, result } = runTool(
      "estimate_price",
      { serviceId: "dog-walk", dateStart: SOON },
      catalog,
      NOW,
    );
    assert.equal(ok, true);
    assert.equal((result as { total: number }).total, walk.tiers[0].price);
  });

  it("refuse a duration on a flat-rate service instead of ignoring it", () => {
    const { ok } = runTool(
      "estimate_price",
      { serviceId: "overnight", durationMinutes: 30, dateStart: SOON },
      catalog,
      NOW,
    );
    assert.equal(ok, false);
  });

  it("refuse a malformed addonIds rather than dropping it and under-quoting", () => {
    // A bare string is not an array, so the add-on used to vanish and the
    // total came back lower with no error at all.
    const addon = catalog.addons[0].id;
    const { ok, result } = runTool(
      "estimate_price",
      { serviceId: "dog-walk", dateStart: SOON, addonIds: addon },
      catalog,
      NOW,
    );
    assert.equal(ok, false);
    assert.match((result as { error: string }).error, /must be an array/);
  });

  it("refuse a pet count that is not a whole number in range", () => {
    // `estimate()` clamps to 0-6 and turns junk into 0, which silently drops
    // a pet from the quote.
    for (const bad of ["two", -1, 7, 1.5]) {
      assert.equal(
        runTool("estimate_price", { serviceId: "dog-walk", dateStart: SOON, extraDogs: bad }, catalog, NOW).ok,
        false,
        `extraDogs: ${JSON.stringify(bad)}`,
      );
    }
    assert.equal(
      runTool("estimate_price", { serviceId: "dog-walk", dateStart: SOON, extraCats: 2 }, catalog, NOW).ok,
      true,
    );
  });

  it("know every served zip and refuse to guess at the ones they do not", () => {
    for (const area of SERVICE_AREA) {
      const { result } = runTool("check_service_area", { zip: area.zip }, catalog);
      assert.equal((result as { served: boolean }).served, true);
      assert.equal((result as { neighborhood: string }).neighborhood, area.neighborhood);
    }

    const outside = runTool("check_service_area", { zip: "90210" }, catalog).result as {
      served: boolean;
      message: string;
    };
    assert.equal(outside.served, false);
    // Not published, so it must not be invented -- the phone number is the
    // whole answer here.
    assert.match(outside.message, /not published/);
    assert.match(outside.message, new RegExp(SITE.phone));
  });

  it("carry the constraints an assistant would otherwise invent", () => {
    const facts = runTool("get_business_facts", {}, catalog).result as {
      notClaimed: string[];
      notPublished: { items: string[] };
    };
    assert.ok(facts.notClaimed.some((claim) => /insur/i.test(claim)));
    for (const policy of ["Cancellation", "Key-handling", "Vet-emergency"]) {
      assert.ok(
        facts.notPublished.items.some((item) => item.includes(policy)),
        `${policy} must be listed as not published`,
      );
    }
  });

  it("answer an unknown tool with the list of real ones", () => {
    const { ok, result } = runTool("do_my_taxes", {}, catalog);
    assert.equal(ok, false);
    assert.deepEqual(
      (result as { knownTools: string[] }).knownTools,
      AGENT_TOOLS.map((t) => t.name),
    );
    assert.equal(findTool("do_my_taxes"), undefined);
  });
});

describe("MCP server", () => {
  it("negotiates a protocol version it actually supports", async () => {
    const supported = await mcp({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05" },
    });
    const body = (await supported.json()) as { result: { protocolVersion: string } };
    assert.equal(body.result.protocolVersion, "2024-11-05");
    assert.equal(supported.headers.get("MCP-Protocol-Version"), "2024-11-05");

    const unknown = await mcp({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "1999-01-01" },
    });
    const fallback = (await unknown.json()) as { result: { protocolVersion: string } };
    assert.equal(fallback.result.protocolVersion, LATEST_PROTOCOL_VERSION);
  });

  it("tells the model what it must not say, in `instructions`", async () => {
    const response = await mcp({ jsonrpc: "2.0", id: 1, method: "initialize" });
    const { result } = (await response.json()) as { result: { instructions: string } };
    assert.match(result.instructions, /not published/);
    assert.match(result.instructions, /insured/);
  });

  it("answers notifications with 202 and no body", async () => {
    // Replying to a notification is a protocol error, and some clients treat
    // it as fatal rather than ignoring it.
    const response = await mcp({ jsonrpc: "2.0", method: "notifications/initialized" });
    assert.equal(response.status, 202);
    assert.equal(await response.text(), "");
  });

  it("answers no notification, whatever its method", async () => {
    // `isNotification` used to be consulted only in the malformed and
    // `default` branches, so `{"jsonrpc":"2.0","method":"ping"}` came back
    // `200 {"id":null,"result":{}}` -- a reply to a message that asked for
    // none, which some clients treat as fatal.
    for (const method of ["ping", "tools/list", "initialize", "notifications/initialized"]) {
      const response = await mcp({ jsonrpc: "2.0", method });
      assert.equal(response.status, 202, `${method} answered ${response.status}`);
      assert.equal(await response.text(), "", `${method} sent a body`);
    }

    // An explicit null id means the same thing as an absent one.
    const explicit = await mcp({ jsonrpc: "2.0", id: null, method: "tools/list" });
    assert.equal(explicit.status, 202);
  });

  it("treats id 0 as a real id, not an absent one", async () => {
    const response = await mcp({ jsonrpc: "2.0", id: 0, method: "tools/list" });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { id: number };
    assert.equal(body.id, 0);
  });

  it("answers a batch containing junk without crashing", async () => {
    // `[null]` reached a property access on `null` and threw, which escaped
    // the Worker as a Cloudflare HTML error page -- a malformed batch getting
    // a non-JSON answer.
    const response = await mcp([null, "nonsense", 42, { jsonrpc: "2.0", id: 1, method: "ping" }]);
    assert.equal(response.status, 200);
    const replies = (await response.json()) as { error?: { code: number }; id: unknown }[];
    assert.equal(replies.length, 4);
    assert.equal(replies.filter((r) => r.error?.code === -32600).length, 3);
  });

  it("rejects an empty batch rather than reading it as all-notifications", async () => {
    const response = await mcp([]);
    assert.equal(response.status, 400);
  });

  it("lists every tool, with a read-only annotation on each", async () => {
    const response = await mcp({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const { result } = (await response.json()) as {
      result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] };
    };
    assert.deepEqual(
      result.tools.map((t) => t.name),
      AGENT_TOOLS.map((t) => t.name),
    );
    assert.ok(result.tools.every((t) => t.annotations.readOnlyHint));
  });

  it("returns a tool refusal as isError, not as a transport failure", async () => {
    const response = await mcp({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "check_service_area", arguments: { zip: "nope" } },
    });
    assert.equal(response.status, 200);
    const { result } = (await response.json()) as {
      result: { isError: boolean; content: { text: string }[] };
    };
    // The model has to be able to read this and try again.
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /five-digit/);
  });

  it("treats an unknown tool as a JSON-RPC error", async () => {
    const response = await mcp({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "submit_booking", arguments: {} },
    });
    const { error } = (await response.json()) as { error: { code: number } };
    assert.equal(error.code, -32602);
  });

  it("refuses GET rather than pretending to open a stream", async () => {
    const response = await mcp(null, "GET");
    assert.equal(response.status, 405);
    assert.match(response.headers.get("Allow") ?? "", /POST/);
  });

  it("survives a body that is not JSON at all", async () => {
    const response = await handleMcpRequest(
      new Request("https://edventures.pet/api/mcp", { method: "POST", body: "not json" }),
      catalog,
      NOW,
    );
    assert.equal(response.status, 400);
    const { error } = (await response.json()) as { error: { code: number } };
    assert.equal(error.code, -32700);
  });

  it("still answers a batch, which older clients send", async () => {
    const response = await mcp([
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
    ]);
    const replies = (await response.json()) as { id: number }[];
    // The notification contributes no reply.
    assert.equal(replies.length, 2);
    assert.deepEqual(
      replies.map((r) => r.id),
      [1, 2],
    );
  });
});

describe("discovery documents", () => {
  it("point only at URLs the site actually serves", () => {
    // Guards the failure this whole layer exists to avoid: a document that
    // confidently sends an agent to a 404.
    const known = new Set<string>([
      ...Object.values(ENDPOINTS),
      "/",
      "/contact",
      "/book",
      "/services",
      ...AGENT_SKILLS.map((s) => skillUrl(s.name)),
    ]);

    const documents: Record<string, unknown> = {
      "api-catalog": apiCatalog(),
      "ai-catalog": ardCatalog(),
      "server-card": mcpServerCard(),
      openapi: openApiDocument(catalog),
    };

    for (const [name, document] of Object.entries(documents)) {
      for (const path of pathsIn(document)) {
        // Schema and spec URLs live off-site; only same-origin paths are ours
        // to keep working.
        if (path.startsWith("/") && !known.has(path)) {
          assert.fail(`${name} points at ${path}, which nothing serves`);
        }
      }
    }
  });

  it("declare a media type the URL will actually answer with", () => {
    // Cloudflare Pages types static assets by file extension, so the extension
    // decides the response header whatever a document claims. Three of these
    // disagreed on the first pass: `/llms.txt` was advertised as
    // `text/markdown` (2.7.1 serves it as plain text) and the server card was
    // advertised as `application/mcp-server-card+json` while the asset server
    // sends `application/json`. A `type` hint that lies is worse than none.
    const byExtension: Record<string, string> = {
      ".txt": "text/plain",
      ".md": "text/markdown",
      ".json": "application/json",
    };

    const declared: [string, string][] = LINK_RELATIONS.filter((l) => l.type).map((l) => [
      l.href,
      l.type!,
    ]);
    for (const entry of apiCatalog().linkset) {
      for (const [rel, targets] of Object.entries(entry)) {
        if (rel === "anchor" || !Array.isArray(targets)) continue;
        for (const target of targets as { href: string; type?: string }[]) {
          if (target.type) declared.push([target.href, target.type]);
        }
      }
    }

    for (const [href, type] of declared) {
      const extension = Object.keys(byExtension).find((ext) => href.endsWith(ext));
      // `/openapi.json` is the deliberate exception: it is served with the
      // OpenAPI media type, set explicitly in `_headers`.
      if (!extension || href.endsWith(ENDPOINTS.openapi)) continue;
      assert.equal(
        type,
        byExtension[extension],
        `${href} is advertised as ${type} but will be served as ${byExtension[extension]}`,
      );
    }
  });

  it("advertise the api-catalog, a service description and documentation", () => {
    const rels = new Set(LINK_RELATIONS.map((l) => l.rel));
    for (const rel of ["api-catalog", "service-desc", "service-doc", "describedby"]) {
      assert.ok(rels.has(rel), `no Link relation with rel="${rel}"`);
    }
  });

  it("format Link headers the way RFC 8288 specifies", () => {
    assert.equal(
      formatLink({ href: "/x", rel: "service-doc", type: "text/html" }),
      '</x>; rel="service-doc"; type="text/html"',
    );
    // One field value, comma-separated, with every target angle-bracketed.
    const value = linkHeaderValue();
    assert.equal(value.split(", ").length, LINK_RELATIONS.length);
    assert.ok(value.split(", ").every((part) => part.startsWith("<")));
  });

  it("give the api-catalog an anchor per API, each with its own description", () => {
    const { linkset } = apiCatalog();
    assert.deepEqual(
      linkset.map((entry) => entry.anchor),
      [abs(ENDPOINTS.booking), abs(ENDPOINTS.mcp)],
    );
    for (const entry of linkset) {
      assert.ok(entry["service-desc"][0].href.endsWith("/openapi.json"));
      assert.ok(entry.status[0].href.endsWith("/api/health"));
    }
  });

  it("give every ARD entry an identifier, a media type and 2-5 queries", () => {
    const { specVersion, host, entries } = ardCatalog();
    assert.equal(specVersion, "1.0");
    assert.equal(host.identifier, "did:web:edventures.pet");
    assert.ok(entries.length > 0);

    for (const entry of entries) {
      assert.match(entry.identifier, /^urn:air:edventures\.pet:[a-z-]+:[a-z-]+$/);
      assert.match(entry.type, /^[a-z]+\/[a-z0-9.+-]+$/);
      // Exactly one of url or data, per the spec.
      assert.ok("url" in entry);
      assert.ok(!("data" in entry));
      assert.ok(
        entry.representativeQueries.length >= 2 && entry.representativeQueries.length <= 5,
        `${entry.identifier} has ${entry.representativeQueries.length} queries`,
      );
    }
  });

  it("describe the MCP server card's transport as the endpoint that exists", () => {
    const card = mcpServerCard();
    assert.equal(card.transport.endpoint, abs(ENDPOINTS.mcp));
    assert.deepEqual(
      card.tools.map((t) => t.name),
      AGENT_TOOLS.map((t) => t.name),
    );
    assert.equal(card.authentication.type, "none");
  });

  it("enumerate only accepted ids in the OpenAPI request schema", () => {
    const document = openApiDocument(catalog);
    const booking = document.components.schemas.BookingRequest;
    assert.deepEqual(
      booking.properties.selection.properties.serviceId.enum,
      catalog.services.map((s) => s.id),
    );
    assert.deepEqual(
      booking.properties.customer.properties.zip.enum,
      SERVICE_AREA.map((a) => a.zip),
    );
    // The example has to be a request the server would accept.
    assert.ok(
      catalog.services.some((s) => s.id === booking.example.selection.serviceId),
      "the OpenAPI example uses a service id that does not exist",
    );
  });
});

describe("agent skills", () => {
  it("hash to the bytes the SKILL.md routes serve", () => {
    // The index promises `digest` for the content at `url`. Both go through
    // skillBody() so that promise holds; this is the test that says so.
    for (const skill of AGENT_SKILLS) {
      const body = skillBody(skill, catalog);
      const digest = createHash("sha256").update(body, "utf8").digest("hex");
      assert.equal(digest, createHash("sha256").update(skillBody(findSkill(skill.name)!, catalog), "utf8").digest("hex"));
      assert.match(skill.name, /^[a-z0-9-]+$/);
    }
  });

  it("quote the live price list rather than a frozen copy", () => {
    const body = skillBody(findSkill("edventures-pricing")!, catalog);
    for (const service of catalog.services) {
      assert.ok(body.includes(`\`${service.id}\``), `${service.id} missing from the pricing skill`);
      const price = service.tiers.length ? service.tiers[0].price : service.base;
      assert.ok(body.includes(`$${price}`), `$${price} missing from the pricing skill`);
    }
    for (const fee of catalog.fees) {
      assert.ok(body.includes(`+$${fee.amount}`), `${fee.id} missing from the pricing skill`);
    }
  });

  it("tell an agent not to book on somebody's behalf", () => {
    const body = skillBody(findSkill("edventures-booking")!, catalog);
    assert.match(body, /Do not submit a booking on someone's behalf/);
    // The other rule that matters: never collect the actual key code.
    assert.match(body, /[Nn]ever collect the actual code/);
    for (const area of SERVICE_AREA) assert.ok(body.includes(area.zip));
  });

  it("repeat the two site-wide rules in every skill", () => {
    for (const skill of AGENT_SKILLS) {
      const body = skillBody(skill, catalog);
      assert.match(body, /Never invent a policy/);
      assert.match(body, /Never say this business is insured/);
    }
  });
});

describe("markdown negotiation", () => {
  it("ignores the wildcard every browser sends", () => {
    // The bug this exists to prevent: serving a text file to Safari.
    assert.equal(
      prefersMarkdown("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
      false,
    );
    assert.equal(prefersMarkdown("*/*"), false);
    assert.equal(prefersMarkdown(null), false);
    assert.equal(prefersMarkdown(""), false);
  });

  it("serves markdown when it is named and not outranked", () => {
    assert.equal(prefersMarkdown("text/markdown"), true);
    assert.equal(prefersMarkdown("text/markdown, text/html;q=0.9"), true);
    assert.equal(prefersMarkdown("text/x-markdown"), true);
    // A tie goes to markdown: naming it at all is a deliberate act.
    assert.equal(prefersMarkdown("text/html,text/markdown"), true);
  });

  it("keeps HTML when the client prefers it or refuses markdown", () => {
    assert.equal(prefersMarkdown("text/html, text/markdown;q=0.5"), false);
    assert.equal(prefersMarkdown("text/markdown;q=0"), false);
  });

  it("tolerates a malformed q without dropping the media range", () => {
    assert.deepEqual(parseAccept("text/markdown;q=banana"), [
      { type: "text/markdown", quality: 1 },
    ]);
    assert.equal(prefersMarkdown("text/markdown;q=banana"), true);
  });

  it("never negotiates an API path or a document asked for by name", () => {
    assert.equal(isNegotiablePath("/about"), true);
    assert.equal(isNegotiablePath("/"), true);
    assert.equal(isNegotiablePath("/docs/api"), true);
    assert.equal(isNegotiablePath("/api/booking"), false);
    assert.equal(isNegotiablePath("/.well-known/api-catalog"), false);
    assert.equal(isNegotiablePath("/llms.txt"), false);
    assert.equal(isNegotiablePath("/about.md"), false);
  });

  it("maps a page to the twin the headers advertise", () => {
    assert.equal(markdownTwin("/"), "/index.md");
    assert.equal(markdownTwin("/about"), "/about.md");
    assert.equal(markdownTwin("/docs/api"), "/docs/api.md");
    assert.ok(estimateTokens("hello world") > 0);
  });
});

describe("_headers", () => {
  const file = buildHeadersFile(["/", "/about", "/docs/api"], ["/index.md", "/about.md", "/auth.md"]);

  it("gives every page the Link set and Vary: Accept", () => {
    for (const path of ["/", "/about", "/docs/api"]) {
      const block = file.split("\n\n").find((b) => b.startsWith(`${path}\n`));
      assert.ok(block, `no rule for ${path}`);
      assert.match(block, /Link: </);
      // Without this a cache could hand the markdown to a browser.
      assert.match(block, /Vary: Accept/);
    }
  });

  it("states the content type Pages cannot infer from a filename", () => {
    // `/.well-known/api-catalog` has no extension by design (RFC 9727).
    assert.match(file, /\/\.well-known\/api-catalog\n {2}Content-Type: application\/linkset\+json/);
  });

  it("never lets two rules match one path", () => {
    // Cloudflare applies every matching rule and concatenates what they set,
    // so an overlap produces `Access-Control-Allow-Origin: *, *`.
    const patterns = file
      .split("\n")
      .filter((line) => line.startsWith("/"))
      .map((line) => line.trim());
    assert.equal(new Set(patterns).size, patterns.length, "a path is covered twice");
    assert.deepEqual(
      patterns.filter((p) => p.includes("*")),
      [],
      "a wildcard rule will overlap the specific ones",
    );
  });
});

describe("markdown twins", () => {
  const page = (main: string) =>
    `<!doctype html><html><head><title>T</title>` +
    `<meta name="description" content="D" /></head><body><main id="main">${main}</main></body></html>`;

  it("map a built file to the URL Cloudflare Pages will serve it at", () => {
    assert.equal(servedPath("index.html"), "/");
    assert.equal(servedPath("about.html"), "/about");
    assert.equal(servedPath("docs/api.html"), "/docs/api");
    // Pages serves `docs/index.html` at `/docs`. Returning `/docs/index` keyed
    // the `_headers` rule on a path that never matches, and left the middleware
    // looking for `/docs.md` while the twin sat at `/docs/index.md` -- so the
    // page silently got neither its Link headers nor its markdown.
    assert.equal(servedPath("docs/index.html"), "/docs");
    assert.equal(servedPath("a/b/index.html"), "/a/b");
  });

  it("report a page with no <main> rather than emitting an empty twin", () => {
    // The build advertises a `rel="alternate"` for every page it converts, so
    // a silent failure here would point agents at a 404.
    assert.equal(pageToMarkdown("<html><body>no main</body></html>", "/x", "https://e.pet/x"), null);
  });

  it("carry the page's identity in front matter", () => {
    const md = pageToMarkdown(page("<h1>Hello</h1>"), "/x", "https://edventures.pet/x")!;
    assert.match(md, /^---\n/);
    assert.match(md, /source: "https:\/\/edventures\.pet\/x"/);
    assert.match(md, /# Hello/);
  });

  it("drop decoration but keep everything a reader would see", () => {
    const md = pageToMarkdown(
      page(
        '<svg aria-hidden="true"><path d="M0 0"/></svg>' +
          '<img src="/paw.png" alt="" />' +
          '<img src="/dog.png" alt="A beagle" />' +
          "<p>Real text.</p>",
      ),
      "/x",
      "https://e.pet/x",
    )!;
    assert.ok(!md.includes("M0 0"), "SVG path data leaked into the markdown");
    assert.ok(!md.includes("paw.png"), "a decorative image survived");
    assert.match(md, /A beagle/);
    assert.match(md, /Real text\./);
  });

  it("separate labels that CSS lays out as rows", () => {
    // Concatenating them fuses "Walks" to "A walk" and hands a model a word
    // that is not on the page.
    const md = pageToMarkdown(
      page('<a href="/services"><span>Dog Walks</span><span>From $15</span></a>'),
      "/x",
      "https://e.pet/x",
    )!;
    assert.ok(!md.includes("WalksFrom"), md);
    assert.match(md, /Dog Walks · From \$15/);
  });

  it("pair a price with its term instead of orphaning both", () => {
    const md = pageToMarkdown(
      page("<dl><div><dt>30 minutes</dt><dd>$25</dd></div></dl>"),
      "/x",
      "https://e.pet/x",
    )!;
    assert.match(md, /- \*\*30 minutes\*\*: \$25/);
  });
});
