/**
 * Markdown for agents: `Accept: text/markdown` gets the markdown twin.
 *
 * The build writes `about.md` beside `about.html` (see
 * `scripts/agent-build-assets.ts`), and this hands it over when a client asks
 * for it. HTML stays the default for everyone else, which is the whole
 * contract: browsers must not notice this exists.
 *
 * Why a middleware rather than a redirect: the URL of a page is the URL of a
 * page. An agent that follows a link, or that is quoting a source, should get
 * the content at that address rather than being bounced to a second one it
 * then has to explain. `Vary: Accept` is what keeps caches honest about the
 * two representations sharing an address, and it is set here as well as in
 * `_headers` because a response this file constructs never passes through the
 * asset server's header rules.
 *
 * The cost is that every non-asset request now wakes a Worker. `_routes.json`
 * keeps `/_astro/*` out of it, and the fast path below is three cheap checks
 * before `next()`.
 */
import {
  estimateTokens,
  isNegotiablePath,
  markdownTwin,
  prefersMarkdown,
} from "../src/lib/markdown-negotiation";

interface PagesContext {
  request: Request;
  next(request?: Request): Promise<Response>;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, next } = context;

  // Only a safe method can have two representations of the same thing. A POST
  // to /api/booking is not a page and has no markdown twin.
  if (request.method !== "GET" && request.method !== "HEAD") return next();
  if (!prefersMarkdown(request.headers.get("Accept"))) return next();

  const url = new URL(request.url);
  if (!isNegotiablePath(url.pathname)) return next();

  const twin = new URL(url);
  twin.pathname = markdownTwin(url.pathname);

  // A HEAD request must not become a GET: the client asked for headers.
  const markdown = await next(new Request(twin, request));

  // No twin -- an unknown path, or a page the build skipped. Fall back to
  // whatever the URL really serves, including its 404.
  if (!markdown.ok) return next();

  const headers = new Headers(markdown.headers);
  headers.set("Content-Type", "text/markdown; charset=utf-8");
  headers.set("Vary", "Accept");
  headers.set("Content-Location", markdownTwin(url.pathname));
  headers.set("Access-Control-Allow-Origin", "*");

  if (request.method === "HEAD") {
    return new Response(null, { status: markdown.status, headers });
  }

  const body = await markdown.text();
  headers.set("x-markdown-tokens", String(estimateTokens(body)));
  // Recomputed, because swapping the body for one of a different length would
  // otherwise leave the twin's own Content-Length in place.
  headers.delete("Content-Length");

  return new Response(body, { status: markdown.status, headers });
};
