/**
 * POST /api/mcp - the Model Context Protocol endpoint.
 *
 * Thin, like its siblings: the protocol lives in `src/lib/mcp.ts` as a plain
 * `Request -> Response` function, and this file supplies the catalog and gets
 * out of the way.
 *
 * A Pages Function rather than an Astro route for the same reason the booking
 * endpoint is one -- the site is `output: 'static'` and stays that way. The
 * catalog comes from `catalog-json.ts`, which reads the same JSON the pages
 * read without needing `astro:content`, so the prices this server quotes are
 * the prices on /services by construction.
 *
 * No environment, no bindings, no secrets. Every tool is read-only and pure,
 * which is why this endpoint needs neither KV nor a mailer to work.
 */
import { getCatalogFromJson } from "../../src/lib/catalog-json";
import { handleMcpRequest } from "../../src/lib/mcp";

interface PagesContext {
  request: Request;
}

export const onRequest = async (context: PagesContext): Promise<Response> =>
  handleMcpRequest(context.request, getCatalogFromJson());
