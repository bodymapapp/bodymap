// src/components/InteractiveDemo.js
import React, { useState } from "react";

const C = { forest: "#2A5741", sage: "#6B9E80", beige: "#F5F0E8", bg: "#F0EAD9", gold: "#C9A84C", gray: "#6B7280", darkGray: "#1A1A2E", white: "#FFFFFF", lightGray: "#E8E4DC" };

// --- Client Demo ---
const BODY_AREAS = [
  { id: "head",    label: "Head",        cx: 160, cy: 52,  r: 22 },
  { id: "neck",    label: "Neck",        cx: 160, cy: 84,  r: 12 },
  { id: "lshldr", label: "L Shoulder",  cx: 122, cy: 100, r: 14 },
  { id: "rshldr", label: "R Shoulder",  cx: 198, cy: 100, r: 14 },
  { id: "chest",  label: "Chest",       cx: 160, cy: 122, r: 20 },
  { id: "larm",   label: "L Arm",       cx: 102, cy: 138, r: 12 },
  { id: "rarm",   label: "R Arm",       cx: 218, cy: 138, r: 12 },
  { id: "abdomen",label: "Abdomen",     cx: 160, cy: 158, r: 18 },
  { id: "lhip",   label: "L Hip",       cx: 134, cy: 186, r: 14 },
  { id: "rhip",   label: "R Hip",       cx: 186, cy: 186, r: 14 },
  { id: "lthigh", label: "L Thigh",     cx: 134, cy: 218, r: 14 },
  { id: "rthigh", label: "R Thigh",     cx: 186, cy: 218, r: 14 },
  { id: "lknee",  label: "L Knee",      cx: 134, cy: 248, r: 11 },
  { id: "rknee",  label: "R Knee",      cx: 186, cy: 248, r: 11 },
  { id: "lcalf",  label: "L Calf",      cx: 134, cy: 276, r: 11 },
  { id: "rcalf",  label: "R Calf",      cx: 186, cy: 276, r: 11 },
];

const PREFS = [
  { key: "pressure", label: "Pressure", options: ["1 - Very Light", "2 - Light", "3 - Medium", "4 - Firm", "5 - Deep"] },
  { key: "goal",     label: "Goal",     options: ["Relax", "Pain Relief", "Sports Recovery", "Stress Relief"] },
  { key: "music",    label: "Music",    options: ["Silent", "Soft", "Nature Sounds", "Upbeat"] },
];

function ClientDemo() {
  const [mode, setMode] = useState("focus"); // focus | avoid
  const [dots, setDots] = useState({});
  const [step, setStep] = useState(1); // 1=body, 2=prefs, 3=done
  const [prefs, setPrefs] = useState({});

  function toggleDot(id) {
    setDots(d => {
      const cur = d[id];
      if (!cur) return { ...d, [id]: mode };
      if (cur === mode) { const n = {...d}; delete n[id]; return n; }
      return { ...d, [id]: mode };
    });
  }

  const focusCount = Object.values(dots).filter(v => v === "focus").length;
  const avoidCount = Object.values(dots).filter(v => v === "avoid").length;

  if (step === 3) return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
      <h3 style={{ fontFamily: "Georgia, serif", fontSize: 24, color: C.forest, marginBottom: 8 }}>Intake Complete!</h3>
      <p style={{ color: C.gray, fontSize: 15, marginBottom: 8 }}>Your therapist now knows exactly what you need.</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 }}>
        <span style={{ background: "#E8F5EE", color: "#22C55E", padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>🟢 {focusCount} focus areas</span>
        <span style={{ background: "#FEF2F2", color: "#EF4444", padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>🔴 {avoidCount} avoid areas</span>
      </div>
      <button onClick={() => { setDots({}); setPrefs({}); setStep(1); }} style={{ background: C.forest, color: "#fff", border: "none", padding: "10px 24px", borderRadius: 50, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Try Again</button>
    </div>
  );

  if (step === 2) return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "20px 0" }}>
      <h3 style={{ fontFamily: "Georgia, serif", fontSize: 20, color: C.darkGray, marginBottom: 6, textAlign: "center" }}>Set Your Preferences</h3>
      <p style={{ color: C.gray, fontSize: 13, textAlign: "center", marginBottom: 24 }}>Help your therapist personalize your session.</p>
      {PREFS.map(pref => (
        <div key={pref.key} style={{ marginBottom: 16 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: C.darkGray, marginBottom: 8 }}>{pref.label}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {pref.options.map(opt => (
              <button key={opt} onClick={() => setPrefs(p => ({ ...p, [pref.key]: opt }))}
                style={{ padding: "7px 14px", borderRadius: 20, border: prefs[pref.key] === opt ? "2px solid " + C.forest : "1.5px solid " + C.lightGray,
                  background: prefs[pref.key] === opt ? "#E8F5EE" : C.beige, color: prefs[pref.key] === opt ? C.forest : C.gray,
                  fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => setStep(3)} disabled={Object.keys(prefs).length < PREFS.length}
        style={{ width: "100%", padding: 14, borderRadius: 50, border: "none", marginTop: 8,
          background: Object.keys(prefs).length >= PREFS.length ? C.forest : "#C8BFB0",
          color: "#fff", fontWeight: 700, fontSize: 15, cursor: Object.keys(prefs).length >= PREFS.length ? "pointer" : "not-allowed" }}>
        Submit Intake →
      </button>
    </div>
  );

  return (
    <div>
      <p style={{ textAlign: "center", color: C.gray, fontSize: 14, marginBottom: 16 }}>Tap areas on the body to mark focus or avoid zones.</p>
      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
        {[["focus","🟢 Focus Areas","#22C55E"],["avoid","🔴 Avoid Areas","#EF4444"]].map(([m, label, col]) => (
          <button key={m} onClick={() => setMode(m)}
            style={{ padding: "8px 20px", borderRadius: 50, border: mode === m ? "2px solid " + col : "1.5px solid " + C.lightGray,
              background: mode === m ? (m === "focus" ? "#E8F5EE" : "#FEF2F2") : C.beige,
              color: mode === m ? col : C.gray, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {label}
          </button>
        ))}
      </div>
      {/* Body map */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg width="320" height="320" viewBox="0 0 320 320" style={{ cursor: "pointer" }}>
          {/* Body outline */}
          <ellipse cx="160" cy="52" rx="22" ry="22" fill="#E8E4DC" stroke="#C8BFB0" strokeWidth="1.5"/>
          <rect x="130" y="88" width="60" height="80" rx="10" fill="#E8E4DC" stroke="#C8BFB0" strokeWidth="1.5"/>
          <rect x="100" y="92" width="28" height="60" rx="8" fill="#E8E4DC" stroke="#C8BFB0" strokeWidth="1.5"/>
          <rect x="192" y="92" width="28" height="60" rx="8" fill="#E8E4DC" stroke="#C8BFB0" strokeWidth="1.5"/>
          <rect x="130" y="168" width="26" height="80" rx="8" fill="#E8E4DC" stroke="#C8BFB0" strokeWidth="1.5"/>
          <rect x="164" y="168" width="26" height="80" rx="8" fill="#E8E4DC" stroke="#C8BFB0" strokeWidth="1.5"/>
          <rect x="130" y="244" width="26" height="40" rx="6" fill="#E8E4DC" stroke="#C8BFB0" strokeWidth="1.5"/>
          <rect x="164" y="244" width="26" height="40" rx="6" fill="#E8E4DC" stroke="#C8BFB0" strokeWidth="1.5"/>
          {/* Clickable dots */}
          {BODY_AREAS.map(area => {
            const state = dots[area.id];
            const fill = state === "focus" ? "#22C55E" : state === "avoid" ? "#EF4444" : "rgba(255,255,255,0.6)";
            const stroke = state ? (state === "focus" ? "#16A34A" : "#DC2626") : "#9CA3AF";
            return (
              <g key={area.id} onClick={() => toggleDot(area.id)} style={{ cursor: "pointer" }}>
                <circle cx={area.cx} cy={area.cy} r={area.r} fill={fill} stroke={stroke} strokeWidth="1.5" opacity="0.85"/>
                {state && <circle cx={area.cx} cy={area.cy} r={area.r * 0.4} fill="white" opacity="0.5"/>}
              </g>
            );
          })}
        </svg>
      </div>
      {/* Stats + next */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12, margin: "16px 0" }}>
        <span style={{ background: "#E8F5EE", color: "#22C55E", padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>🟢 {focusCount} focus</span>
        <span style={{ background: "#FEF2F2", color: "#EF4444", padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>🔴 {avoidCount} avoid</span>
      </div>
      <div style={{ textAlign: "center" }}>
        <button onClick={() => setStep(2)} disabled={focusCount === 0}
          style={{ background: focusCount > 0 ? C.forest : "#C8BFB0", color: "#fff", border: "none", padding: "12px 32px", borderRadius: 50, fontWeight: 700, fontSize: 15, cursor: focusCount > 0 ? "pointer" : "not-allowed" }}>
          Next: Set Preferences →
        </button>
        {focusCount === 0 && <p style={{ fontSize: 12, color: C.gray, marginTop: 8 }}>Tap at least one area to continue</p>}
      </div>
    </div>
  );
}

// --- Therapist Demo ---
const DEMO_CLIENT = {
  name: "Sarah M.",
  phone: "512 555 1234",
  sessions: 4,
  lastVisit: "3 days ago",
  focus: ["Neck", "L Shoulder", "R Shoulder", "Upper Back"],
  avoid: ["L Knee", "R Knee"],
  prefs: { pressure: "4 - Firm", goal: "Pain Relief", music: "Soft", temp: "Warm", conversation: "Quiet" },
  medNote: "Recent neck injury — avoid deep pressure on cervical spine",
  note: "Client prefers silence during session. Always check in at start.",
};

function TherapistDemo() {
  const [screen, setScreen] = useState("list"); // list | session

  if (screen === "list") return (
    <div>
      <div style={{ background: "#F0EAD9", borderRadius: 12, padding: "14px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: C.darkGray, margin: 0 }}>Your Clients</p>
          <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>4 clients total</p>
        </div>
        <div style={{ background: "#E8F5EE", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: C.forest }}>📋 1 pending</div>
      </div>
      {/* Client cards */}
      {[
        { name: "Sarah M.", sessions: 4, status: "🟢 Active", days: "3d ago", pending: true },
        { name: "James K.", sessions: 8, status: "⭐ Regular", days: "12d ago", pending: false },
        { name: "Priya L.", sessions: 1, status: "🆕 New", days: "Today", pending: false },
      ].map((cl, i) => (
        <div key={i} onClick={() => cl.pending && setScreen("session")}
          style={{ background: C.white, borderRadius: 12, padding: "14px 16px", marginBottom: 10, border: cl.pending ? "1.5px solid " + C.sage : "1.5px solid " + C.lightGray,
            cursor: cl.pending ? "pointer" : "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: C.forest, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
              {cl.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: C.darkGray, margin: 0 }}>{cl.name}</p>
              <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>{cl.sessions} sessions · Last: {cl.days}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "#E8F5EE", color: C.forest }}>{cl.status}</span>
            {cl.pending && <span style={{ fontSize: 11, fontWeight: 700, color: C.gold }}>⏳ Tap →</span>}
          </div>
        </div>
      ))}
      <p style={{ textAlign: "center", fontSize: 12, color: C.sage, marginTop: 8, fontWeight: 600 }}>↑ Tap Sarah M. to see her session brief</p>
    </div>
  );

  return (
    <div>
      <button onClick={() => setScreen("list")} style={{ background: "none", border: "none", color: C.forest, fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 12, padding: 0 }}>← Back to Clients</button>
      {/* Medical alert */}
      <div style={{ background: "#FEF2F2", borderRadius: 10, padding: "10px 14px", border: "1px solid #EF4444", marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", margin: "0 0 3px 0" }}>🚨 MEDICAL FLAG</p>
        <p style={{ fontSize: 13, color: "#7F1D1D", margin: 0 }}>{DEMO_CLIENT.medNote}</p>
      </div>
      {/* Body map preview */}
      <div style={{ background: C.white, borderRadius: 12, padding: "16px", border: "1px solid " + C.lightGray, marginBottom: 12 }}>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 700, color: C.darkGray, marginBottom: 12 }}>Body Map — Sarah M.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {DEMO_CLIENT.focus.map(a => <span key={a} style={{ background: "#E8F5EE", color: "#22C55E", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>🟢 {a}</span>)}
          {DEMO_CLIENT.avoid.map(a => <span key={a} style={{ background: "#FEF2F2", color: "#EF4444", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>🔴 {a}</span>)}
        </div>
      </div>
      {/* Prefs */}
      <div style={{ background: C.white, borderRadius: 12, padding: "16px", border: "1px solid " + C.lightGray, marginBottom: 12 }}>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 700, color: C.darkGray, marginBottom: 10 }}>Client Preferences</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {Object.entries(DEMO_CLIENT.prefs).map(([k,v]) => (
            <div key={k} style={{ background: C.beige, borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", margin: "0 0 2px 0" }}>{k}</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.darkGray, margin: 0 }}>{v}</p>
            </div>
          ))}
        </div>
      </div>
      {/* Therapist note */}
      <div style={{ background: "#FFFBEB", borderRadius: 10, padding: "10px 14px", border: "1px solid #D97706" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#D97706", margin: "0 0 3px 0" }}>📝 YOUR NOTE</p>
        <p style={{ fontSize: 13, color: C.darkGray, margin: 0, fontStyle: "italic" }}>{DEMO_CLIENT.note}</p>
      </div>
    </div>
  );
}

// --- Main Component ---
export default function InteractiveDemo() {
  const [tab, setTab] = useState("client");

  return (
    <div style={{ background: "#F5F0E8", borderRadius: 20, padding: "32px", maxWidth: 700, margin: "0 auto" }}>
      {/* Tab switcher */}
      <div style={{ display: "flex", background: "white", borderRadius: 50, padding: 4, marginBottom: 28, width: "fit-content", margin: "0 auto 28px" }}>
        {[["client","👤 Client Experience"],["therapist","💆 Therapist Dashboard"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding: "10px 24px", borderRadius: 50, border: "none", fontWeight: 700, fontSize: 14,
              background: tab === key ? C.forest : "transparent", color: tab === key ? "#fff" : C.gray, cursor: "pointer", transition: "all 0.2s" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: "white", borderRadius: 16, padding: "24px", minHeight: 400 }}>
        {tab === "client" ? (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <p style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: C.darkGray, margin: "0 0 4px 0" }}>🌿 Serenity Massage Studio</p>
              <p style={{ fontSize: 13, color: C.gray, margin: 0 }}>Pre-session intake — takes under 60 seconds</p>
            </div>
            <ClientDemo />
          </div>
        ) : (
          <TherapistDemo />
        )}
      </div>
    </div>
  );
}
