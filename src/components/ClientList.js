// src/components/ClientList.js
import React, { useState, useEffect } from "react";
import { db } from "../lib/supabase";

const C = {
  sage: "#6B9E80", forest: "#2A5741", beige: "#F5F0E8",
  darkGray: "#1A1A2E", gray: "#6B7280", lightGray: "#E8E4DC",
  white: "#FFFFFF", gold: "#C9A84C", red: "#EF4444"
};

const FREE_LIMIT = 5;

function getStatus(client) {
  const days = client.days_since_visit;
  if (days === null) return { label: "New", color: "#7C8DB5", bg: "#EEF0F8", icon: "🆕" };
  if (days <= 30) return { label: "Active", color: "#2A5741", bg: "#E8F5EE", icon: "🟢" };
  if (client.total_sessions >= 3 && days <= 60) return { label: "Regular", color: "#C9A84C", bg: "#FDF8EC", icon: "⭐" };
  if (days > 90) return { label: "Inactive", color: "#9CA3AF", bg: "#F3F4F6", icon: "💤" };
  return { label: "Active", color: "#2A5741", bg: "#E8F5EE", icon: "🟢" };
}

export default function ClientList({ therapistId, onSelectClient, plan = "free" }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const isPaid = plan === "pro" || plan === "clinic";

  useEffect(() => {
    if (therapistId) loadClients();
  }, [therapistId]);

  async function loadClients() {
    setLoading(true);
    try {
      const data = await db.getTherapistClients(therapistId);
      setClients(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const initials = (name) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2) : "?";
  const avatarColor = (name) => {
    const colors = ["#6B9E80","#2A5741","#C9A84C","#7C8DB5","#B57C8D"];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  };

  // Today's focus: clients with pending sessions
  const todayFocus = clients.filter(c => c.has_pending);

  // All clients sorted: active first, then by last visit
  const sortedClients = [...clients].sort((a, b) => {
    if (a.has_pending && !b.has_pending) return -1;
    if (!a.has_pending && b.has_pending) return 1;
    if (a.days_since_visit === null) return 1;
    if (b.days_since_visit === null) return -1;
    return a.days_since_visit - b.days_since_visit;
  });

  const filterFns = {
    all: () => true,
    active: c => c.days_since_visit !== null && c.days_since_visit <= 30,
    regular: c => c.total_sessions >= 3,
    new: c => c.days_since_visit === null || c.total_sessions === 0,
    inactive: c => c.days_since_visit !== null && c.days_since_visit > 90,
  };

  const filtered = sortedClients.filter(c =>
    (c.name?.toLowerCase().includes(search.toLowerCase()) ||
     c.phone?.includes(search) ||
     c.email?.toLowerCase().includes(search.toLowerCase())) &&
    filterFns[filter](c)
  );

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px", color: C.gray }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>🌿</div>
        <p style={{ fontFamily: "Georgia, serif", fontSize: "16px", color: C.gray }}>Loading clients...</p>
      </div>
    </div>
  );

  return (
    <div>
      {/* Upgrade banner */}
      {!isPaid && clients.length > FREE_LIMIT && (
        <div style={{ background: "linear-gradient(135deg, #2A5741, #4A8B6B)", borderRadius: "14px", padding: "18px 24px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <p style={{ fontFamily: "Georgia, serif", fontSize: "15px", fontWeight: "700", color: "#fff", margin: "0 0 3px 0" }}>🎉 Your practice is growing!</p>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", margin: 0 }}>You have {clients.length} clients — upgrade to Pro for unlimited clients + AI session briefs.</p>
          </div>
          <button style={{ background: "#C9A84C", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "50px", fontWeight: "700", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" }}>
            Upgrade to Pro →
          </button>
        </div>
      )}

      {/* Zone 1: Today's Focus */}
      {todayFocus.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: "700", color: C.darkGray, margin: 0 }}>Today's Focus</h3>
            <span style={{ background: C.forest, color: "#fff", fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px" }}>{todayFocus.length} pending</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
            {todayFocus.map(client => (
              <ClientCard key={client.id} client={client} onSelect={onSelectClient} initials={initials} avatarColor={avatarColor} highlight />
            ))}
          </div>
        </div>
      )}

      {/* Zone 2: All Clients */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", fontWeight: "700", color: C.darkGray, margin: 0 }}>Your Clients</h2>
            <span style={{ fontSize: "14px", color: C.gray }}>{clients.length} total</span>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..."
            style={{ padding: "8px 14px", border: `1.5px solid ${C.lightGray}`, borderRadius: "8px", fontSize: "13px", width: "200px", outline: "none", background: C.beige }} />
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[["all","All"], ["active","🟢 Active"], ["regular","⭐ Regular"], ["new","🆕 New"], ["inactive","💤 Inactive"]].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{ padding: "6px 14px", borderRadius: "20px", border: `1.5px solid ${filter === key ? C.forest : C.lightGray}`,
                background: filter === key ? C.forest : C.white, color: filter === key ? "#fff" : C.gray,
                fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: C.gray }}>
            <p style={{ fontSize: "16px" }}>No clients found</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
            {filtered.map((client, idx) => {
              const isLocked = !isPaid && clients.indexOf(client) >= FREE_LIMIT;
              return isLocked
                ? <LockedClientCard key={client.id} client={client} initials={initials} avatarColor={avatarColor} />
                : <ClientCard key={client.id} client={client} onSelect={onSelectClient} initials={initials} avatarColor={avatarColor} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientCard({ client, onSelect, initials, avatarColor, highlight }) {
  const [hovered, setHovered] = useState(false);
  const status = getStatus(client);

  return (
    <div onClick={() => onSelect(client)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: C.white, borderRadius: "14px", padding: "16px 18px",
        border: `1.5px solid ${highlight ? C.forest : hovered ? C.sage : C.lightGray}`,
        cursor: "pointer", transition: "all 0.2s ease",
        boxShadow: hovered ? "0 8px 24px rgba(42,87,65,0.12)" : "0 1px 4px rgba(0,0,0,0.06)",
        transform: hovered ? "translateY(-2px)" : "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: avatarColor(client.name),
          color: C.white, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "15px", fontWeight: "700", flexShrink: 0 }}>
          {initials(client.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "15px", fontWeight: "700", color: C.darkGray, margin: "0 0 2px 0",
            fontFamily: "Georgia, serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {client.name}
          </p>
          <p style={{ fontSize: "12px", color: C.gray, margin: 0 }}>{client.phone || client.email || "—"}</p>
        </div>
        <span style={{ background: status.bg, color: status.color, fontSize: "11px", fontWeight: "700",
          padding: "3px 8px", borderRadius: "20px", whiteSpace: "nowrap" }}>
          {status.icon} {status.label}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "10px", borderTop: `1px solid ${C.lightGray}` }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "17px", fontWeight: "700", color: C.forest, margin: "0 0 1px 0" }}>{client.total_sessions || 0}</p>
          <p style={{ fontSize: "10px", color: C.gray, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Sessions</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "13px", fontWeight: "600", color: C.darkGray, margin: "0 0 1px 0" }}>
            {client.days_since_visit === null ? "First visit" : client.days_since_visit === 0 ? "Today" : `${client.days_since_visit}d ago`}
          </p>
          <p style={{ fontSize: "10px", color: C.gray, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Last Visit</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "13px", fontWeight: "600", color: C.darkGray, margin: "0 0 1px 0" }}>
            {new Date(client.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </p>
          <p style={{ fontSize: "10px", color: C.gray, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Member</p>
        </div>
      </div>
      {client.has_pending && (
        <div style={{ marginTop: 10, background: "#FEF3C7", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "#92400E" }}>
          ⏳ Pending review — tap to view session
        </div>
      )}
    </div>
  );
}

function LockedClientCard({ client, initials, avatarColor }) {
  return (
    <div style={{ background: "#F9F9F9", borderRadius: "14px", padding: "16px 18px",
      border: "1.5px dashed #D4C9B0", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(245,240,232,0.7)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, zIndex: 2 }}>
        <span style={{ fontSize: 20 }}>🔒</span>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#2A5741", margin: 0 }}>Upgrade to Pro to unlock</p>
      </div>
      <div style={{ filter: "blur(4px)", pointerEvents: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: avatarColor(client.name),
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "700" }}>
            {initials(client.name)}
          </div>
          <div>
            <p style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 2px 0" }}>{client.name}</p>
            <p style={{ fontSize: "12px", margin: 0 }}>{client.phone || "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
