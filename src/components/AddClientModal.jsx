// src/components/AddClientModal.jsx
//
// Three-step modal for therapists to add a client manually, especially elderly
// clients who will not use the booking app themselves.
//
// Step 1: Their info (name required, phone/email/age/notes optional)
// Step 2: First session (optional date/time/service)
// Step 3: What hurts (optional intake -- focus areas + pressure + goal)
//
// Each step is skippable except step 1. Therapist can save after step 1 and
// come back later, or fill all three at once. This solves Terra Irving's
// request to put elderly client info in without the public booking flow.

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import CloseButton from "./CloseButton";

const C = {
  cream: "#FAF4E8",
  creamSoft: "#FAF7EE",
  forest: "#2A5741",
  forestInk: "#1F3A2C",
  sage: "#6B9E80",
  sageMute: "#98A395",
  gold: "#C9A84C",
  gray: "#6B7280",
  darkGray: "#1F2937",
  light: "#E8E4DC",
  border: "rgba(31,58,44,0.08)",
  ink: "#1F3A2C",
  inkSoft: "#6B7C68",
};

// Body part presets that match the public intake's BodyMap component.
// Therapist taps these on the client's behalf during step 3.
const BODY_PARTS = [
  { id: "neck", label: "Neck", front: true, back: true },
  { id: "shoulders", label: "Shoulders", front: true, back: true },
  { id: "upperBack", label: "Upper back", front: false, back: true },
  { id: "midBack", label: "Mid back", front: false, back: true },
  { id: "lowerBack", label: "Lower back", front: false, back: true },
  { id: "hips", label: "Hips", front: true, back: true },
  { id: "glutes", label: "Glutes", front: false, back: true },
  { id: "hamstrings", label: "Hamstrings", front: false, back: true },
  { id: "calves", label: "Calves", front: false, back: true },
  { id: "feet", label: "Feet", front: true, back: true },
  { id: "chest", label: "Chest", front: true, back: false },
  { id: "abdomen", label: "Abdomen", front: true, back: false },
  { id: "arms", label: "Arms", front: true, back: true },
  { id: "hands", label: "Hands", front: true, back: false },
  { id: "thighsFront", label: "Thigh fronts", front: true, back: false },
  { id: "head", label: "Head / scalp", front: true, back: false },
];

const PRESSURE_LABELS = ["Very light", "Light", "Medium", "Firm", "Deep"];
const GOAL_OPTIONS = [
  { value: "relax", label: "Relaxation" },
  { value: "pain_relief", label: "Pain relief" },
  { value: "recovery", label: "Recovery" },
  { value: "performance", label: "Performance / sports" },
  { value: "prenatal", label: "Prenatal comfort" },
];

export default function AddClientModal({ therapist, onClose, onSaved }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 1 state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [notes, setNotes] = useState("");

  // Inline field-level validation. Touched flag prevents the error from
  // showing while the user is still typing the first time. Validation runs
  // on blur and on submit attempt.
  const [touched, setTouched] = useState({ phone: false, email: false, age: false });

  // Phone valid if blank (optional) OR exactly 10 digits (US format).
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneError = phone && phoneDigits.length !== 10
    ? `Phone needs to be 10 digits, got ${phoneDigits.length}.`
    : "";

  // Email valid if blank OR matches basic pattern. Conservative regex that
  // catches obvious typos without rejecting unusual but valid addresses.
  const emailError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
    ? "Please enter a valid email like name@example.com."
    : "";

  // Age valid if blank OR a whole number 1-120.
  const ageError = (() => {
    if (!age) return "";
    const n = Number(age);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return "Age must be a whole number.";
    if (n < 1 || n > 120) return "Age must be between 1 and 120.";
    return "";
  })();

  const hasFieldErrors = !!(phoneError || emailError || ageError);

  // Format phone visually as (XXX) XXX-XXXX while user types. Stripping
  // non-digits internally, only formatting on display.
  const formattedPhone = (() => {
    const d = phoneDigits.slice(0, 10);
    if (d.length === 0) return phone;
    if (d.length <= 3) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  })();

  // Step 2 state
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");

  // Step 3 state
  const [frontFocus, setFrontFocus] = useState([]);
  const [backFocus, setBackFocus] = useState([]);
  const [pressure, setPressure] = useState(3);
  const [goal, setGoal] = useState("relax");
  const [intakeNotes, setIntakeNotes] = useState("");

  useEffect(() => {
    if (!therapist?.id) return;
    supabase
      .from("services")
      .select("id, name, duration, price")
      .eq("therapist_id", therapist.id)
      .eq("active", true)
      .order("price")
      .then(({ data }) => setServices(data || []));
  }, [therapist?.id]);

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  // Esc to cancel
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  const canProceedFromStep1 = name.trim().length >= 2 && !hasFieldErrors;

  const toggleBodyPart = (id, side) => {
    if (side === "front") {
      setFrontFocus((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
    } else {
      setBackFocus((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
    }
  };

  async function saveAll() {
    if (saving) return;
    if (!canProceedFromStep1) {
      setStep(1);
      setTouched({ phone: true, email: true, age: true });
      if (!name.trim() || name.trim().length < 2) {
        setError("Please enter the client's name (at least 2 characters).");
      } else {
        setError("Please fix the highlighted fields before saving.");
      }
      return;
    }
    setSaving(true);
    setError("");

    try {
      // STEP 1: Insert or find existing client
      const cleanPhone = phone.replace(/\D/g, "");
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim();

      // Look for existing match by phone OR email first
      let client = null;
      if (cleanPhone) {
        const { data } = await supabase.from("clients")
          .select("id, name, phone, email")
          .eq("therapist_id", therapist.id)
          .eq("phone", cleanPhone)
          .maybeSingle();
        if (data) client = data;
      }
      if (!client && cleanEmail) {
        const { data } = await supabase.from("clients")
          .select("id, name, phone, email")
          .eq("therapist_id", therapist.id)
          .eq("email", cleanEmail)
          .maybeSingle();
        if (data) client = data;
      }

      if (!client) {
        const payload = {
          therapist_id: therapist.id,
          name: cleanName,
          added_by: "therapist_manual",
        };
        if (cleanPhone) payload.phone = cleanPhone;
        if (cleanEmail) payload.email = cleanEmail;
        const allNotesParts = [];
        if (age) allNotesParts.push(`Age: ${age}`);
        if (notes) allNotesParts.push(notes);
        if (allNotesParts.length) payload.notes = allNotesParts.join("\n\n");

        const { data: created, error: insErr } = await supabase
          .from("clients")
          .insert(payload)
          .select("id")
          .single();
        if (insErr) {
          // Fall back without added_by if column doesn't exist yet
          if (insErr.message && insErr.message.includes("added_by")) {
            delete payload.added_by;
            const { data: retryCreated, error: retryErr } = await supabase
              .from("clients").insert(payload).select("id").single();
            if (retryErr) throw new Error("Could not save client: " + retryErr.message);
            client = retryCreated;
          } else {
            throw new Error("Could not save client: " + insErr.message);
          }
        } else {
          client = created;
        }
      }

      // STEP 2: Optional booking
      let bookingId = null;
      if (date && time && serviceId) {
        const svc = services.find((s) => s.id === serviceId);
        if (svc) {
          const startTime = `${date}T${time}:00`;
          const startDate = new Date(startTime);
          const endDate = new Date(startDate.getTime() + (svc.duration || 60) * 60000);
          const endTime = endDate.toTimeString().slice(0, 8);

          const { data: newBooking, error: bookErr } = await supabase
            .from("bookings")
            .insert({
              therapist_id: therapist.id,
              service_id: svc.id,
              client_name: cleanName,
              client_email: cleanEmail || null,
              client_phone: cleanPhone || null,
              booking_date: date,
              start_time: time + ":00",
              end_time: endTime,
              status: "confirmed",
              notes: bookingNotes || `Booked by therapist on behalf of client`,
              sms_opted_in: false,
              deposit_required: false,
              deposit_amount: 0,
              deposit_paid: false,
              addon_ids: [],
              addon_total_price: 0,
              addon_extra_minutes: 0,
            })
            .select("id")
            .single();
          if (bookErr) {
            console.warn("Booking failed:", bookErr.message);
          } else {
            bookingId = newBooking?.id || null;
          }
        }
      }

      // STEP 3: Optional intake (creates a session row with the intake data)
      const hasIntakeData = frontFocus.length > 0 || backFocus.length > 0 || intakeNotes.trim().length > 0;
      if (hasIntakeData) {
        await supabase.from("sessions").insert({
          therapist_id: therapist.id,
          client_id: client.id,
          booking_id: bookingId,
          front_focus: frontFocus,
          front_avoid: [],
          back_focus: backFocus,
          back_avoid: [],
          pressure: pressure,
          goal: goal,
          table_temp: "warm",
          room_temp: "comfortable",
          music: "soft",
          lighting: "dim",
          conversation: "quiet",
          draping: "standard",
          oil_pref: "none",
          med_flag: "none",
          med_note: null,
          client_notes: intakeNotes || null,
          completed: false,
          intake_added_by: "therapist_manual",
        });
      }

      onSaved && onSaved({ client, bookingId, hadBooking: !!bookingId, hadIntake: hasIntakeData });
      onClose();
    } catch (e) {
      setError(e.message || "Could not save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(31,58,44,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 16px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          maxWidth: 560,
          width: "100%",
          padding: 0,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.light}`, background: C.cream }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.sage }}>
                Step {step} of 3
              </div>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 22, fontStyle: "italic", color: C.forestInk, margin: "4px 0 0", fontWeight: 400 }}>
                {step === 1 && "Who are they?"}
                {step === 2 && "Their first session"}
                {step === 3 && "What hurts?"}
              </h3>
              <p style={{ fontSize: 12, color: C.gray, margin: "4px 0 0" }}>
                {step === 1 && "Just name is required. Everything else is optional."}
                {step === 2 && "Add their first appointment, or skip if no session is booked yet."}
                {step === 3 && "Tap their focus areas. Or skip and fill in later."}
              </p>
            </div>
            <CloseButton onClick={handleClose} label="Cancel" disabled={saving} />
          </div>

          {/* Step indicator dots */}
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                onClick={() => { if (canProceedFromStep1 || n === 1) setStep(n); }}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 99,
                  background: step >= n ? C.forest : C.light,
                  cursor: (canProceedFromStep1 || n === 1) ? "pointer" : "not-allowed",
                  transition: "background 0.2s",
                }}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", maxHeight: "60vh", overflowY: "auto" }}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Full name" required>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Margaret Wilson"
                  autoFocus
                  style={inputStyle}
                />
              </Field>
              <Field label="Phone number" error={touched.phone ? phoneError : ""}>
                <input
                  type="tel"
                  value={formattedPhone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
                  placeholder="(713) 555-0142"
                  inputMode="tel"
                  style={{ ...inputStyle, borderColor: (touched.phone && phoneError) ? "#DC2626" : C.light }}
                />
              </Field>
              <Field label="Email" error={touched.email ? emailError : ""}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                  placeholder="Optional"
                  style={{ ...inputStyle, borderColor: (touched.email && emailError) ? "#DC2626" : C.light }}
                />
              </Field>
              <Field label="Age" error={touched.age ? ageError : ""}>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => {
                    // Only allow digits in the input, no letters or symbols
                    const cleaned = e.target.value.replace(/[^\d]/g, "");
                    setAge(cleaned);
                  }}
                  onBlur={() => setTouched((p) => ({ ...p, age: true }))}
                  placeholder="Optional, helps with care decisions"
                  inputMode="numeric"
                  style={{ ...inputStyle, borderColor: (touched.age && ageError) ? "#DC2626" : C.light }}
                  min="1"
                  max="120"
                />
              </Field>
              <Field label="Notes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything you want to remember about them. Medical history, preferences, family context."
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {services.length === 0 ? (
                <div style={{ background: C.creamSoft, border: `1px solid ${C.light}`, borderRadius: 10, padding: "14px 16px", fontSize: 13, color: C.gray, lineHeight: 1.5 }}>
                  You have no services set up yet. Skip this step for now and add services in Settings, then come back to book this client.
                </div>
              ) : (
                <>
                  <Field label="Service">
                    <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} style={inputStyle}>
                      <option value="">Choose a service…</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {s.duration} min · ${s.price}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Date">
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        min={new Date().toISOString().slice(0, 10)}
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Time">
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        style={inputStyle}
                      />
                    </Field>
                  </div>

                  <Field label="Booking notes">
                    <textarea
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      placeholder="Optional. e.g. 'Picked up by daughter, prefers morning sessions'"
                      rows={2}
                      style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                    />
                  </Field>

                  <p style={{ fontSize: 11, color: C.gray, fontStyle: "italic", margin: "4px 0 0" }}>
                    Skip this step if no session is booked yet. You can book them anytime from your schedule.
                  </p>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 12, color: C.gray, lineHeight: 1.5, margin: 0 }}>
                Tap any areas that need attention. This becomes their first body map. Skip if you'd rather fill it in during the session.
              </p>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.sage, marginBottom: 8 }}>Front of body</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {BODY_PARTS.filter((p) => p.front).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => toggleBodyPart(p.id, "front")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 99,
                        border: `1.5px solid ${frontFocus.includes(p.id) ? C.forest : C.light}`,
                        background: frontFocus.includes(p.id) ? C.forest : "#fff",
                        color: frontFocus.includes(p.id) ? "#fff" : C.darkGray,
                        fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.sage, marginBottom: 8 }}>Back of body</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {BODY_PARTS.filter((p) => p.back).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => toggleBodyPart(p.id, "back")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 99,
                        border: `1.5px solid ${backFocus.includes(p.id) ? C.forest : C.light}`,
                        background: backFocus.includes(p.id) ? C.forest : "#fff",
                        color: backFocus.includes(p.id) ? "#fff" : C.darkGray,
                        fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <Field label="Pressure preference">
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setPressure(n)}
                      style={{
                        flex: 1, padding: "8px 4px",
                        borderRadius: 8,
                        border: `1.5px solid ${pressure === n ? C.forest : C.light}`,
                        background: pressure === n ? C.forest : "#fff",
                        color: pressure === n ? "#fff" : C.darkGray,
                        fontSize: 11, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      {PRESSURE_LABELS[n - 1]}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Goal for this session">
                <select value={goal} onChange={(e) => setGoal(e.target.value)} style={inputStyle}>
                  {GOAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Anything else">
                <textarea
                  value={intakeNotes}
                  onChange={(e) => setIntakeNotes(e.target.value)}
                  placeholder="Optional. Sensitivities, prior injuries, emotional context, anything you want to remember."
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                />
              </Field>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#991B1B" }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.light}`, background: C.creamSoft, display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
          <button
            onClick={() => step > 1 ? setStep(step - 1) : handleClose()}
            disabled={saving}
            style={{
              padding: "9px 16px", background: "transparent",
              color: C.gray, border: `1.5px solid ${C.light}`,
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: saving ? "default" : "pointer",
            }}
          >
            {step === 1 ? "Cancel" : "← Back"}
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            {step < 3 && canProceedFromStep1 && step >= 1 && (
              <button
                onClick={saveAll}
                disabled={saving}
                style={{
                  padding: "9px 16px", background: "transparent",
                  color: C.forest, border: `1.5px solid ${C.forest}`,
                  borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: saving ? "default" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Save & finish"}
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => {
                  if (step === 1) {
                    if (!name.trim() || name.trim().length < 2) {
                      setError("Please enter the client's name (at least 2 characters).");
                      return;
                    }
                    if (hasFieldErrors) {
                      setTouched({ phone: true, email: true, age: true });
                      setError("Please fix the highlighted fields before continuing.");
                      return;
                    }
                  }
                  setError("");
                  setStep(step + 1);
                }}
                disabled={saving || (step === 1 && !canProceedFromStep1)}
                style={{
                  padding: "9px 20px",
                  background: (step === 1 && !canProceedFromStep1) ? C.light : C.forest,
                  color: "#fff", border: "none", borderRadius: 8,
                  fontSize: 13, fontWeight: 700,
                  cursor: (saving || (step === 1 && !canProceedFromStep1)) ? "default" : "pointer",
                }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={saveAll}
                disabled={saving}
                style={{
                  padding: "9px 20px", background: C.forest,
                  color: "#fff", border: "none", borderRadius: 8,
                  fontSize: 13, fontWeight: 700,
                  cursor: saving ? "default" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Save client"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.sage, marginBottom: 6 }}>
        {label}{required && <span style={{ color: "#DC2626", marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {error && (
        <p style={{ fontSize: 11, color: "#DC2626", margin: "4px 2px 0", lineHeight: 1.4 }}>
          {error}
        </p>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: `1.5px solid ${C.light}`,
  borderRadius: 8,
  fontSize: 14,
  color: C.darkGray,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};
