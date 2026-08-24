import type { APIRoute } from "astro";
import { apiCatalog } from "../../lib/agent-discovery";

/**
 * /.well-known/api-catalog -- RFC 9727.
 *
 * The entry point an agent is told about by the `Link: rel="api-catalog"`
 * header on every page. It says which APIs exist and, for each, where the
 * OpenAPI description, the human documentation and the health check live.
 *
 * No file extension, deliberately: RFC 9727 registers this exact well-known
 * URI. Cloudflare Pages types static assets by extension and would serve an
 * extensionless file as octet-stream, so the required
 * `application/linkset+json` is pinned in `public/_headers`. The header set
 * here is what `astro dev` serves and what the tests read.
 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(apiCatalog(), null, 2), {
    headers: {
      "Content-Type": "application/linkset+json",
      "Access-Control-Allow-Origin": "*",
    },
  });
