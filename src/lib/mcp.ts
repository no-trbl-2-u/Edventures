/**
 * A Model Context Protocol server over Streamable HTTP.
 *
 * Thin by design, and stateless. Every tool in `agent-tools.ts` is a pure
 * function of the catalog, so there is no session to keep: no session id is
 * issued, no `GET` stream is opened, and each POST is answered on its own.
 * That is not a shortcut around the spec -- Streamable HTTP explicitly permits
 * a server with no session -- it is what a read-only price list actually
 * needs, and it means the endpoint costs nothing when nobody is asking.
 *
 * `Request -> Response`, like `booking-handler.ts`, so the Cloudflare Function
 * in `functions/api/mcp.ts` is a wiring file and the protocol is testable in
 * `npm test` without a runtime.
 */
import { AGENT_TOOLS, runTool } from "./agent-tools";
import { MCP_SERVER_VERSION } from "./agent-discovery";
import type { Catalog } from "./booking";
import { SITE } from "./site";

/**
 * Protocol revisions this server speaks, newest first.
 *
 * Nothing here depends on the differences between them -- there are no
 * resources, prompts, sampling or elicitation to have changed -- so accepting
 * the older revisions costs nothing and keeps older clients working.
 */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

/** JSON-RPC 2.0 error codes, plus the one MCP adds for invalid tool params. */
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...headers },
  });

const rpcError = (id: string | number | null, code: number, message: string, data?: unknown) => ({
  jsonrpc: "2.0" as const,
  id,
  error: data === undefined ? { code, message } : { code, message, data },
});

const rpcResult = (id: string | number | null, result: unknown) => ({
  jsonrpc: "2.0" as const,
  id,
  result,
});

/** The tool list, in MCP's shape. Read-only annotations on every one, because
 *  every one of them is. */
function toolDescriptors() {
  return AGENT_TOOLS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: {
      title: tool.title,
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }));
}

function negotiateVersion(requested: unknown): string {
  return typeof requested === "string" &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : LATEST_PROTOCOL_VERSION;
}

/**
 * Dispatch one JSON-RPC message.
 *
 * Returns `null` for a notification, which must be answered with no body --
 * `notifications/initialized` is the one every client sends, and replying to
 * it with a result is a protocol error that some clients treat as fatal.
 *
 * The notification test is applied once, to whatever the dispatch produced,
 * rather than inside each branch. Checking it per-case is how
 * `{"jsonrpc":"2.0","method":"ping"}` -- no id, so a notification -- came back
 * with `{"id":null,"result":{}}`: the `notifications/*` cases returned null
 * and every other case forgot to.
 */
function dispatch(
  message: unknown,
  catalog: Catalog,
  now: Date,
): { body: unknown; protocolVersion?: string } | null {
  // Guarded here rather than by the caller, because the batch branch maps this
  // over array elements: a body of `[null]` reached the property access below
  // and threw, which escaped the Worker as a Cloudflare HTML error page --
  // a malformed batch getting a non-JSON answer.
  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    return { body: rpcError(null, INVALID_REQUEST, "Expected a JSON-RPC 2.0 request object.") };
  }

  const request = message as JsonRpcRequest;
  const id = request.id ?? null;
  const method = request.method;
  // Absent or null id means "no reply wanted". `0` is a real id, which is why
  // this compares rather than testing truthiness.
  const isNotification = request.id === undefined || request.id === null;

  // Notifications are still dispatched, because some of them mean something --
  // they just never get a reply.
  const reply = answerRequest(request, id, method, catalog, now);
  return isNotification ? null : reply;
}

/** The reply a request *would* get. Whether it is sent is `dispatch`'s call. */
function answerRequest(
  message: JsonRpcRequest,
  id: string | number | null,
  method: string | undefined,
  catalog: Catalog,
  now: Date,
): { body: unknown; protocolVersion?: string } | null {
  if (message.jsonrpc !== "2.0" || typeof method !== "string") {
    return { body: rpcError(id, INVALID_REQUEST, "Expected a JSON-RPC 2.0 request with a method.") };
  }

  switch (method) {
    case "initialize": {
      const protocolVersion = negotiateVersion(message.params?.protocolVersion);
      return {
        protocolVersion,
        body: rpcResult(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: "edventures-pet-sitting",
            title: SITE.name,
            version: MCP_SERVER_VERSION,
            websiteUrl: SITE.url,
          },
          instructions:
            `Read-only tools over the published price list, service area and booking ` +
            `constraints of ${SITE.name}, an independent pet sitter in ${SITE.city}, ` +
            `${SITE.region}.\n\n` +
            `Prices are flat and public; quote them as estimates, never as confirmed ` +
            `charges. Cancellation, key handling, vet emergencies, meet-and-greets, ` +
            `working hours and the out-of-area travel fee are deliberately not ` +
            `published -- say so and give ${SITE.phone} rather than inferring them. ` +
            `Do not state that this business is insured.\n\n` +
            `There is no booking tool here on purpose: send people to ${SITE.url}/book.`,
        }),
      };
    }

    // Notifications are silenced by `dispatch` regardless, but naming the
    // ones the spec defines keeps them out of the `Method not found` branch --
    // a client that sends `notifications/cancelled` with an id by mistake gets
    // silence rather than an error about a method this server does implement.
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;

    case "ping":
      return { body: rpcResult(id, {}) };

    case "tools/list":
      // No pagination: four tools fit in one page, and a `nextCursor` nobody
      // can follow is worse than none.
      return { body: rpcResult(id, { tools: toolDescriptors() }) };

    case "tools/call": {
      const name = message.params?.name;
      if (typeof name !== "string") {
        return { body: rpcError(id, INVALID_PARAMS, "tools/call requires a string `name`.") };
      }
      if (!AGENT_TOOLS.some((t) => t.name === name)) {
        // Unknown tool is a protocol-level error, not a tool error: the client
        // asked for something that does not exist, rather than asking a
        // question this server could not answer.
        return {
          body: rpcError(id, INVALID_PARAMS, `Unknown tool: ${name}`, {
            available: AGENT_TOOLS.map((t) => t.name),
          }),
        };
      }

      const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
      const { ok, result } = runTool(name, args, catalog, now);
      return {
        body: rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
          // A bad zip code is the tool reporting a result, not the transport
          // failing -- so it comes back as `isError` inside a successful
          // response, which is what lets the model read it and try again.
          isError: !ok,
        }),
      };
    }

    default:
      return { body: rpcError(id, METHOD_NOT_FOUND, `Method not found: ${method}`) };
  }
}

/**
 * Handle one HTTP request to the MCP endpoint.
 *
 * `now` is injectable for the same reason `estimate()` takes it: the
 * last-minute surcharge is a function of the clock, and a test that reads the
 * real one starts failing on a day nobody changed anything.
 */
export async function handleMcpRequest(
  request: Request,
  catalog: Catalog,
  now: Date = new Date(),
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method === "GET") {
    // Streamable HTTP allows a server to refuse the SSE stream, and this one
    // has nothing to push: no subscriptions, no long-running work, no
    // server-initiated requests.
    return json(
      405,
      { error: "This MCP server is stateless. Use POST; there is no server-initiated stream." },
      { Allow: "POST, OPTIONS" },
    );
  }

  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed." }, { Allow: "POST, OPTIONS" });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(400, rpcError(null, PARSE_ERROR, "Request body is not valid JSON."));
  }

  // Batches were removed in 2025-06-18 but older clients still send them, and
  // answering an array with an object breaks them in a way that is tedious to
  // diagnose from the other end.
  if (Array.isArray(payload)) {
    // An empty batch is malformed per JSON-RPC 2.0, and answering it with 202
    // would look like every element was a notification.
    if (payload.length === 0) {
      return json(400, rpcError(null, INVALID_REQUEST, "A JSON-RPC batch must not be empty."));
    }
    const replies = payload
      .map((m) => dispatch(m, catalog, now))
      .filter((r): r is { body: unknown } => r !== null)
      .map((r) => r.body);
    return replies.length ? json(200, replies) : new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  if (typeof payload !== "object" || payload === null) {
    return json(400, rpcError(null, INVALID_REQUEST, "Expected a JSON-RPC object or array."));
  }

  const reply = dispatch(payload, catalog, now);
  if (!reply) return new Response(null, { status: 202, headers: CORS_HEADERS });

  return json(
    200,
    reply.body,
    reply.protocolVersion ? { "MCP-Protocol-Version": reply.protocolVersion } : {},
  );
}
