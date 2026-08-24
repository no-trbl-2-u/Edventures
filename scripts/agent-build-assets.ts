/**
 * The build step that makes the site legible to agents.
 *
 * Three files, all derived from what the build actually produced rather than
 * from a list somebody maintains:
 *
 * 1. **A markdown twin of every page** -- `about.html` gets `about.md`. Not
 *    written by hand and not reassembled from the content collections, but
 *    converted from the rendered HTML. That is the whole point: a hand-written
 *    markdown copy of /about drifts from /about on the first edit, whereas a
 *    conversion cannot say anything the page does not. It also means a page
 *    added next year gets its markdown twin for free.
 * 2. **`_headers`** -- the RFC 8288 `Link` set on every page, the content types
 *    Cloudflare Pages cannot infer from a filename, and CORS on the discovery
 *    documents. The rules live in `src/lib/agent-discovery.ts`; the page list
 *    comes from the walk below.
 * 3. **`_routes.json`** -- keeps `/_astro/*` away from the middleware, so
 *    hashed CSS, JS and images are served straight from the asset store
 *    instead of waking a Worker for each one.
 *
 * Runs as an `astro:build:done` integration so it is part of `astro build`,
 * which is what Cloudflare Pages runs. A separate npm script would work
 * locally and then quietly not run in production.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import TurndownService from "turndown";
import { buildHeadersFile } from "../src/lib/agent-discovery";
import { markdownTwin } from "../src/lib/markdown-negotiation";

/**
 * Pages with no markdown twin and no `Link` header.
 *
 * `404` is the only one: an error page has no content worth converting, and
 * advertising a markdown alternate of it would be odd.
 */
const SKIP = new Set(["404"]);

/** Every file under `dir` with the given suffix, relative and POSIX-separated. */
async function filesWithSuffix(dir: string, suffix: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // `_astro` holds hashed bundles, never pages.
      if (entry.name === "_astro") continue;
      found.push(...(await filesWithSuffix(full, suffix, base)));
    } else if (entry.name.endsWith(suffix)) {
      found.push(relative(base, full).split(sep).join("/"));
    }
  }
  return found.sort();
}

/**
 * The served URL for a built file, given `build.format: 'file'` and
 * `trailingSlash: 'never'`: `index.html` → `/`, `docs/api.html` → `/docs/api`.
 *
 * The same transformation `Base.astro` applies to build the canonical URL. If
 * either of those config options changes, both have to change together.
 */
export function servedPath(file: string): string {
  // `index` is stripped at every depth, not just the root: Pages serves
  // `docs/index.html` at `/docs`. Keying the `_headers` rule on `/docs/index`
  // would match nothing, and the middleware -- which sees `/docs` -- would
  // look for `/docs.md` while the twin sat at `/docs/index.md`. The page would
  // quietly get neither its Link headers nor its markdown.
  const withoutExt = file.replace(/\.html$/, "");
  const withoutIndex = withoutExt.replace(/(^|\/)index$/, "");
  return withoutIndex === "" ? "/" : `/${withoutIndex}`;
}

function converter(): TurndownService {
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    hr: "---",
  });

  // Hydration plumbing and styling. Without this turndown emits the raw text
  // content of a <script> as if it were prose. Inline `<svg>` belongs on this
  // list too, but turndown types `remove()` against `HTMLElementTagNameMap`,
  // which has no entry for it -- so the `decorative` rule below takes it.
  service.remove(["script", "style", "noscript", "template"]);

  // Astro's island markers wrap real content, so they are unwrapped rather
  // than removed -- dropping them would take the booking form's text with them.
  service.addRule("astroIsland", {
    filter: (node) => node.nodeName.toLowerCase() === "astro-island",
    replacement: (content) => content,
  });

  /**
   * Anything hidden from assistive technology is hidden here too.
   *
   * The site already marks its decoration -- paw dividers, ribbon flourishes,
   * icon glyphs -- with `aria-hidden` or an empty `alt`, because that is what
   * a screen reader needs. An agent reading the page wants the same view, so
   * the accessibility markup does double duty rather than needing a second,
   * parallel set of "ignore this" annotations that would drift from it.
   */
  service.addRule("decorative", {
    filter: (node) => {
      const el = node as unknown as { getAttribute?(name: string): string | null };
      if (typeof el.getAttribute !== "function") return false;
      // Every icon on the site is an inline <svg>, and a path definition is
      // not content in any rendering of the word.
      if (node.nodeName.toLowerCase() === "svg") return true;
      if (el.getAttribute("aria-hidden") === "true") return true;
      return node.nodeName.toLowerCase() === "img" && !el.getAttribute("alt");
    },
    replacement: () => "",
  });

  // `<dt>`/`<dd>` is how every price on /services is marked up. Turndown has no
  // rule for definition lists and would emit the term and the price as two
  // unrelated paragraphs -- which is exactly the "$25 for what?" ambiguity the
  // markup exists to prevent.
  service.addRule("definitionTerm", {
    filter: "dt",
    replacement: (content) => `\n- **${content.trim()}**: `,
  });
  service.addRule("definitionDescription", {
    filter: "dd",
    replacement: (content) => `${content.trim()}\n`,
  });

  // A typographic line break inside a heading, rendered as markdown's
  // two-space break, produces a heading followed by an orphaned word. The only
  // `<br>` on the site is exactly that case.
  service.addRule("lineBreak", {
    filter: "br",
    replacement: () => " ",
  });

  /**
   * Separate `<span>`s and `<button>`s that CSS lays out as rows or a grid.
   *
   * A service card is one `<a>` wrapping three `<span>`s -- name, blurb,
   * price -- displayed as rows; the booking form's service picker is a grid of
   * `<button>`s. Turndown has no CSS, so it concatenates them into
   * `Dog WalksA walk at your dog's pace...From $15` and `1 · Service2 ·
   * Schedule`. That does not just read badly: it fuses the end of one label to
   * the start of the next, and a model parsing "WalksA" or "Service2" has been
   * handed a word that is not on the page.
   *
   * The test is whether the element's *next sibling is an element*. One used
   * inline, mid-sentence, is followed by a text node -- the rest of the
   * sentence -- so it keeps the default treatment and the separator lands only
   * where two of them genuinely sit apart on screen.
   */
  service.addRule("stackedControl", {
    filter: (node) =>
      ["span", "button"].includes(node.nodeName.toLowerCase()) &&
      // 1 is Node.ELEMENT_NODE; turndown's DOM shim has no Node constant.
      node.nextSibling?.nodeType === 1,
    replacement: (content) => (content.trim() ? `${content.trim()} · ` : ""),
  });

  /**
   * A link that begins where the previous element ended needs a gap.
   *
   * The button rows and the "see every neighborhood" links sit as element
   * siblings after a paragraph or another link, and markdown has no block
   * boundary to fall back on, so the output reads
   * `...usually yes.[See every neighborhood](/service-area)`. Prefixing a
   * space is the whole fix; the href is rebuilt because adding a rule for `a`
   * replaces turndown's own.
   */
  service.addRule("adjacentLink", {
    filter: (node) => {
      const el = node as unknown as { getAttribute?(name: string): string | null };
      return (
        node.nodeName.toLowerCase() === "a" &&
        typeof el.getAttribute === "function" &&
        Boolean(el.getAttribute("href")) &&
        node.previousSibling?.nodeType === 1
      );
    },
    replacement: (content, node) => {
      const href = (node as unknown as { getAttribute(name: string): string }).getAttribute("href");
      const text = content.trim();
      return text ? ` [${text}](${href})` : "";
    },
  });

  return service;
}

/** The page body, or `null` if the layout has changed shape. */
function extractMain(html: string): string | null {
  const match = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  return match ? match[1] : null;
}

function extractTitle(html: string): string {
  const match = /<title>([\s\S]*?)<\/title>/i.exec(html);
  return match ? decodeEntities(match[1].trim()) : "";
}

function extractDescription(html: string): string {
  const match = /<meta\s+name="description"\s+content="([^"]*)"/i.exec(html);
  return match ? decodeEntities(match[1].trim()) : "";
}

/** Only the five XML entities Astro emits into title and meta attributes. */
function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Convert one page. Exported so the tests can feed it fixture HTML rather than
 * running a full build.
 */
export function pageToMarkdown(html: string, path: string, canonical: string): string | null {
  const main = extractMain(html);
  if (main === null) return null;

  const body = converter()
    .turndown(main)
    // Turndown leaves runs of blank lines where nested layout divs collapsed.
    .replace(/\n{3,}/g, "\n\n")
    // Each price row is a <div> wrapping its <dt>/<dd>, so turndown separates
    // consecutive items with a blank line and the price list reads as a run of
    // one-item lists. Only ever joins a list item to a list item.
    .replace(/(^- .*)\n\n(?=- )/gm, "$1\n")
    // Removing a decorative icon leaves the separator with the space that
    // followed it, so ` \u00b7  Label` needs collapsing back to ` \u00b7 Label`.
    .replace(/ \u00b7 +/g, " \u00b7 ")
    // ...and a separator whose following sibling converted to nothing at all
    // is left dangling at the end of its line.
    .replace(/ \u00b7 *$/gm, "")
    // Where the markup runs a link straight on from the sentence before it --
    // `...usually yes.<a>See every neighborhood</a>`, spaced by CSS alone --
    // markdown has nothing to separate them with.
    .replace(/([.!?\u2026,;:])\[/g, "$1 [")
    // Two links side by side pick up a gap from turndown and another from the
    // rule above.
    .replace(/\)\s{2,}\[/g, ") [")
    .trim();

  const title = extractTitle(html);
  const description = extractDescription(html);

  // A short front matter block, because the first thing an agent fetching this
  // needs is to know which page it is holding and where the HTML lives.
  const header = [
    "---",
    `title: ${JSON.stringify(title)}`,
    description ? `description: ${JSON.stringify(description)}` : "",
    `source: ${JSON.stringify(canonical)}`,
    `path: ${JSON.stringify(path)}`,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  return `${header}\n\n${body}\n`;
}

interface Logger {
  info(message: string): void;
  warn(message: string): void;
}

interface IntegrationHooks {
  name: string;
  hooks: {
    "astro:config:done"(options: { config: { site?: URL | string } }): void;
    "astro:build:done"(options: { dir: URL; logger: Logger }): Promise<void>;
  };
}

export default function agentBuildAssets(): IntegrationHooks {
  // Taken from Astro's own resolved config rather than passed in. The `site`
  // option already decides which origin a build is for -- it is what the
  // canonical URLs and the sitemap use -- and a second copy in the integration
  // call is one more place for a preview build to end up advertising
  // production's URLs.
  let site = "";

  return {
    name: "agent-build-assets",
    hooks: {
      "astro:config:done": ({ config }) => {
        site = String(config.site ?? "");
      },

      "astro:build:done": async ({ dir, logger }) => {
        if (!site) {
          // Only reachable if `site` is dropped from astro.config.mjs, which
          // would also break the canonical URLs and the sitemap. Say which one
          // is missing rather than throwing "Invalid URL" from a build hook.
          logger.warn("No `site` in the Astro config; skipping agent build assets.");
          return;
        }

        const out = fileURLToPath(dir);
        const files = await filesWithSuffix(out, ".html");

        const pagePaths: string[] = [];
        let written = 0;

        for (const file of files) {
          const path = servedPath(file);
          if (SKIP.has(file.replace(/\.html$/, ""))) continue;

          const html = await readFile(join(out, file), "utf8");
          const canonical = new URL(path, site).href;
          const markdown = pageToMarkdown(html, path, canonical);

          if (markdown === null) {
            // Loud, not silent. If the layout stops emitting a <main>, every
            // markdown twin vanishes, and a build that shipped that quietly
            // would leave the Link headers advertising 404s.
            logger.warn(`No <main> found in ${file}; no markdown twin written.`);
            continue;
          }

          await writeFile(join(out, markdownTwin(path).slice(1)), markdown, "utf8");
          written++;
          // Recorded only now. Pushing before the guard above meant a page
          // whose conversion failed still got `Link: </foo.md>; rel="alternate"`
          // and `Vary: Accept` -- the build warned and then shipped a header
          // advertising a 404, which is the exact thing the warning is for.
          pagePaths.push(path);
        }

        // Walked after the twins are written, so the list covers them along
        // with `/auth.md` and each published SKILL.md.
        const markdownPaths = (await filesWithSuffix(out, ".md")).map((f) => `/${f}`);
        await writeFile(
          join(out, "_headers"),
          `${buildHeadersFile(pagePaths, markdownPaths)}\n`,
          "utf8",
        );

        // `include` has to be stated or Pages routes nothing to the middleware.
        // `/_astro/*` is every hashed bundle and optimised image, none of which
        // the middleware has any business seeing.
        await writeFile(
          join(out, "_routes.json"),
          `${JSON.stringify({ version: 1, include: ["/*"], exclude: ["/_astro/*"] }, null, 2)}\n`,
          "utf8",
        );

        logger.info(
          `${written} markdown twin(s), _headers for ${pagePaths.length} page(s) ` +
            `and ${markdownPaths.length} markdown file(s), _routes.json`,
        );
      },
    },
  };
}
