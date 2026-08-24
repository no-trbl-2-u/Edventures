/**
 * Tests for the booking backend (Roadmap 3.7).
 *
 * Run with `npm test`. Node strips the types itself, so there is no test
 * framework and no build step -- the point is that a check on the money path
 * costs nothing to run and therefore actually gets run.
 *
 * The endpoint is a pure function over injected dependencies, so every case
 * here exercises the real handler with a dry-run mailer. Nothing is mocked out
 * that a request would otherwise pass through.
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { coversHoliday, estimate, type BookingRequest } from "../src/lib/booking.ts";
import { getCatalogFromJson } from "../src/lib/catalog-json.ts";
import { validateBooking, looksAutomated } from "../src/lib/booking-validate.ts";
import { handleBookingRequest, type BookingDeps } from "../src/lib/booking-handler.ts";
import { dryRunMailer } from "../src/lib/mailer.ts";
import { checkRateLimit, memoryStore } from "../src/lib/rate-limit.ts";
import { edwardEmail, customerEmail, confirmationEmail } from "../src/lib/booking-emails.ts";
import {
  cleanNote,
  handleConfirmRequest,
  pointerKey,
  type ConfirmDeps,
  type ConfirmStore,
} from "../src/lib/confirm.ts";
import { SERVED_ZIPS } from "../src/lib/site.ts";

const catalog = getCatalogFromJson();

/** Fixed "today" so a passing test does not start failing next Tuesday. */
const NOW = new Date(2026, 7, 17, 10, 0, 0); // 17 Aug 2026, local
const SOON = "2026-08-24";

function validBooking(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    selection: { serviceId: "dog-walk", durationMinutes: 30, addonIds: [], extraDogs: 0, extraCats: 0 },
    schedule: { dateStart: SOON, dateEnd: "", window: "morning", flexibilityNotes: "" },
    pet: {
      name: "Stellaluna",
      species: "Dog",
      breed: "Mutt",
      age: "4",
      temperament: "Easy-going",
      medical: "",
      upToDateOnPreventatives: true,
    },
    customer: {
      name: "Dana Reyes",
      phone: "215-555-0134",
      email: "dana@example.com",
      address: "1200 Fairmount Ave",
      zip: "19130",
      entryMethod: "Lockbox",
      emergencyContact: "Sam 215-555-0199",
      vet: "Fairmount Vet 215-555-0111",
      firstTime: false,
    },
    consent: true,
    photoConsent: true,
    ...overrides,
  };
}

const opts = { catalog, servedZips: SERVED_ZIPS, now: NOW };

function deps(overrides: Partial<BookingDeps> = {}): BookingDeps & { mailer: ReturnType<typeof dryRunMailer> } {
  const mailer = dryRunMailer();
  return {
    catalog,
    servedZips: SERVED_ZIPS,
    mailer,
    ownerEmail: "edventurespetsitting@gmail.com",
    fromAddress: "Edventures <bookings@edventures.pet>",
    site: {
      phone: "610-888-4541",
      email: "edventurespetsitting@gmail.com",
      url: "https://edventures.pet",
      owner: "Edward",
    },
    // A fresh store per test, or the rate limit leaks between them.
    rateLimitStore: memoryStore(),
    now: () => NOW,
    ...overrides,
  } as BookingDeps & { mailer: ReturnType<typeof dryRunMailer> };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://edventures.pet/api/booking", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.7", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/* ------------------------------------------------------------------ */

describe("validation", () => {
  it("accepts a well-formed request", () => {
    const result = validateBooking(validBooking(), opts);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.customer.zip, "19130");
    assert.deepEqual(result.warnings, []);
  });

  it("rejects a service that is not in the catalog", () => {
    const result = validateBooking(
      validBooking({ selection: { serviceId: "helicopter-ride", durationMinutes: 30, addonIds: [], extraDogs: 0, extraCats: 0 } }),
      opts,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "selection.serviceId"));
  });

  it("rejects a duration the catalog does not sell", () => {
    // The money case: a crafted 5-minute walk would otherwise price itself.
    const result = validateBooking(
      validBooking({ selection: { serviceId: "dog-walk", durationMinutes: 5, addonIds: [], extraDogs: 0, extraCats: 0 } }),
      opts,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "selection.durationMinutes"));
  });

  it("normalises the duration on a flat-rate service instead of trusting it", () => {
    const result = validateBooking(
      validBooking({
        selection: { serviceId: "overnight", durationMinutes: 15, addonIds: [], extraDogs: 0, extraCats: 0 },
      }),
      opts,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.selection.durationMinutes, 0);
  });

  it("rejects unknown add-ons and de-duplicates real ones", () => {
    const bad = validateBooking(
      validBooking({ selection: { serviceId: "dog-walk", durationMinutes: 30, addonIds: ["free-money"], extraDogs: 0, extraCats: 0 } }),
      opts,
    );
    assert.equal(bad.ok, false);

    const dupes = validateBooking(
      validBooking({
        selection: { serviceId: "dog-walk", durationMinutes: 30, addonIds: ["medication", "medication"], extraDogs: 0, extraCats: 0 },
      }),
      opts,
    );
    assert.equal(dupes.ok, true);
    if (!dupes.ok) return;
    assert.deepEqual(dupes.value.selection.addonIds, ["medication"]);
  });

  it("rejects dates in the past and dates that do not exist", () => {
    const past = validateBooking(
      validBooking({ schedule: { dateStart: "2026-08-16", dateEnd: "", window: "morning", flexibilityNotes: "" } }),
      opts,
    );
    assert.equal(past.ok, false);

    const unreal = validateBooking(
      validBooking({ schedule: { dateStart: "2026-02-31", dateEnd: "", window: "morning", flexibilityNotes: "" } }),
      opts,
    );
    assert.equal(unreal.ok, false);
    if (unreal.ok) return;
    assert.ok(unreal.errors.some((e) => e.message.includes("does not exist")));
  });

  it("accepts today", () => {
    const today = validateBooking(
      validBooking({ schedule: { dateStart: "2026-08-17", dateEnd: "", window: "evening", flexibilityNotes: "" } }),
      opts,
    );
    assert.equal(today.ok, true);
  });

  it("rejects an end date before the start date", () => {
    const result = validateBooking(
      validBooking({ schedule: { dateStart: SOON, dateEnd: "2026-08-20", window: "morning", flexibilityNotes: "" } }),
      opts,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "schedule.dateEnd"));
  });

  it("flags an out-of-area zip without blocking it", () => {
    const result = validateBooking(
      validBooking({ customer: { ...validBooking().customer, zip: "19191" } }),
      opts,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.warnings, ["out-of-area"]);
  });

  it("requires consent", () => {
    const result = validateBooking(validBooking({ consent: false }), opts);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "consent"));
  });

  it("strips control characters from free text", () => {
    const injected = "Dana\r\nBcc: someone@elsewhere.test";
    const result = validateBooking(
      validBooking({ customer: { ...validBooking().customer, name: injected } }),
      opts,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(!result.value.customer.name.includes("\r"));
    assert.ok(!result.value.customer.name.includes("\n"));
  });

  it("keeps newlines in the notes fields", () => {
    const result = validateBooking(
      validBooking({ pet: { ...validBooking().pet, medical: "Line one\nLine two" } }),
      opts,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.pet.medical, "Line one\nLine two");
  });

  it("drops keys it was not asked for", () => {
    const result = validateBooking({ ...validBooking(), isAdmin: true, total: 0 }, opts);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(!("isAdmin" in result.value));
    assert.ok(!("total" in result.value));
  });

  it("treats the first-time flag as false unless it is literally true", () => {
    const yes = validateBooking(
      validBooking({ customer: { ...validBooking().customer, firstTime: true } }),
      opts,
    );
    assert.equal(yes.ok, true);
    if (!yes.ok) return;
    assert.equal(yes.value.customer.firstTime, true);

    // A crafted request cannot smuggle a truthy non-boolean through.
    const legacy = { ...validBooking() } as Record<string, unknown>;
    (legacy.customer as Record<string, unknown>).firstTime = "yes";
    const coerced = validateBooking(legacy, opts);
    assert.equal(coerced.ok, true);
    if (!coerced.ok) return;
    assert.equal(coerced.value.customer.firstTime, false);
  });

  it("rejects malformed phone numbers and email addresses", () => {
    const result = validateBooking(
      validBooking({ customer: { ...validBooking().customer, phone: "12", email: "not-an-email" } }),
      opts,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "customer.phone"));
    assert.ok(result.errors.some((e) => e.field === "customer.email"));
  });
});

describe("spam heuristics", () => {
  it("catches a filled honeypot", () => {
    assert.equal(looksAutomated({ honeypot: "buy pills" }), true);
    assert.equal(looksAutomated({ honeypot: "  " }), false);
  });

  it("catches an instant submission but tolerates a skewed clock", () => {
    const now = 1_000_000;
    assert.equal(looksAutomated({ startedAt: now - 500 }, now), true);
    assert.equal(looksAutomated({ startedAt: now - 30_000 }, now), false);
    // A clock running fast puts startedAt in the future. Not evidence of a bot.
    assert.equal(looksAutomated({ startedAt: now + 60_000 }, now), false);
    assert.equal(looksAutomated({}, now), false);
  });
});

describe("pricing", () => {
  it("does not double-charge a nail trim added to a stand-alone nail trim", () => {
    const request = validBooking({
      selection: { serviceId: "nail-trim", durationMinutes: 0, addonIds: ["nail-trim-addon"], extraDogs: 0, extraCats: 0 },
    });
    assert.equal(estimate(request, catalog, NOW).total, 20);
  });

  it("surcharges Easter (B5, confirmed) and holidays inside a range, both years", () => {
    assert.equal(coversHoliday("2026-04-05", ""), true, "Easter 2026");
    assert.equal(coversHoliday("2027-03-27", "2027-03-30"), true, "range over Easter 2027");
    assert.equal(coversHoliday("2027-12-20", "2027-12-26"), true, "range over Christmas 2027");
    assert.equal(coversHoliday("2026-04-06", ""), false, "the Monday after is a normal day");
  });

  it("prices against the clock it is given, not the wall clock", () => {
    // This suite books SOON, a week past NOW. Before the estimator took a
    // clock, it read the real one -- so the fixture quietly became a
    // last-minute booking once the calendar reached it, and the suite started
    // failing on a day nobody had touched the code. Pin both sides.
    const request = validBooking();
    assert.equal(estimate(request, catalog, NOW).total, 25, "a week out: no surcharge");

    const eveningBefore = new Date(2026, 7, 23, 20, 0, 0); // < 24h before 9am on the 24th
    assert.equal(
      estimate(request, catalog, eveningBefore).total,
      33,
      "inside 24 hours: +$8, and only because the clock says so",
    );
  });

  it("charges nights for an overnight range and visits for a walk range", () => {
    const range = { dateStart: "2026-08-22", dateEnd: "2026-08-25", window: "morning" as const, flexibilityNotes: "" };

    const overnight = estimate(
      validBooking({
        selection: { serviceId: "overnight", durationMinutes: 0, addonIds: [], extraDogs: 0, extraCats: 0 },
        schedule: range,
      }),
      catalog,
      NOW,
    );
    assert.equal(overnight.units, 3, "22nd to 25th is three nights");

    const walks = estimate(validBooking({ schedule: range }), catalog, NOW);
    assert.equal(walks.units, 4, "22nd to 25th is four visits");
  });
});

describe("rate limiting", () => {
  it("blocks past the burst limit and reports a retry delay", async () => {
    const store = memoryStore();
    const rules = [{ name: "burst", limit: 2, windowSeconds: 60 }];
    const now = 1_700_000_000_000;

    assert.equal((await checkRateLimit("ip", store, rules, now)).allowed, true);
    assert.equal((await checkRateLimit("ip", store, rules, now)).allowed, true);

    const third = await checkRateLimit("ip", store, rules, now);
    assert.equal(third.allowed, false);
    assert.equal(third.rule, "burst");
    assert.ok(third.retryAfter > 0 && third.retryAfter <= 60);
  });

  it("keeps separate counters per caller", async () => {
    const store = memoryStore();
    const rules = [{ name: "burst", limit: 1, windowSeconds: 60 }];
    const now = 1_700_000_000_000;

    await checkRateLimit("a", store, rules, now);
    assert.equal((await checkRateLimit("b", store, rules, now)).allowed, true);
  });

  it("resets in the next window", async () => {
    const store = memoryStore();
    const rules = [{ name: "burst", limit: 1, windowSeconds: 60 }];
    const now = 1_700_000_000_000;

    await checkRateLimit("ip", store, rules, now);
    assert.equal((await checkRateLimit("ip", store, rules, now)).allowed, false);
    assert.equal((await checkRateLimit("ip", store, rules, now + 61_000)).allowed, true);
  });
});

describe("emails", () => {
  const ctx = {
    catalog,
    outOfArea: false,
    phone: "610-888-4541",
    email: "edventurespetsitting@gmail.com",
    siteUrl: "https://edventures.pet",
    owner: "Edward",
    now: NOW,
  };

  it("puts service, date, window, name and phone in Edward's first lines", () => {
    const mail = edwardEmail(validBooking(), ctx);
    const firstThree = mail.text.split("\n").slice(0, 3).join("\n");

    assert.match(firstThree, /Dog Walk, 30 min/);
    assert.match(firstThree, /August 24/);
    assert.match(firstThree, /Morning/);
    assert.match(firstThree, /Dana Reyes/);
    assert.match(firstThree, /215-555-0134/);
  });

  it("sets Reply-To to the customer", () => {
    assert.equal(edwardEmail(validBooking(), ctx).replyTo, "dana@example.com");
  });

  it("uses the 3.9 subject format", () => {
    assert.equal(
      edwardEmail(validBooking(), ctx).subject,
      "New booking: Dog Walk, 30 min - Mon, Aug 24 - Dana Reyes",
    );
  });

  it("flags out-of-area prominently for Edward and gently for the customer", () => {
    const flagged = { ...ctx, outOfArea: true };
    assert.match(edwardEmail(validBooking(), flagged).text.split("\n")[0]!, /OUT OF AREA/);
    assert.match(customerEmail(validBooking(), flagged).text, /travel fee/);
  });

  it("flags a first-time client at the top of Edward's email and tells the customer about the meet-and-greet", () => {
    const firstTimer = validBooking({
      customer: { ...validBooking().customer, firstTime: true },
    });
    assert.match(edwardEmail(firstTimer, ctx).text.split("\n")[0]!, /FIRST-TIME CLIENT/);
    assert.match(customerEmail(firstTimer, ctx).text, /meet-and-greet/);

    // And a repeat client's emails say nothing about it.
    assert.ok(!edwardEmail(validBooking(), ctx).text.includes("FIRST-TIME"));
    assert.ok(!customerEmail(validBooking(), ctx).text.includes("meet-and-greet"));
  });

  it("escapes HTML so a pasted angle bracket cannot inject markup", () => {
    const mail = edwardEmail(
      validBooking({ pet: { ...validBooking().pet, name: "<script>alert(1)</script>" } }),
      ctx,
    );
    assert.ok(!mail.html.includes("<script>"));
    assert.ok(mail.html.includes("&lt;script&gt;"));
  });

  it("tells the customer nothing is booked yet", () => {
    assert.match(customerEmail(validBooking(), ctx).text, /Nothing is booked yet/);
  });
});

describe("endpoint", () => {
  it("accepts a valid booking and sends both emails", async () => {
    const d = deps();
    const res = await handleBookingRequest(post(validBooking()), d);

    assert.equal(res.status, 200);
    const body = await res.json() as { ok: boolean; total: number };
    assert.equal(body.ok, true);
    assert.equal(body.total, 25);

    assert.equal(d.mailer.sent.length, 2);
    assert.equal(d.mailer.sent[0]!.to, "edventurespetsitting@gmail.com");
    assert.equal(d.mailer.sent[1]!.to, "dana@example.com");
  });

  it("recomputes the total rather than trusting the client", async () => {
    const d = deps();
    const res = await handleBookingRequest(post({ ...validBooking(), total: 1, estimate: 1 }), d);
    const body = await res.json() as { total: number };
    assert.equal(body.total, 25);
  });

  it("rejects anything but POST", async () => {
    const res = await handleBookingRequest(
      new Request("https://edventures.pet/api/booking", { method: "GET" }),
      deps(),
    );
    assert.equal(res.status, 405);
    assert.equal(res.headers.get("Allow"), "POST");
  });

  it("rejects a non-JSON content type", async () => {
    const res = await handleBookingRequest(
      post(validBooking(), { "Content-Type": "text/plain" }),
      deps(),
    );
    assert.equal(res.status, 415);
  });

  it("rejects malformed JSON", async () => {
    const res = await handleBookingRequest(post("{ not json"), deps());
    assert.equal(res.status, 400);
  });

  it("rejects an oversized body", async () => {
    const huge = { ...validBooking(), pet: { ...validBooking().pet, medical: "x".repeat(70_000) } };
    const res = await handleBookingRequest(post(huge), deps());
    assert.equal(res.status, 413);
  });

  it("returns field errors on invalid input without sending anything", async () => {
    const d = deps();
    const res = await handleBookingRequest(post(validBooking({ consent: false })), d);

    assert.equal(res.status, 422);
    const body = await res.json() as { errors: { field: string }[] };
    assert.ok(body.errors.some((e) => e.field === "consent"));
    assert.equal(d.mailer.sent.length, 0);
  });

  it("answers a bot with an indistinguishable success and sends nothing", async () => {
    const d = deps();
    const res = await handleBookingRequest(post({ ...validBooking(), honeypot: "x" }), d);

    assert.equal(res.status, 200);
    assert.equal((await res.json() as { ok: boolean }).ok, true);
    assert.equal(d.mailer.sent.length, 0);
  });

  it("rate-limits a caller who will not stop", async () => {
    const d = deps({ rateLimitRules: [{ name: "burst", limit: 2, windowSeconds: 60 }] });

    await handleBookingRequest(post(validBooking()), d);
    await handleBookingRequest(post(validBooking()), d);
    const third = await handleBookingRequest(post(validBooking()), d);

    assert.equal(third.status, 429);
    assert.ok(Number(third.headers.get("Retry-After")) > 0);
  });

  it("logs before sending, so a mail failure still leaves a record", async () => {
    const order: string[] = [];
    const d = deps({
      logSubmission: async () => { order.push("log"); },
      mailer: { send: async () => { order.push("send"); throw new Error("provider down"); } },
      onError: () => {},
    });

    const res = await handleBookingRequest(post(validBooking()), d);
    assert.equal(res.status, 502);
    assert.deepEqual(order, ["log", "send"]);
  });

  it("does not fail the booking when only the customer's copy fails", async () => {
    let call = 0;
    const d = deps({
      mailer: {
        send: async () => {
          call += 1;
          if (call === 2) throw new Error("customer copy bounced");
        },
      },
      onError: () => {},
    });

    const res = await handleBookingRequest(post(validBooking()), d);
    assert.equal(res.status, 200, "Edward has it; the receipt failing is not the customer's problem");
  });

  it("does not let a logging failure lose the booking", async () => {
    const d = deps({
      logSubmission: async () => { throw new Error("KV unavailable"); },
      onError: () => {},
    });

    const res = await handleBookingRequest(post(validBooking()), d);
    assert.equal(res.status, 200);
    assert.equal(d.mailer.sent.length, 2);
  });

  it("passes the out-of-area flag through to the emails", async () => {
    const d = deps();
    await handleBookingRequest(
      post(validBooking({ customer: { ...validBooking().customer, zip: "19191" } })),
      d,
    );
    assert.match(d.mailer.sent[0]!.text, /OUT OF AREA/);
  });
});

/* ------------------------------------------------------------------ *
 * Confirmation flow
 * ------------------------------------------------------------------ */

/** KV, as a Map. The real thing is get/put over strings and nothing else. */
function fakeStore(): ConfirmStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(key) {
      return data.get(key) ?? null;
    },
    async put(key, value) {
      data.set(key, value);
    },
  };
}

const TOKEN = "test-token-0001";

/**
 * Runs a real booking through the real endpoint, logging into `store` exactly
 * the way functions/api/booking.ts does. Anything the confirm flow then reads
 * was written by the booking flow, so the two cannot drift apart unnoticed.
 */
async function bookInto(store: ReturnType<typeof fakeStore>, overrides: Partial<BookingRequest> = {}) {
  const d = deps({
    makeToken: () => TOKEN,
    confirmLinkFor: (t: string) => `https://edventures.pet/api/confirm?t=${t}`,
    logSubmission: async (record) => {
      const key = `booking:${record.receivedAt}:test`;
      await store.put(key, JSON.stringify(record));
      await store.put(pointerKey(record.token), key);
    },
  });
  const res = await handleBookingRequest(post(validBooking(overrides)), d);
  assert.equal(res.status, 200);
  return d;
}

function confirmDeps(store: ConfirmStore, overrides: Partial<ConfirmDeps> = {}): ConfirmDeps & {
  mailer: ReturnType<typeof dryRunMailer>;
} {
  const mailer = dryRunMailer();
  return {
    store,
    catalog,
    mailer,
    fromAddress: "Edventures <bookings@edventures.pet>",
    site: {
      phone: "610-888-4541",
      email: "edventurespetsitting@gmail.com",
      url: "https://edventures.pet",
      owner: "Edward",
    },
    now: () => NOW,
    ...overrides,
  } as ConfirmDeps & { mailer: ReturnType<typeof dryRunMailer> };
}

const confirmGet = (token: string, format = "") =>
  new Request(
    `https://edventures.pet/api/confirm?t=${encodeURIComponent(token)}` +
      (format ? `&format=${format}` : ""),
  );

const confirmPost = (token: string, note = "") =>
  new Request("https://edventures.pet/api/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ t: token, note }).toString(),
  });

describe("confirmation", () => {
  it("issues a token with the booking and puts the link in Edward's email", async () => {
    const store = fakeStore();
    const d = await bookInto(store);

    assert.match(d.mailer.sent[0]!.text, /\/api\/confirm\?t=test-token-0001/);
    assert.match(d.mailer.sent[0]!.html, /Confirm this booking/);
    assert.ok(store.data.get(pointerKey(TOKEN)), "pointer written for the token");
  });

  it("renders no button when there is nowhere to look the booking up", async () => {
    const d = deps(); // no confirmLinkFor, as when KV is unbound
    await handleBookingRequest(post(validBooking()), d);
    assert.ok(!d.mailer.sent[0]!.text.includes("/api/confirm"));
    assert.ok(!d.mailer.sent[0]!.html.includes("Confirm this booking"));
  });

  it("GET renders the page and sends absolutely nothing", async () => {
    const store = fakeStore();
    await bookInto(store);
    const c = confirmDeps(store);

    const res = await handleConfirmRequest(confirmGet(TOKEN), c);
    const body = await res.text();

    assert.equal(res.status, 200);
    assert.match(body, /Confirm this booking\?/);
    assert.match(body, /Dana Reyes/);
    assert.match(body, /<form method="POST">/);
    assert.equal(c.mailer.sent.length, 0, "a prefetching scanner must not send mail");
  });

  it("POST sends the confirmation, carries the note, and stamps the record", async () => {
    const store = fakeStore();
    await bookInto(store);
    const c = confirmDeps(store);

    const res = await handleConfirmRequest(confirmPost(TOKEN, "See you Tuesday."), c);
    assert.equal(res.status, 200);

    assert.equal(c.mailer.sent.length, 1);
    const mail = c.mailer.sent[0]!;
    assert.equal(mail.to, "dana@example.com");
    assert.match(mail.subject, /^Confirmed: /);
    assert.match(mail.text, /See you Tuesday\./);
    assert.match(mail.html, /See you Tuesday\./);

    const key = store.data.get(pointerKey(TOKEN))!;
    const stored = JSON.parse(store.data.get(key)!);
    assert.ok(stored.confirmedAt, "record stamped");
    assert.equal(stored.confirmNote, "See you Tuesday.");
  });

  it("does not send twice, however many times the button is pressed", async () => {
    const store = fakeStore();
    await bookInto(store);
    const c = confirmDeps(store);

    await handleConfirmRequest(confirmPost(TOKEN), c);
    const second = await handleConfirmRequest(confirmPost(TOKEN), c);
    const body = await second.text();

    assert.equal(c.mailer.sent.length, 1, "the customer hears once");
    assert.match(body, /Already confirmed/);

    // And the page a re-opened link shows says the same.
    const get = await handleConfirmRequest(confirmGet(TOKEN), c);
    assert.match(await get.text(), /Already confirmed/);
  });

  it("refuses an unknown token without sending", async () => {
    const store = fakeStore();
    await bookInto(store);
    const c = confirmDeps(store);

    const res = await handleConfirmRequest(confirmPost("not-a-real-token"), c);
    assert.equal(res.status, 404);
    assert.match(await res.text(), /isn.t recognised/);
    assert.equal(c.mailer.sent.length, 0);
  });

  it("leaves the record unstamped when the send fails, so it can be retried", async () => {
    const store = fakeStore();
    await bookInto(store);
    const c = confirmDeps(store, {
      mailer: { send: async () => { throw new Error("provider down"); } },
      onError: () => {},
    });

    const res = await handleConfirmRequest(confirmPost(TOKEN), c);
    assert.equal(res.status, 502);
    assert.match(await res.text(), /have <strong>not<\/strong> been told/);

    const key = store.data.get(pointerKey(TOKEN))!;
    assert.ok(!JSON.parse(store.data.get(key)!).confirmedAt, "not marked confirmed");
  });

  it("neutralises a note rather than rejecting it", () => {
    assert.equal(cleanNote("Header: x\r\nBcc: someone@elsewhere.test").includes("\r"), false);
    assert.equal(cleanNote(undefined), "");
    assert.equal(cleanNote("x".repeat(5000)).length, 1000);
  });

  it("escapes a hostile note instead of rendering it", () => {
    const ctx = {
      catalog,
      outOfArea: false,
      phone: "610-888-4541",
      email: "edventurespetsitting@gmail.com",
      siteUrl: "https://edventures.pet",
      owner: "Edward",
      now: NOW,
    };
    const mail = confirmationEmail(validBooking(), ctx, "<script>alert(1)</script>");
    assert.ok(!mail.html.includes("<script>"));
    assert.ok(mail.html.includes("&lt;script&gt;"));
  });

  it("attaches the calendar file to the customer's confirmation", async () => {
    const store = fakeStore();
    await bookInto(store);
    const c = confirmDeps(store);

    await handleConfirmRequest(confirmPost(TOKEN), c);
    const [sent] = c.mailer.sent;

    assert.equal(sent!.attachments?.length, 1);
    assert.match(sent!.attachments![0].contentType, /^text\/calendar/);
    assert.match(sent!.attachments![0].filename, /\.ics$/);
    assert.match(sent!.attachments![0].content, /^BEGIN:VCALENDAR/);
  });

  it("builds the attachment from what was agreed, not what was requested", async () => {
    // The note Edward types on the confirm page belongs in the calendar entry;
    // generating the file from the pre-confirmation record would silently drop
    // it and mark an unconfirmed booking CONFIRMED.
    const store = fakeStore();
    await bookInto(store);
    const c = confirmDeps(store);

    await handleConfirmRequest(confirmPost(TOKEN, "Bring the spare leash"), c);
    const ics = c.mailer.sent[0]!.attachments![0].content;

    assert.match(ics.replace(/\r\n /g, ""), /Bring the spare leash/);
    assert.match(ics, /STATUS:CONFIRMED/);
  });

  it("serves the calendar file to Edward once, and only once, it is confirmed", async () => {
    const store = fakeStore();
    await bookInto(store);
    const c = confirmDeps(store);

    // Before confirming there is nothing to put in a diary -- the request has
    // not been agreed to, and an unbooked visit in his calendar is worse than
    // no export.
    const early = await handleConfirmRequest(confirmGet(TOKEN, "ics"), c);
    assert.match(early.headers.get("Content-Type") ?? "", /text\/html/);
    assert.match(await early.text(), /Confirm this booking\?/);

    await handleConfirmRequest(confirmPost(TOKEN), c);

    const after = await handleConfirmRequest(confirmGet(TOKEN, "ics"), c);
    assert.match(after.headers.get("Content-Type") ?? "", /^text\/calendar/);
    assert.match(after.headers.get("Content-Disposition") ?? "", /attachment; filename=".*\.ics"/);
    assert.match(await after.text(), /^BEGIN:VCALENDAR/);
    // Serving a file is not sending mail. A second confirmation must not go out.
    assert.equal(c.mailer.sent.length, 1);
  });

  it("keeps the token out of referrers and search indexes on the ics too", async () => {
    const store = fakeStore();
    await bookInto(store);
    const c = confirmDeps(store);
    await handleConfirmRequest(confirmPost(TOKEN), c);

    const res = await handleConfirmRequest(confirmGet(TOKEN, "ics"), c);
    assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");
    assert.match(res.headers.get("X-Robots-Tag") ?? "", /noindex/);
  });

  it("offers the add-to-calendar button on the confirmed page", async () => {
    const store = fakeStore();
    await bookInto(store);
    const c = confirmDeps(store);

    const res = await handleConfirmRequest(confirmPost(TOKEN), c);
    const body = await res.text();
    assert.match(body, /Add to calendar/);
    assert.match(body, new RegExp(`t=${TOKEN}&amp;format=ics`));
  });

  it("tells the customer it is actually booked, unlike the request receipt", () => {
    const ctx = {
      catalog,
      outOfArea: false,
      phone: "610-888-4541",
      email: "edventurespetsitting@gmail.com",
      siteUrl: "https://edventures.pet",
      owner: "Edward",
      now: NOW,
    };
    const confirmed = confirmationEmail(validBooking(), ctx);
    assert.match(confirmed.text, /has confirmed your booking/);
    assert.ok(!confirmed.text.includes("Nothing is booked yet"));
    // No note given: no empty heading left behind.
    assert.ok(!confirmed.html.includes("A note from"));
  });
});
