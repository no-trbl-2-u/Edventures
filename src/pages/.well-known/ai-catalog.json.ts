import type { APIRoute } from "astro";
import { ardCatalog } from "../../lib/agent-discovery";

/**
 * /.well-known/ai-catalog.json -- the ARD capability manifest.
 *
 * Where the api-catalog answers "what APIs are here", this answers "what can
 * this site do, and what would you ask it". The `representativeQueries` are
 * the working part: registries embed them to decide whether this domain is
 * worth routing a question to at all.
 *
 * CORS is required by the spec -- a manifest a browser-side agent cannot read
 * is not discoverable -- and is repeated in `public/_headers` for production.
 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(ardCatalog(), null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
