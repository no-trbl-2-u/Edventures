/**
 * The booking request form (Roadmap 3.2 - 3.8).
 *
 * The only interactive component on the site, so the only place that ships
 * JavaScript. Everything it knows about prices arrives as `catalog` props built
 * from the validated content collections - nothing is hardcoded here.
 *
 * Deliberate choices worth knowing about:
 *
 * - Broad time windows, not exact times. Edward cannot promise 2:15pm.
 * - Out-of-area zips warn but never block. Turning away a customer eight
 *   blocks outside the line is worse than an awkward email.
 * - The draft is kept in localStorage so a dropped signal on the subway
 *   doesn't wipe twenty fields.
 * - Honeypot + minimum time-to-submit instead of an image CAPTCHA.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_BOOKING,
  ENTRY_METHODS,
  TEMPERAMENTS,
  TIME_WINDOWS,
  estimate,
  isLastMinute,
  parseLocalDate,
  summarize,
  toIso,
  type BookingRequest,
  type Catalog,
  type Species,
} from "../lib/booking";

interface Props {
  catalog: Catalog;
  servedZips: string[];
  phone: string;
  phoneHref: string;
  email: string;
  /** Where to POST. Empty until the Phase 3.7 function exists. */
  endpoint?: string;
}

const DRAFT_KEY = "edventures.booking.draft.v1";
/** Bots submit instantly; a person cannot complete four steps this fast. */
const MIN_SUBMIT_SECONDS = 5;

type Status = "form" | "sending" | "success" | "error";

export default function BookingForm({
  catalog,
  servedZips,
  phone,
  phoneHref,
  email,
  endpoint = "",
}: Props) {
  const [booking, setBooking] = useState<BookingRequest>(EMPTY_BOOKING);
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<Status>("form");
  const [restored, setRestored] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const startedAt = useRef(Date.now());
  /** True when the medication add-on was pre-selected by choosing Overnight,
   *  rather than ticked by the customer. */
  const autoAddedMed = useRef(false);
  const liveRegion = useRef<HTMLDivElement>(null);

  /* ---------------- draft persistence ---------------- */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge rather than replace, so a draft written by an older version
        // that lacks a newer field doesn't produce undefined holes.
        setBooking({
          ...EMPTY_BOOKING,
          ...parsed,
          selection: { ...EMPTY_BOOKING.selection, ...parsed.selection },
          schedule: { ...EMPTY_BOOKING.schedule, ...parsed.schedule },
          pet: { ...EMPTY_BOOKING.pet, ...parsed.pet },
          customer: { ...EMPTY_BOOKING.customer, ...parsed.customer },
        });
        setRestored(true);
      }
    } catch {
      /* A corrupt draft should never stop the form loading. */
    }
  }, []);

  useEffect(() => {
    if (status !== "form") return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(booking));
    } catch {
      /* Private mode, quota - not worth interrupting anyone over. */
    }
  }, [booking, status]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setBooking(EMPTY_BOOKING);
    setRestored(false);
  };

  /* ---------------- derived ---------------- */

  const service = useMemo(
    () => catalog.services.find((s) => s.id === booking.selection.serviceId) ?? catalog.services[0],
    [catalog.services, booking.selection.serviceId],
  );

  const est = useMemo(() => estimate(booking, catalog), [booking, catalog]);
  const lastMinute = isLastMinute(booking.schedule.dateStart);
  const zipComplete = /^\d{5}$/.test(booking.customer.zip);
  const zipInArea = zipComplete && servedZips.includes(booking.customer.zip);

  const medication = catalog.addons.find((a) => a.id === "medication");
  const nailAddon = catalog.addons.find((a) => a.id === "nail-trim-addon");
  const isOvernight = service.id === "overnight";

  /* ---------------- updates ---------------- */

  const update = useCallback((patch: Partial<BookingRequest>) => {
    setBooking((b) => ({ ...b, ...patch }));
  }, []);

  const setSelection = (patch: Partial<BookingRequest["selection"]>) =>
    setBooking((b) => ({ ...b, selection: { ...b.selection, ...patch } }));
  const setSchedule = (patch: Partial<BookingRequest["schedule"]>) =>
    setBooking((b) => ({ ...b, schedule: { ...b.schedule, ...patch } }));
  const setPet = (patch: Partial<BookingRequest["pet"]>) =>
    setBooking((b) => ({ ...b, pet: { ...b.pet, ...patch } }));
  const setCustomer = (patch: Partial<BookingRequest["customer"]>) =>
    setBooking((b) => ({ ...b, customer: { ...b.customer, ...patch } }));

  const pickService = (id: string) => {
    const next = catalog.services.find((s) => s.id === id)!;

    setBooking((b) => {
      let addonIds = [...b.selection.addonIds];

      // Overnight includes medication free, so pre-select it as a convenience.
      // But remember that WE added it: if the customer then switches back to a
      // walk, silently leaving it on would bill them $5 for something they
      // never asked for.
      if (id === "overnight") {
        if (!addonIds.includes("medication")) {
          addonIds.push("medication");
          autoAddedMed.current = true;
        }
      } else if (autoAddedMed.current) {
        addonIds = addonIds.filter((a) => a !== "medication");
        autoAddedMed.current = false;
      }

      // A nail-trim add-on on top of a stand-alone nail trim is double-charging.
      if (id === "nail-trim") {
        addonIds = addonIds.filter((a) => a !== "nail-trim-addon");
      }

      return {
        ...b,
        selection: {
          ...b.selection,
          serviceId: id,
          // Default to the middle tier - the most commonly booked, and it stops
          // the estimate reading $0 while nothing is chosen.
          durationMinutes: next.tiers.length
            ? next.tiers[Math.min(1, next.tiers.length - 1)].minutes
            : 0,
          addonIds,
        },
      };
    });
  };

  const toggleAddon = (id: string) => {
    // Once the customer touches medication themselves, it's their choice to
    // keep or drop - stop treating it as ours to remove.
    if (id === "medication") autoAddedMed.current = false;

    setSelection({
      addonIds: booking.selection.addonIds.includes(id)
        ? booking.selection.addonIds.filter((a) => a !== id)
        : [...booking.selection.addonIds, id],
    });
  };

  const goToStep = (n: number) => {
    setStep(n);
    // The global `prefers-reduced-motion` rule in global.css cannot reach this
    // one: `scroll-behavior: auto !important` governs CSS-initiated scrolling,
    // while a JS `behavior: "smooth"` sets it per call and wins regardless. So
    // the preference has to be read here as well.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  /* ---------------- submit ---------------- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) return; // silently drop
    if ((Date.now() - startedAt.current) / 1000 < MIN_SUBMIT_SECONDS) return;

    setStatus("sending");

    const payload: BookingRequest = {
      ...booking,
      startedAt: startedAt.current,
    };

    // Without a configured endpoint there is nowhere to send this. Falling
    // through to the error screen is deliberate: it puts Edward's phone number
    // in front of the customer instead of pretending the request went through.
    if (!endpoint) {
      setStatus("error");
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("success");
      clearDraft();
    } catch {
      setStatus("error");
    }
  }

  /* ---------------- screens ---------------- */

  if (status === "success") {
    return (
      <section className="outcome">
        <span className="outcome-icon outcome-icon-ok" aria-hidden="true">
          <CheckIcon size={34} />
        </span>
        <h1 className="display outcome-title">Your request is with Edward.</h1>
        <p className="outcome-body">
          He'll read it between visits and text you a confirmation{" "}
          <strong>within a few hours</strong>. A copy is on its way to your inbox — nothing is
          booked until he replies.
        </p>
        <div className="outcome-summary">
          <p className="outcome-label">What you asked for</p>
          <p className="outcome-line">{summarize(booking, catalog)}</p>
          <p className="outcome-note">
            Estimated ${est.total} — Edward confirms the final price.
          </p>
        </div>
        <p className="outcome-foot">Something urgent, or changed your mind?</p>
        <div className="btn-row outcome-actions">
          <a href={phoneHref} className="btn btn-ghost">Text {phone}</a>
          <a href="/" className="btn-quiet">Back to the site</a>
        </div>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="outcome">
        <span className="outcome-icon outcome-icon-warn" aria-hidden="true">
          <AlertIcon size={32} />
        </span>
        <h1 className="display outcome-title">That didn't send.</h1>
        <p className="outcome-body">
          Something on our end failed — your details are still saved, so nothing is lost. The
          fastest fix is to text Edward directly; he'd rather hear from you than have you wait.
        </p>
        <div className="outcome-contact">
          <p className="outcome-label outcome-label-light">Text or call</p>
          <a href={phoneHref} className="outcome-phone">{phone}</a>
          <p className="outcome-email">Or email {email}</p>
        </div>
        <div className="btn-row outcome-actions">
          <button type="button" className="btn btn-primary" onClick={() => setStatus("form")}>
            Back to my request
          </button>
          <a href="/" className="btn-quiet">Back to the site</a>
        </div>
      </section>
    );
  }

  /* ---------------- the form ---------------- */

  const steps = ["Service", "Schedule", "Pets", "You"];

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div ref={liveRegion} aria-live="polite" className="sr-only">
        Estimated total ${est.total}
      </div>

      <nav className="progress" aria-label="Form steps">
        {steps.map((label, i) => {
          const n = i + 1;
          return (
            <button
              key={label}
              type="button"
              className="progress-step"
              aria-current={step === n ? "step" : undefined}
              onClick={() => goToStep(n)}
            >
              <span className={`progress-bar${step >= n ? " is-done" : ""}`} />
              <span className={`progress-label${step === n ? " is-current" : ""}`}>
                {n} · {label}
              </span>
            </button>
          );
        })}
      </nav>

      {restored && (
        <p className="restored">
          Picked up where you left off.{" "}
          <button type="button" onClick={clearDraft} className="restored-clear">
            Start over
          </button>
        </p>
      )}

      <div className="form-layout">
        <div className="form-steps">
          {/* ---------------- Step 1 ---------------- */}
          {step === 1 && (
            <section className="step">
              <h2 className="heading-brand step-title">What do you need?</h2>
              <p className="step-sub">Pick one service — you can mention extras in the notes at the end.</p>

              <fieldset className="fieldset">
                <legend className="sr-only">Service</legend>
                <div className="tile-grid">
                  {catalog.services.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="choice tile"
                      aria-pressed={booking.selection.serviceId === s.id}
                      onClick={() => pickService(s.id)}
                    >
                      <span className="tile-top">
                        <ServiceIcon name={s.icon} />
                        <span className="tile-from">{s.fromLabel}</span>
                      </span>
                      <span className="heading-brand tile-name">{s.name}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {service.tiers.length > 0 && (
                <fieldset className="fieldset">
                  <legend className="group-label">How long?</legend>
                  <div className="pill-row">
                    {service.tiers.map((tier) => (
                      <button
                        key={tier.minutes}
                        type="button"
                        className="choice choice-pill pill-lg"
                        aria-pressed={booking.selection.durationMinutes === tier.minutes}
                        onClick={() => setSelection({ durationMinutes: tier.minutes })}
                      >
                        {tier.minutes} min · ${tier.price}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <fieldset className="fieldset">
                <legend className="group-label">Add-ons</legend>
                <div className="addon-list">
                  {medication && (
                    <button
                      type="button"
                      className="choice addon"
                      aria-pressed={booking.selection.addonIds.includes("medication")}
                      onClick={() => toggleAddon("medication")}
                    >
                      <span className="checkbox-box">
                        {booking.selection.addonIds.includes("medication") && <CheckIcon size={16} />}
                      </span>
                      <span className="addon-copy">
                        <span className="addon-name">{medication.name}</span>
                        <span className="addon-note">Pills, drops, topicals. {medication.note}</span>
                      </span>
                      <span className="addon-price">
                        {isOvernight ? "Free" : `+$${medication.price}`}
                      </span>
                    </button>
                  )}

                  {nailAddon && service.id !== "nail-trim" && (
                    <button
                      type="button"
                      className="choice addon"
                      aria-pressed={booking.selection.addonIds.includes("nail-trim-addon")}
                      onClick={() => toggleAddon("nail-trim-addon")}
                    >
                      <span className="checkbox-box">
                        {booking.selection.addonIds.includes("nail-trim-addon") && <CheckIcon size={16} />}
                      </span>
                      <span className="addon-copy">
                        <span className="addon-name">Nail trim</span>
                        <span className="addon-note">Added to this visit, one paw at a time.</span>
                      </span>
                      <span className="addon-price">+${nailAddon.price}</span>
                    </button>
                  )}
                </div>
              </fieldset>

              <div className="two-up">
                <div>
                  <label className="field-label" htmlFor="extraDogs">
                    Additional dogs (+${catalog.fees.find((f) => f.id === "additional-dog")?.amount ?? 7} each)
                  </label>
                  <input
                    id="extraDogs"
                    className="field"
                    type="number"
                    min={0}
                    max={6}
                    inputMode="numeric"
                    value={booking.selection.extraDogs}
                    onChange={(e) => setSelection({ extraDogs: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="extraCats">
                    Additional cats (+${catalog.fees.find((f) => f.id === "additional-cat")?.amount ?? 5} each)
                  </label>
                  <input
                    id="extraCats"
                    className="field"
                    type="number"
                    min={0}
                    max={6}
                    inputMode="numeric"
                    value={booking.selection.extraCats}
                    onChange={(e) => setSelection({ extraCats: Number(e.target.value) })}
                  />
                </div>
              </div>

              <StepNav onNext={() => goToStep(2)} nextLabel="Next · Schedule" />
            </section>
          )}

          {/* ---------------- Step 2 ---------------- */}
          {step === 2 && (
            <section className="step">
              <h2 className="heading-brand step-title">When?</h2>
              <p className="step-sub">
                Pick a date — or a range for a trip — then the window that suits your pet. Edward
                doesn't promise an exact minute, and won't pretend to.
              </p>

              <Calendar
                dateStart={booking.schedule.dateStart}
                dateEnd={booking.schedule.dateEnd}
                onChange={(dateStart, dateEnd) => setSchedule({ dateStart, dateEnd })}
              />

              {lastMinute && (
                <p className="notice notice-brown">
                  <ClockIcon size={18} />
                  <span>
                    That's less than 24 hours away — a{" "}
                    <strong>
                      +${catalog.fees.find((f) => f.id === "last-minute")?.amount ?? 8} last-minute fee
                    </strong>{" "}
                    is in your estimate. Text Edward and he'll tell you straight away whether he
                    can make it.
                  </span>
                </p>
              )}

              <fieldset className="fieldset">
                <legend className="group-label">Time window</legend>
                <div className="tile-grid">
                  {TIME_WINDOWS.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      className="choice tile tile-window"
                      aria-pressed={booking.schedule.window === w.id}
                      onClick={() => setSchedule({ window: w.id })}
                    >
                      <span className="heading-brand tile-name">{w.name}</span>
                      <span className="tile-hours">{w.hours}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="fieldset">
                <label className="field-label" htmlFor="flex">
                  Flexibility notes <span className="optional">(optional)</span>
                </label>
                <textarea
                  id="flex"
                  className="field"
                  rows={3}
                  placeholder="e.g. Tuesdays and Thursdays every week, ideally before noon"
                  value={booking.schedule.flexibilityNotes}
                  onChange={(e) => setSchedule({ flexibilityNotes: e.target.value })}
                />
              </div>

              <StepNav onBack={() => goToStep(1)} onNext={() => goToStep(3)} nextLabel="Next · Your pet" />
            </section>
          )}

          {/* ---------------- Step 3 ---------------- */}
          {step === 3 && (
            <section className="step">
              <h2 className="heading-brand step-title">Your pet</h2>
              <p className="step-sub">The more you tell Edward, the less your pet has to explain.</p>

              <div className="two-up">
                <div>
                  <label className="field-label" htmlFor="petName">Name</label>
                  <input
                    id="petName"
                    className="field"
                    value={booking.pet.name}
                    placeholder="Jackie"
                    onChange={(e) => setPet({ name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="species">Species</label>
                  <select
                    id="species"
                    className="field"
                    value={booking.pet.species}
                    onChange={(e) => setPet({ species: e.target.value as Species })}
                  >
                    <option>Dog</option>
                    <option>Cat</option>
                    <option>Both</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="breed">Breed</label>
                  <input
                    id="breed"
                    className="field"
                    value={booking.pet.breed}
                    placeholder="Labrador mix"
                    onChange={(e) => setPet({ breed: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="age">Age</label>
                  <input
                    id="age"
                    className="field"
                    value={booking.pet.age}
                    placeholder="7"
                    onChange={(e) => setPet({ age: e.target.value })}
                  />
                </div>
              </div>

              <fieldset className="fieldset">
                <legend className="group-label">Temperament</legend>
                <div className="pill-row">
                  {TEMPERAMENTS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="choice choice-pill"
                      aria-pressed={booking.pet.temperament === t}
                      onClick={() => setPet({ temperament: t })}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="fieldset">
                <legend className="group-label">
                  Up to date on vaccinations and flea/tick medication?
                </legend>
                <div className="pill-row">
                  <button
                    type="button"
                    className="choice choice-pill"
                    aria-pressed={booking.pet.upToDateOnPreventatives === true}
                    onClick={() => setPet({ upToDateOnPreventatives: true })}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className="choice choice-pill"
                    aria-pressed={booking.pet.upToDateOnPreventatives === false}
                    onClick={() => setPet({ upToDateOnPreventatives: false })}
                  >
                    No
                  </button>
                </div>
              </fieldset>

              <div className="fieldset">
                <label className="field-label" htmlFor="medical">
                  Medical needs, medication, anything Edward should watch for
                </label>
                <textarea
                  id="medical"
                  className="field"
                  rows={4}
                  placeholder="Arthritis in the back legs — short walks are better. Half a pill with breakfast."
                  value={booking.pet.medical}
                  onChange={(e) => setPet({ medical: e.target.value })}
                />
              </div>

              <StepNav onBack={() => goToStep(2)} onNext={() => goToStep(4)} nextLabel="Next · Your details" />
            </section>
          )}

          {/* ---------------- Step 4 ---------------- */}
          {step === 4 && (
            <section className="step">
              <h2 className="heading-brand step-title">You</h2>
              <p className="step-sub">
                Your address and entry details are emailed to Edward and nowhere else — this site
                has no account and no database. A draft is kept in this browser so you don't lose
                your place.
              </p>

              <div className="two-up">
                <div>
                  <label className="field-label" htmlFor="yourName">Your name</label>
                  <input
                    id="yourName"
                    className="field"
                    autoComplete="name"
                    required
                    value={booking.customer.name}
                    onChange={(e) => setCustomer({ name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="phone">Mobile</label>
                  <input
                    id="phone"
                    className="field"
                    type="tel"
                    autoComplete="tel"
                    required
                    placeholder="215-555-0134"
                    value={booking.customer.phone}
                    onChange={(e) => setCustomer({ phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="email">Email</label>
                  <input
                    id="email"
                    className="field"
                    type="email"
                    autoComplete="email"
                    required
                    value={booking.customer.email}
                    onChange={(e) => setCustomer({ email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="zip">Zip code</label>
                  <input
                    id="zip"
                    className="field"
                    inputMode="numeric"
                    maxLength={5}
                    autoComplete="postal-code"
                    placeholder="19146"
                    value={booking.customer.zip}
                    onChange={(e) =>
                      setCustomer({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) })
                    }
                  />
                </div>
              </div>

              {/* Out of area warns, never blocks. */}
              {zipComplete && !zipInArea && (
                <p className="notice notice-green">
                  <PinIcon size={18} />
                  <span>
                    That's outside the usual eleven zip codes — <strong>Edward may still be
                    able to help,</strong> and travel fees may apply. Send it through and he'll
                    take a look.
                  </span>
                </p>
              )}
              {zipInArea && (
                <p className="zip-ok">
                  <CheckIcon size={18} />
                  That's in the regular service area.
                </p>
              )}

              <div className="fieldset">
                <label className="field-label" htmlFor="address">Street address</label>
                <input
                  id="address"
                  className="field"
                  autoComplete="street-address"
                  value={booking.customer.address}
                  onChange={(e) => setCustomer({ address: e.target.value })}
                />
              </div>

              <fieldset className="fieldset">
                <legend className="group-label">How will Edward get in?</legend>
                <div className="pill-row">
                  {ENTRY_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className="choice choice-pill"
                      aria-pressed={booking.customer.entryMethod === m}
                      onClick={() => setCustomer({ entryMethod: m })}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {/* The form captures the category only - never the secret. */}
                <p className="hint">
                  Never send codes or key details through this form — that's sorted at the
                  meet-and-greet.
                </p>
              </fieldset>

              <div className="two-up">
                <div>
                  <label className="field-label" htmlFor="emergency">Emergency contact</label>
                  <input
                    id="emergency"
                    className="field"
                    placeholder="Name & number"
                    value={booking.customer.emergencyContact}
                    onChange={(e) => setCustomer({ emergencyContact: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="vet">Your vet</label>
                  <input
                    id="vet"
                    className="field"
                    placeholder="Practice & number"
                    value={booking.customer.vet}
                    onChange={(e) => setCustomer({ vet: e.target.value })}
                  />
                </div>
              </div>

              <label className="consent">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={booking.consent}
                  onChange={(e) => update({ consent: e.target.checked })}
                />
                <span className="checkbox-box" aria-hidden="true">
                  {booking.consent && <CheckIcon size={16} />}
                </span>
                <span>
                  I've read the <a href="/contact#cancellation">cancellation policy</a> and
                  understand this is a request, not a confirmed booking.
                </span>
              </label>

              <label className="consent">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={booking.photoConsent}
                  onChange={(e) => update({ photoConsent: e.target.checked })}
                />
                <span className="checkbox-box" aria-hidden="true">
                  {booking.photoConsent && <CheckIcon size={16} />}
                </span>
                <span>
                  Edward may post photos from the visit to Edventures' social media.
                </span>
              </label>

              {/* Honeypot: off-screen, not `display:none`, which some bots skip. */}
              <div className="honeypot" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary submit"
                disabled={!booking.consent || status === "sending"}
              >
                {status === "sending" ? "Sending…" : "Send request to Edward"}
              </button>
              {!booking.consent && (
                <p className="hint hint-centre">Tick the box above to send your request.</p>
              )}
              <p className="hint hint-centre">
                Prefer to talk? <a href={phoneHref}>Call or text {phone}</a>
              </p>

              <StepNav onBack={() => goToStep(3)} />
            </section>
          )}
        </div>

        {/* ---------------- Estimate ---------------- */}
        <aside className="estimate" aria-label="Price estimate">
          <p className="estimate-label">Your estimate</p>
          <p className="estimate-total">${est.total}</p>
          <p className="estimate-basis">
            {est.units > 1
              ? `$${est.perUnit} × ${est.units} ${isOvernight ? "nights" : "visits"}`
              : booking.schedule.window
                ? `${TIME_WINDOWS.find((w) => w.id === booking.schedule.window)!.name}, ${formatDate(booking.schedule.dateStart)}`
                : "One visit · pick a date and window"}
          </p>

          <div className="estimate-rule" />
          <dl className="estimate-lines">
            {est.lines.map((line, i) => (
              <div className="estimate-line" key={i}>
                <dt>{line.label}</dt>
                <dd>{line.amount}</dd>
              </div>
            ))}
          </dl>
          <div className="estimate-rule" />

          <p className="estimate-fine">
            <strong>This is an estimate, not a quote.</strong> Overnight stays start at $
            {catalog.services.find((s) => s.id === "overnight")?.base ?? 55}, so Edward confirms
            the final figure when he replies.
          </p>
          <a href={phoneHref} className="estimate-ask">Ask a question instead</a>
        </aside>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Calendar
 * ------------------------------------------------------------------ */

function Calendar({
  dateStart,
  dateEnd,
  onChange,
}: {
  dateStart: string;
  dateEnd: string;
  onChange: (start: string, end: string) => void;
}) {
  const today = toIso(new Date());
  const [cursor, setCursor] = useState(() => {
    const d = parseLocalDate(dateStart) ?? new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  /** When set, the next tap closes a range instead of starting a new one. */
  const [extending, setExtending] = useState(false);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const gridStart = new Date(cursor.year, cursor.month, 1 - first.getDay());
    const lo = dateStart;
    const hi = dateEnd || dateStart;

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const iso = toIso(d);
      return {
        iso,
        label: d.getDate(),
        outside: d.getMonth() !== cursor.month,
        past: iso < today,
        isToday: iso === today,
        inRange: Boolean(lo) && iso >= lo && iso <= hi,
        isStart: Boolean(lo) && iso === lo,
        isEnd: Boolean(lo) && iso === hi,
        column: i % 7,
      };
    });
  }, [cursor, dateStart, dateEnd, today]);

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const shiftMonth = (delta: number) => {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  const pick = (iso: string) => {
    if (extending && dateStart) {
      const [lo, hi] = iso < dateStart ? [iso, dateStart] : [dateStart, iso];
      onChange(lo, lo === hi ? "" : hi);
      setExtending(false);
    } else {
      onChange(iso, "");
    }
  };

  const rangeLabel = !dateStart
    ? "No date chosen yet"
    : dateEnd
      ? `${formatShort(dateStart)} – ${formatShort(dateEnd)} · ${dayCountLabel(dateStart, dateEnd)}`
      : formatDate(dateStart);

  return (
    <div className="calendar">
      <div className="cal-head">
        <button type="button" className="cal-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <ChevronIcon dir="left" />
        </button>
        <span className="cal-title" aria-live="polite">{monthLabel}</span>
        <button type="button" className="cal-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
          <ChevronIcon dir="right" />
        </button>
      </div>

      <div className="cal-dow" aria-hidden="true">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="cal-grid" role="group" aria-label="Choose a date">
        {cells.map((cell) => (
          <button
            key={cell.iso}
            type="button"
            disabled={cell.past}
            aria-pressed={cell.inRange}
            aria-label={formatDate(cell.iso)}
            className={[
              "cal-day",
              cell.outside && "is-outside",
              cell.isToday && "is-today",
              cell.inRange && "is-in-range",
              (cell.isStart || cell.isEnd) && "is-edge",
              cell.column === 0 && "is-row-start",
              cell.column === 6 && "is-row-end",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => pick(cell.iso)}
          >
            {cell.label}
          </button>
        ))}
      </div>

      <div className="cal-foot">
        <span className="cal-range">{rangeLabel}</span>
        {dateStart && !dateEnd && !extending && (
          <button type="button" className="cal-chip" onClick={() => setExtending(true)}>
            Make it a trip
          </button>
        )}
        {extending && <span className="cal-chip cal-chip-active">Tap the last day</span>}
        {dateStart && (
          <button
            type="button"
            className="cal-chip cal-chip-quiet"
            onClick={() => {
              onChange("", "");
              setExtending(false);
            }}
          >
            Clear
          </button>
        )}
      </div>
      <p className="hint">
        {extending
          ? "Now tap the last day of the trip."
          : dateStart && !dateEnd
            ? "One day chosen. Tap “Make it a trip” to add more."
            : "Tap a day to choose it."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Bits
 * ------------------------------------------------------------------ */

function StepNav({
  onBack,
  onNext,
  nextLabel,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
}) {
  return (
    <div className={`step-nav${onBack && onNext ? "" : onBack ? " is-back-only" : " is-next-only"}`}>
      {onBack && (
        <button type="button" className="btn btn-ghost step-back" onClick={onBack}>
          Back
        </button>
      )}
      {onNext && (
        <button type="button" className="btn btn-primary step-next" onClick={onNext}>
          {nextLabel} <ArrowIcon />
        </button>
      )}
    </div>
  );
}

function formatDate(iso: string) {
  const d = parseLocalDate(iso);
  return d
    ? d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "a date to be confirmed";
}

function formatShort(iso: string) {
  const d = parseLocalDate(iso);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
}

function dayCountLabel(start: string, end: string) {
  const a = parseLocalDate(start);
  const b = parseLocalDate(end);
  if (!a || !b) return "";
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
  return `${days} days`;
}

/* Inline icons - the island is the only scripted component, and pulling an
   icon library into the bundle for six glyphs is not worth the bytes. */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const CheckIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const AlertIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const ClockIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const PinIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const ArrowIcon = () => (
  <svg width={17} height={17} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const ChevronIcon = ({ dir }: { dir: "left" | "right" }) => (
  <svg width={19} height={19} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
    <path d={dir === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
  </svg>
);

/** Service glyphs, keyed to the icon names in services.json. */
const SERVICE_PATHS: Record<string, string> = {
  dog: "M11.25 16.25h1.5L12 17zM16 14v.5M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306M8 14v.5M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.96-1.45-2.344-2.5",
  cat: "M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 18.29 16.97 21 12 21s-9-2.71-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Zm-3 8h.01M15 13h.01M11.75 16c.35.5.85.5 1.25.5s.9 0 1.25-.5",
  scissors: "M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  house: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  pill: "m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7ZM8.5 8.5l7 7",
};

function ServiceIcon({ name }: { name: string }) {
  const d = SERVICE_PATHS[name];
  if (!d) return null;
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      {d.split("M").filter(Boolean).map((seg, i) => (
        <path key={i} d={`M${seg}`} />
      ))}
    </svg>
  );
}
