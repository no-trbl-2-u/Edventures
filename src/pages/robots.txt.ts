import type { APIRoute } from "astro";
import { ENDPOINTS } from "../lib/agent-discovery";
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
 *
 * The `Content-Signal` lines say the same thing in the machine-readable form
 * (contentsignals.org, draft-romm-aipref-contentsignals). They are a
 * declaration of preference, not an access control -- `Allow: /` is what
 * actually governs fetching -- but stating a preference is worth more than
 * leaving it to be guessed, and the guess for an unmarked site is increasingly
 * "no". All three are `yes` here, which follows from the decision above rather
 * than being a separate one: a business that wants to be the answer when
 * somebody asks an assistant for a dog walker in Rittenhouse wants its prices
 * trained on, searched, and used as input.
 *
 * If Edward reverses that decision, both halves change together. A robots.txt
 * that allows GPTBot while signalling `ai-train=no` says two different things
 * to two different readers.
 */
export const GET: APIRoute = () => {
  const body = [
    "# Everything here is public. Nothing to hide from crawlers.",
    "#",
    "# Content-Signal below declares how this content may be used, per",
    "# https://contentsignals.org. `yes` means the preference is granted:",
    "#   search    = build a search index and link back here",
    "#   ai-input  = use the content to ground an AI answer, with attribution",
    "#   ai-train  = use the content to train a generative model",
    "#",
    "# This is a small pet-sitting business that wants to be found. All three",
    "# are yes on purpose -- see src/pages/robots.txt.ts.",
    "User-agent: *",
    "Content-Signal: search=yes, ai-input=yes, ai-train=yes",
    "Allow: /",
    "",
    "# AI crawlers explicitly welcome - see src/pages/robots.txt.ts for why.",
    ...["GPTBot", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended", "CCBot"].flatMap(
      (bot) => [
        `User-agent: ${bot}`,
        "Content-Signal: search=yes, ai-input=yes, ai-train=yes",
        "Allow: /",
        "",
      ],
    ),
    `Sitemap: ${SITE.url}/sitemap-index.xml`,
    "",
    "# Machine-readable descriptions of this site, for agents that want more",
    "# than the pages. Every page also carries these as RFC 8288 Link headers.",
    ...[
      ENDPOINTS.apiCatalog,
      ENDPOINTS.ardCatalog,
      ENDPOINTS.mcpServerCard,
      ENDPOINTS.agentSkills,
      ENDPOINTS.openapi,
      ENDPOINTS.llms,
      ENDPOINTS.authMd,
    ].map((path) => `# ${SITE.url}${path}`),
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
