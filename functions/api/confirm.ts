/**
 * GET/POST /api/confirm - Edward's one-button confirmation.
 *
 * Thin, like its sibling in `booking.ts`: read the environment, hand the work
 * to `src/lib/confirm.ts`, get out of the way.
 *
 * GET renders a page and sends nothing; POST sends the customer's
 * confirmation. That split is not decoration - mail scanners prefetch links,
 * and a GET that sent email would confirm bookings nobody looked at.
 */
import { getCatalogFromJson } from "../../src/lib/catalog-json";
import { handleConfirmRequest } from "../../src/lib/confirm";
import { resendMailer, type Mailer } from "../../src/lib/mailer";
import { SITE } from "../../src/lib/site";

interface Env {
  RESEND_API_KEY?: string;
  BOOKING_FROM?: string;
  BOOKINGS?: KVNamespace;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface PagesContext {
  request: Request;
  env: Env;
}

/** Refuses rather than pretending, exactly as the booking endpoint does. */
function unconfiguredMailer(): Mailer {
  return {
    async send() {
      throw new Error("RESEND_API_KEY is not set; refusing to claim a confirmation was sent.");
    },
  };
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;

  // Without KV there is nothing to look a token up in. Say so plainly instead
  // of rendering a page that cannot work.
  if (!env.BOOKINGS) {
    return new Response("Confirmation is unavailable: no booking store is bound.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const kv = env.BOOKINGS;

  return handleConfirmRequest(request, {
    store: {
      get: (key) => kv.get(key),
      put: (key, value) => kv.put(key, value),
    },
    catalog: getCatalogFromJson(),
    mailer: env.RESEND_API_KEY ? resendMailer(env.RESEND_API_KEY) : unconfiguredMailer(),
    fromAddress: env.BOOKING_FROM || "Edventures <onboarding@resend.dev>",
    site: { phone: SITE.phone, email: SITE.email, url: SITE.url, owner: SITE.owner },
    onError: (stage, error) => {
      console.error(`[confirm] ${stage}:`, error instanceof Error ? error.message : error);
    },
  });
};
