/**
 * GET /api/health - the `status` target in the API catalog.
 *
 * Answers the question an agent actually has before posting a booking: not
 * "is the site up" -- it just fetched a page -- but "would a submission get
 * through". Without `RESEND_API_KEY` the booking endpoint refuses rather than
 * pretending (see `functions/api/booking.ts`), so a client that checks here
 * first can offer the phone number instead of collecting twelve fields and
 * then failing.
 *
 * Booleans only, deliberately. Whether a binding exists is useful; its value
 * is nobody's business, and a health endpoint is a favourite place for that
 * distinction to get lost.
 */
import { getCatalogFromJson } from "../../src/lib/catalog-json";
import { SERVED_ZIPS } from "../../src/lib/site";

interface Env {
  RESEND_API_KEY?: string;
  BOOKINGS?: unknown;
}

interface PagesContext {
  request: Request;
  env: Env;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed." }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "GET, HEAD, OPTIONS" },
    });
  }

  const catalog = getCatalogFromJson();
  const bookingsAcceptable = Boolean(env.RESEND_API_KEY);

  const body = {
    ok: true,
    service: "edventures-pet-sitting",
    /** False means a POST to /api/booking would answer 502. Offer the phone. */
    bookingsAcceptable,
    /** Whether submissions are durably logged (Roadmap 3.10). */
    bookingLogging: Boolean(env.BOOKINGS),
    mcp: true,
    services: catalog.services.length,
    servedZips: SERVED_ZIPS.length,
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      // A health check that is cached is a health check that lies, but a
      // stampede on a Function costs real money. Ten seconds is the compromise.
      "Cache-Control": "public, max-age=10",
    },
  });
};
