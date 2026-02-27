// src/components/SessionDetail.js
import React, { useState, useEffect } from "react";
import { db, supabase } from "../lib/supabase";

const C = {
  sage: "#6B9E80", forest: "#2A5741", beige: "#F5F0E8",
  darkGray: "#1A1A2E", gray: "#6B7280", lightGray: "#E8E4DC",
  white: "#FFFFFF", gold: "#C9A84C", red: "#EF4444"
};

const AREA_LABELS = {
  // Front
  "f-head": "Head", "f-neck": "Neck",
  "f-l-shldr": "L Shoulder", "f-r-shldr": "R Shoulder",
  "f-l-chest": "L Chest", "f-r-chest": "R Chest",
  "f-abdomen": "Abdomen",
  "f-l-arm-u": "L Upper Arm", "f-r-arm-u": "R Upper Arm",
  "f-l-forearm": "L Forearm", "f-r-forearm": "R Forearm",
  "f-l-hand": "L Hand", "f-r-hand": "R Hand",
  "f-l-hip": "L Hip", "f-r-hip": "R Hip",
  "f-l-thigh": "L Thigh", "f-r-thigh": "R Thigh",
  "f-l-knee": "L Knee", "f-r-knee": "R Knee",
  "f-l-calf": "L Calf", "f-r-calf": "R Calf",
  "f-l-foot": "L Foot", "f-r-foot": "R Foot",
  // Back
  "b-head": "Back of Head", "b-neck": "Back of Neck",
  "b-l-shldr": "L Shoulder Blade", "b-r-shldr": "R Shoulder Blade",
  "b-upper-bk": "Upper Back", "b-mid-bk": "Mid Back", "b-lower-bk": "Lower Back",
  "b-l-arm-u": "L Upper Arm", "b-r-arm-u": "R Upper Arm",
  "b-l-forearm": "L Forearm", "b-r-forearm": "R Forearm",
  "b-l-hand": "L Hand", "b-r-hand": "R Hand",
  "b-l-glute": "L Glute", "b-r-glute": "R Glute",
  "b-l-hamstr": "L Hamstring", "b-r-hamstr": "R Hamstring",
  "b-l-knee": "L Knee", "b-r-knee": "R Knee",
  "b-l-calf": "L Calf", "b-r-calf": "R Calf",
  "b-l-foot": "L Foot", "b-r-foot": "R Foot"
};

const AREA_COORDS = {
  // Front
  "f-head": [85,28], "f-neck": [85,52],
  "f-l-shldr": [58,72], "f-r-shldr": [112,72],
  "f-l-chest": [68,95], "f-r-chest": [102,95],
  "f-abdomen": [85,125],
  "f-l-arm-u": [45,100], "f-r-arm-u": [125,100],
  "f-l-forearm": [42,130], "f-r-forearm": [128,130],
  "f-l-hand": [40,155], "f-r-hand": [130,155],
  "f-l-hip": [68,155], "f-r-hip": [102,155],
  "f-l-thigh": [68,185], "f-r-thigh": [102,185],
  "f-l-knee": [68,220], "f-r-knee": [102,220],
  "f-l-calf": [68,248], "f-r-calf": [102,248],
  "f-l-foot": [68,285], "f-r-foot": [102,285],
  // Back
  "b-head": [85,28], "b-neck": [85,52],
  "b-l-shldr": [58,72], "b-r-shldr": [112,72],
  "b-upper-bk": [85,88], "b-mid-bk": [85,112], "b-lower-bk": [85,136],
  "b-l-arm-u": [45,100], "b-r-arm-u": [125,100],
  "b-l-forearm": [42,130], "b-r-forearm": [128,130],
  "b-l-hand": [40,155], "b-r-hand": [130,155],
  "b-l-glute": [68,162], "b-r-glute": [102,162],
  "b-l-hamstr": [68,192], "b-r-hamstr": [102,192],
  "b-l-knee": [68,220], "b-r-knee": [102,220],
  "b-l-calf": [68,248], "b-r-calf": [102,248],
  "b-l-foot": [68,285], "b-r-foot": [102,285]
};

function BodySVG({ focusAreas = [], avoidAreas = [] }) {
  return (
    <svg width="150" height="290" viewBox="0 0 170 310" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.08))" }}>
      <ellipse cx="85" cy="28" rx="20" ry="24" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <rect x="77" y="50" width="16" height="14" rx="3" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <path d="M57 64 Q47 70 44 90 L40 155 Q40 162 48 162 L122 162 Q130 162 130 155 L126 90 Q123 70 113 64 Z" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <path d="M57 66 Q42 74 38 115 Q36 128 40 138 Q46 141 50 138 Q54 112 60 85 Z" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <path d="M113 66 Q128 74 132 115 Q134 128 130 138 Q124 141 120 138 Q116 112 110 85 Z" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <path d="M60 162 Q56 195 54 232 Q52 260 56 278 Q62 284 70 282 Q76 278 76 260 L78 162 Z" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <path d="M110 162 Q114 195 116 232 Q118 260 114 278 Q108 284 100 282 Q94 278 94 260 L92 162 Z" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      {focusAreas.map((area, i) => {
        const c = AREA_COORDS[area]; if (!c) return null;
        return <g key={"f"+i}>
          <circle cx={c[0]} cy={c[1]} r="12" fill="rgba(107,158,128,0.25)" stroke="#6B9E80" strokeWidth="2"/>
          <circle cx={c[0]} cy={c[1]} r="5" fill="#6B9E80"/>
        </g>;
      })}
      {avoidAreas.map((area, i) => {
        const c = AREA_COORDS[area]; if (!c) return null;
        return <g key={"a"+i}>
          <circle cx={c[0]} cy={c[1]} r="12" fill="rgba(239,68,68,0.2)" stroke="#EF4444" strokeWidth="2"/>
          <circle cx={c[0]} cy={c[1]} r="5" fill="#EF4444"/>
        </g>;
      })}
    </svg>
  );
}

export default function SessionDetail({ session, client, onBack, onUpdate }) {
  const [notes, setNotes] = useState(session.therapist_notes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [history, setHistory] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [feedbackLink, setFeedbackLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    loadHistory();
    loadFeedback();
    supabase.from("therapists").select("custom_url").eq("id", session.therapist_id).maybeSingle()
      .then(({ data: t }) => { if (t) setFeedbackLink(window.location.origin + "/" + t.custom_url + "/feedback/" + session.id); });
  }, [client?.id]);

  async function loadFeedback() {
    try {
      const { data } = await supabase.from("feedback").select("*").eq("session_id", session.id).maybeSingle();
      setFeedback(data);
    } catch(e) {}
  }

  function copyLink() {
    navigator.clipboard.writeText(feedbackLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function loadHistory() {
    try {
      const { data } = await supabase
        .from("sessions").select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setHistory(data || []);
    } catch (err) { console.error(err); }
  }

  // Compute patterns from history
  const patterns = React.useMemo(() => {
    if (history.length < 2) return [];
    const result = [];
    // Medical flags - highest priority
    const medFlags = history.filter(s => s.med_flag && s.med_flag !== "none").map(s => s.med_flag);
    if (medFlags.length > 0) {
      const unique = [...new Set(medFlags)];
      result.push({ icon: "🚨", text: `Medical flag: ${unique.join(", ")} — always check before session`, urgent: true });
    }

    const pressures = history.filter(s => s.pressure).map(s => s.pressure);
    if (pressures.length >= 2) {
      const avg = Math.round(pressures.reduce((a,b) => a+b, 0) / pressures.length);
      result.push({ icon: "💆", text: `Consistently prefers pressure level ${avg}/5` });
    }
    const goals = history.filter(s => s.goal).map(s => s.goal);
    const topGoal = goals.sort((a,b) => goals.filter(v=>v===a).length - goals.filter(v=>v===b).length).pop();
    if (topGoal) result.push({ icon: "🎯", text: `Most common goal: ${topGoal}` });
    const allAvoid = history.flatMap(s => [...(s.front_avoid||[]), ...(s.back_avoid||[])]);
    const avoidCounts = {};
    allAvoid.forEach(a => avoidCounts[a] = (avoidCounts[a]||0)+1);
    const topAvoid = Object.entries(avoidCounts).sort((a,b) => b[1]-a[1]).slice(0,2);
    topAvoid.forEach(([area, count]) => {
      if (count >= 2) result.push({ icon: "⚠️", text: `Always avoids: ${AREA_LABELS[area] || area} (${count}x)` });
    });
    const allFocus = history.flatMap(s => [...(s.front_focus||[]), ...(s.back_focus||[])]);
    const focusCounts = {};
    allFocus.forEach(a => focusCounts[a] = (focusCounts[a]||0)+1);
    const topFocus = Object.entries(focusCounts).sort((a,b) => b[1]-a[1]).slice(0,2);
    topFocus.forEach(([area, count]) => {
      if (count >= 2) result.push({ icon: "✨", text: `Always focuses: ${AREA_LABELS[area] || area} (${count}x)` });
    });
    const lights = history.filter(s => s.lighting).map(s => s.lighting);
    if (lights.length >= 2 && new Set(lights).size === 1) result.push({ icon: "💡", text: `Always prefers ${lights[0]} lighting` });
    return result.slice(0, 5);
  }, [history]);

  async function saveNotes() {
    setSaving(true);
    try {
      const { data } = await supabase.from("sessions").update({ therapist_notes: notes }).eq("id", session.id).select().single();
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      if (onUpdate && data) onUpdate(data);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function markComplete() {
    setCompleting(true);
    try {
      const { data } = await supabase.from("sessions").update({ completed: true, therapist_notes: notes, completed_at: new Date().toISOString() }).eq("id", session.id).select().single();
      if (onUpdate && data) onUpdate(data);
      onBack();
    } catch (err) { console.error(err); }
    finally { setCompleting(false); }
  }

  const prefs = [
    { label: "Pressure", value: session.pressure ? `Level ${session.pressure}/5` : null, icon: "💆" },
    { label: "Goal", value: session.goal, icon: "🎯" },
    { label: "Table Temp", value: session.table_temp, icon: "🌡️" },
    { label: "Room Temp", value: session.room_temp, icon: "🏠" },
    { label: "Music", value: session.music, icon: "🎵" },
    { label: "Lighting", value: session.lighting, icon: "💡" },
    { label: "Conversation", value: session.conversation, icon: "💬" },
    { label: "Draping", value: session.draping, icon: "🛏️" },
    { label: "Oil Preference", value: session.oil_pref !== "none" ? session.oil_pref : null, icon: "🌿" },
    { label: "Medical Flag", value: session.med_flag !== "none" ? session.med_flag : null, icon: "⚕️", urgent: true },
    { label: "Medical Details", value: session.med_note || null, icon: "🚨", urgent: true },
    { label: "Client Notes", value: session.client_notes || null, icon: "📝", highlight: true },
  ].filter(p => p.value);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px" }}>
        <button onClick={onBack} style={{ background: "transparent", border: `1.5px solid ${C.lightGray}`, color: C.gray, padding: "8px 16px", borderRadius: "8px", fontSize: "14px", cursor: "pointer" }}>
          ← Sessions
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "26px", fontWeight: "700", color: C.darkGray, margin: "0 0 2px 0", letterSpacing: "-0.5px" }}>
            {client.name}
          </h2>
          <p style={{ fontSize: "14px", color: C.gray, margin: 0 }}>
            {new Date(session.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button onClick={() => window.print()} style={{ background: C.beige, border: `1.5px solid ${C.lightGray}`, color: C.gray, padding: "8px 16px", borderRadius: "8px", fontSize: "14px", cursor: "pointer" }}>
            🖨️ Print Brief
          </button>
          <span style={{ background: session.completed ? "#D1FAE5" : "#FEF3C7", color: session.completed ? "#065F46" : "#92400E", padding: "6px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "600" }}>
            {session.completed ? "✓ Completed" : "⏳ Pending Review"}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

        {/* Left col */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Preferences */}
          <div style={{ background: C.white, borderRadius: "14px", padding: "24px", border: `1px solid ${C.lightGray}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "17px", fontWeight: "700", color: C.darkGray, marginBottom: "16px", letterSpacing: "-0.3px" }}>
              Client Preferences
            </h3>
            {prefs.length === 0 ? (
              <p style={{ color: C.gray, fontSize: "14px" }}>No preferences recorded</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {prefs.map((p, i) => (
                  <div key={i} style={{ padding: "10px 12px", background: C.beige, borderRadius: "8px", border: `1px solid ${C.lightGray}` }}>
                    <p style={{ fontSize: "11px", color: C.gray, margin: "0 0 3px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>{p.icon} {p.label}</p>
                    <p style={{ fontSize: "14px", fontWeight: "600", color: C.darkGray, margin: 0, textTransform: "capitalize" }}>{p.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History Patterns */}
          {patterns.length > 0 && (
            <div style={{ background: `linear-gradient(135deg, ${C.forest}08, ${C.sage}12)`, borderRadius: "14px", padding: "24px", border: `1px solid ${C.sage}30` }}>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: "17px", fontWeight: "700", color: C.forest, marginBottom: "16px", letterSpacing: "-0.3px" }}>
                🔍 Client Patterns
              </h3>
              <p style={{ fontSize: "12px", color: C.gray, margin: "0 0 12px 0" }}>Based on {history.length} sessions</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {patterns.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: p.urgent ? "#FEF2F2" : C.white, borderRadius: "8px", border: `1px solid ${p.urgent ? "#EF4444" : C.sage+"25"}`, fontWeight: p.urgent ? "700" : "500" }}>
                    <span style={{ fontSize: "16px" }}>{p.icon}</span>
                    <span style={{ fontSize: "13px", color: p.urgent ? "#DC2626" : C.darkGray, fontWeight: p.urgent ? "700" : "500" }}>{p.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div style={{ background: C.white, borderRadius: "14px", padding: "24px", border: `1px solid ${C.lightGray}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "17px", fontWeight: "700", color: C.darkGray, marginBottom: "16px", letterSpacing: "-0.3px" }}>
              Your Notes
            </h3>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add session notes..."
              style={{ width: "100%", minHeight: "100px", padding: "12px", border: `1.5px solid ${C.lightGray}`, borderRadius: "8px", fontSize: "14px", fontFamily: "Georgia, serif", resize: "vertical", boxSizing: "border-box", background: C.beige, lineHeight: "1.6" }}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
              <button onClick={saveNotes} disabled={saving}
                style={{ flex: 1, background: C.sage, color: C.white, border: "none", padding: "11px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "system-ui" }}>
                {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Notes"}
              </button>
              {!session.completed && (
                <button onClick={markComplete} disabled={completing}
                  style={{ flex: 1, background: C.forest, color: C.white, border: "none", padding: "11px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "system-ui" }}>
                  {completing ? "..." : "✓ Mark Complete"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right col - Body Map */}
        <div style={{ background: C.white, borderRadius: "14px", padding: "24px", border: `1px solid ${C.lightGray}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <h3 style={{ fontFamily: "Georgia, serif", fontSize: "17px", fontWeight: "700", color: C.darkGray, marginBottom: "8px", letterSpacing: "-0.3px" }}>
            Body Map
          </h3>
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <span style={{ fontSize: "12px", background: "rgba(107,158,128,0.15)", color: C.forest, padding: "4px 12px", borderRadius: "20px", fontWeight: "500" }}>🟢 Focus</span>
            <span style={{ fontSize: "12px", background: "rgba(239,68,68,0.1)", color: "#991B1B", padding: "4px 12px", borderRadius: "20px", fontWeight: "500" }}>🔴 Avoid</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "20px" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "11px", fontWeight: "600", color: C.gray, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Front</p>
              <BodySVG focusAreas={session.front_focus || []} avoidAreas={session.front_avoid || []} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "11px", fontWeight: "600", color: C.gray, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Back</p>
              <BodySVG focusAreas={session.back_focus || []} avoidAreas={session.back_avoid || []} />
            </div>
          </div>

          {[...(session.front_focus||[]), ...(session.front_avoid||[]), ...(session.back_focus||[]), ...(session.back_avoid||[])].length > 0 && (
            <div>
              <p style={{ fontSize: "12px", color: C.gray, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Areas</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {[...(session.front_focus||[]), ...(session.back_focus||[])].map((a, i) => (
                  <span key={"f"+i} style={{ background: "rgba(107,158,128,0.15)", color: C.forest, padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "500" }}>
                    🟢 {AREA_LABELS[a] || a}
                  </span>
                ))}
                {[...(session.front_avoid||[]), ...(session.back_avoid||[])].map((a, i) => (
                  <span key={"a"+i} style={{ background: "rgba(239,68,68,0.1)", color: "#991B1B", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "500" }}>
                    🔴 {AREA_LABELS[a] || a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          header, nav, [class*="tab"], button, .no-print { display: none !important; }
          body { background: white !important; font-size: 11px !important; }
          * { box-shadow: none !important; }
          div { padding: 4px !important; margin: 2px !important; }
          h2 { font-size: 16px !important; margin: 0 0 2px 0 !important; }
          h3 { font-size: 13px !important; margin: 0 0 4px 0 !important; }
          p, span { font-size: 11px !important; }
          textarea { min-height: 40px !important; font-size: 11px !important; }
          svg { width: 100px !important; height: 160px !important; }
        }
      `}</style>
    </div>
  );
}
