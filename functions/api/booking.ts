/**
 * POST /api/booking - Roadmap 3.7.
 *
 * A Cloudflare Pages Function, which is the whole reason this file is thin.
 * Every decision it makes lives in `src/lib/booking-handler.ts` as a plain
 * `Request -> Response` function; this reads the environment, wires up the
 * pieces, and gets out of the way.
 *
 * Pages Functions rather than Astro's Cloudflare adapter, deliberately: the
 * adapter has dropped Cloudflare Pages support and now targets Workers only,
 * so adopting it would mean migrating a live, DNS-verified apex domain off
 * Pages. This endpoint needs none of that. The site stays static, the deploy
 * command is unchanged, and `functions/` rides along beside `dist/`.
 */
import { handleBookingRequest, type SubmissionRecord } from "../../src/lib/booking-handler";
import { getCatalogFromJson } from "../../src/lib/catalog-json";
import { resendMailer, type Mailer } from "../../src/lib/mailer";
import { kvStore, memoryStore } from "../../src/lib/rate-limit";
import { SERVED_ZIPS, SITE } from "../../src/lib/site";

interface Env {
  /** Resend API key. Until it is set, every submission fails loudly. */
  RESEND_API_KEY?: string;
  /** Verified sender, e.g. `Edventures <bookings@edventures.pet>`. */
  BOOKING_FROM?: string;
  /** Overrides where Edward's notification goes. Defaults to SITE.email. */
  BOOKING_TO?: string;
  /** Durable log + rate-limit counters (3.10). Optional but strongly wanted. */
  BOOKINGS?: KVNamespace;
}

/** Cloudflare's KV type, narrowed to what is used, so this file needs no
 *  `@cloudflare/workers-types` dependency to typecheck under Astro's config. */
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  list(options?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string }[] }>;
}

interface PagesContext {
  request: Request;
  env: Env;
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * A mailer that refuses rather than pretends.
 *
 * With no API key there is no way to reach Edward, and the one thing this
 * endpoint must never do is answer 200 to a booking nobody will ever read.
 * Throwing puts the customer on the failure screen with his phone number,
 * which is the honest outcome and the same one they got before 3.7 existed.
 */
function unconfiguredMailer(): Mailer {
  return {
    async send() {
      throw new Error("RESEND_API_KEY is not set; refusing to accept a booking silently.");
    },
  };
}

/**
 * Durable logging, 3.10.
 *
 * Keyed by timestamp so `wrangler kv key list` reads chronologically, with the
 * customer's name in the key to make a specific booking findable without
 * fetching every value. No TTL: these are records, not cache.
 */
function kvLogger(kv: KVNamespace) {
  return async (record: SubmissionRecord) => {
    const slug = record.request.customer.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    await kv.put(`booking:${record.receivedAt}:${slug}`, JSON.stringify(record));
  };
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;

  return handleBookingRequest(request, {
    catalog: getCatalogFromJson(),
    servedZips: SERVED_ZIPS,
    mailer: env.RESEND_API_KEY ? resendMailer(env.RESEND_API_KEY) : unconfiguredMailer(),
    ownerEmail: env.BOOKING_TO || SITE.email,
    // Falls back to Resend's shared testing sender, which only delivers to the
    // account owner. Wrong for production, but it fails visibly rather than
    // appearing to work -- see NEEDS_HUMAN_ATTENTION.md.
    fromAddress: env.BOOKING_FROM || "Edventures <onboarding@resend.dev>",
    site: { phone: SITE.phone, email: SITE.email, url: SITE.url, owner: SITE.owner },
    logSubmission: env.BOOKINGS ? kvLogger(env.BOOKINGS) : undefined,
    // Without KV the limiter is per-isolate and therefore leaky. It is a speed
    // bump either way; KV makes it a real one.
    rateLimitStore: env.BOOKINGS ? kvStore(env.BOOKINGS) : memoryStore(),
    onError: (stage, error) => {
      // Surfaces in `wrangler pages deployment tail`.
      console.error(`[booking] ${stage}:`, error instanceof Error ? error.message : error);
    },
  });
};
