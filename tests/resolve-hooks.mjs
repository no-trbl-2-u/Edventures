/**
 * Lets Node import the project's source files unchanged.
 *
 * Vite (and therefore Astro) resolves `./booking` to `./booking.ts`. Node's ESM
 * resolver does not -- it requires the extension. Rather than write every
 * import in `src/` twice over to satisfy a test runner, this hook retries a
 * failed relative specifier with `.ts` appended.
 *
 * Node strips the types itself, so this is the entire toolchain: no bundler,
 * no transpile step, no test framework.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HAS_EXTENSION = /\.[cm]?[jt]sx?$|\.json$/;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !HAS_EXTENSION.test(specifier)) {
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try {
        const resolved = await nextResolve(candidate, context);
        if (existsSync(fileURLToPath(resolved.url))) return resolved;
      } catch {
        /* Fall through to the next candidate, then to Node's own error. */
      }
    }
  }

  // Source files import JSON without `with { type: "json" }`, because the
  // esbuild inside Cloudflare's pinned wrangler 3 cannot parse the attribute
  // syntax (import attributes postdate it). Bundlers import JSON fine bare;
  // Node's own ESM loader is the one consumer that insists on the attribute,
  // so it is supplied here for the test run instead of in the source.
  if (specifier.endsWith(".json")) {
    const resolved = await nextResolve(specifier, context);
    return { ...resolved, importAttributes: { type: "json" } };
  }

  return nextResolve(specifier, context);
}
