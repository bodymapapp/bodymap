// src/components/demos/BookingDemo.jsx
//
// BookingDemo — interactive mockup of a therapist's custom booking page,
// the kind clients see at mybodymap.app/sarah-mitchell. Built to FEEL like
// the actual product, not a stock screenshot. Three steps: pick a service,
// pick a time, see confirmation.

import React, { useState } from "react";

const C = {
  forest: "#2A5741", sage: "#6B9E80", beige: "#F5F0E8",
  gold: "#C9A84C", white: "#FFFFFF", dark: "#0D1F17",
  gray: "#6B7280", lightGray: "#F3F4F6", border: "#E5E7EB",
};

const SERVICES = [
  { id: "deep", name: "Deep Tissue", duration: 60, price: 95 },
  { id: "swedish", name: "Swedish Relaxation", duration: 60, price: 85 },
  { id: "sport", name: "Sports Recovery", duration: 90, price: 130 },
  { id: "prenatal", name: "Prenatal", duration: 60, price: 95 },
];

const TIMES = [
  { time: "9:00 AM", available: true },
  { time: "10:30 AM", available: true },
  { time: "12:00 PM", available: false },
  { time: "2:00 PM", available: true },
  { time: "3:30 PM", available: true },
  { time: "5:00 PM", available: true },
];

function BookingDemo() {
  const [step, setStep] = useState(1); // 1 = pick service, 2 = pick time, 3 = confirmed
  const [service, setService] = useState(null);
  const [time, setTime] = useState(null);

  const reset = () => { setStep(1); setService(null); setTime(null); };

  return (
    <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: `1px solid ${C.border}`, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      {/* Browser-bar mockup with the URL */}
      <div style={{ background: C.lightGray, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: "#FF5F57" }} />
        <span style={{ width: 8, height: 8, borderRadius: 4, background: "#FEBC2E" }} />
        <span style={{ width: 8, height: 8, borderRadius: 4, background: "#28C840" }} />
        <span style={{ flex: 1, fontSize: 11, color: C.gray, marginLeft: 8 }}>mybodymap.app/sarah-mitchell</span>
      </div>

      {/* Booking page header */}
      <div style={{ background: `linear-gradient(135deg, ${C.forest}, #1E3F2E)`, padding: "20px 18px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.gold, color: C.dark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, fontFamily: "Georgia,serif" }}>SM</div>
          <div>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 600, lineHeight: 1.1 }}>Sarah Mitchell, LMT</div>
            <div style={{ fontSize: 12, opacity: 0.82, marginTop: 2 }}>Sugar Land, TX · Licensed since 2014</div>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ display: "flex", padding: "10px 18px", borderBottom: `1px solid ${C.border}`, background: "#FAFAF8" }}>
        {[1, 2, 3].map((n) => (
          <div key={n} style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, opacity: step >= n ? 1 : 0.4 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: step >= n ? C.forest : "#D6D3CB", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
              {step > n ? "✓" : n}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: step >= n ? C.forest : C.gray }}>
              {["Service", "Time", "Confirm"][n - 1]}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Pick service */}
      {step === 1 && (
        <div style={{ padding: "16px 16px 18px" }}>
          <div style={{ fontSize: 13, color: C.gray, marginBottom: 12 }}>Choose your session</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SERVICES.map((s) => (
              <button
                key={s.id}
                onClick={() => { setService(s); setStep(2); }}
                style={{
                  background: "#fff",
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.background = "#F9F5EE"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "#fff"; }}
              >
                <div>
                  <div style={{ fontFamily: "Georgia,serif", fontWeight: 600, fontSize: 14, color: C.dark }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{s.duration} minutes</div>
                </div>
                <div style={{ fontFamily: "Georgia,serif", fontWeight: 600, fontSize: 16, color: C.forest }}>${s.price}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Pick time */}
      {step === 2 && service && (
        <div style={{ padding: "16px 16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: C.gray }}>Tomorrow, Apr 26</div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 14, fontWeight: 600, color: C.dark }}>{service.name} · {service.duration} min</div>
            </div>
            <button onClick={() => { setStep(1); setService(null); }} style={{ background: "transparent", border: "none", color: C.gray, fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>change</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {TIMES.map((t) => (
              <button
                key={t.time}
                disabled={!t.available}
                onClick={() => { setTime(t.time); setStep(3); }}
                style={{
                  background: t.available ? "#fff" : C.lightGray,
                  border: `1.5px solid ${t.available ? C.border : C.lightGray}`,
                  borderRadius: 8,
                  padding: "10px 8px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.available ? C.dark : "#BDB7AC",
                  cursor: t.available ? "pointer" : "not-allowed",
                  textDecoration: t.available ? "none" : "line-through",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (t.available) { e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.background = "#F9F5EE"; } }}
                onMouseLeave={(e) => { if (t.available) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "#fff"; } }}
              >
                {t.time}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Confirmed */}
      {step === 3 && service && time && (
        <div style={{ padding: "20px 18px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#DCFCE7", color: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 12px" }}>✓</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 600, color: C.dark, marginBottom: 6 }}>You're booked.</div>
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.5, marginBottom: 14 }}>
            {service.name} with Sarah Mitchell<br />
            Tomorrow at <strong style={{ color: C.dark }}>{time}</strong>
          </div>
          <div style={{ background: "#F9F5EE", border: `1px solid ${C.gold}40`, borderRadius: 10, padding: "10px 12px", fontSize: 12, color: C.dark, marginBottom: 14, textAlign: "left" }}>
            <div style={{ fontFamily: "Georgia,serif", fontStyle: "italic", color: C.forest, marginBottom: 4 }}>What happens next</div>
            <div style={{ color: C.gray, lineHeight: 1.5 }}>
              · Body map intake sent to your phone<br />
              · Reminder 24 hours before<br />
              · See you tomorrow.
            </div>
          </div>
          <button onClick={reset} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.gray, fontSize: 12, padding: "6px 14px", borderRadius: 999, cursor: "pointer" }}>Book another</button>
        </div>
      )}
    </div>
  );
}

export default BookingDemo;
