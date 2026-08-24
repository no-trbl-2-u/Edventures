import type { APIRoute } from "astro";
import { mcpServerCard } from "../../../lib/agent-discovery";

/**
 * /.well-known/mcp/server-card.json -- SEP-1649.
 *
 * Published because there is a server behind it: `functions/api/mcp.ts`
 * answers `initialize`, `tools/list` and `tools/call` at the endpoint this
 * card advertises. A card pointing at nothing would be worse than no card,
 * since an agent that reads one stops looking for another way in.
 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(mcpServerCard(), null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
