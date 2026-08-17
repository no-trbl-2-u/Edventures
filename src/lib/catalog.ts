/**
 * Bridges the validated content collections into the plain `Catalog` shape the
 * booking model and the React island consume.
 *
 * Collections are only readable from Astro's server context, so pages call this
 * and pass the result into the island as props. That keeps one source of truth:
 * prices live in JSON, get schema-checked at build, and reach the estimator as
 * data rather than as constants copied into a component.
 */
import { getCollection } from "astro:content";
import type { Catalog, CatalogAddon, CatalogFee, CatalogService } from "./booking";

const money = (n: number) => `$${n}`;

export async function getCatalog(): Promise<Catalog> {
  const [serviceEntries, addonEntries, feeEntries] = await Promise.all([
    getCollection("services"),
    getCollection("addons"),
    getCollection("fees"),
  ]);

  const services: CatalogService[] = serviceEntries
    .map((e) => e.data)
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

  const addons: CatalogAddon[] = addonEntries.map((e) => ({
    id: e.data.id,
    name: e.data.name,
    price: e.data.price,
    note: e.data.note,
    freeWithOvernight: e.data.freeWithOvernight,
  }));

  const fees: CatalogFee[] = feeEntries.map((e) => ({
    id: e.data.id,
    name: e.data.name,
    amount: e.data.amount,
    auto: e.data.auto,
  }));

  return { services, addons, fees };
}

/** Convenience for the pricing page, which needs the raw tier list back. */
export type PricingService = CatalogService & {
  note?: string;
  allTiers: { minutes: number; price: number }[];
};
