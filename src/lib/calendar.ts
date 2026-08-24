/**
 * iCalendar (RFC 5545) for a confirmed booking — Roadmap 3.14, step 1.
 *
 * The narrow, honest slice of "sync Edward's calendar": once he has pressed
 * Confirm, the booking becomes a `.ics` he can add in one tap, and the same
 * file rides along on the customer's confirmation email. No OAuth, no Google
 * project, no stored refresh token, no new failure mode in the confirm path.
 *
 * Two rules shape everything below, and both are about not inventing facts:
 *
 * 1. **Visits are windows, not times.** A booking is "morning", which the site
 *    publishes as 7–11am. The event spans the window. Writing `09:00` because
 *    it looks tidier would put a time in Edward's calendar that nobody agreed
 *    to, and he would then be late or early against his own diary.
 * 2. **When the hours genuinely aren't known, the event is all-day.** Overnight
 *    stays have no published start or end (go-back-to-ed.md C1 is still open),
 *    so they become `VALUE=DATE` entries rather than a guessed 6pm-to-9am. A
 *    date with no time is true; a fabricated time is not.
 *
 * Times are *floating* — no `Z`, no `TZID`. The rest of the codebase treats
 * these as local calendar dates and never as timestamps (see `booking.ts`), and
 * floating time is the iCalendar spelling of exactly that: 9am means 9am on
 * whatever device reads it. The alternative, `TZID=America/New_York`, is more
 * precise on paper but requires shipping a `VTIMEZONE` block with DST rules,
 * and would still be read by a one-city business as "the local morning".
 */
import { TIME_WINDOWS, dayCount, parseLocalDate, toIso, type Catalog } from "./booking";
import type { StoredBooking } from "./confirm";

export interface CalendarEvent {
  /** Stable across regenerations of the same booking. */
  uid: string;
  summary: string;
  description: string;
  location: string;
  /** Local `YYYY-MM-DD`. */
  date: string;
  /** Omitted for an all-day event. 24-hour local clock. */
  startHour?: number;
  endHour?: number;
}

/** RFC 5545 §3.3.11. Order matters: the backslash must be escaped first. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold a content line to 75 octets, per RFC 5545 §3.1.
 *
 * Octets, not characters: the limit is on the encoded bytes, and a description
 * carrying a customer's name can easily be multi-byte. Folding mid-sequence
 * would corrupt it, so the split points are measured in UTF-8 bytes and never
 * land inside a character.
 *
 * Unfolded long lines are the classic reason a hand-rolled `.ics` imports fine
 * in one calendar app and silently truncates in another.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let bytes = 0;
  // Continuation lines carry a leading space, which counts toward the 75.
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
      limit = 74;
    }
    current += char;
    bytes += size;
  }
  if (current) out.push(current);

  return out.join("\r\n ");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `20260914` from `2026-09-14`. */
function icsDate(iso: string): string {
  return iso.replace(/-/g, "");
}

/** `20260914T070000` — floating local time, deliberately without a `Z`. */
function icsDateTime(iso: string, hour: number): string {
  return `${icsDate(iso)}T${pad(hour)}0000`;
}

/** `20260824T161500Z` — DTSTAMP must be UTC, unlike the event itself. */
function icsStamp(at: Date): string {
  return (
    `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}` +
    `T${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}${pad(at.getUTCSeconds())}Z`
  );
}

/** The day after `iso`. All-day events are exclusive of their DTEND. */
function nextDay(iso: string): string {
  const date = parseLocalDate(iso);
  if (!date) return iso;
  date.setDate(date.getDate() + 1);
  return toIso(date);
}

/**
 * One event per visit, or per night for an overnight stay.
 *
 * Per unit rather than one block spanning the range, because that is what a
 * calendar is for: Edward looking at Thursday wants to see Thursday's walk,
 * not the edge of a five-day bar. It matches how the booking is priced, too —
 * `estimate()` bills visits per day and overnights per night, and a stay from
 * the 3rd to the 6th is three nights, so it is three events.
 */
export function bookingEvents(
  record: StoredBooking,
  catalog: Catalog,
  now: Date = new Date(),
): CalendarEvent[] {
  const { request } = record;
  const { selection, schedule, pet, customer } = request;
  const service = catalog.services.find((s) => s.id === selection.serviceId) ?? catalog.services[0];
  const isOvernight = service.id === "overnight";

  const days = schedule.dateEnd ? dayCount(schedule.dateStart, schedule.dateEnd) : 1;
  const units = days > 1 ? (isOvernight ? days - 1 : days) : 1;

  const window = TIME_WINDOWS.find((w) => w.id === schedule.window);
  // No window, or an overnight whose hours are not published: all-day. See the
  // file header — a date without a time is true, an invented time is not.
  const timed = !isOvernight && window !== undefined;

  const petName = pet.name.trim() || "pet";
  const addonNames = selection.addonIds
    .map((id) => catalog.addons.find((a) => a.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  const events: CalendarEvent[] = [];

  for (let i = 0; i < units; i++) {
    const date = addDays(schedule.dateStart, i);

    const description = [
      `${service.name} for ${petName}${pet.breed ? ` (${pet.breed})` : ""}.`,
      timed && window ? `Window: ${window.name}, ${window.hours}.` : "",
      addonNames.length ? `Add-ons: ${addonNames.join(", ")}.` : "",
      `Client: ${customer.name}, ${customer.phone}.`,
      customer.entryMethod ? `Entry: ${customer.entryMethod}.` : "",
      pet.medical ? `Medical: ${pet.medical}` : "",
      record.confirmNote ? `Your note: ${record.confirmNote}` : "",
      // The total is the whole booking, not this one visit -- said plainly so
      // a three-visit booking does not read as $96 per walk.
      units > 1
        ? `Booking total $${record.estimateTotal} for all ${units} ${isOvernight ? "nights" : "visits"}.`
        : `Total $${record.estimateTotal}.`,
      "An estimate from the published rates, agreed at confirmation.",
    ]
      .filter(Boolean)
      .join("\n");

    events.push({
      // Stable: the same booking regenerates the same UID, so re-importing
      // updates the entry instead of duplicating it.
      uid: `${record.token ?? record.receivedAt}-${i}@edventures.pet`,
      summary: `${service.name.replace(/s$/, "")} · ${petName}${units > 1 ? ` (${i + 1}/${units})` : ""}`,
      description,
      location: [customer.address, customer.zip].filter(Boolean).join(", "),
      date,
      ...(timed && window ? { startHour: window.startHour, endHour: window.endHour } : {}),
    });
  }

  // `now` is threaded through only so DTSTAMP is injectable; the events
  // themselves are a pure function of the record.
  void now;
  return events;
}

function addDays(iso: string, days: number): string {
  if (days === 0) return iso;
  const date = parseLocalDate(iso);
  if (!date) return iso;
  date.setDate(date.getDate() + days);
  return toIso(date);
}

/** A complete VCALENDAR. CRLF throughout, as the spec requires. */
export function toIcs(events: CalendarEvent[], now: Date = new Date()): string {
  const stamp = icsStamp(now);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Edventures Pet Sitting//Booking//EN",
    "CALSCALE:GREGORIAN",
    // PUBLISH, not REQUEST: this is a file to add, not an invitation that
    // expects an RSVP back to an organiser nobody is monitoring.
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeText(event.uid)}`);
    lines.push(`DTSTAMP:${stamp}`);

    if (event.startHour === undefined || event.endHour === undefined) {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(event.date)}`);
      // Exclusive, per RFC 5545 -- a one-day event ends on the following date.
      lines.push(`DTEND;VALUE=DATE:${icsDate(nextDay(event.date))}`);
    } else {
      lines.push(`DTSTART:${icsDateTime(event.date, event.startHour)}`);
      lines.push(`DTEND:${icsDateTime(event.date, event.endHour)}`);
    }

    lines.push(`SUMMARY:${escapeText(event.summary)}`);
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    lines.push("STATUS:CONFIRMED");
    lines.push("TRANSP:OPAQUE");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** The `.ics` for a confirmed booking, ready to attach or serve. */
export function bookingIcs(record: StoredBooking, catalog: Catalog, now: Date = new Date()): string {
  return toIcs(bookingEvents(record, catalog, now), now);
}

/** `edventures-hubert-2026-09-14.ics`, safe on every filesystem. */
export function icsFilename(record: StoredBooking): string {
  const slug = (record.request.pet.name || "visit")
    .toLowerCase()
    // Decompose first so accents fold to their base letter: "Zoë" becomes
    // "zoe" rather than "zo", which is what stripping non-ASCII outright gives.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return `edventures-${slug || "visit"}-${record.request.schedule.dateStart}.ics`;
}
