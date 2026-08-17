import { defineCollection, z } from "astro:content";
import { file, glob } from "astro/loaders";

/**
 * Content collections for Edventures Pet Sitting.
 *
 * These files are the single source of truth. The images in
 * starting-assets/ are archival - never re-derive content from them.
 *
 * Schemas are deliberately strict: a malformed edit should fail the
 * build rather than ship a wrong price. That matters more here than
 * usual, because Phase 5 hands editing to Edward via a CMS.
 */

const services = defineCollection({
  loader: file("src/content/services.json"),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    blurb: z.string(),
    /** Duration in minutes -> price in whole dollars. */
    tiers: z.array(z.object({ minutes: z.number().int().positive(), price: z.number().positive() })),
    order: z.number().int(),
  }),
});

const addons = defineCollection({
  loader: file("src/content/addons.json"),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    price: z.number().nonnegative(),
    note: z.string().optional(),
    freeWithOvernight: z.boolean().default(false),
  }),
});

const fees = defineCollection({
  loader: file("src/content/fees.json"),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    amount: z.number().positive(),
    /** Applied automatically by the booking form's estimator. */
    auto: z.boolean().default(false),
  }),
});

const photos = defineCollection({
  loader: file("src/content/photos.json"),
  schema: z.object({
    id: z.string(),
    src: z.string(),
    caption: z.string(),
    /** Observed, never inferred from the filename. */
    alt: z.string(),
    placement: z.enum(["hero", "about", "gallery", "excluded"]),
    /** EXIF rotation must be applied and stripped before publishing. */
    needsExifRotation: z.boolean().default(false),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

export const collections = { services, addons, fees, photos, pages };
