/**
 * Deciding whether a request wants markdown instead of HTML.
 *
 * The whole feature turns on this one judgement, and getting it wrong is
 * expensive in both directions: too eager and a browser is handed a text file
 * instead of the site; too shy and the agents this exists for never see it.
 *
 * So it is a real `Accept` parser rather than a substring test. Every browser
 * sends `*\/*` somewhere in its Accept header, and a `header.includes(...)`
 * check against a wildcard would serve markdown to Safari.
 */

/** One parsed `Accept` entry. */
interface MediaRange {
  type: string;
  quality: number;
}

/** RFC 9110 §12.5.1. Unparseable parameters are ignored, not fatal. */
export function parseAccept(header: string | null): MediaRange[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => {
      const [rawType, ...params] = part.split(";");
      const type = rawType.trim().toLowerCase();
      if (!type) return null;

      let quality = 1;
      for (const param of params) {
        const [key, value] = param.split("=");
        if (key?.trim().toLowerCase() !== "q") continue;
        const parsed = Number.parseFloat(value ?? "");
        // A malformed q is treated as absent, which RFC 9110 permits and which
        // is kinder than dropping the whole media range.
        if (Number.isFinite(parsed)) quality = Math.min(Math.max(parsed, 0), 1);
      }
      return { type, quality };
    })
    .filter((r): r is MediaRange => r !== null);
}

/** The quality the client assigned to a concrete type, wildcards included. */
function qualityFor(ranges: MediaRange[], type: string): number {
  const [group] = type.split("/");
  let best = 0;
  let bestSpecificity = -1;

  for (const range of ranges) {
    // More specific matches win outright, regardless of q: a client asking for
    // `text/html, */*;q=1.0` still prefers HTML.
    const specificity =
      range.type === type ? 2 : range.type === `${group}/*` ? 1 : range.type === "*/*" ? 0 : -1;
    if (specificity < 0) continue;
    if (specificity > bestSpecificity || (specificity === bestSpecificity && range.quality > best)) {
      bestSpecificity = specificity;
      best = range.quality;
    }
  }
  return best;
}

/**
 * Whether to answer this request with markdown.
 *
 * Markdown has to be asked for **by name** and has to beat HTML. A wildcard
 * alone is never enough: `*\/*` means "anything", and for a web page the
 * honest reading of "anything" is the HTML that every other client gets.
 *
 * A tie goes to markdown, because a client that names `text/markdown` at the
 * same weight as `text/html` has gone out of its way to mention it.
 */
export function prefersMarkdown(acceptHeader: string | null): boolean {
  const ranges = parseAccept(acceptHeader);
  const named = ranges.some((r) => r.type === "text/markdown" || r.type === "text/x-markdown");
  if (!named) return false;

  const markdown = Math.max(
    qualityFor(ranges, "text/markdown"),
    qualityFor(ranges, "text/x-markdown"),
  );
  if (markdown === 0) return false;

  return markdown >= qualityFor(ranges, "text/html");
}

/**
 * A rough token count for the `x-markdown-tokens` header.
 *
 * An estimate, and labelled as one in `/docs/api`: running a real tokenizer at
 * the edge would mean shipping vocabulary tables into a Worker to answer a
 * question that is advisory. Four characters per token is the usual
 * approximation for English prose and is close enough to let a client decide
 * whether a page fits in the budget it has left.
 */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Paths that never negotiate.
 *
 * The API endpoints answer JSON, and the discovery documents under
 * `/.well-known/` are already the machine-readable form -- swapping either for
 * a markdown page would break the client that asked for them.
 */
export function isNegotiablePath(pathname: string): boolean {
  if (pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/.well-known/")) return false;
  // Anything with an extension is being asked for by name: `/llms.txt`,
  // `/openapi.json`, `/about.md` itself.
  const last = pathname.slice(pathname.lastIndexOf("/") + 1);
  return !last.includes(".");
}

/**
 * The markdown twin of a page path: `/` → `/index.md`, `/about` → `/about.md`.
 *
 * The `_headers` generator and the middleware must agree on this exactly -- a
 * header advertising an alternate the middleware cannot find is a 404 an agent
 * has no way to recover from -- so both call this rather than each doing the
 * string surgery.
 *
 * It lives here, beside the negotiation, rather than with the discovery
 * documents: the middleware runs on every request that is not a hashed asset,
 * and importing it from `agent-discovery.ts` would drag the tool definitions,
 * the estimator and the whole catalog into that path to do one string replace.
 */
export function markdownTwin(pagePath: string): string {
  const clean = pagePath.replace(/\/+$/, "");
  return clean === "" ? "/index.md" : `${clean}.md`;
}
