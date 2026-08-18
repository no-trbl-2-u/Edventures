import type { APIRoute } from "astro";
import { getCatalog } from "../lib/catalog";
import { briefing } from "../lib/llms";
import { SITE } from "../lib/site";

/**
 * /llms.txt (Roadmap 2.7.1).
 *
 * A short, factual briefing for language models: what the business does, what
 * it costs, where it operates, how to reach it. The facts themselves live in
 * src/lib/llms.ts, shared with /llms-full.txt, so the two can't drift apart.
 *
 * Generated from the same content collections the pages render from. Writing
 * this by hand would guarantee it goes stale on the first price change -- and a
 * stale llms.txt is worse than none, because it teaches an assistant to quote a
 * number Edward no longer charges.
 *
 * Honest caveat: llms.txt is a community convention, not a standard, and
 * support is uneven. It costs a few dozen lines and cannot hurt. Clean semantic
 * HTML plus the JSON-LD in src/lib/structured-data.ts is what actually gets
 * read today.
 */
export const GET: APIRoute = async () => {
  const catalog = await getCatalog();

  const body = `${briefing(catalog)}

## Pages

- [Home](${SITE.url}/): overview, services, service area
- [Services & Pricing](${SITE.url}/services): full published price list
- [About](${SITE.url}/about): ${SITE.owner}'s background and credentials
- [Gallery](${SITE.url}/gallery): photographs of client pets, shared with permission
- [Service Area](${SITE.url}/service-area): all eleven zip codes with neighborhood names
- [Contact](${SITE.url}/contact): phone, email, social, FAQ
- [Book](${SITE.url}/book): booking request form with a live price estimate

For the full text of every page in one file, see [llms-full.txt](${SITE.url}/llms-full.txt).
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
