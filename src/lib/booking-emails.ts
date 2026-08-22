/**
 * Roadmap 3.7 / 3.9 - the two emails a booking request produces.
 *
 * Pure functions: a `BookingRequest` and a `Catalog` in, subject and bodies
 * out. Nothing here talks to a mail provider, which is what makes the wording
 * testable and lets the endpoint swap Resend for anything else later.
 *
 * The shape of Edward's email is the whole point of 3.9. He reads it on a phone,
 * one-handed, with a dog on the other end of the lead. So the first three lines
 * carry everything he needs to decide yes or no -- service, when, who, and the
 * number to text back. Everything else can wait until he is sitting down.
 *
 * Both emails are sent as plain text *and* HTML. The text part is not a
 * fallback nobody reads: a message with no text alternative scores worse with
 * spam filters, and this project cannot afford to land in spam (3.11).
 */
import {
  TIME_WINDOWS,
  dayCount,
  estimate,
  isLastMinute,
  parseLocalDate,
  summarize,
  type BookingRequest,
  type Catalog,
} from "./booking";

export interface EmailMessage {
  subject: string;
  text: string;
  html: string;
  /** Set on Edward's email so hitting reply reaches the customer. */
  replyTo?: string;
}

export interface EmailContext {
  catalog: Catalog;
  /** Zip fell outside the served list. Never blocks; always flagged. */
  outOfArea: boolean;
  /** Business phone, in the canonical NAP format. */
  phone: string;
  /** Business email, for the customer's copy. */
  email: string;
  /** Canonical site origin, for links in the customer's copy. */
  siteUrl: string;
  /** Owner's first name, as the customer sees it across the site. */
  owner: string;
}

/* ------------------------------------------------------------------ *
 * Formatting helpers
 * ------------------------------------------------------------------ */

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Escaped, with newlines turned into breaks -- for the free-text fields. */
const escapeHtmlMultiline = (s: string) => escapeHtml(s).replace(/\n/g, "<br>");

/** "Saturday, August 22" - long form, because a bare 8/22 is ambiguous enough
 *  to get a visit booked on the wrong day. */
function longDate(iso: string): string {
  const d = parseLocalDate(iso);
  if (!d) return iso || "date to be confirmed";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** "Sat Aug 22" - the compact form, for the subject line. */
function shortDate(iso: string): string {
  const d = parseLocalDate(iso);
  if (!d) return iso || "TBC";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function dateRangeText(request: BookingRequest): string {
  const { dateStart, dateEnd } = request.schedule;
  if (!dateEnd) return longDate(dateStart);
  const days = dayCount(dateStart, dateEnd);
  return `${longDate(dateStart)} to ${longDate(dateEnd)} (${days} days)`;
}

function windowText(request: BookingRequest): string {
  const w = TIME_WINDOWS.find((x) => x.id === request.schedule.window);
  return w ? `${w.name} (${w.hours})` : "No window selected";
}

function serviceText(request: BookingRequest, catalog: Catalog): string {
  const service = catalog.services.find((s) => s.id === request.selection.serviceId);
  if (!service) return request.selection.serviceId;
  const name = service.name.replace(/s$/, "");
  return request.selection.durationMinutes
    ? `${name}, ${request.selection.durationMinutes} min`
    : name;
}

function addonsText(request: BookingRequest, catalog: Catalog): string {
  const names = request.selection.addonIds
    .map((id) => catalog.addons.find((a) => a.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  return names.length ? names.join(", ") : "None";
}

function petsText(request: BookingRequest): string {
  const { extraDogs, extraCats } = request.selection;
  const extras: string[] = [];
  if (extraDogs) extras.push(`${extraDogs} additional ${extraDogs > 1 ? "dogs" : "dog"}`);
  if (extraCats) extras.push(`${extraCats} additional ${extraCats > 1 ? "cats" : "cat"}`);

  const { name, species, breed, age } = request.pet;
  const descriptors = [breed, age].filter(Boolean).join(", ");
  const base = `${name} (${species}${descriptors ? `, ${descriptors}` : ""})`;
  return extras.length ? `${base} + ${extras.join(", ")}` : base;
}

/** A labelled block, skipping any row whose value is empty. */
type Row = [label: string, value: string];

const rowsToText = (rows: Row[]) =>
  rows.filter(([, v]) => v).map(([label, v]) => `${label}: ${v}`).join("\n");

const rowsToHtml = (rows: Row[]) =>
  rows
    .filter(([, v]) => v)
    .map(
      ([label, v]) =>
        `<p style="margin:0 0 6px"><strong>${escapeHtml(label)}:</strong> ${escapeHtmlMultiline(v)}</p>`,
    )
    .join("\n");

/* ------------------------------------------------------------------ *
 * Edward's notification
 * ------------------------------------------------------------------ */

/**
 * Subject format is fixed by 3.9: `New booking: [Service] - [Date] - [Customer]`.
 * Kept short enough to survive a phone's notification preview, where the
 * customer's name is the part most likely to get cut -- hence it goes last.
 */
export function edwardSubject(request: BookingRequest, catalog: Catalog): string {
  const service = serviceText(request, catalog);
  return `New booking: ${service} - ${shortDate(request.schedule.dateStart)} - ${request.customer.name}`;
}

export function edwardEmail(request: BookingRequest, ctx: EmailContext): EmailMessage {
  const { catalog, outOfArea } = ctx;
  const est = estimate(request, catalog);
  const lastMinute = isLastMinute(request.schedule.dateStart);

  // The flags that change what Edward does next, before anything else.
  const flags: string[] = [];
  if (outOfArea) flags.push(`OUT OF AREA - ${request.customer.zip} is outside the served zips`);
  if (lastMinute) flags.push("LAST MINUTE - under 24 hours' notice");

  // Lines 1-3. Everything needed to say yes or no without scrolling.
  const headline = [
    `${serviceText(request, catalog)} - ${dateRangeText(request)}`,
    windowText(request),
    `${request.customer.name} - ${request.customer.phone}`,
  ];

  const detailRows: Row[] = [
    ["Pet", petsText(request)],
    ["Temperament", request.pet.temperament],
    ["Medical / medication", request.pet.medical],
    [
      "Vaccines & flea/tick up to date",
      request.pet.upToDateOnPreventatives === null
        ? "Not answered"
        : request.pet.upToDateOnPreventatives
          ? "Yes"
          : "No",
    ],
    ["Add-ons", addonsText(request, catalog)],
    ["Flexibility", request.schedule.flexibilityNotes],
    ["Address", `${request.customer.address}, ${request.customer.zip}`],
    ["Entry", request.customer.entryMethod],
    ["Emergency contact", request.customer.emergencyContact],
    ["Vet", request.customer.vet],
    ["Email", request.customer.email],
    ["OK to post photos on social media", request.photoConsent ? "Yes" : "No"],
  ];

  const estimateRows: Row[] = est.lines.map((l) => [l.label, l.amount] as Row);

  const text = [
    flags.length ? `** ${flags.join(" **\n** ")} **\n` : "",
    headline.join("\n"),
    "",
    "---",
    "",
    rowsToText(detailRows),
    "",
    "--- Estimate (not a quote) ---",
    "",
    rowsToText(estimateRows),
    `TOTAL: $${est.total}`,
    "",
    `Reply to this email to reach ${request.customer.name} directly.`,
  ]
    .filter((block) => block !== "")
    .join("\n");

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a;max-width:600px">
${flags
  .map(
    (f) =>
      `<p style="margin:0 0 12px;padding:10px 12px;background:#fff4e5;border-left:4px solid #d97706;font-weight:600">${escapeHtml(f)}</p>`,
  )
  .join("\n")}
  <p style="margin:0 0 4px;font-size:19px;font-weight:700">${escapeHtml(headline[0]!)}</p>
  <p style="margin:0 0 4px;font-size:17px">${escapeHtml(headline[1]!)}</p>
  <p style="margin:0 0 20px;font-size:17px">${escapeHtml(request.customer.name)} &middot;
    <a href="tel:${escapeHtml(request.customer.phone.replace(/[^\d+]/g, ""))}">${escapeHtml(request.customer.phone)}</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:0 0 20px">
  ${rowsToHtml(detailRows)}
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0">
  <p style="margin:0 0 8px;font-weight:700">Estimate &mdash; not a quote</p>
  ${rowsToHtml(estimateRows)}
  <p style="margin:8px 0 0;font-weight:700">Total: $${est.total}</p>
  <p style="margin:20px 0 0;color:#666;font-size:14px">Reply to this email to reach ${escapeHtml(request.customer.name)} directly.</p>
</div>`.trim();

  return {
    subject: edwardSubject(request, catalog),
    text,
    html,
    // The one line that makes the whole thing usable: reply goes to the
    // customer, not to the robot that sent it.
    replyTo: request.customer.email,
  };
}

/* ------------------------------------------------------------------ *
 * The customer's confirmation
 * ------------------------------------------------------------------ */

/**
 * Restates the request and does one job beyond that: makes absolutely clear
 * that nothing is booked yet. The success screen says the same thing, and a
 * customer who thinks a walk is confirmed when it is not is the single worst
 * outcome this form can produce.
 */
export function customerEmail(request: BookingRequest, ctx: EmailContext): EmailMessage {
  const { catalog, outOfArea, phone, email, siteUrl, owner } = ctx;
  const est = estimate(request, catalog);

  const detailRows: Row[] = [
    ["Service", serviceText(request, catalog)],
    ["When", dateRangeText(request)],
    ["Time window", windowText(request)],
    ["Pet", petsText(request)],
    ["Add-ons", addonsText(request, catalog)],
    ["Address", `${request.customer.address}, ${request.customer.zip}`],
  ];

  const outOfAreaNote = outOfArea
    ? `Your zip code is just outside ${owner}'s usual area, so he may need to add a travel fee - he'll confirm when he replies.`
    : "";

  const text = [
    `Thanks - ${owner} has your request.`,
    "",
    `Nothing is booked yet. He reads these between visits and will text you a confirmation, usually within a few hours. If you need an answer sooner, text him directly on ${phone}.`,
    "",
    "--- What you asked for ---",
    "",
    rowsToText(detailRows),
    "",
    `Estimated total: $${est.total} - an estimate, not a quote. ${owner} confirms the final price when he replies.`,
    outOfAreaNote ? `\n${outOfAreaNote}` : "",
    "",
    `Need to change something? Just reply to this email, or text ${phone}.`,
    "",
    `${siteUrl} - ${email}`,
  ]
    .filter((block) => block !== "")
    .join("\n");

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:600px">
  <p style="margin:0 0 16px;font-size:20px;font-weight:700">Thanks &mdash; ${escapeHtml(owner)} has your request.</p>
  <p style="margin:0 0 20px"><strong>Nothing is booked yet.</strong> He reads these between visits and will text you a
    confirmation, usually within a few hours. If you need an answer sooner, text him on
    <a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}">${escapeHtml(phone)}</a>.</p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:0 0 20px">
  <p style="margin:0 0 12px;font-weight:700">What you asked for</p>
  ${rowsToHtml(detailRows)}
  <p style="margin:16px 0 0"><strong>Estimated total: $${est.total}</strong><br>
    <span style="color:#666;font-size:14px">An estimate, not a quote &mdash; ${escapeHtml(owner)} confirms the final price when he replies.</span></p>
  ${outOfAreaNote ? `<p style="margin:16px 0 0;padding:10px 12px;background:#fff4e5">${escapeHtml(outOfAreaNote)}</p>` : ""}
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0">
  <p style="margin:0 0 4px;color:#666;font-size:14px">Need to change something? Reply to this email, or text ${escapeHtml(phone)}.</p>
  <p style="margin:0;color:#666;font-size:14px"><a href="${escapeHtml(siteUrl)}">${escapeHtml(siteUrl.replace(/^https?:\/\//, ""))}</a> &middot; ${escapeHtml(email)}</p>
</div>`.trim();

  return {
    subject: `Your request is with ${owner} - ${summarize(request, catalog)}`,
    text,
    html,
  };
}
