/**
 * Bridges the validated content collections into the plain `Catalog` shape the
 * booking model and the React island consume.
 *
 * Collections are only readable from Astro's server context, so pages call this
 * and pass the result into the island as props. That keeps one source of truth:
 * prices live in JSON, get schema-checked at build, and reach the estimator as
 * data rather than as constants copied into a component.
 *
 * The mapping itself lives in `catalog-shape.ts`, shared with `catalog-json.ts`
 * -- the booking endpoint has no `astro:content` to read from, and the two
 * catalogs must agree exactly or the server would price what the form quoted
 * differently.
 */
import { getCollection } from "astro:content";
import { shapeCatalog, type AddonRecord, type FeeRecord, type ServiceRecord } from "./catalog-shape";
import type { Catalog, CatalogService } from "./booking";

export async function getCatalog(): Promise<Catalog> {
  const [serviceEntries, addonEntries, feeEntries] = await Promise.all([
    getCollection("services"),
    getCollection("addons"),
    getCollection("fees"),
  ]);

  return shapeCatalog(
    serviceEntries.map((e) => e.data as ServiceRecord),
    addonEntries.map((e) => e.data as AddonRecord),
    feeEntries.map((e) => e.data as FeeRecord),
  );
}

/** Convenience for the pricing page, which needs the raw tier list back. */
export type PricingService = CatalogService & {
  note?: string;
  allTiers: { minutes: number; price: number }[];
};
