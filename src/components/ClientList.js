// src/components/ClientList.js
import React, { useState, useEffect } from "react";
import { db } from "../lib/supabase";

const C = {
  sage: "#6B9E80", forest: "#2A5741", beige: "#F5F0E8",
  darkGray: "#1A1A2E", gray: "#6B7280", lightGray: "#E8E4DC",
  white: "#FFFFFF", gold: "#C9A84C"
};

export default function ClientList({ therapistId, onSelectClient }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

  const filtered = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const initials = (name) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2) : "?";
  const avatarColor = (name) => {
    const colors = ["#6B9E80","#2A5741","#C9A84C","#7C8DB5","#B57C8D"];
    const i = (name?.charCodeAt(0) || 0) % colors.length;
    return colors[i];
  };

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "28px" }}>
        <div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "28px", fontWeight: "700", color: C.darkGray, margin: "0 0 4px 0", letterSpacing: "-0.5px" }}>
            Your Clients
          </h2>
          <p style={{ fontSize: "14px", color: C.gray, margin: 0 }}>{clients.length} client{clients.length !== 1 ? "s" : ""} total</p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search clients..."
          style={{ padding: "10px 16px", border: `1.5px solid ${C.lightGray}`, borderRadius: "8px", fontSize: "14px", width: "220px", outline: "none", fontFamily: "system-ui", background: C.beige }}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.gray }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>👤</div>
          <p style={{ fontFamily: "Georgia, serif", fontSize: "18px", color: C.darkGray, marginBottom: "8px" }}>No clients yet</p>
          <p style={{ fontSize: "14px", color: C.gray }}>Share your intake link to get started</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {filtered.map(client => (
            <ClientCard key={client.id} client={client} onSelect={onSelectClient} initials={initials} avatarColor={avatarColor} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClientCard({ client, onSelect, initials, avatarColor }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onSelect(client)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.white, borderRadius: "14px", padding: "20px",
        border: `1.5px solid ${hovered ? C.sage : C.lightGray}`,
        cursor: "pointer", transition: "all 0.2s ease",
        boxShadow: hovered ? "0 8px 24px rgba(42,87,65,0.12)" : "0 1px 4px rgba(0,0,0,0.06)",
        transform: hovered ? "translateY(-2px)" : "none"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "14px" }}>
        <div style={{
          width: "44px", height: "44px", borderRadius: "50%",
          background: avatarColor(client.name), color: C.white,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "16px", fontWeight: "700", fontFamily: "Georgia, serif", flexShrink: 0
        }}>
          {initials(client.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "16px", fontWeight: "700", color: C.darkGray, margin: "0 0 2px 0", fontFamily: "Georgia, serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {client.name}
          </p>
          <p style={{ fontSize: "13px", color: C.gray, margin: 0 }}>{client.phone || "—"}</p>
        </div>
        <span style={{ color: hovered ? C.sage : C.lightGray, fontSize: "20px", transition: "color 0.2s" }}>›</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "12px", borderTop: `1px solid ${C.lightGray}` }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "18px", fontWeight: "700", color: C.forest, margin: "0 0 2px 0" }}>{client.total_sessions || 0}</p>
          <p style={{ fontSize: "11px", color: C.gray, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Sessions</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "18px", fontWeight: "700", color: C.gold, margin: "0 0 2px 0" }}>{client.loyalty_points || 0}</p>
          <p style={{ fontSize: "11px", color: C.gray, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Points</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "13px", fontWeight: "600", color: C.darkGray, margin: "0 0 2px 0" }}>
            {new Date(client.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </p>
          <p style={{ fontSize: "11px", color: C.gray, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Member</p>
        </div>
      </div>
    </div>
  );
}
