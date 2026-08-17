/**
 * JSON-LD builders (Roadmap 2.6.3).
 *
 * Every figure here is derived from the content collections. Hand-writing this
 * markup is how sites end up telling Google $25 while the page says $30 -- a
 * ranking penalty and a customer-facing lie in one move. If a price changes in
 * services.json, it changes here on the next build, or nowhere.
 */
import type { Catalog } from "./booking";
import { SERVICE_AREA, SITE } from "./site";

const businessId = `${SITE.url}/#business`;

export function localBusiness() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": businessId,
    name: SITE.name,
    description:
      "Independent dog walking, cat visits, medication administration, nail trims and overnight pet sitting in Philadelphia.",
    url: SITE.url,
    telephone: SITE.phone,
    email: SITE.email,
    image: `${SITE.url}/og-default.png`,
    logo: `${SITE.url}/apple-touch-icon.png`,
    priceRange: "$$",
    founder: { "@type": "Person", name: SITE.owner },
    // Service-area business: Edward works out of clients' homes. Publishing a
    // street address here would publish his own.
    areaServed: SERVICE_AREA.map((a) => ({
      "@type": "PostalCodeRangeSpecification",
      postalCodeBegin: a.zip,
      postalCodeEnd: a.zip,
    })),
    address: {
      "@type": "PostalAddress",
      addressLocality: SITE.city,
      addressRegion: SITE.region,
      addressCountry: SITE.country,
    },
    sameAs: [SITE.instagram, SITE.facebook],
    // NOTE: openingHoursSpecification is deliberately omitted until Edward
    // confirms his real working hours (go-back-to-ed.md, C1). Publishing
    // invented hours would have people ringing at times he doesn't work.
  };
}

export function serviceOffers(catalog: Catalog) {
  return catalog.services.map((service) => {
    const prices = service.tiers.length
      ? service.tiers.map((t) => t.price)
      : [service.base ?? 0];

    return {
      "@context": "https://schema.org",
      "@type": "Service",
      name: service.name,
      description: service.blurb,
      serviceType: service.name,
      provider: { "@id": businessId },
      areaServed: { "@type": "City", name: `${SITE.city}, ${SITE.region}` },
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: Math.min(...prices),
        highPrice: Math.max(...prices),
        offerCount: prices.length,
        availability: "https://schema.org/InStock",
      },
    };
  });
}

export interface FaqItem {
  question: string;
  answer: string;
  /** Unanswered questions are excluded from structured data entirely. */
  placeholder?: boolean;
}

/**
 * Only fully answered questions become FAQ structured data. Emitting a
 * placeholder would hand an assistant a confident, invented policy to repeat
 * back to a customer -- and Edward would be the one correcting it.
 */
export function faqPage(items: FaqItem[]) {
  const answered = items.filter((i) => !i.placeholder);
  if (!answered.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: answered.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function breadcrumbs(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: new URL(crumb.path, SITE.url).href,
    })),
  };
}
