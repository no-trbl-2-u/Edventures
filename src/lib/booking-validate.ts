/**
 * Roadmap 3.7 - server-side validation.
 *
 * The form validates as you type, which is a courtesy to the customer and no
 * protection at all: anything can POST to a public endpoint. Everything the
 * client checked is checked again here, against the real catalog, and the
 * result is a freshly built `BookingRequest` rather than the caller's object.
 *
 * Three rules this file follows deliberately:
 *
 * 1. **Nothing is passed through.** Every field is re-read, trimmed, capped and
 *    re-typed. The returned object shares no references with the input, so an
 *    unexpected extra key cannot ride along into an email or a log.
 * 2. **Free text is neutralised, not rejected.** Control characters are
 *    stripped and lengths are capped. A customer who pastes something strange
 *    into "anything to watch for" should still get their dog walked; a newline
 *    smuggled into an email header should not survive.
 * 3. **Money is never taken from the client.** The estimate is recomputed from
 *    the catalog on the server. The number the browser sent is not read at all.
 */
import {
  ENTRY_METHODS,
  TIME_WINDOWS,
  dayCount,
  parseLocalDate,
  toIso,
  type BookingRequest,
  type Catalog,
  type Species,
  type TimeWindowId,
} from "./booking";

export interface FieldError {
  /** Dotted path, e.g. `customer.email`, so the response can point at a field. */
  field: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: BookingRequest; warnings: string[] }
  | { ok: false; errors: FieldError[] };

/* ------------------------------------------------------------------ *
 * Limits
 * ------------------------------------------------------------------ */

/** Field length caps. Generous for a person, ruinous for anyone pasting a
 *  payload. The longest legitimate entry here is a medical note. */
const MAX = {
  name: 120,
  phone: 40,
  email: 254, // RFC 5321 maximum
  address: 200,
  shortText: 120,
  notes: 2000,
} as const;

/** How far ahead a request may be made. Beyond this it is far more likely to be
 *  a typo -- or a bot -- than a real trip. */
const MAX_DAYS_AHEAD = 550;

/** Longest bookable stretch. A three-month range is a mistake, not a holiday. */
const MAX_RANGE_DAYS = 90;

/** Matches the client's `MIN_SUBMIT_SECONDS`. */
export const MIN_SUBMIT_SECONDS = 5;

const SPECIES: Species[] = ["Dog", "Cat", "Both", "Other"];

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

/** Control characters, as a class. Stripping these is the part that matters:
 *  a CR/LF reaching an email header is header injection, and the customer's
 *  own name goes straight into the subject line. */
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]", "g");
/** The same, minus tab and the newline pair, for genuinely multi-line fields. */
const CONTROL_CHARS_KEEP_NEWLINES = new RegExp("[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]", "g");

/** Strip control characters, collapse whitespace runs, trim, and cap. */
function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Same, but newlines survive -- medical notes and flexibility notes are prose. */
function cleanMultiline(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(CONTROL_CHARS_KEEP_NEWLINES, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function count(value: unknown, max = 6): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? 0), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.trunc(n)));
}

/**
 * Deliberately permissive. The purpose is to catch a typo and to guarantee the
 * string is safe to put in a `Reply-To`, not to adjudicate RFC 5322 -- every
 * clever regex that tries ends up rejecting somebody's real address.
 */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value) && value.length <= MAX.email;
}

/** Ten digits after punctuation, optionally with a leading US country code. */
function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/* ------------------------------------------------------------------ *
 * The validator
 * ------------------------------------------------------------------ */

export interface ValidateOptions {
  catalog: Catalog;
  servedZips: readonly string[];
  /** Injectable so tests are not hostage to the calendar. */
  now?: Date;
}

export function validateBooking(input: unknown, opts: ValidateOptions): ValidationResult {
  const { catalog, servedZips } = opts;
  const now = opts.now ?? new Date();
  const errors: FieldError[] = [];
  const warnings: string[] = [];
  const fail = (field: string, message: string) => errors.push({ field, message });

  if (!isPlainObject(input)) {
    return { ok: false, errors: [{ field: "", message: "Expected a JSON object." }] };
  }

  const selectionIn = isPlainObject(input.selection) ? input.selection : {};
  const scheduleIn = isPlainObject(input.schedule) ? input.schedule : {};
  const petIn = isPlainObject(input.pet) ? input.pet : {};
  const customerIn = isPlainObject(input.customer) ? input.customer : {};

  /* ---------------- selection ---------------- */

  const serviceId = clean(selectionIn.serviceId, MAX.shortText);
  const service = catalog.services.find((s) => s.id === serviceId);
  if (!service) fail("selection.serviceId", "Unknown service.");

  // A tiered service must name a duration the catalog actually sells; a
  // flat-rate one has no duration to choose, so it is normalised to 0 rather
  // than trusted. Otherwise a crafted 15-minute overnight prices itself.
  let durationMinutes = 0;
  if (service?.tiers.length) {
    const requested = count(selectionIn.durationMinutes, 24 * 60);
    const tier = service.tiers.find((t) => t.minutes === requested);
    if (!tier) {
      fail("selection.durationMinutes", `Not a duration offered for ${service.name}.`);
    } else {
      durationMinutes = tier.minutes;
    }
  }

  const rawAddons = Array.isArray(selectionIn.addonIds) ? selectionIn.addonIds : [];
  const addonIds: string[] = [];
  for (const raw of rawAddons.slice(0, 20)) {
    const id = clean(raw, MAX.shortText);
    if (!catalog.addons.some((a) => a.id === id)) {
      fail("selection.addonIds", `Unknown add-on: ${id || "(blank)"}.`);
      continue;
    }
    if (!addonIds.includes(id)) addonIds.push(id);
  }

  /* ---------------- schedule ---------------- */

  const dateStart = clean(scheduleIn.dateStart, 10);
  const dateEndRaw = clean(scheduleIn.dateEnd, 10);
  const start = parseLocalDate(dateStart);
  let dateEnd = "";

  if (!start) {
    fail("schedule.dateStart", "A start date is required, as YYYY-MM-DD.");
  } else if (toIso(start) !== dateStart) {
    // Round-tripping catches dates that parse but do not exist: JavaScript
    // reads 2026-02-31 as March 3rd without complaint.
    fail("schedule.dateStart", "That date does not exist.");
  } else {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysOut = Math.round((start.getTime() - today.getTime()) / 86_400_000);
    if (daysOut < 0) fail("schedule.dateStart", "That date has already passed.");
    if (daysOut > MAX_DAYS_AHEAD) {
      fail("schedule.dateStart", "That is further ahead than Edward books.");
    }

    if (dateEndRaw) {
      const end = parseLocalDate(dateEndRaw);
      if (!end || toIso(end) !== dateEndRaw) {
        fail("schedule.dateEnd", "That end date does not exist.");
      } else if (dateEndRaw < dateStart) {
        fail("schedule.dateEnd", "The end date is before the start date.");
      } else if (dayCount(dateStart, dateEndRaw) > MAX_RANGE_DAYS) {
        fail("schedule.dateEnd", `Ranges longer than ${MAX_RANGE_DAYS} days need a text instead.`);
      } else if (dateEndRaw !== dateStart) {
        dateEnd = dateEndRaw;
      }
    }
  }

  const windowIn = clean(scheduleIn.window, MAX.shortText);
  const window = TIME_WINDOWS.find((w) => w.id === windowIn)?.id ?? "";
  if (!window) fail("schedule.window", "Pick a time window.");

  /* ---------------- pet ---------------- */

  const petName = clean(petIn.name, MAX.name);
  if (!petName) fail("pet.name", "Your pet's name is required.");

  const speciesIn = clean(petIn.species, MAX.shortText);
  const species = SPECIES.find((s) => s === speciesIn);
  if (!species) fail("pet.species", "Pick dog, cat, both, or other.");

  /* ---------------- customer ---------------- */

  const customerName = clean(customerIn.name, MAX.name);
  if (!customerName) fail("customer.name", "Your name is required.");

  const phone = clean(customerIn.phone, MAX.phone);
  if (!phone) fail("customer.phone", "A phone number is required.");
  else if (!looksLikePhone(phone)) fail("customer.phone", "That doesn't look like a phone number.");

  const email = clean(customerIn.email, MAX.email).toLowerCase();
  if (!email) fail("customer.email", "An email address is required.");
  else if (!looksLikeEmail(email)) {
    fail("customer.email", "That doesn't look like an email address.");
  }

  const address = clean(customerIn.address, MAX.address);
  if (!address) fail("customer.address", "An address is required.");

  const zip = clean(customerIn.zip, 10).slice(0, 5);
  if (!/^\d{5}$/.test(zip)) {
    fail("customer.zip", "A five-digit zip code is required.");
  } else if (!servedZips.includes(zip)) {
    // Never an error. Turning away a customer eight blocks outside the line is
    // worse than an awkward email, so this rides along as a flag for Edward.
    warnings.push("out-of-area");
  }

  const entryIn = clean(customerIn.entryMethod, MAX.shortText);
  const entryMethod = entryIn ? (ENTRY_METHODS.find((m) => m === entryIn) ?? "") : "";
  if (entryIn && !entryMethod) fail("customer.entryMethod", "Unknown entry method.");

  /* ---------------- consent ---------------- */

  if (input.consent !== true) {
    fail("consent", "The cancellation policy has to be agreed to.");
  }

  if (errors.length || !service || !species) return { ok: false, errors };

  /* ---------------- rebuild ---------------- *
   * Constructed field by field rather than spread from the input, so only what
   * is listed here can reach an email, a log, or storage.                     */

  const value: BookingRequest = {
    selection: {
      serviceId: service.id,
      durationMinutes,
      addonIds,
      extraDogs: count(selectionIn.extraDogs),
      extraCats: count(selectionIn.extraCats),
    },
    schedule: {
      dateStart,
      dateEnd,
      window: window as TimeWindowId,
      flexibilityNotes: cleanMultiline(scheduleIn.flexibilityNotes, MAX.notes),
    },
    pet: {
      name: petName,
      species,
      breed: clean(petIn.breed, MAX.shortText),
      age: clean(petIn.age, MAX.shortText),
      temperament: clean(petIn.temperament, MAX.shortText),
      medical: cleanMultiline(petIn.medical, MAX.notes),
      upToDateOnPreventatives:
        petIn.upToDateOnPreventatives === true ? true : petIn.upToDateOnPreventatives === false ? false : null,
    },
    customer: {
      name: customerName,
      phone,
      email,
      address,
      zip,
      entryMethod,
      emergencyContact: clean(customerIn.emergencyContact, MAX.address),
      vet: clean(customerIn.vet, MAX.address),
    },
    consent: true,
    photoConsent: input.photoConsent === true,
  };

  return { ok: true, value, warnings };
}

/**
 * The two spam checks the form already performs, repeated where they cannot be
 * edited out with devtools (Roadmap 3.8).
 *
 * `startedAt` is a clock reading from the customer's own machine, so a skewed
 * clock could otherwise reject a real person. Only an implausibly *fast*
 * submission counts against them, and a missing or future timestamp is ignored
 * rather than punished. Turnstile is the real answer here; this is the cheap
 * layer that costs a customer nothing.
 */
export function looksAutomated(input: unknown, now = Date.now()): boolean {
  if (!isPlainObject(input)) return false;
  if (typeof input.honeypot === "string" && input.honeypot.trim() !== "") return true;

  const startedAt = input.startedAt;
  if (typeof startedAt !== "number" || !Number.isFinite(startedAt)) return false;
  const elapsed = (now - startedAt) / 1000;
  if (elapsed < 0) return false; // clock skew, not evidence
  return elapsed < MIN_SUBMIT_SECONDS;
}
