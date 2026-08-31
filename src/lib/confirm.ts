/**
 * The confirm-and-notify flow: Edward presses a button, the customer learns
 * their visit is actually happening.
 *
 * Same shape as `booking-handler.ts` and for the same reason - `Request` in,
 * `Response` out, every dependency injected - so the whole thing is exercisable
 * with no server, no KV and no credentials.
 *
 * Two decisions here are load-bearing:
 *
 * 1. **GET renders, POST sends.** Mail providers and corporate security
 *    products routinely *prefetch* every link in a message to scan it. If the
 *    link itself sent the confirmation, a scanner would confirm bookings that
 *    Edward never looked at, and the customer would be told a visit is
 *    happening on the strength of a virus checker. So the link opens a page
 *    with no side effect, and a form POST does the work.
 *
 * 2. **Send, then stamp.** If the record were marked confirmed first and the
 *    send then failed, Edward would believe the customer had been told when
 *    they had not - a silent failure, and the worst outcome this flow can
 *    produce. Stamping second risks a duplicate confirmation instead, which is
 *    merely awkward.
 */
import { estimate, summarize, type BookingRequest, type Catalog } from "./booking";
import { confirmationEmail, type EmailContext } from "./booking-emails";
import { bookingIcs, icsFilename } from "./calendar";
import type { Mailer } from "./mailer";

/** The subset of KV this flow needs. Keeps the module platform-free. */
export interface ConfirmStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

/** What the booking endpoint wrote, plus what confirming adds. */
export interface StoredBooking {
  receivedAt: string;
  summary: string;
  estimateTotal: number;
  request: BookingRequest;
  /** Unguessable, issued when the booking was logged. */
  token?: string;
  /** Set once Edward has confirmed. Its presence is what stops a re-send. */
  confirmedAt?: string;
  /** Whatever he typed on the confirm page. */
  confirmNote?: string;
}

export interface ConfirmDeps {
  store: ConfirmStore;
  catalog: Catalog;
  mailer: Mailer;
  /** Envelope sender, same one the booking emails use. */
  fromAddress: string;
  site: { phone: string; email: string; url: string; owner: string };
  now?: () => Date;
  onError?: (stage: string, error: unknown) => void;
}

/** Longest note Edward can attach. Room for a paragraph, not an essay. */
const MAX_NOTE = 1000;

/** The pointer that maps a token to the booking record's own key. Kept
 *  separate so the human-browsable `booking:<timestamp>:<name>` listing is
 *  undisturbed by tokens nobody wants to read. */
export const pointerKey = (token: string) => `confirm:${token}`;

const CONTROL_CHARS = new RegExp("[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]", "g");

/** Edward's note is free text that lands in an email. Neutralise, don't reject. */
export function cleanNote(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(CONTROL_CHARS, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_NOTE);
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const html = (status: number, body: string) =>
  new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // A token in a URL should never reach an analytics tool or a search
      // index by way of a referrer header or a crawler.
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "no-store",
    },
  });

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

function page(title: string, inner: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  body {
    margin: 0; padding: 24px 18px 60px;
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #1a1a18; background: #fbf7f3;
  }
  .wrap { max-width: 560px; margin: 0 auto; }
  h1 { font-size: 26px; line-height: 1.15; margin: 0 0 12px; color: #163e1f; }
  .card { background: #fff; border: 1px solid rgba(78,50,22,.18); border-radius: 12px; padding: 20px; margin: 20px 0; }
  .row { margin: 0 0 6px; }
  .row strong { color: #4e3216; }
  label { display: block; font-weight: 600; margin: 0 0 8px; color: #4e3216; }
  textarea {
    width: 100%; box-sizing: border-box; min-height: 110px; padding: 12px;
    font: 16px/1.5 inherit; border: 1.5px solid rgba(78,50,22,.22); border-radius: 9px; resize: vertical;
  }
  button {
    width: 100%; margin-top: 16px; padding: 17px; font-size: 17px; font-weight: 700;
    color: #f6ede5; background: #163e1f; border: 0; border-radius: 9px; cursor: pointer;
  }
  .muted { color: #6b6b66; font-size: 14px; }
  .ok { color: #163e1f; font-weight: 700; }
  .warn { color: #8a2a12; font-weight: 700; }
  a { color: #163e1f; }
</style>
</head>
<body><div class="wrap">${inner}</div></body>
</html>`;
}

function detailsCard(record: StoredBooking, catalog: Catalog, now: Date): string {
  const r = record.request;
  const est = estimate(r, catalog, now);
  return `<div class="card">
  <p class="row"><strong>What:</strong> ${escapeHtml(record.summary || summarize(r, catalog))}</p>
  <p class="row"><strong>Who:</strong> ${escapeHtml(r.customer.name)} &middot; ${escapeHtml(r.customer.phone)}</p>
  <p class="row"><strong>Where:</strong> ${escapeHtml(r.customer.address)}, ${escapeHtml(r.customer.zip)}</p>
  <p class="row"><strong>Pet:</strong> ${escapeHtml(r.pet.name)} (${escapeHtml(r.pet.species)})</p>
  <p class="row"><strong>Estimate:</strong> $${est.total}</p>
</div>`;
}

/** The page the link opens. Nothing here sends anything. */
export function confirmPage(record: StoredBooking, catalog: Catalog, token: string, now: Date): string {
  return page(
    "Confirm this booking",
    `<h1>Confirm this booking?</h1>
<p class="muted">Pressing the button emails ${escapeHtml(record.request.customer.name)} to say the visit is going ahead.</p>
${detailsCard(record, catalog, now)}
<form method="POST">
  <input type="hidden" name="t" value="${escapeHtml(token)}">
  <label for="note">Add a note (optional)</label>
  <textarea id="note" name="note" maxlength="${MAX_NOTE}" placeholder="See you Tuesday morning — I'll bring a spare leash."></textarea>
  <button type="submit">Send confirmation</button>
</form>`,
  );
}

/**
 * The button, rather than a second email to Edward.
 *
 * He is already here -- he just pressed Confirm -- so a link he taps now beats
 * a mail that has to be sent, delivered and found. It also keeps the confirm
 * path to exactly one outbound send: adding a second would mean deciding what
 * to do when the customer's email succeeds and Edward's fails, and there is no
 * good answer to that question at the moment the booking is being agreed.
 */
function addToCalendarLink(token: string): string {
  return token
    ? `<p><a class="btn" href="?t=${encodeURIComponent(token)}&amp;format=ics">Add to calendar</a></p>
<p class="muted">Downloads a calendar file. The customer's copy is attached to their confirmation email too.</p>`
    : "";
}

export function confirmedPage(record: StoredBooking, note: string, token = ""): string {
  return page(
    "Confirmation sent",
    `<h1>Sent.</h1>
<p class="ok">${escapeHtml(record.request.customer.name)} has been emailed a confirmation.</p>
${note ? `<div class="card"><p class="row"><strong>Your note:</strong></p><p class="row">${escapeHtml(note).replace(/\n/g, "<br>")}</p></div>` : ""}
${addToCalendarLink(token)}
<p class="muted">Nothing else to do. This page can be closed.</p>`,
  );
}

export function alreadyConfirmedPage(record: StoredBooking, token = ""): string {
  const when = record.confirmedAt ? new Date(record.confirmedAt).toLocaleString("en-US") : "earlier";
  return page(
    "Already confirmed",
    `<h1>Already confirmed.</h1>
<p>${escapeHtml(record.request.customer.name)} was sent a confirmation on <strong>${escapeHtml(when)}</strong>, so nothing was sent again.</p>
${addToCalendarLink(token)}
<p class="muted">To tell them something new, reply to their booking email instead.</p>`,
  );
}

export function notFoundPage(): string {
  return page(
    "Link not recognised",
    `<h1>That link isn't recognised.</h1>
<p>It may have been mistyped, or belong to a booking that is no longer stored.</p>
<p class="muted">Nothing was sent. Reply to the booking email to reach the customer directly.</p>`,
  );
}

export function sendFailedPage(record: StoredBooking, phone: string): string {
  return page(
    "Could not send",
    `<h1 class="warn">That didn't send.</h1>
<p>The confirmation email to ${escapeHtml(record.request.customer.name)} failed, so they have <strong>not</strong> been told.</p>
<p>Reply to their booking email, or text them on ${escapeHtml(record.request.customer.phone)}.</p>
<p class="muted">Nothing was marked confirmed, so this link still works if you want to try again. Business line: ${escapeHtml(phone)}</p>`,
  );
}

/* ------------------------------------------------------------------ *
 * The handler
 * ------------------------------------------------------------------ */

async function load(
  store: ConfirmStore,
  token: string,
): Promise<{ record: StoredBooking; key: string } | null> {
  if (!token) return null;
  const key = await store.get(pointerKey(token));
  if (!key) return null;
  const raw = await store.get(key);
  if (!raw) return null;
  try {
    return { record: JSON.parse(raw) as StoredBooking, key };
  } catch {
    return null;
  }
}

export async function handleConfirmRequest(
  request: Request,
  deps: ConfirmDeps,
): Promise<Response> {
  const now = deps.now?.() ?? new Date();
  const url = new URL(request.url);

  /* ---------------- GET: render, never send ---------------- */

  if (request.method === "GET") {
    const token = url.searchParams.get("t") ?? "";
    const found = await load(deps.store, token);
    if (!found) return html(404, notFoundPage());

    /**
     * The calendar file. Still a GET that sends nothing, so it is safe from
     * the mail-scanner prefetch this endpoint's GET/POST split exists to
     * survive.
     *
     * Only once confirmed, deliberately: an `.ics` for a request Edward has
     * not agreed to would put an unbooked visit in his diary, and a diary he
     * cannot trust is worse than no export at all.
     */
    if (url.searchParams.get("format") === "ics" && found.record.confirmedAt) {
      return new Response(bookingIcs(found.record, deps.catalog, now), {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8; method=PUBLISH",
          "Content-Disposition": `attachment; filename="${icsFilename(found.record)}"`,
          // A token in a URL should never reach an analytics tool or a search
          // index -- same reasoning as the page responses.
          "Referrer-Policy": "no-referrer",
          "X-Robots-Tag": "noindex, nofollow",
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (found.record.confirmedAt) return html(200, alreadyConfirmedPage(found.record, token));
    return html(200, confirmPage(found.record, deps.catalog, token, now));
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed.", { status: 405, headers: { Allow: "GET, POST" } });
  }

  /* ---------------- POST: the side effect ---------------- */

  let form: URLSearchParams;
  try {
    form = new URLSearchParams(await request.text());
  } catch (error) {
    deps.onError?.("read-body", error);
    return html(400, notFoundPage());
  }

  const token = form.get("t") ?? "";
  const note = cleanNote(form.get("note"));

  const found = await load(deps.store, token);
  if (!found) return html(404, notFoundPage());
  // Re-checked here and not only on GET: the page could have been left open in
  // a tab and submitted twice.
  if (found.record.confirmedAt) return html(200, alreadyConfirmedPage(found.record));

  const ctx: EmailContext = {
    catalog: deps.catalog,
    outOfArea: false,
    phone: deps.site.phone,
    email: deps.site.email,
    siteUrl: deps.site.url,
    owner: deps.site.owner,
    now,
  };

  // Built before the send and reused by the stamp below, so the attachment,
  // the stored record and the served `.ics` are all the same object. The file
  // says CONFIRMED and repeats Edward's note, so it has to describe what was
  // agreed rather than what was requested.
  const confirmed: StoredBooking = {
    ...found.record,
    confirmedAt: now.toISOString(),
    confirmNote: note,
  };

  try {
    await deps.mailer.send({
      ...confirmationEmail(found.record.request, ctx, note),
      to: found.record.request.customer.email,
      from: deps.fromAddress,
      replyTo: deps.site.email,
      attachments: [
        {
          filename: icsFilename(confirmed),
          content: bookingIcs(confirmed, deps.catalog, now),
          contentType: "text/calendar; charset=utf-8; method=PUBLISH",
        },
      ],
    });
  } catch (error) {
    deps.onError?.("confirmation-email", error);
    // 503, not 502: Cloudflare replaces an origin 502/504 body with its own
    // branded "Host Error" page, and this page only exists to be read - it is
    // how Edward learns the customer has NOT been told and the link is still
    // live. A 503 passes through with its body intact.
    return html(503, sendFailedPage(found.record, deps.site.phone));
  }

  // Only now. See the header note on send-then-stamp.
  try {
    await deps.store.put(found.key, JSON.stringify(confirmed));
  } catch (error) {
    // The customer has been told, which is the part that matters. A lost stamp
    // only risks a duplicate if he presses the button twice.
    deps.onError?.("stamp", error);
  }

  return html(200, confirmedPage(found.record, note, token));
}
