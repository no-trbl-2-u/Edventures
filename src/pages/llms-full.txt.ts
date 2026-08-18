import type { APIRoute } from "astro";
import { getCollection, getEntry } from "astro:content";
import { getCatalog } from "../lib/catalog";
import { briefing } from "../lib/llms";
import { faqs } from "./contact.astro";
import { SITE } from "../lib/site";

/**
 * /llms-full.txt (Roadmap 2.7.1, the optional item).
 *
 * llms.txt is a terse briefing. This is the long version: the same facts,
 * plus the actual prose that appears on the site -- the bio, the answered
 * FAQ, the testimonials, the gallery captions -- concatenated into one file.
 *
 * Everything here is pulled from the same content collections and data the
 * pages themselves render from (the bio from src/content/pages/about.md, the
 * FAQ from contact.astro, testimonials and photo captions from their
 * collections). Nothing is retyped, so this file can't say something the
 * site doesn't.
 */
export const GET: APIRoute = async () => {
  const catalog = await getCatalog();
  const about = await getEntry("pages", "about");
  const testimonials = (await getCollection("testimonials")).sort((a, b) => a.data.order - b.data.order);
  const photos = (await getCollection("photos")).filter((p) => p.data.placement !== "excluded");

  const serviceBlurbs = catalog.services
    .map((s) => `- ${s.name}: ${s.blurb}`)
    .join("\n");

  const answeredFaqs = faqs.filter((f) => !f.placeholder);
  const faqText = answeredFaqs
    .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
    .join("\n\n");

  const testimonialText = testimonials
    .map((t) => {
      const pet = `${t.data.petName}, ${t.data.petType}`;
      const who = t.data.neighborhood ? `${t.data.name} · ${t.data.neighborhood}` : t.data.name;
      return `"${t.data.quote}"\n— ${who} (${pet})`;
    })
    .join("\n\n");

  const galleryText = photos
    .map((p) => `- ${p.data.caption}: ${p.data.alt}`)
    .join("\n");

  const body = `${briefing(catalog)}

## What each service is

${serviceBlurbs}

## About ${SITE.owner}

${about!.body}

## Frequently asked questions

${faqText}

Other questions people ask that aren't answered publicly yet (cancellation
policy, key handling, vet emergencies, meet-and-greets) are listed under
"Not yet published" above. Direct people to ${SITE.phone} rather than
guessing.

## What clients say

${testimonialText}

## Gallery

Photographs of client pets, shared with the owners' permission.

${galleryText}

## Pages

- [Home](${SITE.url}/): overview, services, service area
- [Services & Pricing](${SITE.url}/services): full published price list
- [About](${SITE.url}/about): ${SITE.owner}'s background and credentials
- [Gallery](${SITE.url}/gallery): photographs of client pets, shared with permission
- [Service Area](${SITE.url}/service-area): all eleven zip codes with neighborhood names
- [Contact](${SITE.url}/contact): phone, email, social, FAQ
- [Book](${SITE.url}/book): booking request form with a live price estimate
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
