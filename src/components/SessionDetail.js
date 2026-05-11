// src/components/SessionDetail.js
import React, { useState, useEffect, useMemo } from "react";
import { db, supabase } from "../lib/supabase";
import { AFTERCARE_PRESETS } from "../lib/sessionIntelligence";

const C = {
  sage: "#6B9E80", forest: "#2A5741", beige: "#F5F0E8",
  darkGray: "#1A1A2E", gray: "#6B7280", lightGray: "#E8E4DC",
  white: "#FFFFFF", gold: "#C9A84C", red: "#EF4444"
};

const AREA_LABELS = {
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

function BodySVG({ focusAreas = [], avoidAreas = [], heatmapFocus = {}, heatmapAvoid = {}, showHeatmap = false }) {
  return (
    <svg width="150" height="290" viewBox="0 0 170 310" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.08))" }}>
      <ellipse cx="85" cy="28" rx="20" ry="24" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <rect x="77" y="50" width="16" height="14" rx="3" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <path d="M57 64 Q47 70 44 90 L40 155 Q40 162 48 162 L122 162 Q130 162 130 155 L126 90 Q123 70 113 64 Z" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <path d="M57 66 Q42 74 38 115 Q36 128 40 138 Q46 141 50 138 Q54 112 60 85 Z" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <path d="M113 66 Q128 74 132 115 Q134 128 130 138 Q124 141 120 138 Q116 112 110 85 Z" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <path d="M60 162 Q56 195 54 232 Q52 260 56 278 Q62 284 70 282 Q76 278 76 260 L78 162 Z" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <path d="M110 162 Q114 195 116 232 Q118 260 114 278 Q108 284 100 282 Q94 278 94 260 L92 162 Z" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      {showHeatmap && Object.entries(heatmapFocus).map(([area, { opacity, count }]) => {
        const c = AREA_COORDS[area]; if (!c) return null;
        const r = 8 + opacity * 10;
        return (
          <g key={"hf-" + area}>
            <circle cx={c[0]} cy={c[1]} r={r + 8} fill={"rgba(107,158,128," + (opacity * 0.2).toFixed(2) + ")"} stroke="none"/>
            <circle cx={c[0]} cy={c[1]} r={r} fill={"rgba(107,158,128," + (opacity * 0.55).toFixed(2) + ")"} stroke="#6B9E80" strokeWidth={opacity > 0.6 ? "2.5" : "1.5"}/>
            <circle cx={c[0]} cy={c[1]} r="5" fill={"rgba(42,87,65," + Math.min(opacity + 0.2, 1).toFixed(2) + ")"}/>
            <circle cx={c[0] + r - 1} cy={c[1] - r + 1} r="7" fill="#2A5741" stroke="white" strokeWidth="1.5"/>
            <text x={c[0] + r - 1} y={c[1] - r + 5} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="system-ui">{count}</text>
          </g>
        );
      })}
      {showHeatmap && Object.entries(heatmapAvoid).map(([area, { opacity, count }]) => {
        if (heatmapFocus[area]) return null;
        const c = AREA_COORDS[area]; if (!c) return null;
        const r = 8 + opacity * 10;
        return (
          <g key={"ha-" + area}>
            <circle cx={c[0]} cy={c[1]} r={r + 8} fill={"rgba(239,68,68," + (opacity * 0.15).toFixed(2) + ")"} stroke="none"/>
            <circle cx={c[0]} cy={c[1]} r={r} fill={"rgba(239,68,68," + (opacity * 0.4).toFixed(2) + ")"} stroke="#EF4444" strokeWidth={opacity > 0.6 ? "2.5" : "1.5"}/>
            <circle cx={c[0]} cy={c[1]} r="5" fill={"rgba(185,28,28," + Math.min(opacity + 0.2, 1).toFixed(2) + ")"}/>
            <circle cx={c[0] + r - 1} cy={c[1] - r + 1} r="7" fill="#991B1B" stroke="white" strokeWidth="1.5"/>
            <text x={c[0] + r - 1} y={c[1] - r + 5} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="system-ui">{count}</text>
          </g>
        );
      })}
      {!showHeatmap && focusAreas.map((area, i) => {
        const c = AREA_COORDS[area]; if (!c) return null;
        return <g key={"f"+i}>
          <circle cx={c[0]} cy={c[1]} r="12" fill="rgba(107,158,128,0.25)" stroke="#6B9E80" strokeWidth="2"/>
          <circle cx={c[0]} cy={c[1]} r="5" fill="#6B9E80"/>
        </g>;
      })}
      {!showHeatmap && avoidAreas.map((area, i) => {
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
  // Track therapist's AI features setting so we can hide the pre/post-session
  // brief buttons when AI is turned off in Settings.
  const [aiEnabled, setAiEnabled] = useState(true);
  useEffect(() => {
    if (!session?.therapist_id) return;
    supabase.from("therapists").select("ai_enabled").eq("id", session.therapist_id).maybeSingle()
      .then(({ data }) => { if (data) setAiEnabled(data.ai_enabled !== false); });
  }, [session?.therapist_id]);
  const [publicNotes, setPublicNotes] = useState(session.public_notes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [history, setHistory] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [feedbackLink, setFeedbackLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [soapTab, setSoapTab] = useState("soap"); // "soap" | "notes"

  // Parse SOAP from therapist_notes if stored as JSON
  const parseSoap = (raw) => {
    try {
      const p = JSON.parse(raw);
      if (p && p.__soap) return {
        __soap: true,
        S: p.S || "", O: p.O || "", A: p.A || "", P: p.P || "",
        noteToClient: p.noteToClient || "",
        aftercare: Array.isArray(p.aftercare) ? p.aftercare : [],
        aftercareCustom: p.aftercareCustom || "",
        legacy: p.legacy || "",
      };
    } catch(e) {}
    return { __soap: true, S: "", O: "", A: "", P: "", noteToClient: "", aftercare: [], aftercareCustom: "", legacy: raw };
  };
  const [soap, setSoap] = useState(() => parseSoap(session.therapist_notes || ""));

  // Intake editing (Lindsey #11, May 10 2026).
  //
  // Therapist can correct any intake field after the client filled it
  // out. Each saved change writes an intake_edits row so the audit
  // trail is complete. Per the waiver consent line, therapists may
  // update for accuracy (typos, new information shared in session,
  // etc) but must not change substance without client agreement.
  //
  // Draft state holds in-progress edits. When the therapist clicks
  // Save, we diff against the current session row, write the changes
  // to sessions table, write one intake_edits row per changed field,
  // and call onUpdate(updatedSession) so the parent re-renders.
  const INTAKE_FIELDS = [
    'pressure', 'goal', 'table_temp', 'room_temp', 'music', 'lighting',
    'conversation', 'draping', 'oil_pref', 'client_notes', 'med_flag',
    'med_note', 'front_pct', 'top_pct', 'middle_pct', 'bottom_pct',
  ];
  const [editingIntake, setEditingIntake] = useState(false);
  const [intakeDraft, setIntakeDraft] = useState(() => {
    const d = {};
    for (const f of INTAKE_FIELDS) d[f] = session[f];
    return d;
  });
  const [savingIntake, setSavingIntake] = useState(false);
  const [intakeSaved, setIntakeSaved] = useState(false);

  async function saveIntakeEdits() {
    setSavingIntake(true);
    try {
      // Diff: only write rows for fields that actually changed.
      const changed = {};
      for (const f of INTAKE_FIELDS) {
        const before = session[f];
        const after = intakeDraft[f];
        // Treat null and '' as equivalent for text fields so toggling
        // an empty input does not create noise in the audit log.
        const beforeNorm = before == null || before === '' ? null : before;
        const afterNorm  = after  == null || after  === '' ? null : after;
        if (beforeNorm !== afterNorm) changed[f] = afterNorm;
      }
      if (Object.keys(changed).length === 0) {
        setEditingIntake(false);
        setSavingIntake(false);
        return;
      }
      // Write the session update first. If this fails the audit log
      // entries do not get written; we never log changes that did
      // not actually happen.
      const { data: updated, error: updErr } = await supabase
        .from('sessions')
        .update(changed)
        .eq('id', session.id)
        .select()
        .single();
      if (updErr) throw updErr;
      // Audit log: one row per field. Best-effort: a failure here
      // does NOT roll back the session update. We accept a missing
      // audit row over a stuck edit. Future iteration could move
      // this to an edge function or RPC for atomicity.
      const auditRows = Object.entries(changed).map(([field, after]) => ({
        session_id: session.id,
        therapist_id: session.therapist_id,
        editor_id: session.therapist_id,
        field_name: field,
        value_before: session[field] == null ? null : JSON.stringify(session[field]),
        value_after:  after == null ? null : JSON.stringify(after),
      }));
      try {
        await supabase.from('intake_edits').insert(auditRows);
      } catch (auditErr) {
        console.warn('Audit log write failed (session update succeeded):', auditErr);
      }
      setIntakeSaved(true);
      setEditingIntake(false);
      setTimeout(() => setIntakeSaved(false), 2200);
      if (onUpdate) onUpdate(updated);
    } catch (err) {
      console.error('Save intake edits failed:', err);
      alert('Could not save intake changes. Please try again or refresh the page.');
    } finally {
      setSavingIntake(false);
    }
  }

  function cancelIntakeEdit() {
    const d = {};
    for (const f of INTAKE_FIELDS) d[f] = session[f];
    setIntakeDraft(d);
    setEditingIntake(false);
  }

  useEffect(() => {
    loadHistory();
    loadFeedback();
    supabase.from("therapists").select("custom_url").eq("id", session.therapist_id).maybeSingle()
      .then(({ data: t }) => {
        if (t) {
          const code = session.feedback_code || session.id;
          setFeedbackLink(window.location.origin + "/" + t.custom_url + "/feedback/" + code);
        }
      });
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

  const heatmapData = useMemo(() => {
    const past = history.filter(s => s.id !== session.id).slice(0, 5);
    const n = past.length;
    if (n === 0) return { frontFocus: {}, frontAvoid: {}, backFocus: {}, backAvoid: {}, count: 0 };
    const ff = {}, fa = {}, bf = {}, ba = {};
    past.forEach(s => {
      (s.front_focus || []).forEach(a => { ff[a] = (ff[a] || 0) + 1; });
      (s.front_avoid || []).forEach(a => { fa[a] = (fa[a] || 0) + 1; });
      (s.back_focus  || []).forEach(a => { bf[a] = (bf[a] || 0) + 1; });
      (s.back_avoid  || []).forEach(a => { ba[a] = (ba[a] || 0) + 1; });
    });
    const toEntry = (c) => ({ count: c, total: n, opacity: parseFloat(Math.min(0.3 + (c / n) * 0.7, 1.0).toFixed(2)) });
    return {
      frontFocus: Object.fromEntries(Object.entries(ff).map(([k,v]) => [k, toEntry(v)])),
      frontAvoid: Object.fromEntries(Object.entries(fa).map(([k,v]) => [k, toEntry(v)])),
      backFocus:  Object.fromEntries(Object.entries(bf).map(([k,v]) => [k, toEntry(v)])),
      backAvoid:  Object.fromEntries(Object.entries(ba).map(([k,v]) => [k, toEntry(v)])),
      count: n,
    };
  }, [history, session.id]);

  const patterns = useMemo(() => {
    if (history.length < 2) return [];
    const result = [];
    const medSessions = history.filter(s => s.med_flag && s.med_flag !== "none" && s.med_flag !== "no");
    if (medSessions.length > 0) {
      const medNotes = medSessions.map(s => s.med_note).filter(Boolean);
      const uniqueNotes = [...new Set(medNotes)];
      const noteText = uniqueNotes.length > 0 ? ": \"" + uniqueNotes[uniqueNotes.length-1] + "\"" : "";
      result.push({ icon: "🚨", text: "Medical flag" + noteText + " - always check before session", urgent: true });
    }
    const pressures = history.filter(s => s.pressure).map(s => s.pressure);
    if (pressures.length >= 2) {
      const avg = Math.round(pressures.reduce((a,b) => a+b, 0) / pressures.length);
      result.push({ icon: "💆", text: "Consistently prefers pressure level " + avg + "/5" });
    }
    const goals = history.filter(s => s.goal).map(s => s.goal);
    const topGoal = goals.sort((a,b) => goals.filter(v=>v===a).length - goals.filter(v=>v===b).length).pop();
    if (topGoal) result.push({ icon: "🎯", text: "Most common goal: " + topGoal });
    const allAvoid = history.flatMap(s => [...(s.front_avoid||[]), ...(s.back_avoid||[])]);
    const avoidCounts = {};
    allAvoid.forEach(a => avoidCounts[a] = (avoidCounts[a]||0)+1);
    Object.entries(avoidCounts).sort((a,b) => b[1]-a[1]).slice(0,2).forEach(([area, count]) => {
      if (count >= 2) result.push({ icon: "⚠️", text: "Always avoids: " + (AREA_LABELS[area] || area), count, total: history.length, pct: Math.round(count/history.length*100), type: "avoid" });
    });
    const allFocus = history.flatMap(s => [...(s.front_focus||[]), ...(s.back_focus||[])]);
    const focusCounts = {};
    allFocus.forEach(a => focusCounts[a] = (focusCounts[a]||0)+1);
    Object.entries(focusCounts).sort((a,b) => b[1]-a[1]).slice(0,2).forEach(([area, count]) => {
      if (count >= 2) result.push({ icon: "✨", text: "Always focuses: " + (AREA_LABELS[area] || area), count, total: history.length, pct: Math.round(count/history.length*100), type: "focus" });
    });
    const lights = history.filter(s => s.lighting).map(s => s.lighting);
    if (lights.length >= 2 && new Set(lights).size === 1) result.push({ icon: "💡", text: "Always prefers " + lights[0] + " lighting" });
    return result.slice(0, 5);
  }, [history]);

  const medFlagValue = (() => {
    const flag = session.med_flag;
    const note = session.med_note;
    if (!flag || flag === "none" || flag === "no" || flag === "false") return null;
    const flagIsGeneric = ["yes","true","flagged","1"].includes(String(flag).toLowerCase().trim());
    if (flagIsGeneric) return note ? note : "Medical condition flagged - ask client for details";
    return note ? flag + " - " + note : flag;
  })();

  async function saveNotes() {
    setSaving(true);
    try {
      const notesToSave = JSON.stringify(soap);
      const { data } = await supabase.from("sessions").update({ therapist_notes: notesToSave, public_notes: publicNotes }).eq("id", session.id).select().single();
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      if (onUpdate && data) onUpdate(data);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function markComplete() {
    setCompleting(true);
    try {
      const notesToSave = JSON.stringify(soap);
      const { data } = await supabase.from("sessions").update({ completed: true, therapist_notes: notesToSave, public_notes: publicNotes, completed_at: new Date().toISOString() }).eq("id", session.id).select().single();
      if (onUpdate && data) onUpdate(data);

      // Fire post-session email (non-blocking, don't wait)
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      fetch(`${supabaseUrl}/functions/v1/send-post-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
        body: JSON.stringify({ session_id: session.id }),
      }).catch(e => console.warn('Post-session email failed silently:', e));

      onBack();
    } catch (err) { console.error(err); }
    finally { setCompleting(false); }
  }

  const prefs = [
    { label: "Pressure", value: session.pressure ? "Level " + session.pressure + "/5" : null, icon: "💆" },
    { label: "Goal", value: session.goal, icon: "🎯" },
    { label: "Table Temp", value: session.table_temp, icon: "🌡️" },
    { label: "Room Temp", value: session.room_temp, icon: "🏠" },
    { label: "Music", value: session.music, icon: "🎵" },
    { label: "Lighting", value: session.lighting, icon: "💡" },
    { label: "Conversation", value: session.conversation, icon: "💬" },
    { label: "Draping", value: session.draping, icon: "🛏️" },
    { label: "Oil Preference", value: session.oil_pref !== "none" ? session.oil_pref : null, icon: "🌿" },
    { label: "Client Notes", value: session.client_notes || null, icon: "📝" },
  ].filter(p => p.value);

  return (
    <div style={{ paddingBottom: "100px" }}>
      <style>{`
        @media (max-width: 640px) {
          .bm-session-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "28px", flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ background: "transparent", border: "1.5px solid " + C.lightGray, color: C.gray, padding: "8px 16px", borderRadius: "8px", fontSize: "14px", cursor: "pointer" }}>
          ← Sessions
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "26px", fontWeight: "700", color: C.darkGray, margin: "0 0 2px 0", letterSpacing: "-0.5px" }}>{client.name}</h2>
          <p style={{ fontSize: "13px", color: C.gray, margin: 0 }}>
            <span style={{ fontWeight: 600, color: '#2A5741', marginRight: 8 }}>Session Record</span>
            {new Date(session.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {aiEnabled && (
            <button onClick={() => window.open("/brief/pre/" + session.id, "_blank")} style={{ background: C.beige, border: "1.5px solid " + C.lightGray, color: C.gray, padding: "8px 16px", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>🖨️ Pre-Session Brief</button>
          )}

          {aiEnabled && session.completed && <button onClick={() => window.open("/brief/post/" + session.id, "_blank")} style={{ background: C.forest, color: C.white, border: "none", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>📋 Post-Session Brief</button>}

          <span style={{ background: session.completed ? "#D1FAE5" : "#FEF3C7", color: session.completed ? "#065F46" : "#92400E", padding: "6px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "600" }}>
            {session.completed ? "✓ Completed" : "⏳ Pending Review"}
          </span>
        </div>
      </div>

      {medFlagValue && (
        <div style={{ background: "#FEF2F2", border: "2px solid #EF4444", borderRadius: "12px", padding: "14px 20px", marginBottom: "16px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <span style={{ fontSize: "22px", lineHeight: 1 }}>🚨</span>
          <div>
            <p style={{ fontSize: "12px", fontWeight: "800", color: "#991B1B", margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: "0.8px" }}>Medical Flag - Review Before Session</p>
            <p style={{ fontSize: "15px", fontWeight: "600", color: "#7F1D1D", margin: 0 }}>{medFlagValue}</p>
          </div>
        </div>
      )}

      <div className="bm-session-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: C.white, borderRadius: "14px", padding: "24px", border: "1px solid " + C.lightGray, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: "17px", fontWeight: "700", color: C.darkGray, letterSpacing: "-0.3px", margin: 0 }}>Client Preferences</h3>
              {!editingIntake ? (
                <button onClick={() => setEditingIntake(true)} style={{
                  background: "transparent", border: `1px solid ${C.lightGray}`,
                  padding: "5px 11px", borderRadius: "6px",
                  fontSize: "12px", fontWeight: 600, color: C.forest, cursor: "pointer",
                }}>
                  ✏️ Edit
                </button>
              ) : (
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={cancelIntakeEdit} disabled={savingIntake} style={{
                    background: "transparent", border: `1px solid ${C.lightGray}`,
                    padding: "5px 11px", borderRadius: "6px",
                    fontSize: "12px", fontWeight: 600, color: C.gray, cursor: "pointer",
                  }}>
                    Cancel
                  </button>
                  <button onClick={saveIntakeEdits} disabled={savingIntake} style={{
                    background: C.forest, border: "none",
                    padding: "5px 13px", borderRadius: "6px",
                    fontSize: "12px", fontWeight: 700, color: "#fff", cursor: savingIntake ? "wait" : "pointer",
                  }}>
                    {savingIntake ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>
            {intakeSaved && (
              <div style={{
                background: "#F0FDF4", border: "1px solid #86EFAC", color: "#15803D",
                padding: "7px 11px", borderRadius: "8px",
                fontSize: "12px", fontWeight: 600, marginBottom: "12px",
              }}>
                ✓ Saved. Audit log entry created.
              </div>
            )}
            {!editingIntake && prefs.length === 0 ? (
              <p style={{ color: C.gray, fontSize: "14px" }}>No preferences recorded</p>
            ) : !editingIntake ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {prefs.map((p, i) => (
                  <div key={i} style={{ padding: "10px 12px", background: C.beige, borderRadius: "8px", border: "1px solid " + C.lightGray }}>
                    <p style={{ fontSize: "11px", color: C.gray, margin: "0 0 3px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>{p.icon} {p.label}</p>
                    <p style={{ fontSize: "14px", fontWeight: "600", color: C.darkGray, margin: 0, textTransform: "capitalize" }}>{p.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              // Edit mode: each preference becomes an inline input.
              // Layout: 2-column grid for compact display, full-width
              // for the textareas (med_note, client_notes).
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <p style={{ fontSize: "11px", color: C.gray, fontStyle: "italic", margin: "0 0 4px", lineHeight: 1.5 }}>
                  Changes are logged for audit. Per the client's signed waiver, edits are for accuracy only.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { key: "pressure", label: "💆 Pressure", type: "number", min: 1, max: 5 },
                    { key: "goal", label: "🎯 Goal", type: "select", options: ["relax", "pain", "stress", "recovery", "maintenance", "energy"] },
                    { key: "table_temp", label: "🌡️ Table Temp", type: "select", options: ["cool", "warm", "hot"] },
                    { key: "room_temp", label: "🏠 Room Temp", type: "select", options: ["cool", "comfortable", "warm"] },
                    { key: "music", label: "🎵 Music", type: "select", options: ["none", "soft", "nature", "instrumental"] },
                    { key: "lighting", label: "💡 Lighting", type: "select", options: ["dim", "candlelit", "bright"] },
                    { key: "conversation", label: "💬 Conversation", type: "select", options: ["silent", "quiet", "chatty"] },
                    { key: "draping", label: "🛏️ Draping", type: "select", options: ["standard", "secure", "minimal"] },
                    { key: "oil_pref", label: "🌿 Oil", type: "select", options: ["none", "unscented", "lavender", "eucalyptus", "peppermint"] },
                    { key: "med_flag", label: "🩺 Medical Flag", type: "select", options: ["none", "minor", "moderate", "major"] },
                  ].map(field => (
                    <div key={field.key} style={{ padding: "8px 10px", background: C.beige, borderRadius: "8px", border: "1px solid " + C.lightGray }}>
                      <label style={{ fontSize: "10px", color: C.gray, display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{field.label}</label>
                      {field.type === "number" ? (
                        <input
                          type="number"
                          min={field.min}
                          max={field.max}
                          value={intakeDraft[field.key] ?? ""}
                          onChange={e => setIntakeDraft(d => ({ ...d, [field.key]: e.target.value === "" ? null : parseInt(e.target.value, 10) }))}
                          style={{ width: "100%", padding: "4px 6px", border: "1px solid " + C.lightGray, borderRadius: "5px", fontSize: "13px", fontWeight: 600, fontFamily: "system-ui" }}
                        />
                      ) : (
                        <select
                          value={intakeDraft[field.key] ?? ""}
                          onChange={e => setIntakeDraft(d => ({ ...d, [field.key]: e.target.value || null }))}
                          style={{ width: "100%", padding: "4px 6px", border: "1px solid " + C.lightGray, borderRadius: "5px", fontSize: "13px", fontWeight: 600, fontFamily: "system-ui", background: "#fff" }}
                        >
                          <option value="">not set</option>
                          {field.options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
                {/* Long-form text fields full-width */}
                <div style={{ padding: "8px 10px", background: C.beige, borderRadius: "8px", border: "1px solid " + C.lightGray }}>
                  <label style={{ fontSize: "10px", color: C.gray, display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>🩺 Medical Note</label>
                  <textarea
                    value={intakeDraft.med_note ?? ""}
                    onChange={e => setIntakeDraft(d => ({ ...d, med_note: e.target.value || null }))}
                    rows={2}
                    style={{ width: "100%", padding: "5px 7px", border: "1px solid " + C.lightGray, borderRadius: "5px", fontSize: "13px", fontFamily: "system-ui", resize: "vertical" }}
                  />
                </div>
                <div style={{ padding: "8px 10px", background: C.beige, borderRadius: "8px", border: "1px solid " + C.lightGray }}>
                  <label style={{ fontSize: "10px", color: C.gray, display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>📝 Client Notes</label>
                  <textarea
                    value={intakeDraft.client_notes ?? ""}
                    onChange={e => setIntakeDraft(d => ({ ...d, client_notes: e.target.value || null }))}
                    rows={2}
                    style={{ width: "100%", padding: "5px 7px", border: "1px solid " + C.lightGray, borderRadius: "5px", fontSize: "13px", fontFamily: "system-ui", resize: "vertical" }}
                  />
                </div>
              </div>
            )}
          </div>

          {patterns.length > 0 && (
            <div style={{ background: "linear-gradient(135deg, " + C.forest + "08, " + C.sage + "12)", borderRadius: "14px", padding: "24px", border: "1px solid " + C.sage + "30" }}>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: "17px", fontWeight: "700", color: C.forest, marginBottom: "16px", letterSpacing: "-0.3px" }}>🔍 Client Patterns</h3>
              <p style={{ fontSize: "12px", color: C.gray, margin: "0 0 12px 0" }}>Based on {history.length} sessions</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {patterns.map((p, i) => (
                  <div key={i} style={{ background: p.urgent ? "#FEF2F2" : C.white, borderRadius: "10px", padding: "10px 14px", border: "1px solid " + (p.urgent ? "#EF4444" : C.sage + "25") }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: p.pct ? "8px" : "0" }}>
                      <span style={{ fontSize: "16px" }}>{p.icon}</span>
                      <span style={{ fontSize: "13px", color: p.urgent ? "#DC2626" : C.darkGray, fontWeight: p.urgent ? "700" : "600", flex: 1 }}>{p.text}</span>
                      {p.pct && (
                        <span style={{ fontSize: "12px", fontWeight: "800", color: p.type === "avoid" ? "#991B1B" : C.forest, background: p.type === "avoid" ? "rgba(239,68,68,0.1)" : "rgba(42,87,65,0.1)", padding: "2px 8px", borderRadius: "10px", whiteSpace: "nowrap" }}>
                          {p.count}/{p.total} · {p.pct}%
                        </span>
                      )}
                    </div>
                    {p.pct && (
                      <div style={{ height: "6px", background: C.lightGray, borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: p.pct + "%", background: p.type === "avoid" ? "linear-gradient(90deg, #EF4444, #DC2626)" : "linear-gradient(90deg, #6B9E80, #2A5741)", borderRadius: "3px", transition: "width 0.6s ease" }}/>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}



          {/* Care Summary */}
          {session.completed && (() => {
            const AREA_LABELS_LOCAL = {
              "f-head":"Head","f-neck":"Neck","f-l-shldr":"L Shoulder","f-r-shldr":"R Shoulder",
              "f-l-chest":"L Chest","f-r-chest":"R Chest","f-abdomen":"Abdomen",
              "f-l-arm-u":"L Upper Arm","f-r-arm-u":"R Upper Arm","f-l-forearm":"L Forearm",
              "f-r-forearm":"R Forearm","f-l-hand":"L Hand","f-r-hand":"R Hand",
              "f-l-hip":"L Hip","f-r-hip":"R Hip","f-l-thigh":"L Thigh","f-r-thigh":"R Thigh",
              "f-l-knee":"L Knee","f-r-knee":"R Knee","f-l-calf":"L Calf","f-r-calf":"R Calf",
              "f-l-foot":"L Foot","f-r-foot":"R Foot","b-head":"Back of Head","b-neck":"Back of Neck",
              "b-l-shldr":"L Shoulder Blade","b-r-shldr":"R Shoulder Blade","b-upper-bk":"Upper Back",
              "b-mid-bk":"Mid Back","b-lower-bk":"Lower Back","b-l-arm-u":"L Upper Arm",
              "b-r-arm-u":"R Upper Arm","b-l-forearm":"L Forearm","b-r-forearm":"R Forearm",
              "b-l-hand":"L Hand","b-r-hand":"R Hand","b-l-glute":"L Glute","b-r-glute":"R Glute",
              "b-l-hamstr":"L Hamstring","b-r-hamstr":"R Hamstring","b-l-knee":"L Knee",
              "b-r-knee":"R Knee","b-l-calf":"L Calf","b-r-calf":"R Calf",
              "b-l-foot":"L Foot","b-r-foot":"R Foot"
            };
            const an = k => AREA_LABELS_LOCAL[k] || k;
            const focusAreas = [...(session.front_focus||[]), ...(session.back_focus||[])].map(an);
            const avoidAreas = [...(session.front_avoid||[]), ...(session.back_avoid||[])].map(an);
            const summaryCode = session.feedback_code || session.id;
            const summaryUrl = window.location.origin + "/summary/" + summaryCode;

            const lines = [];
            if (focusAreas.length > 0) lines.push("Today's session focused on " + focusAreas.slice(0,3).join(", ") + (session.goal ? ", with a goal to " + session.goal : "") + ".");
            if (avoidAreas.length > 0) lines.push("Areas avoided: " + avoidAreas.slice(0,3).join(", ") + ".");
            if (session.pressure) lines.push("Pressure preference: Level " + session.pressure + "/5.");
            const summary = lines.join(" ");

            return null;
          })()}
        </div>

        <div style={{ background: C.white, borderRadius: "14px", padding: "24px", border: "1px solid " + C.lightGray, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "17px", fontWeight: "700", color: C.darkGray, margin: 0, letterSpacing: "-0.3px" }}>Body Map</h3>
            {heatmapData.count > 0 && (
              <button onClick={() => setShowHeatmap(v => !v)} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "7px 16px", borderRadius: "20px", border: "none", background: showHeatmap ? "linear-gradient(135deg, #2A5741, #3D7A5C)" : C.beige, color: showHeatmap ? C.white : C.gray, fontSize: "13px", fontWeight: "700", cursor: "pointer", boxShadow: showHeatmap ? "0 2px 8px rgba(42,87,65,0.35)" : "0 1px 3px rgba(0,0,0,0.1)", transition: "all 0.2s ease", fontFamily: "system-ui" }}>
                {showHeatmap ? "🔥" : "📊"} {showHeatmap ? "Heatmap ON" : "History"}
                <span style={{ background: showHeatmap ? "rgba(255,255,255,0.25)" : C.lightGray, borderRadius: "10px", padding: "2px 8px", fontSize: "11px", fontWeight: "800", color: showHeatmap ? C.white : C.forest }}>
                  {heatmapData.count}
                </span>
              </button>
            )}
          </div>

          {showHeatmap && (
            <div style={{ background: "linear-gradient(135deg, #2A574108, #6B9E8015)", border: "1px solid #6B9E8040", borderRadius: "8px", padding: "8px 12px", marginBottom: "12px", fontSize: "12px", color: C.forest, display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🔥</span>
              <span><strong>Pattern history</strong> - last {heatmapData.count} sessions. Badge = times marked.</span>
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
            {showHeatmap ? (
              <>
                <span style={{ fontSize: "12px", background: "rgba(42,87,65,0.1)", color: C.forest, padding: "4px 12px", borderRadius: "20px", fontWeight: "600" }}>🟢 Consistent focus</span>
                <span style={{ fontSize: "12px", background: "rgba(239,68,68,0.1)", color: "#991B1B", padding: "4px 12px", borderRadius: "20px", fontWeight: "600" }}>🔴 Consistent avoid</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: "12px", background: "rgba(107,158,128,0.15)", color: C.forest, padding: "4px 12px", borderRadius: "20px", fontWeight: "500" }}>🟢 Focus</span>
                <span style={{ fontSize: "12px", background: "rgba(239,68,68,0.1)", color: "#991B1B", padding: "4px 12px", borderRadius: "20px", fontWeight: "500" }}>🔴 Avoid</span>
              </>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "20px" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "11px", fontWeight: "600", color: C.gray, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Front</p>
              <BodySVG focusAreas={session.front_focus || []} avoidAreas={session.front_avoid || []} heatmapFocus={heatmapData.frontFocus} heatmapAvoid={heatmapData.frontAvoid} showHeatmap={showHeatmap} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "11px", fontWeight: "600", color: C.gray, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Back</p>
              <BodySVG focusAreas={session.back_focus || []} avoidAreas={session.back_avoid || []} heatmapFocus={heatmapData.backFocus} heatmapAvoid={heatmapData.backAvoid} showHeatmap={showHeatmap} />
            </div>
          </div>

          {!showHeatmap && [...(session.front_focus||[]), ...(session.front_avoid||[]), ...(session.back_focus||[]), ...(session.back_avoid||[])].length > 0 && (
            <div>
              <p style={{ fontSize: "12px", color: C.gray, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Areas</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {[...(session.front_focus||[]), ...(session.back_focus||[])].map((a, i) => (
                  <span key={"f"+i} style={{ background: "rgba(107,158,128,0.15)", color: C.forest, padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "500" }}>🟢 {AREA_LABELS[a] || a}</span>
                ))}
                {[...(session.front_avoid||[]), ...(session.back_avoid||[])].map((a, i) => (
                  <span key={"a"+i} style={{ background: "rgba(239,68,68,0.1)", color: "#991B1B", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "500" }}>🔴 {AREA_LABELS[a] || a}</span>
                ))}
              </div>
            </div>
          )}

          {showHeatmap && (
            <div>
              <p style={{ fontSize: "12px", color: C.gray, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Top recurring areas</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {Object.entries({ ...heatmapData.frontFocus, ...heatmapData.backFocus }).sort((a,b) => b[1].count - a[1].count).slice(0,5).map(([area, { count, total }]) => (
                  <span key={"hft-"+area} style={{ background: "rgba(42,87,65,0.1)", color: C.forest, padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", border: "1px solid " + C.sage + "40" }}>
                    🟢 {AREA_LABELS[area] || area} <span style={{ opacity: 0.7 }}>{count}/{total}</span>
                  </span>
                ))}
                {Object.entries({ ...heatmapData.frontAvoid, ...heatmapData.backAvoid }).sort((a,b) => b[1].count - a[1].count).slice(0,3).map(([area, { count, total }]) => {
                  if (heatmapData.frontFocus[area] || heatmapData.backFocus[area]) return null;
                  return (
                    <span key={"hat-"+area} style={{ background: "rgba(239,68,68,0.1)", color: "#991B1B", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", border: "1px solid rgba(239,68,68,0.25)" }}>
                      🔴 {AREA_LABELS[area] || area} <span style={{ opacity: 0.7 }}>{count}/{total}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SOAP Notes + Session Notes */}
      <div style={{ background: C.white, borderRadius: "14px", border: "1px solid " + C.lightGray, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginTop: "16px", overflow: "hidden" }}>
        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid " + C.lightGray }}>
          {[
            { id: "soap", label: "📋 SOAP Notes" },
            { id: "notes", label: "🔒 Private Notes" },
            { id: "client", label: "💌 Message to Client" },
          ].map(t => (
            <button key={t.id} onClick={() => setSoapTab(t.id)}
              style={{ flex: 1, padding: "12px 8px", border: "none", borderBottom: soapTab === t.id ? "2px solid " + C.forest : "2px solid transparent", background: "transparent", color: soapTab === t.id ? C.forest : C.gray, fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "system-ui", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: "20px 24px" }}>

          {/* SOAP Tab */}
          {soapTab === "soap" && (
            <div>
              <p style={{ fontSize: "12px", color: C.gray, marginBottom: "16px" }}>Structured clinical notes. S, O, A, and P are private clinical fields. Note to Client and Aftercare are sent to the client in their post-session summary.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }} className="bm-session-grid">
                {[
                  { key: "S", label: "S, Subjective", hint: "What the client reports: pain level, area, sensation, changes since last visit..." },
                  { key: "O", label: "O, Objective", hint: "What you observe and measure: tissue quality, ROM, postural findings..." },
                  { key: "A", label: "A, Assessment", hint: "Your clinical interpretation: patterns, progress, response to treatment..." },
                  { key: "P", label: "P, Plan", hint: "Next steps: techniques to use, areas to focus, frequency, referrals..." },
                ].map(({ key, label, hint }) => (
                  <div key={key}>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: C.darkGray, display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
                    <textarea
                      value={soap[key] || ""}
                      onChange={e => setSoap(s => ({ ...s, [key]: e.target.value }))}
                      placeholder={hint}
                      style={{ width: "100%", minHeight: "100px", padding: "10px 12px", border: "1.5px solid " + C.lightGray, borderRadius: "8px", fontSize: "13px", fontFamily: "system-ui", resize: "vertical", boxSizing: "border-box", background: C.beige, lineHeight: 1.6, outline: "none" }}
                    />
                  </div>
                ))}
              </div>

              {/* Fifth field: Note to Client. Saved to publicNotes column AND mirrored into soap.noteToClient. */}
              <div style={{ marginBottom: "20px", paddingTop: "16px", borderTop: "1px solid " + C.lightGray }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: C.darkGray, display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  💌 Note to Client
                  <span style={{ marginLeft: 8, fontWeight: 500, color: C.gray, textTransform: "none", letterSpacing: 0 }}>(appears in their summary, tap the mic on your keyboard to dictate)</span>
                </label>
                <textarea
                  value={publicNotes}
                  onChange={e => setPublicNotes(e.target.value)}
                  placeholder="A warm note for your client. Example: 'Loved having you today, your shoulder felt much looser by the end. Try a few minutes of the neck rolls we talked about this week.'"
                  style={{ width: "100%", minHeight: "90px", padding: "10px 12px", border: "1.5px solid " + C.lightGray, borderRadius: "8px", fontSize: "13px", fontFamily: "system-ui", resize: "vertical", boxSizing: "border-box", background: C.beige, lineHeight: 1.6, outline: "none" }}
                />
              </div>

              {/* Aftercare checklist. Saved into soap.aftercare and soap.aftercareCustom. */}
              <div style={{ marginBottom: "20px", paddingTop: "16px", borderTop: "1px solid " + C.lightGray }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: C.darkGray, display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  🌿 Aftercare for Client
                  <span style={{ marginLeft: 8, fontWeight: 500, color: C.gray, textTransform: "none", letterSpacing: 0 }}>(tap to include in their summary)</span>
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }} className="bm-session-grid">
                  {AFTERCARE_PRESETS.map(item => {
                    const checked = (soap.aftercare || []).includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSoap(s => {
                          const cur = Array.isArray(s.aftercare) ? s.aftercare : [];
                          const next = cur.includes(item.id) ? cur.filter(x => x !== item.id) : [...cur, item.id];
                          return { ...s, aftercare: next };
                        })}
                        style={{
                          background: checked ? C.sage + "20" : C.beige,
                          border: "1.5px solid " + (checked ? C.sage : C.lightGray),
                          color: checked ? C.forest : C.darkGray,
                          padding: "10px 12px", borderRadius: "8px",
                          fontSize: "13px", fontWeight: checked ? 600 : 500,
                          cursor: "pointer", textAlign: "left",
                          fontFamily: "system-ui", display: "flex", gap: "8px", alignItems: "flex-start",
                          transition: "all 0.15s",
                        }}>
                        <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 4, border: "1.5px solid " + (checked ? C.sage : C.gray), background: checked ? C.sage : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, fontWeight: 700 }}>
                          {checked ? "✓" : ""}
                        </span>
                        <span style={{ flex: 1, lineHeight: 1.4 }}>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={soap.aftercareCustom || ""}
                  onChange={e => setSoap(s => ({ ...s, aftercareCustom: e.target.value }))}
                  placeholder="Anything specific to this client (optional, e.g. 'Ice the right hamstring for 10 minutes tonight')"
                  style={{ width: "100%", minHeight: "60px", padding: "10px 12px", border: "1.5px solid " + C.lightGray, borderRadius: "8px", fontSize: "13px", fontFamily: "system-ui", resize: "vertical", boxSizing: "border-box", background: C.beige, lineHeight: 1.6, outline: "none" }}
                />
              </div>

              {soap.legacy && (
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px", padding: "10px 14px", marginBottom: "12px", fontSize: "12px", color: "#92400E" }}>
                  Previous note: {soap.legacy}
                </div>
              )}
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={saveNotes} disabled={saving}
                  style={{ flex: 1, background: C.sage, color: C.white, border: "none", padding: "11px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "system-ui" }}>
                  {saving ? "Saving..." : saved ? "✓ Saved!" : "Save SOAP Notes"}
                </button>
                {!session.completed && (
                  <button onClick={markComplete} disabled={completing}
                    style={{ flex: 1, background: C.forest, color: C.white, border: "none", padding: "11px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "system-ui" }}>
                    {completing ? "..." : "✓ Mark Complete"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Private Notes Tab */}
          {soapTab === "notes" && (
            <div>
              <p style={{ fontSize: "12px", color: C.gray, marginBottom: "12px" }}>🔒 Private, only visible to you, never shared with clients.</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Your private session notes..."
                style={{ width: "100%", minHeight: "160px", padding: "12px", border: "1.5px solid " + C.lightGray, borderRadius: "8px", fontSize: "14px", fontFamily: "Georgia, serif", resize: "vertical", boxSizing: "border-box", background: C.beige, lineHeight: 1.6 }}
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
          )}

          {/* Message to Client Tab */}
          {soapTab === "client" && (
            <div>
              <p style={{ fontSize: "12px", color: C.gray, marginBottom: "12px" }}>💌 Appears on the Post-Session Brief you share with your client.</p>
              <textarea value={publicNotes} onChange={e => setPublicNotes(e.target.value)} placeholder="Optional - write a personal note for your client (e.g. stretches to try, what improved)..."
                style={{ width: "100%", minHeight: "160px", padding: "12px", border: "1.5px solid " + C.lightGray, borderRadius: "8px", fontSize: "14px", fontFamily: "Georgia, serif", resize: "vertical", boxSizing: "border-box", background: C.beige, lineHeight: 1.6 }}
              />
              <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                <button onClick={saveNotes} disabled={saving} style={{ flex: 1, background: C.sage, color: C.white, border: "none", padding: "11px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "system-ui" }}>
                  {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Message"}
                </button>
                {!session.completed && (
                  <button onClick={markComplete} disabled={completing} style={{ flex: 1, background: C.forest, color: C.white, border: "none", padding: "11px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "system-ui" }}>
                    {completing ? "..." : "✓ Mark Complete"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ background:C.white, borderRadius:"14px", padding:"24px", border:"1px solid #E8E4DC", boxShadow:"0 1px 4px rgba(0,0,0,0.05)", marginTop:"16px" }}>
        <h3 style={{ fontFamily:"Georgia, serif", fontSize:"17px", fontWeight:"700", color:C.darkGray, marginBottom:"16px" }}>💬 Client Feedback</h3>
        {feedback ? (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"12px" }}>
              {[
                { label:"Pressure", value: feedback.pressure_rating ? feedback.pressure_rating.replace(/_/g," ") : null },
                { label:"Focus Areas", value: feedback.focus_rating },
                { label:"Overall", value: feedback.overall_rating ? feedback.overall_rating + "/5 ⭐" : null },
                { label:"Communication", value: feedback.communication_rating },
                { label:"Return", value: feedback.return_likelihood },
              ].filter(f => f.value).map((f, i) => (
                <div key={i} style={{ background:C.beige, borderRadius:"10px", padding:"10px 12px" }}>
                  <p style={{ fontSize:"10px", fontWeight:"700", color:C.gray, textTransform:"uppercase", margin:"0 0 3px 0" }}>{f.label}</p>
                  <p style={{ fontSize:"14px", fontWeight:"600", color:C.darkGray, margin:0, textTransform:"capitalize" }}>{f.value}</p>
                </div>
              ))}
            </div>
            {feedback.client_comment && (
              <div style={{ background:"#FFFBEB", borderRadius:"10px", padding:"12px 14px", border:"1px solid #D97706" }}>
                <p style={{ fontSize:"11px", fontWeight:"700", color:"#D97706", margin:"0 0 4px 0" }}>📝 CLIENT COMMENT</p>
                <p style={{ fontSize:"13px", color:C.darkGray, margin:0, fontStyle:"italic" }}>"{feedback.client_comment}"</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p style={{ fontSize:"13px", color:C.gray, marginBottom:"14px" }}>No feedback yet. Send this link to your client after the session.</p>
            {feedbackLink && (
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <div style={{ flex:1, background:C.beige, borderRadius:"8px", padding:"10px 12px", fontSize:"12px", color:C.gray, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{feedbackLink}</div>
                <button onClick={copyLink} style={{ background:"#2A5741", color:"#fff", border:"none", padding:"10px 16px", borderRadius:"8px", fontSize:"12px", fontWeight:"700", cursor:"pointer", whiteSpace:"nowrap" }}>
                  {linkCopied ? "✓ Copied!" : "Copy Link"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{"@media print { header, nav, button, .no-print { display: none !important; } body { background: white !important; font-size: 11px !important; } * { box-shadow: none !important; } h2 { font-size: 16px !important; } h3 { font-size: 13px !important; } svg { width: 100px !important; height: 160px !important; } }"}</style>
    </div>
  );
}
