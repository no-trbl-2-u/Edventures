/**
 * The pure mapping from content-collection records to the `Catalog` shape the
 * booking model consumes.
 *
 * It lives apart from `catalog.ts` because there are now two callers with very
 * different capabilities:
 *
 * - `catalog.ts` reads the collections through `astro:content`, which only
 *   exists inside Astro's build. That is what the pages use.
 * - `catalog-json.ts` imports the same JSON files directly, which is what the
 *   booking endpoint uses -- a serverless function has no Astro runtime.
 *
 * Both paths must produce byte-identical catalogs, or the server would price a
 * booking differently from the form that quoted it. Sharing this function is
 * what guarantees that; duplicating the mapping is precisely how the two would
 * drift apart six months from now.
 */
import type { Catalog, CatalogAddon, CatalogFee, CatalogService } from "./booking";

/** The validated record shapes, as defined by `src/content.config.ts`. */
export interface ServiceRecord {
  id: string;
  name: string;
  blurb: string;
  icon: string;
  flatRate: boolean;
  baseLabel?: string;
  note?: string;
  tiers: { minutes: number; price: number }[];
  order: number;
}

export interface AddonRecord {
  id: string;
  name: string;
  price: number;
  note?: string;
  freeWithOvernight: boolean;
}

export interface FeeRecord {
  id: string;
  name: string;
  amount: number;
  auto: boolean;
}

const money = (n: number) => `$${n}`;

export function shapeCatalog(
  serviceRecords: ServiceRecord[],
  addonRecords: AddonRecord[],
  feeRecords: FeeRecord[],
): Catalog {
  const services: CatalogService[] = [...serviceRecords]
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      const cheapest = Math.min(...s.tiers.map((t) => t.price));
      return {
        id: s.id,
        name: s.name,
        blurb: s.blurb,
        icon: s.icon,
        // Flat-rate services expose a `base` and no tiers, so the estimator
        // renders one line instead of offering a duration choice.
        tiers: s.flatRate ? [] : s.tiers,
        base: s.flatRate ? s.tiers[0]?.price : undefined,
        baseLabel: s.baseLabel,
        note: s.note,
        fromLabel: s.flatRate
          ? s.id === "overnight"
            ? `Starting at ${money(cheapest)}`
            : money(cheapest)
          : `From ${money(cheapest)}`,
        /** All tiers, including for flat-rate services, for the pricing page. */
        allTiers: s.tiers,
      } as CatalogService & { note?: string; allTiers: typeof s.tiers };
    });

  const addons: CatalogAddon[] = addonRecords.map((a) => ({
    id: a.id,
    name: a.name,
    price: a.price,
    note: a.note,
    freeWithOvernight: a.freeWithOvernight,
  }));

  const fees: CatalogFee[] = feeRecords.map((f) => ({
    id: f.id,
    name: f.name,
    amount: f.amount,
    auto: f.auto,
  }));

  return { services, addons, fees };
}
