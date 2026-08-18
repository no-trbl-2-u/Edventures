/**
 * Roadmap 3.1 - the booking data model.
 *
 * Everything about a booking request is described here, once. The form, the
 * price estimate, the serverless handler, the notification email and any future
 * third-party integration all speak this shape. That is the whole point: when
 * Phase 4 swaps in a booking tool, or Phase 6 puts a database behind it, those
 * are adapters onto `BookingRequest` rather than rewrites of the form.
 *
 * Prices are NOT hardcoded here. They arrive as a `Catalog` built from the
 * validated content collections (services.json / addons.json / fees.json), so a
 * price change is a content edit and the build fails if it is malformed.
 */

/* ------------------------------------------------------------------ *
 * Catalog - the priced things, shaped from content collections
 * ------------------------------------------------------------------ */

export interface ServiceTier {
  minutes: number;
  price: number;
}

export interface CatalogService {
  id: string;
  name: string;
  blurb: string;
  /** Empty for flat-rate services (nail trim, overnight). */
  tiers: ServiceTier[];
  /** Flat price when there are no tiers. */
  base?: number;
  baseLabel?: string;
  icon: string;
  /** Short "from $15" label for cards. */
  fromLabel: string;
}

export interface CatalogAddon {
  id: string;
  name: string;
  price: number;
  note?: string;
  freeWithOvernight: boolean;
}

export interface CatalogFee {
  id: string;
  name: string;
  amount: number;
  /** Applied automatically by the estimator rather than chosen by the customer. */
  auto: boolean;
}

export interface Catalog {
  services: CatalogService[];
  addons: CatalogAddon[];
  fees: CatalogFee[];
}

/* ------------------------------------------------------------------ *
 * The request itself
 * ------------------------------------------------------------------ */

/**
 * Broad windows rather than exact times.
 *
 * A walker cannot promise 2:15pm, and a form that asks for it implies a
 * precision that will be broken on the first rainy Tuesday. Windows match how
 * the day actually gets scheduled.
 */
export type TimeWindowId = "morning" | "midday" | "afternoon" | "evening";

export interface TimeWindow {
  id: TimeWindowId;
  name: string;
  hours: string;
  icon: string;
}

export const TIME_WINDOWS: TimeWindow[] = [
  { id: "morning", name: "Morning", hours: "7 – 11 am", icon: "sunrise" },
  { id: "midday", name: "Midday", hours: "11 am – 2 pm", icon: "sun" },
  { id: "afternoon", name: "Afternoon", hours: "2 – 6 pm", icon: "sunset" },
  { id: "evening", name: "Evening", hours: "6 – 9 pm", icon: "moon" },
];

export const TEMPERAMENTS = [
  "Easy-going",
  "Energetic",
  "Shy",
  "Anxious",
  "Elderly",
  "Reactive to other dogs",
] as const;

/**
 * Entry methods are captured as a category only. The form must never collect
 * an actual code or key location - that is settled in person at the
 * meet-and-greet, not typed into a web form and emailed in plain text.
 */
export const ENTRY_METHODS = [
  "I'll leave a key",
  "Lockbox",
  "Door code",
  "Front desk / doorman",
  "I'll be home",
] as const;

export type Species = "Dog" | "Cat" | "Both" | "Other";

export interface PetDetails {
  name: string;
  species: Species;
  breed: string;
  age: string;
  temperament: string;
  /** Free text: medical needs, medication, anything to watch for. */
  medical: string;
}

export interface CustomerDetails {
  name: string;
  phone: string;
  email: string;
  address: string;
  zip: string;
  entryMethod: string;
  emergencyContact: string;
  vet: string;
}

export interface BookingSchedule {
  /** ISO `YYYY-MM-DD`. Local calendar dates, never timestamps - a walk on the
   *  14th is on the 14th regardless of the reader's timezone. */
  dateStart: string;
  /** Empty for a single day; set for a multi-day trip. */
  dateEnd: string;
  window: TimeWindowId | "";
  flexibilityNotes: string;
}

export interface BookingSelection {
  serviceId: string;
  /** 0 for flat-rate services. */
  durationMinutes: number;
  addonIds: string[];
  extraDogs: number;
  extraCats: number;
}

export interface BookingRequest {
  selection: BookingSelection;
  schedule: BookingSchedule;
  pet: PetDetails;
  customer: CustomerDetails;
  /** Acknowledgement that this is a request, not a confirmed booking. */
  consent: boolean;
  /** Filled by bots, never by people. Server rejects any non-empty value. */
  honeypot?: string;
  /** Client timestamp of form render, for the minimum-time-to-submit check. */
  startedAt?: number;
}

export const EMPTY_BOOKING: BookingRequest = {
  selection: { serviceId: "dog-walk", durationMinutes: 30, addonIds: [], extraDogs: 0, extraCats: 0 },
  schedule: { dateStart: "", dateEnd: "", window: "", flexibilityNotes: "" },
  pet: { name: "", species: "Dog", breed: "", age: "", temperament: "", medical: "" },
  customer: {
    name: "", phone: "", email: "", address: "", zip: "",
    entryMethod: "", emergencyContact: "", vet: "",
  },
  consent: false,
};

/* ------------------------------------------------------------------ *
 * Estimate
 * ------------------------------------------------------------------ */

export interface EstimateLine {
  label: string;
  /** Display string, because some lines read "Included" rather than a number. */
  amount: string;
}

export interface Estimate {
  total: number;
  lines: EstimateLine[];
  /** Visits for walks/visits, nights for overnights. */
  units: number;
  perUnit: number;
}

const money = (n: number) => `$${n}`;

/** Parse `YYYY-MM-DD` as a local date. `new Date("2026-08-17")` parses as UTC
 *  and lands on the previous day west of Greenwich - a classic off-by-one. */
export function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function toIso(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Inclusive day count across a range; 1 for a single date. */
export function dayCount(dateStart: string, dateEnd: string): number {
  const a = parseLocalDate(dateStart);
  const b = parseLocalDate(dateEnd);
  if (!a || !b) return 1;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}

/**
 * Under 24 hours' notice, measured from 9am on the requested day - the earliest
 * a booking realistically needs covering. Measuring from midnight would flag
 * next-day requests made at 11pm as fine when they are plainly last-minute.
 */
export function isLastMinute(dateStart: string, now = new Date()): boolean {
  const d = parseLocalDate(dateStart);
  if (!d) return false;
  d.setHours(9, 0, 0, 0);
  return d.getTime() - now.getTime() < 86_400_000;
}

/**
 * Dates carrying the holiday surcharge.
 *
 * OPEN QUESTION (go-back-to-ed.md, B5): Edward has not confirmed which days he
 * treats as holidays. This is the common pet-sitting set. The surcharge is
 * published on the price list at a flat +$15, so applying it here matches what
 * a customer already sees -- but the *list* needs his sign-off before launch.
 */
export const HOLIDAYS_2026: string[] = [
  "2026-01-01", // New Year's Day
  "2026-05-25", // Memorial Day
  "2026-07-04", // Independence Day
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving
  "2026-12-24", // Christmas Eve
  "2026-12-25", // Christmas Day
  "2026-12-31", // New Year's Eve
];

export function coversHoliday(
  dateStart: string,
  dateEnd: string,
  holidays: string[] = HOLIDAYS_2026,
): boolean {
  if (!dateStart) return false;
  const end = dateEnd || dateStart;
  return holidays.some((h) => h >= dateStart && h <= end);
}

const feeAmount = (catalog: Catalog, id: string, fallback: number) =>
  catalog.fees.find((f) => f.id === id)?.amount ?? fallback;

/**
 * Build the line-item estimate.
 *
 * Deliberately shows the breakdown rather than a bare number: a customer who
 * can see *why* it is $48 does not need to ask, and Edward does not have to
 * defend a figure he never quoted.
 */
export function estimate(request: BookingRequest, catalog: Catalog): Estimate {
  const { selection, schedule } = request;
  const service = catalog.services.find((s) => s.id === selection.serviceId) ?? catalog.services[0];
  const lines: EstimateLine[] = [];
  let perUnit = 0;

  // Base
  if (service.tiers.length) {
    const tier =
      service.tiers.find((t) => t.minutes === selection.durationMinutes) ?? service.tiers[0];
    perUnit += tier.price;
    lines.push({
      label: `${service.name.replace(/s$/, "")} · ${tier.minutes} min`,
      amount: money(tier.price),
    });
  } else {
    const base = service.base ?? 0;
    perUnit += base;
    lines.push({ label: service.baseLabel ?? service.name, amount: money(base) });
  }

  // Add-ons
  const isOvernight = service.id === "overnight";
  for (const id of selection.addonIds) {
    const addon = catalog.addons.find((a) => a.id === id);
    if (!addon) continue;
    // A nail trim add-on on top of a stand-alone nail trim is double-charging.
    // The ids differ by design -- the service is `nail-trim`, the add-on is
    // `nail-trim-addon` -- so this compared the add-on against a service id it
    // could never equal, and quietly charged $28 for a $20 trim.
    if (addon.id === "nail-trim-addon" && service.id === "nail-trim") continue;

    const free = addon.freeWithOvernight && isOvernight;
    lines.push({
      label: free ? `${addon.name} (free overnight)` : addon.name,
      amount: free ? "Included" : `+${money(addon.price)}`,
    });
    if (!free) perUnit += addon.price;
  }

  // Additional pets
  const dogFee = feeAmount(catalog, "additional-dog", 7);
  const catFee = feeAmount(catalog, "additional-cat", 5);
  const extraDogs = clampCount(selection.extraDogs);
  const extraCats = clampCount(selection.extraCats);

  if (extraDogs) {
    lines.push({
      label: `${extraDogs} additional ${extraDogs > 1 ? "dogs" : "dog"}`,
      amount: `+${money(extraDogs * dogFee)}`,
    });
    perUnit += extraDogs * dogFee;
  }
  if (extraCats) {
    lines.push({
      label: `${extraCats} additional ${extraCats > 1 ? "cats" : "cat"}`,
      amount: `+${money(extraCats * catFee)}`,
    });
    perUnit += extraCats * catFee;
  }

  // Repeat across a date range. An overnight booking spanning the 3rd to the
  // 6th is three nights, not four days - the last day is a departure, not a
  // stay. Visits are the other way round: every day gets one.
  const days = schedule.dateEnd ? dayCount(schedule.dateStart, schedule.dateEnd) : 1;
  const units = days > 1 ? (isOvernight ? days - 1 : days) : 1;

  let total = perUnit;
  if (units > 1) {
    total = perUnit * units;
    lines.push({
      label: `× ${units} ${isOvernight ? "nights" : "visits"}`,
      amount: money(total),
    });
  }

  // Automatic surcharges, applied once per booking rather than per visit.
  if (isLastMinute(schedule.dateStart)) {
    const fee = feeAmount(catalog, "last-minute", 8);
    lines.push({ label: "Under 24 hrs notice", amount: `+${money(fee)}` });
    total += fee;
  }
  if (coversHoliday(schedule.dateStart, schedule.dateEnd)) {
    const fee = feeAmount(catalog, "holiday", 15);
    lines.push({ label: "Holiday visit", amount: `+${money(fee)}` });
    total += fee;
  }

  return { total, lines, units, perUnit };
}

function clampCount(n: unknown): number {
  const v = typeof n === "number" ? n : parseInt(String(n ?? 0), 10);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(6, Math.trunc(v)));
}

/** One-line summary for the confirmation screen and the email subject. */
export function summarize(request: BookingRequest, catalog: Catalog): string {
  const { selection, schedule, pet } = request;
  const service = catalog.services.find((s) => s.id === selection.serviceId) ?? catalog.services[0];
  const date = parseLocalDate(schedule.dateStart);

  const parts = [
    service.name.replace(/s$/, "") +
      (service.tiers.length ? `, ${selection.durationMinutes} min` : ""),
    date
      ? date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
      : "a date to be confirmed",
  ];

  const window = TIME_WINDOWS.find((w) => w.id === schedule.window);
  if (window) parts.push(window.name);
  if (pet.name) parts.push(`for ${pet.name}`);

  return parts.join(" · ");
}
