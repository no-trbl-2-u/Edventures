/**
 * Roadmap 3.7 - the booking endpoint, as a plain function.
 *
 * `Request` in, `Response` out, with everything it touches passed in as
 * dependencies. That is deliberate: the hosting question for this project is
 * still open (Cloudflare Pages Functions today, possibly the Astro Cloudflare
 * adapter later), and neither choice should reach into the logic. Whichever
 * wins, its route file is a dozen lines that read the environment and call
 * `handleBookingRequest`.
 *
 * It also means the whole endpoint is testable with no server, no network and
 * no credentials.
 *
 * The order of operations matters and is the part worth not rearranging:
 *
 *   parse -> spam -> rate limit -> validate -> log -> email Edward -> email customer
 *
 * Logging happens *before* the send, so a mail failure still leaves a record of
 * a customer who tried to book (3.10). Edward's email is the one that decides
 * the response: if it fails the customer sees the failure screen with his phone
 * number on it, which is a worse experience but an honest one. The customer's
 * own copy failing does not fail the request -- the booking reached Edward, and
 * telling the customer otherwise would send them away for no reason.
 */
import { summarize, estimate, type BookingRequest, type Catalog } from "./booking";
import { customerEmail, edwardEmail, type EmailContext } from "./booking-emails";
import { looksAutomated, validateBooking, type FieldError } from "./booking-validate";
import type { Mailer } from "./mailer";
import { checkRateLimit, clientIp, memoryStore, type RateLimitRule, type RateLimitStore } from "./rate-limit";

/** A booking is a few hundred bytes. Anything approaching this is not one. */
const MAX_BODY_BYTES = 64 * 1024;

export interface SubmissionRecord {
  receivedAt: string;
  ip: string;
  outOfArea: boolean;
  estimateTotal: number;
  summary: string;
  request: BookingRequest;
}

export interface BookingDeps {
  catalog: Catalog;
  servedZips: readonly string[];
  mailer: Mailer;
  /** Where Edward's notification goes. */
  ownerEmail: string;
  /** Envelope sender, e.g. `Edventures <bookings@edventures.pet>`. */
  fromAddress: string;
  /** Business facts for the email bodies. */
  site: { phone: string; email: string; url: string; owner: string };
  /**
   * Durable logging hook (3.10). Called before any mail is attempted. A
   * failure here is swallowed: losing the log is bad, losing the booking on
   * account of the log is worse.
   */
  logSubmission?: (record: SubmissionRecord) => Promise<void>;
  /** Defaults to an in-process store, which is per-isolate and therefore leaky. */
  rateLimitStore?: RateLimitStore;
  rateLimitRules?: RateLimitRule[];
  /** Reported to the caller when something fails, so a 502 is traceable. */
  onError?: (stage: string, error: unknown) => void;
  now?: () => Date;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const accepted = (summary: string, total: number) => json(200, { ok: true, summary, total });

export async function handleBookingRequest(
  request: Request,
  deps: BookingDeps,
): Promise<Response> {
  const now = deps.now?.() ?? new Date();

  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." }, { Allow: "POST" });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json(415, { ok: false, error: "Expected application/json." });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "That request is too large." });
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch (error) {
    deps.onError?.("read-body", error);
    return json(400, { ok: false, error: "Could not read the request body." });
  }

  // Chunked uploads arrive without a content-length, so the real check is here.
  if (raw.length > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "That request is too large." });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: "That isn't valid JSON." });
  }

  /* ---------------- spam (3.8) ---------------- *
   * Answered with the same 200 a real booking gets, and nothing is sent. A bot
   * told it failed retries with the honeypot cleared; a bot told it succeeded
   * goes away. The body differs -- an empty summary gives it away to anything
   * actually reading the response -- but the status code is what the crude
   * scripts check, and Turnstile is the answer to the rest.                  */

  if (looksAutomated(payload, now.getTime())) {
    return accepted("", 0);
  }

  /* ---------------- rate limit ---------------- */

  const ip = clientIp(request.headers);
  const store = deps.rateLimitStore ?? sharedMemoryStore();
  const limit = await checkRateLimit(ip, store, deps.rateLimitRules, now.getTime());
  if (!limit.allowed) {
    return json(
      429,
      { ok: false, error: "Too many requests. Please text instead." },
      { "Retry-After": String(limit.retryAfter) },
    );
  }

  /* ---------------- validate ---------------- */

  const result = validateBooking(payload, {
    catalog: deps.catalog,
    servedZips: deps.servedZips,
    now,
  });

  if (!result.ok) {
    return json(422, { ok: false, error: "Some details need fixing.", errors: result.errors });
  }

  const booking = result.value;
  const outOfArea = result.warnings.includes("out-of-area");
  const est = estimate(booking, deps.catalog);
  const summary = summarize(booking, deps.catalog);

  /* ---------------- log first (3.10) ---------------- */

  if (deps.logSubmission) {
    try {
      await deps.logSubmission({
        receivedAt: now.toISOString(),
        ip,
        outOfArea,
        estimateTotal: est.total,
        summary,
        request: booking,
      });
    } catch (error) {
      deps.onError?.("log", error);
    }
  }

  /* ---------------- email ---------------- */

  const ctx: EmailContext = {
    catalog: deps.catalog,
    outOfArea,
    phone: deps.site.phone,
    email: deps.site.email,
    siteUrl: deps.site.url,
    owner: deps.site.owner,
  };

  try {
    await deps.mailer.send({
      ...edwardEmail(booking, ctx),
      to: deps.ownerEmail,
      from: deps.fromAddress,
    });
  } catch (error) {
    deps.onError?.("owner-email", error);
    return json(502, {
      ok: false,
      error: "The request could not be delivered. Please text Edward directly.",
    });
  }

  try {
    await deps.mailer.send({
      ...customerEmail(booking, ctx),
      to: booking.customer.email,
      from: deps.fromAddress,
    });
  } catch (error) {
    // Non-fatal on purpose. Edward has the booking; the customer missing their
    // receipt is not a reason to tell them it failed.
    deps.onError?.("customer-email", error);
  }

  return accepted(summary, est.total);
}

/** Lazily created so the module can be imported without allocating anything. */
let fallbackStore: RateLimitStore | null = null;
function sharedMemoryStore(): RateLimitStore {
  fallbackStore ??= memoryStore();
  return fallbackStore;
}

export type { FieldError };
