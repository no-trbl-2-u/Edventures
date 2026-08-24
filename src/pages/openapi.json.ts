import type { APIRoute } from "astro";
import { openApiDocument } from "../lib/agent-discovery";
import { getCatalog } from "../lib/catalog";

/**
 * /openapi.json -- the `service-desc` target.
 *
 * Built from the live catalog so the enumerated service and add-on ids, and
 * the example request, are the ones the endpoint will actually accept. An
 * OpenAPI document listing a service id that was renamed is a slower, more
 * confusing 422 than no document at all.
 */
export const GET: APIRoute = async () => {
  const catalog = await getCatalog();
  return new Response(JSON.stringify(openApiDocument(catalog), null, 2), {
    headers: {
      "Content-Type": "application/vnd.oai.openapi+json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
