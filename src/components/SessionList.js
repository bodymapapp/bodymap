// src/components/SessionList.js
import React, { useState, useEffect } from "react";
import { db, supabase } from "../lib/supabase";

const C = {
  sage: "#6B9E80", forest: "#2A5741", beige: "#F5F0E8",
  darkGray: "#1A1A2E", gray: "#6B7280", lightGray: "#E8E4DC",
  white: "#FFFFFF", gold: "#C9A84C"
};

export default function SessionList({ client, therapistId, onBack, onSelectSession }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (client?.id) loadSessions();
  }, [client?.id]);

  async function loadSessions() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sessions").select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });
      if (!error) setSessions(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px" }}>
        <button onClick={onBack} style={{ background: "transparent", border: `1.5px solid ${C.lightGray}`, color: C.gray, padding: "8px 16px", borderRadius: "8px", fontSize: "14px", cursor: "pointer", fontFamily: "system-ui" }}>
          ← All Clients
        </button>
        <div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "28px", fontWeight: "700", color: C.darkGray, margin: "0 0 2px 0", letterSpacing: "-0.5px" }}>
            {client.name}
          </h2>
          <p style={{ fontSize: "14px", color: C.gray, margin: 0 }}>{sessions.length} session{sessions.length !== 1 ? "s" : ""} on record</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Total Sessions", value: sessions.length, color: C.forest },
          { label: "Completed", value: sessions.filter(s => s.completed).length, color: C.sage },
          { label: "Pending", value: sessions.filter(s => !s.completed).length, color: C.gold },
        ].map((stat, i) => (
          <div key={i} style={{ background: C.white, borderRadius: "12px", padding: "16px", border: `1px solid ${C.lightGray}`, textAlign: "center" }}>
            <p style={{ fontSize: "24px", fontWeight: "700", color: stat.color, margin: "0 0 4px 0" }}>{stat.value}</p>
            <p style={{ fontSize: "12px", color: C.gray, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: C.gray }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🌿</div>
          <p style={{ fontFamily: "Georgia, serif" }}>Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: C.gray }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
          <p style={{ fontFamily: "Georgia, serif", fontSize: "18px", color: C.darkGray }}>No sessions yet</p>
          <p style={{ fontSize: "14px" }}>Sessions appear here after the client submits their intake form</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {sessions.map(session => (
            <SessionRow key={session.id} session={session} onSelect={onSelectSession} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({ session, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const focusCount = (session.front_focus?.length || 0) + (session.back_focus?.length || 0);
  const avoidCount = (session.front_avoid?.length || 0) + (session.back_avoid?.length || 0);

  return (
    <div
      onClick={() => onSelect(session)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.white, borderRadius: "12px", padding: "16px 20px",
        border: `1.5px solid ${hovered ? "#6B9E80" : C.lightGray}`,
        cursor: "pointer", transition: "all 0.15s ease",
        boxShadow: hovered ? "0 4px 16px rgba(42,87,65,0.1)" : "0 1px 3px rgba(0,0,0,0.04)",
        display: "flex", alignItems: "center", gap: "16px"
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: "15px", fontWeight: "600", color: "#1A1A2E", margin: "0 0 4px 0", fontFamily: "Georgia, serif" }}>
          {new Date(session.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
        <div style={{ display: "flex", gap: "12px" }}>
          {session.goal && <span style={{ fontSize: "13px", color: "#6B7280" }}>Goal: <strong>{session.goal}</strong></span>}
          {session.pressure && <span style={{ fontSize: "13px", color: "#6B7280" }}>Pressure: <strong>{session.pressure}/5</strong></span>}
          {focusCount > 0 && <span style={{ fontSize: "13px", color: "#6B9E80" }}>🟢 {focusCount} focus</span>}
          {avoidCount > 0 && <span style={{ fontSize: "13px", color: "#EF4444" }}>🔴 {avoidCount} avoid</span>}
        </div>
      </div>
      <span style={{
        background: session.completed ? "#D1FAE5" : "#FEF3C7",
        color: session.completed ? "#065F46" : "#92400E",
        padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap"
      }}>
        {session.completed ? "✓ Done" : "⏳ Pending"}
      </span>
      <span style={{ color: hovered ? "#6B9E80" : "#E8E4DC", fontSize: "20px", transition: "color 0.15s" }}>›</span>
    </div>
  );
}
