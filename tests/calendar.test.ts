/**
 * Tests for the booking `.ics` (Roadmap 3.14, step 1).
 *
 * A calendar file fails quietly. A malformed one does not throw — it imports
 * into Google looking fine and drops a field in Apple Calendar, or lands an
 * hour out, and nobody finds out until Edward is at the wrong house. So the
 * cases below are the ones that produce a *plausible* wrong answer: escaping,
 * folding, the exclusive all-day DTEND, and the rule that we never write a
 * time the booking does not actually have.
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { bookingEvents, bookingIcs, icsFilename, toIcs } from "../src/lib/calendar.ts";
import { TIME_WINDOWS, type BookingRequest } from "../src/lib/booking.ts";
import { getCatalogFromJson } from "../src/lib/catalog-json.ts";
import type { StoredBooking } from "../src/lib/confirm.ts";

const catalog = getCatalogFromJson();
const NOW = new Date(Date.UTC(2026, 7, 24, 16, 15, 0));

function booking(overrides: Partial<BookingRequest> = {}, record: Partial<StoredBooking> = {}): StoredBooking {
  const request: BookingRequest = {
    selection: { serviceId: "dog-walk", durationMinutes: 30, addonIds: [], extraDogs: 0, extraCats: 0 },
    schedule: { dateStart: "2026-09-14", dateEnd: "", window: "morning", flexibilityNotes: "" },
    pet: {
      name: "Hubert",
      species: "Dog",
      breed: "Beagle mix",
      age: "4",
      temperament: "Easy-going",
      medical: "",
      upToDateOnPreventatives: true,
    },
    customer: {
      name: "Sam Rivera",
      phone: "215-555-0134",
      email: "sam@example.com",
      address: "1200 Green St",
      zip: "19130",
      entryMethod: "Lockbox",
      emergencyContact: "Alex 215-555-0199",
      vet: "Fairmount Animal Hospital",
      firstTime: true,
    },
    consent: true,
    photoConsent: false,
    ...overrides,
  };
  return {
    receivedAt: "2026-08-24T16:00:00.000Z",
    summary: "Dog Walk · Monday, September 14",
    estimateTotal: 25,
    token: "tok123",
    confirmedAt: "2026-08-24T16:15:00.000Z",
    request,
    ...record,
  };
}

/** Unfold a VCALENDAR back into logical lines, the way a parser would. */
const unfold = (ics: string) => ics.replace(/\r\n /g, "").split("\r\n");
const field = (ics: string, name: string) =>
  unfold(ics).filter((l) => l.startsWith(`${name}:`) || l.startsWith(`${name};`));

describe("calendar export", () => {
  it("uses the window's real hours, not a tidy invented time", () => {
    // The booking says "morning", which the site publishes as 7-11am. Writing
    // 09:00 because it looks neater puts a time in Edward's diary that nobody
    // agreed to.
    const ics = bookingIcs(booking(), catalog, NOW);
    const morning = TIME_WINDOWS.find((w) => w.id === "morning")!;

    const hh = (n: number) => String(n).padStart(2, "0");
    assert.deepEqual(field(ics, "DTSTART"), [`DTSTART:20260914T${hh(morning.startHour)}0000`]);
    assert.deepEqual(field(ics, "DTEND"), [`DTEND:20260914T${hh(morning.endHour)}0000`]);
  });

  it("falls back to an all-day event when the hours are genuinely unknown", () => {
    // Overnight stays have no published start or end (go-back-to-ed.md C1).
    // A date with no time is true; a guessed 6pm-to-9am is not.
    const ics = bookingIcs(
      booking({
        selection: { serviceId: "overnight", durationMinutes: 0, addonIds: [], extraDogs: 0, extraCats: 0 },
        schedule: { dateStart: "2026-09-03", dateEnd: "2026-09-06", window: "", flexibilityNotes: "" },
      }),
      catalog,
      NOW,
    );
    assert.ok(field(ics, "DTSTART").every((l) => l.startsWith("DTSTART;VALUE=DATE:")));
    assert.ok(!ics.includes("T180000"), "an overnight must not invent an evening start");
  });

  it("makes an all-day DTEND exclusive, per RFC 5545", () => {
    // Off by one here and every overnight reads as a day short in Google.
    const ics = bookingIcs(
      booking({
        selection: { serviceId: "overnight", durationMinutes: 0, addonIds: [], extraDogs: 0, extraCats: 0 },
        schedule: { dateStart: "2026-09-03", dateEnd: "2026-09-04", window: "", flexibilityNotes: "" },
      }),
      catalog,
      NOW,
    );
    assert.deepEqual(field(ics, "DTSTART"), ["DTSTART;VALUE=DATE:20260903"]);
    assert.deepEqual(field(ics, "DTEND"), ["DTEND;VALUE=DATE:20260904"]);
  });

  it("bills the same units the estimator does: one event per visit or night", () => {
    const visits = bookingEvents(
      booking({
        schedule: { dateStart: "2026-09-14", dateEnd: "2026-09-16", window: "morning", flexibilityNotes: "" },
      }),
      catalog,
      NOW,
    );
    assert.equal(visits.length, 3, "three days of walks is three visits");

    const nights = bookingEvents(
      booking({
        selection: { serviceId: "overnight", durationMinutes: 0, addonIds: [], extraDogs: 0, extraCats: 0 },
        schedule: { dateStart: "2026-09-03", dateEnd: "2026-09-06", window: "", flexibilityNotes: "" },
      }),
      catalog,
      NOW,
    );
    // The 3rd to the 6th is three nights -- the last day is a departure.
    assert.equal(nights.length, 3);
    assert.deepEqual(nights.map((e) => e.date), ["2026-09-03", "2026-09-04", "2026-09-05"]);
  });

  it("says the total covers the whole booking, not each visit", () => {
    const [first] = bookingEvents(
      booking(
        { schedule: { dateStart: "2026-09-14", dateEnd: "2026-09-16", window: "morning", flexibilityNotes: "" } },
        { estimateTotal: 96 },
      ),
      catalog,
      NOW,
    );
    assert.match(first.description, /\$96 for all 3 visits/);
  });

  it("escapes the characters RFC 5545 reserves", () => {
    // A comma in an address is not exotic -- it is every address. Unescaped it
    // splits the property value and the rest of the line is silently lost.
    const ics = bookingIcs(
      booking({
        customer: {
          ...booking().request.customer,
          name: "Rivera, Sam",
          address: "1200 Green St; Apt 3",
        },
        pet: { ...booking().request.pet, medical: "Line one\nLine two" },
      }),
      catalog,
      NOW,
    );
    const description = unfold(ics).find((l) => l.startsWith("DESCRIPTION:"))!;
    const location = unfold(ics).find((l) => l.startsWith("LOCATION:"))!;

    assert.ok(description.includes("Rivera\\, Sam"), "comma must be escaped");
    assert.ok(description.includes("\\n"), "newline must become the literal escape");
    // The address carries the semicolon, and LOCATION is where it lands.
    assert.ok(location.includes("Green St\\; Apt 3"), `semicolon not escaped: ${location}`);
    // No unescaped reserved character survived anywhere in a value.
    for (const line of unfold(ics).filter((l) => /^(SUMMARY|DESCRIPTION|LOCATION):/.test(l))) {
      const value = line.slice(line.indexOf(":") + 1);
      assert.ok(!/(?<!\\)[;,]/.test(value), `unescaped reserved char in: ${line.slice(0, 60)}`);
    }
    // And no raw newline survived into the middle of a property.
    assert.ok(!/DESCRIPTION:[^\r]*\n(?!\r)/.test(ics.replace(/\r\n/g, "\r")));
  });

  it("folds long lines and survives the round trip", () => {
    const ics = bookingIcs(
      booking({ pet: { ...booking().request.pet, medical: "x".repeat(400) } }),
      catalog,
      NOW,
    );
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n")) {
      assert.ok(encoder.encode(line).length <= 75, `line over 75 octets: ${line.slice(0, 40)}…`);
    }
    // Unfolding must give the content back intact.
    assert.ok(unfold(ics).some((l) => l.includes("x".repeat(400))));
  });

  it("never folds inside a multi-byte character", () => {
    // The limit is octets, so a naive character-count fold corrupts accented
    // names at exactly the wrong moment -- confirmation.
    const ics = bookingIcs(
      booking({ pet: { ...booking().request.pet, name: "Zoë".repeat(60) } }),
      catalog,
      NOW,
    );
    assert.ok(unfold(ics).some((l) => l.includes("Zoë".repeat(60))));
    assert.ok(!ics.includes("�"), "a replacement character means a split mid-sequence");
  });

  it("keeps a stable UID so re-importing updates rather than duplicates", () => {
    const record = booking();
    const first = bookingEvents(record, catalog, NOW).map((e) => e.uid);
    const second = bookingEvents(record, catalog, new Date(Date.UTC(2027, 0, 1))).map((e) => e.uid);
    assert.deepEqual(first, second);
    assert.equal(new Set(first).size, first.length, "UIDs within one booking must differ");
  });

  it("stamps DTSTAMP in UTC while leaving the event floating", () => {
    const ics = bookingIcs(booking(), catalog, NOW);
    assert.deepEqual(field(ics, "DTSTAMP"), ["DTSTAMP:20260824T161500Z"]);
    // The event itself carries no Z and no TZID: 7am means the local 7am.
    assert.ok(field(ics, "DTSTART").every((l) => !l.includes("Z") && !l.includes("TZID")));
  });

  it("produces a well-formed, CRLF-terminated VCALENDAR", () => {
    const ics = bookingIcs(booking(), catalog, NOW);
    const lines = unfold(ics);
    assert.equal(lines[0], "BEGIN:VCALENDAR");
    assert.equal(lines.filter((l) => l === "BEGIN:VEVENT").length, 1);
    assert.equal(lines.filter((l) => l === "END:VEVENT").length, 1);
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    // A bare LF anywhere is a parser's problem, not ours to hand over.
    assert.ok(!/[^\r]\n/.test(ics));
  });

  it("names the file after the pet and the date, safely", () => {
    assert.equal(icsFilename(booking()), "edventures-hubert-2026-09-14.ics");
    const awkward = booking({ pet: { ...booking().request.pet, name: "Mr. O'Hare / Jr" } });
    assert.match(icsFilename(awkward), /^edventures-[a-z0-9-]+-2026-09-14\.ics$/);
    // Accents fold rather than vanish: "Zoë" must not become "zo".
    assert.equal(
      icsFilename(booking({ pet: { ...booking().request.pet, name: "Zoë" } })),
      "edventures-zoe-2026-09-14.ics",
    );
  });

  it("handles an empty event list without emitting a broken calendar", () => {
    const ics = toIcs([], NOW);
    assert.ok(ics.startsWith("BEGIN:VCALENDAR"));
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    assert.ok(!ics.includes("VEVENT"));
  });
});

describe("time windows", () => {
  it("keep the numeric hours in step with the label customers see", () => {
    // Two representations of one fact. The label is what a customer reads and
    // the numbers are what lands in Edward's calendar; if they drift, the
    // calendar quietly disagrees with the booking confirmation.
    const to24 = (text: string, meridiem: string) => {
      const hour = Number(text);
      if (meridiem === "pm") return hour === 12 ? 12 : hour + 12;
      return hour === 12 ? 0 : hour;
    };

    for (const window of TIME_WINDOWS) {
      // "7 – 11 am" | "11 am – 2 pm"
      const match = /^(\d+)\s*(am|pm)?\s*[–-]\s*(\d+)\s*(am|pm)$/.exec(window.hours);
      assert.ok(match, `unparseable label: ${window.hours}`);
      const [, startText, startMeridiem, endText, endMeridiem] = match;
      assert.equal(to24(startText, startMeridiem ?? endMeridiem), window.startHour, window.id);
      assert.equal(to24(endText, endMeridiem), window.endHour, window.id);
    }
  });
});
