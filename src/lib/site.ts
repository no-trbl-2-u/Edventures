/**
 * Single source of truth for the business facts that appear in more than one
 * place: header, footer, contact page, booking form, structured data, llms.txt.
 *
 * NAP consistency (Roadmap 2.6.2) is the reason this file exists. Name,
 * address/service area and phone must be byte-identical across the site, Google
 * Business Profile, Instagram and Facebook -- `610-888-4541` and
 * `(610) 888-4541` are different strings to a local-search crawler, and the
 * mismatch measurably weakens the signal. Change the format here, nowhere else.
 */

export const SITE = {
  name: "Edventures Pet Sitting",
  tagline: "Adventurous care. Tailored for your pet.",
  owner: "Edward",
  city: "Philadelphia",
  region: "PA",
  country: "US",

  /** Display format. This exact string is the canonical NAP phone. */
  phone: "610-888-4541",
  /** RFC 3966 form for `tel:` links. */
  phoneHref: "tel:+16108884541",

  email: "edventurespetsitting@gmail.com",

  instagram: "https://instagram.com/edventurespetsitting",
  facebook: "https://facebook.com/edventurespetsitting",
  socialHandle: "@edventurespetsitting",

  /**
   * Canonical origin. Canonical URLs, the sitemap, Open Graph image URLs and
   * llms.txt all derive from it.
   *
   * Apex, not www -- picked once and enforced with a redirect, because serving
   * both splits ranking signal between two addresses (Roadmap 2.6.1).
   */
  url: "https://edventures.pet",

  /** Years of experience, as claimed on the flyer and in the bio. */
  yearsExperience: 15,
} as const;

/**
 * The eleven served zip codes with their neighbourhood names.
 *
 * The names matter as much as the numbers: "dog walker Fairmount" is a query
 * people actually type, while nobody searches a bare zip code. This is why
 * /service-area stayed a real page instead of folding into /contact.
 */
export const SERVICE_AREA = [
  { zip: "19102", neighborhood: "Rittenhouse" },
  { zip: "19104", neighborhood: "University City" },
  { zip: "19106", neighborhood: "Old City" },
  { zip: "19107", neighborhood: "Washington Square West" },
  { zip: "19123", neighborhood: "Northern Liberties" },
  { zip: "19130", neighborhood: "Fairmount" },
  { zip: "19143", neighborhood: "Cedar Park" },
  { zip: "19145", neighborhood: "Point Breeze" },
  { zip: "19146", neighborhood: "Graduate Hospital" },
  { zip: "19147", neighborhood: "Queen Village" },
  { zip: "19148", neighborhood: "Pennsport" },
] as const;

export const SERVED_ZIPS = SERVICE_AREA.map((a) => a.zip);

export const NAV = [
  { href: "/services", label: "Services & Pricing", shortLabel: "Services & Pricing" },
  { href: "/about", label: "About", shortLabel: "About Edward" },
  { href: "/gallery", label: "Gallery", shortLabel: "Gallery" },
  { href: "/contact", label: "Contact", shortLabel: "Contact" },
] as const;

/**
 * Trust claims shown in the strip and the footer.
 *
 * "Insured" is deliberately absent. The Claude Design comp includes it, and the
 * original flyer claims it, but it is unverified -- and if Edward's only cover
 * is Rover's, it likely does not extend to work booked through this site at all
 * (go-back-to-ed.md, A3). Every other claim here is confirmed. Add insurance
 * back only once there's a policy number behind it.
 */
export const TRUST_BADGES = [
  { icon: "award", label: `${SITE.yearsExperience} Years Experience` },
  { icon: "heart-pulse", label: "CPR & First-Aid Certified" },
  { icon: "badge-check", label: "Background Checked" },
] as const;

/** Same list, as a single line for the footer rule. */
export const TRUST_LINE = TRUST_BADGES.map((b) => b.label).join(" · ");
