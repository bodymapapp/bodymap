// src/pages/CareSummary.js
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

const C = {
  sage: "#6B9E80", forest: "#2A5741", beige: "#F5F0E8",
  darkGray: "#1A1A2E", gray: "#6B7280", lightGray: "#E8E4DC",
  white: "#FFFFFF"
};

const AREA_LABELS = {
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

function areaName(key) { return AREA_LABELS[key] || key; }

function generateSummary(session, allSessions, clientName) {
  const firstName = clientName ? clientName.split(" ")[0] : "Your client";
  const focusAreas = [...(session.front_focus||[]), ...(session.back_focus||[])].map(areaName);
  const avoidAreas = [...(session.front_avoid||[]), ...(session.back_avoid||[])].map(areaName);
  const pressure = session.pressure;
  const goal = session.goal;
  const sessionCount = allSessions.length;

  // Build avoid pattern from history
  const avoidCounts = {};
  allSessions.forEach(s => {
    [...(s.front_avoid||[]), ...(s.back_avoid||[])].forEach(a => {
      avoidCounts[areaName(a)] = (avoidCounts[areaName(a)] || 0) + 1;
    });
  });
  const consistentAvoids = Object.entries(avoidCounts)
    .filter(([,count]) => count >= 2)
    .sort((a,b) => b[1]-a[1])
    .slice(0,2)
    .map(([name]) => name);

  // Build pressure trend
  const pressures = allSessions.filter(s => s.pressure).map(s => s.pressure);
  const avgPressure = pressures.length ? Math.round(pressures.reduce((a,b)=>a+b,0)/pressures.length) : null;

  const lines = [];

  // Sentence 1: Today's focus
  if (focusAreas.length > 0) {
    const areaList = focusAreas.slice(0,3).join(", ");
    lines.push(`Today's session focused on ${areaList}${goal ? `, with a goal to ${goal}` : ""}.`);
  } else {
    lines.push(`Thank you for your session today${goal ? ` — goal was to ${goal}` : ""}.`);
  }

  // Sentence 2: Avoid pattern or today's avoids
  if (consistentAvoids.length > 0 && sessionCount > 1) {
    lines.push(`${firstName} consistently avoids ${consistentAvoids.join(" and ")} — noted and respected across ${sessionCount} sessions.`);
  } else if (avoidAreas.length > 0) {
    lines.push(`Areas avoided today: ${avoidAreas.slice(0,3).join(", ")}.`);
  }

  // Sentence 3: Pressure preference
  if (pressure) {
    if (avgPressure && sessionCount > 1) {
      lines.push(`Pressure preference: Level ${pressure}/5 — consistent with your average of ${avgPressure}/5 across ${sessionCount} sessions.`);
    } else {
      lines.push(`Pressure preference recorded: Level ${pressure}/5.`);
    }
  }

  return lines.join(" ");
}

export default function CareSummary() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        // Find session by feedback_code or id
        const { data: session } = await supabase
          .from("sessions")
          .select("*")
          .or(`feedback_code.eq.${code},id.eq.${code}`)
          .maybeSingle();

        if (!session) { setError("Summary not found."); setLoading(false); return; }

        // Get client name
        const { data: client } = await supabase
          .from("clients")
          .select("name")
          .eq("id", session.client_id)
          .maybeSingle();

        // Get therapist name
        const { data: therapist } = await supabase
          .from("therapists")
          .select("name, business_name")
          .eq("id", session.therapist_id)
          .maybeSingle();

        // Get all sessions for pattern context
        const { data: allSessions } = await supabase
          .from("sessions")
          .select("*")
          .eq("client_id", session.client_id)
          .eq("completed", true)
          .order("created_at", { ascending: false })
          .limit(10);

        const summary = generateSummary(session, allSessions || [session], client?.name);
        setData({ session, client, therapist, summary, allSessions: allSessions || [] });
      } catch(e) {
        setError("Could not load summary.");
      }
      setLoading(false);
    }
    load();
  }, [code]);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:C.beige, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <p style={{ color:C.gray, fontFamily:"Georgia, serif", fontSize:"18px" }}>Loading your care summary...</p>
    </div>
  );

  if (error) return (
    <div style={{ minHeight:"100vh", background:C.beige, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <p style={{ color:C.gray }}>{error}</p>
    </div>
  );

  const { session, client, therapist, summary, allSessions } = data;
  const focusAreas = [...(session.front_focus||[]), ...(session.back_focus||[])].map(areaName);
  const avoidAreas = [...(session.front_avoid||[]), ...(session.back_avoid||[])].map(areaName);
  const therapistName = therapist?.business_name || therapist?.name || "Your Therapist";
  const sessionDate = new Date(session.created_at).toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });

  return (
    <div style={{ minHeight:"100vh", background:C.beige, fontFamily:"system-ui, sans-serif", padding:"0 0 60px 0" }}>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg, ${C.sage}, ${C.forest})`, padding:"32px 24px", textAlign:"center", color:"white" }}>
        <div style={{ fontSize:"32px", marginBottom:"8px" }}>🌿</div>
        <h1 style={{ fontFamily:"Georgia, serif", fontSize:"24px", fontWeight:"700", margin:"0 0 4px 0" }}>Care Summary</h1>
        <p style={{ fontSize:"14px", opacity:0.85, margin:0 }}>{therapistName}</p>
      </div>

      <div style={{ maxWidth:"560px", margin:"0 auto", padding:"24px 16px" }}>

        {/* Client + Date */}
        <div style={{ background:C.white, borderRadius:"16px", padding:"20px 24px", marginBottom:"16px", border:"1px solid "+C.lightGray }}>
          <p style={{ fontSize:"13px", color:C.gray, margin:"0 0 4px 0", textTransform:"uppercase", letterSpacing:"0.5px" }}>Session for</p>
          <h2 style={{ fontFamily:"Georgia, serif", fontSize:"22px", fontWeight:"700", color:C.darkGray, margin:"0 0 4px 0" }}>{client?.name || "Client"}</h2>
          <p style={{ fontSize:"14px", color:C.gray, margin:0 }}>{sessionDate}</p>
        </div>

        {/* AI Summary */}
        <div style={{ background:`linear-gradient(135deg, ${C.forest}08, ${C.sage}15)`, borderRadius:"16px", padding:"20px 24px", marginBottom:"16px", border:`1px solid ${C.sage}30` }}>
          <p style={{ fontSize:"12px", fontWeight:"700", color:C.forest, margin:"0 0 10px 0", textTransform:"uppercase", letterSpacing:"0.5px" }}>📋 Session Notes</p>
          <p style={{ fontSize:"16px", color:C.darkGray, lineHeight:"1.7", margin:0, fontFamily:"Georgia, serif" }}>{summary}</p>
        </div>

        {/* Focus Areas */}
        {focusAreas.length > 0 && (
          <div style={{ background:C.white, borderRadius:"16px", padding:"20px 24px", marginBottom:"16px", border:"1px solid "+C.lightGray }}>
            <p style={{ fontSize:"12px", fontWeight:"700", color:C.forest, margin:"0 0 12px 0", textTransform:"uppercase", letterSpacing:"0.5px" }}>🟢 Focus Areas Today</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
              {focusAreas.map((a,i) => (
                <span key={i} style={{ background:"rgba(107,158,128,0.15)", color:C.forest, padding:"6px 14px", borderRadius:"20px", fontSize:"13px", fontWeight:"600" }}>{a}</span>
              ))}
            </div>
          </div>
        )}

        {/* Avoid Areas */}
        {avoidAreas.length > 0 && (
          <div style={{ background:C.white, borderRadius:"16px", padding:"20px 24px", marginBottom:"16px", border:"1px solid "+C.lightGray }}>
            <p style={{ fontSize:"12px", fontWeight:"700", color:"#991B1B", margin:"0 0 12px 0", textTransform:"uppercase", letterSpacing:"0.5px" }}>🔴 Avoided Areas</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
              {avoidAreas.map((a,i) => (
                <span key={i} style={{ background:"rgba(239,68,68,0.1)", color:"#991B1B", padding:"6px 14px", borderRadius:"20px", fontSize:"13px", fontWeight:"600" }}>{a}</span>
              ))}
            </div>
          </div>
        )}

        {/* Preferences */}
        {(session.pressure || session.goal) && (
          <div style={{ background:C.white, borderRadius:"16px", padding:"20px 24px", marginBottom:"16px", border:"1px solid "+C.lightGray }}>
            <p style={{ fontSize:"12px", fontWeight:"700", color:C.gray, margin:"0 0 12px 0", textTransform:"uppercase", letterSpacing:"0.5px" }}>Your Preferences</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
              {session.pressure && (
                <div style={{ background:C.beige, borderRadius:"10px", padding:"12px" }}>
                  <p style={{ fontSize:"11px", color:C.gray, margin:"0 0 3px 0", textTransform:"uppercase" }}>Pressure</p>
                  <p style={{ fontSize:"16px", fontWeight:"700", color:C.darkGray, margin:0 }}>Level {session.pressure}/5</p>
                </div>
              )}
              {session.goal && (
                <div style={{ background:C.beige, borderRadius:"10px", padding:"12px" }}>
                  <p style={{ fontSize:"11px", color:C.gray, margin:"0 0 3px 0", textTransform:"uppercase" }}>Goal</p>
                  <p style={{ fontSize:"16px", fontWeight:"700", color:C.darkGray, margin:0, textTransform:"capitalize" }}>{session.goal}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sessions count */}
        {allSessions.length > 1 && (
          <div style={{ background:C.white, borderRadius:"16px", padding:"16px 24px", marginBottom:"24px", border:"1px solid "+C.lightGray, textAlign:"center" }}>
            <p style={{ fontSize:"13px", color:C.gray, margin:0 }}>
              🌿 <strong>{allSessions.length} sessions</strong> on record with {therapistName}
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign:"center" }}>
          <p style={{ fontSize:"12px", color:C.gray, margin:"0 0 8px 0" }}>Powered by</p>
          <a href="https://www.mybodymap.app" style={{ fontFamily:"Georgia, serif", fontSize:"16px", fontWeight:"700", color:C.forest, textDecoration:"none" }}>🌿 BodyMap</a>
          <p style={{ fontSize:"11px", color:C.gray, margin:"8px 0 0 0" }}>Professional intake & pattern intelligence for massage therapists</p>
        </div>
      </div>
    </div>
  );
}
