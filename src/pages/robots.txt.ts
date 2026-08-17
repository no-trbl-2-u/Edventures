import type { APIRoute } from "astro";
import { SITE } from "../lib/site";

/**
 * robots.txt (Roadmap 2.6.1 / 2.7.3).
 *
 * AI crawlers are allowed. That is a decision, not a default: the reasoning
 * publishers use to block them -- protecting paid or proprietary content --
 * doesn't apply to a pet-sitting business that wants to be found. Being the
 * answer when someone asks an assistant "who walks dogs in Rittenhouse?" is
 * worth more here than withholding six pages of public copy.
 *
 * Worth knowing if this is ever revisited: Google-Extended governs training and
 * grounding use only. Disallowing it does NOT remove the site from Google
 * Search -- that's Googlebot, and blocking it would be self-harm.
 *
 * Confirm with Edward before launch; it's his business and a one-line reversal.
 */
export const GET: APIRoute = () => {
  const body = [
    "# Everything here is public. Nothing to hide from crawlers.",
    "User-agent: *",
    "Allow: /",
    "",
    "# AI crawlers explicitly welcome - see src/pages/robots.txt.ts for why.",
    ...["GPTBot", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended", "CCBot"].flatMap(
      (bot) => [`User-agent: ${bot}`, "Allow: /", ""],
    ),
    `Sitemap: ${SITE.url}/sitemap-index.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
