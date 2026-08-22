/**
 * The same catalog, built without Astro.
 *
 * The booking endpoint runs as a serverless function with no `astro:content`
 * available, but it still has to price a request from the real numbers -- a
 * server that trusts the client's total is not validating anything. So it reads
 * the identical JSON files the content collections read, and shapes them with
 * the identical function.
 *
 * These imports skip the Zod schemas in `content.config.ts`, which is
 * acceptable only because the build already validates the very same files: a
 * malformed price fails `astro build` before this code could ever see it.
 *
 * No `with { type: "json" }` attribute, deliberately. Cloudflare's Pages git
 * builder compiles `functions/` with its own pinned wrangler 3, whose esbuild
 * predates import attributes and dies on the syntax -- while esbuild and Vite
 * import JSON fine without it. The one place that genuinely needs the
 * attribute is Node's ESM loader in `npm test`, and the test runner's resolve
 * hook (tests/resolve-hooks.mjs) supplies it there instead.
 */
import { shapeCatalog, type AddonRecord, type FeeRecord, type ServiceRecord } from "./catalog-shape";
import type { Catalog } from "./booking";

import serviceRecords from "../content/services.json";
import addonRecords from "../content/addons.json";
import feeRecords from "../content/fees.json";

let cached: Catalog | null = null;

/** Cached, because a warm isolate serves many requests and the shape is pure. */
export function getCatalogFromJson(): Catalog {
  cached ??= shapeCatalog(
    serviceRecords as ServiceRecord[],
    addonRecords as AddonRecord[],
    feeRecords as FeeRecord[],
  );
  return cached;
}
