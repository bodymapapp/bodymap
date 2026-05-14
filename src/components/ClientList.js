// src/components/ClientList.js
import React, { useState, useEffect } from "react";
import { db } from "../lib/supabase";
import AddClientModal from "./AddClientModal";
import SampleClientPreview from "./SampleClientPreview";

const C = {
  sage: "#6B9E80", forest: "#2A5741", beige: "#F5F0E8",
  darkGray: "#1A1A2E", gray: "#6B7280", lightGray: "#E8E4DC",
  white: "#FFFFFF", gold: "#C9A84C", red: "#EF4444"
};

const FREE_LIMIT = 5;

function getStatus(client, lapsedDays = 60) {
  if (client.do_not_rebook) return { label: "Archived", color: "#991B1B", bg: "#FEE2E2", icon: "⛔" };
  const days = client.days_since_visit;
  if (days === null || client.total_sessions === 0) return { label: "New", color: "#7C3AED", bg: "#F5F3FF", icon: "🌸" };
  if (days > lapsedDays) return { label: "Lapsed", color: "#92400E", bg: "#FEF3C7", icon: "🍂" };
  return { label: "Active", color: "#2A5741", bg: "#E8F5EE", icon: "🌱" };
}

export default function ClientList({ therapistId, therapist, onSelectClient, plan = "free", lapsedDays = 60, customUrl = "" }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [justAddedToast, setJustAddedToast] = useState("");
  const [nudgeDismissed, setNudgeDismissed] = React.useState(false);
  const [previewSample, setPreviewSample] = React.useState(null);
  const isPaid = true; // All clients visible on all tiers - only pattern depth is tier-limited

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

  // Today's focus: clients with pending sessions (exclude archived)
  const todayFocus = clients.filter(c => c.has_pending && !c.do_not_rebook);

  // All clients sorted: active first, then by last visit
  const sortedClients = [...clients].sort((a, b) => {
    if (a.do_not_rebook && !b.do_not_rebook) return 1;
    if (!a.do_not_rebook && b.do_not_rebook) return -1;
    if (a.has_pending && !b.has_pending) return -1;
    if (!a.has_pending && b.has_pending) return 1;
    if (a.days_since_visit === null) return 1;
    if (b.days_since_visit === null) return -1;
    return a.days_since_visit - b.days_since_visit;
  });

  const filterFns = {
    all: c => !c.do_not_rebook,
    active: c => !c.do_not_rebook && c.days_since_visit !== null && c.days_since_visit <= lapsedDays,
    lapsed: c => !c.do_not_rebook && c.days_since_visit !== null && c.days_since_visit > lapsedDays,
    new: c => !c.do_not_rebook && (c.days_since_visit === null || c.total_sessions === 0),
    archived: c => c.do_not_rebook === true,
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
        <p style={{ fontFamily: "Georgia, serif", fontSize: "16px", color: C.gray }}>Your first client is one link away 🌿</p>
      </div>
    </div>
  );

  const lapsedClients = clients.filter(c => !c.do_not_rebook && c.days_since_visit !== null && c.days_since_visit > lapsedDays).sort((a,b) => b.days_since_visit - a.days_since_visit);

  return (
    <div>
      {/* Lapsed Client Nudge - MOVED TO BOTTOM */}
      {false && (
        <div style={{ background: "linear-gradient(135deg, #FEF3C7, #FFFBEB)", border: "1.5px solid #D97706", borderRadius: "14px", padding: "16px 20px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: "700", color: "#92400E", margin: "0 0 2px 0" }}>🍂 {lapsedClients.length} client{lapsedClients.length > 1 ? "s" : ""} haven't visited in {lapsedDays}+ days</p>
              <p style={{ fontSize: "12px", color: "#B45309", margin: 0 }}>Tap to send a quick check-in message</p>
            </div>
            <button onClick={() => setNudgeDismissed(true)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#B45309", padding: "4px" }}>✕</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {lapsedClients.slice(0, 3).map(client => (
              <div key={client.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", borderRadius: "10px", padding: "10px 14px", border: "1px solid #FDE68A" }}>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: "600", color: "#1A1A2E", margin: "0 0 2px 0" }}>{client.name}</p>
                  <p style={{ fontSize: "12px", color: "#B45309", margin: 0 }}>{client.days_since_visit} days since last visit</p>
                </div>
                {client.phone ? (
                  <a href={"sms:" + client.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent("Hi " + client.name.split(" ")[0] + "! It's been a while - I'd love to see you back. Book your next session: " + window.location.origin + "/" + customUrl)}
                    style={{ background: "#D97706", color: "white", padding: "8px 16px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", textDecoration: "none", whiteSpace: "nowrap" }}>
                    💬 Send Check-in
                  </a>
                  ) : (
                  <span style={{ fontSize: "11px", color: "#B45309", fontStyle: "italic" }}>No phone on file</span>
                )}
              </div>
            ))}
            {lapsedClients.length > 3 && (
              <p style={{ fontSize: "12px", color: "#B45309", textAlign: "center", margin: "4px 0 0 0" }}>+ {lapsedClients.length - 3} more - filter by 🍂 Lapsed to see all</p>
            )}
          </div>
        </div>
      )}

      {/* Legend - top of dashboard */}
      <details open style={{ marginBottom: 20, background: "#F5F0E8", borderRadius: 12, padding: "14px 18px", cursor: "pointer" }}>
        <summary style={{ fontSize: 13, fontWeight: 700, color: C.forest, listStyle: "none", display: "flex", alignItems: "center", gap: 6, marginBottom: 0 }}>
          ❓ Quick Reference - Session States &amp; Client Categories
        </summary>
        <div className="bm-ref-grid" style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Session States - Left */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px 0" }}>Session States</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ background: "white", borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🧭</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#2A5741", margin: "0 0 1px 0" }}>Intake Done</p>
                  <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>Client filled form in last 48hrs - review now</p>
                </div>
              </div>
              <div style={{ background: "white", borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#065F46", margin: "0 0 1px 0" }}>Complete</p>
                  <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>Session reviewed and marked done</p>
                </div>
              </div>
              <div style={{ background: "white", borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔔</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#92400E", margin: "0 0 1px 0" }}>Pending Intake</p>
                  <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>Link sent, client hasn't filled form yet</p>
                </div>
              </div>
            </div>
          </div>
          {/* Client Categories - Right */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px 0" }}>Client Categories</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ background: "white", borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🌱</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#2A5741", margin: "0 0 1px 0" }}>Active</p>
                  <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>Visited in the last 60 days</p>
                </div>
              </div>
              <div style={{ background: "white", borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🍂</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#92400E", margin: "0 0 1px 0" }}>Lapsed</p>
                  <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>No visit in 60+ days - time to reach out</p>
                </div>
              </div>
              <div style={{ background: "white", borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🌸</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", margin: "0 0 1px 0" }}>New</p>
                  <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>No completed sessions yet</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </details>

      {/* Upgrade banner */}
      
      {/* Zone 1: Today's Focus */}
      {todayFocus.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "18px", fontWeight: "700", color: C.darkGray, margin: 0 }}>Today's Focus</h3>
            <span style={{ background: C.forest, color: "#fff", fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px" }}>🧭 {todayFocus.length} intake done</span>
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
            <span style={{ fontSize: "14px", color: C.gray }}>{clients.filter(c => !c.do_not_rebook).length} active</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: C.forest, color: "#fff", border: "none",
                padding: "8px 16px", borderRadius: 8, fontSize: 13,
                fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              }}
              title="Add an elderly or non-app client manually"
            >
              + Add client
            </button>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..."
              style={{ padding: "8px 14px", border: `1.5px solid ${C.lightGray}`, borderRadius: "8px", fontSize: "13px", width: "180px", outline: "none", background: C.beige }} />
          </div>
        </div>

        {/* Toast for just-added client */}
        {justAddedToast && (
          <div style={{ marginBottom: 14, padding: "10px 14px", background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 10, fontSize: 13, color: C.forest, fontWeight: 600 }}>
            ✓ {justAddedToast}
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[["all","All"], ["active","🌱 Active"], ["lapsed","🍂 Lapsed"], ["new","🌸 New"], ["archived","⛔ Archived"]].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{ padding: "6px 14px", borderRadius: "20px", border: `1.5px solid ${filter === key ? (key === "archived" ? "#991B1B" : C.forest) : C.lightGray}`,
                background: filter === key ? (key === "archived" ? "#991B1B" : C.forest) : C.white,
                color: filter === key ? "#fff" : key === "archived" ? "#991B1B" : C.gray,
                fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
              {label}{key === "archived" && clients.filter(c => c.do_not_rebook).length > 0 ? ` (${clients.filter(c => c.do_not_rebook).length})` : ""}
            </button>
          ))}
        </div>

        {clients.length === 0 ? (
          <div>
            {/* Preview banner, sets expectations that the cards below are a glimpse of the future */}
            <div style={{ background:'#FFF7ED', border:'1.5px dashed #F97316', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#9A3412', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:16 }}>👁️</span>
              <div><strong>A preview of your practice.</strong> These are sample clients. <strong>Tap any card</strong> to see what a populated profile looks like, with the full four-document session journey.</div>
            </div>

            {/* Retention insight card, the exact thing the Day 2 email points at */}
            <div style={{
              background: '#FEF9E7',
              border: '1.5px solid #F4C46C',
              borderRadius: 12,
              padding: '16px 18px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>🍂</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: '#92400E', marginBottom: 4 }}>
                  Retention insight · Sample
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1F2937', marginBottom: 4 }}>
                  1 client is drifting
                </div>
                <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.5, marginBottom: 8 }}>
                  Dana Park used to book every 4 weeks. She hasn't booked in 68 days. A short message from you is usually the one thing that brings someone like Dana back.
                </div>
                <div style={{ fontSize: 12, color: '#78350F', fontStyle: 'italic' }}>
                  Once you have real clients, MyBodyMap flags this for you automatically. No work on your end.
                </div>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
              {[
                { id:'s1', full_name:'Sarah Mitchell', focus:'Neck, Upper Back', sessions:7, status:'active', last:'2 days ago', initials:'SM', color:'#2A5741', interactive: true },
                { id:'s2', full_name:'Jennifer Kim',   focus:'Lower Back, Hip', sessions:4, status:'active', last:'5 days ago', initials:'JK', color:'#6B9E80', interactive: true },
                { id:'s3', full_name:'Maria Lopez',    focus:'Shoulders',       sessions:12,status:'active', last:'1 week ago',  initials:'ML', color:'#C9A84C', interactive: true },
                { id:'s4', full_name:'Rachel Torres',  focus:'Full Body',       sessions:2, status:'new',    last:'New client',  initials:'RT', color:'#9CA3AF' },
                { id:'s5', full_name:'Dana Park',      focus:'Neck, Shoulders', sessions:9, status:'lapsed', last:'68 days ago', initials:'DP', color:'#DC2626', highlight:true, interactive: true },
              ].map(c => (
                <SampleCard
                  key={c.id}
                  c={c}
                  onPreview={() => setPreviewSample(c)}
                />
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: C.gray }}>
            <p style={{ fontSize: "16px" }}>No clients found</p>
          </div>
        ) : (
          <>
            {/* Demo retention hint, shown only when therapist has clients but hasn't yet accumulated any lapsed ones.
                Gives them a preview of what retention insights will look like as their practice grows.
                Hidden once they have 10+ sessions across the practice (by then they'll see real retention signals). */}
            {filter === "all" && lapsedClients.length === 0 && clients.reduce((s, c) => s + (c.total_sessions || 0), 0) < 10 && (
              <div style={{
                background: '#FEF9E7',
                border: '1.5px dashed #F4C46C',
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}>
                <div style={{ fontSize: 18, lineHeight: 1 }}>🔭</div>
                <div style={{ flex: 1, fontSize: 13, color: '#78350F', lineHeight: 1.5 }}>
                  <strong style={{ color: '#1F2937' }}>Retention insights appear here as your practice grows.</strong> Once a client hasn't booked in 60 days, MyBodyMap flags them so you can send a short note. Most come back. No work on your end.
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
              {filtered.map((client) => (
                <ClientCard key={client.id} client={client} onSelect={onSelectClient} initials={initials} avatarColor={avatarColor} lapsedDays={lapsedDays} customUrl={customUrl} />
              ))}
            </div>
          </>
        )}
      </div>
      {/* Lapsed Client Nudge - bottom */}
      {!nudgeDismissed && lapsedClients.length > 0 && (
        <div style={{ background: "linear-gradient(135deg, #FEF3C7, #FFFBEB)", border: "1.5px solid #D97706", borderRadius: "14px", padding: "16px 20px", marginTop: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: "700", color: "#92400E", margin: "0 0 2px 0" }}>🍂 {lapsedClients.length} client{lapsedClients.length > 1 ? "s" : ""} haven't visited in {lapsedDays}+ days</p>
              <p style={{ fontSize: "12px", color: "#B45309", margin: 0 }}>Send a quick check-in to bring them back</p>
            </div>
            <button onClick={() => setNudgeDismissed(true)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#B45309", padding: "4px" }}>✕</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {lapsedClients.slice(0, 3).map(client => (
              <div key={client.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", borderRadius: "10px", padding: "10px 14px", border: "1px solid #FDE68A" }}>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: "600", color: "#1A1A2E", margin: "0 0 2px 0" }}>{client.name}</p>
                  <p style={{ fontSize: "12px", color: "#B45309", margin: 0 }}>{client.days_since_visit} days since last visit</p>
                </div>
                {client.phone ? (
                  <a href={"sms:" + client.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent("Hi " + client.name.split(" ")[0] + "! It's been a while - I'd love to see you back. Book your next session: " + window.location.origin + "/" + customUrl)}
                    style={{ background: "#D97706", color: "white", padding: "8px 16px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", textDecoration: "none", whiteSpace: "nowrap" }}>
                    💬 Send Check-in
                  </a>
                ) : (
                  <span style={{ fontSize: "11px", color: "#B45309", fontStyle: "italic" }}>No phone on file</span>
                )}
              </div>
            ))}
            {lapsedClients.length > 3 && (
              <p style={{ fontSize: "12px", color: "#B45309", textAlign: "center", margin: "4px 0 0 0" }}>+ {lapsedClients.length - 3} more - filter by 🍂 Lapsed to see all</p>
            )}
          </div>
        </div>
      )}

      {showAddModal && therapist && (
        <AddClientModal
          therapist={therapist}
          onClose={() => setShowAddModal(false)}
          onSaved={async (result) => {
            const parts = ["Added " + (result.client?.name || "client")];
            if (result.hadBooking) parts.push("session booked");
            if (result.hadIntake) parts.push("intake saved");
            setJustAddedToast(parts.join(", ") + ".");
            setTimeout(() => setJustAddedToast(""), 5000);
            await loadClients();
          }}
        />
      )}
      {previewSample && (
        <SampleClientPreview
          sampleClient={previewSample}
          onClose={() => setPreviewSample(null)}
        />
      )}
    </div>
  );
}

function formatIntakeDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function ClientCard({ client, onSelect, initials, avatarColor, highlight, lapsedDays = 60, customUrl = "" }) {
  const [hovered, setHovered] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const status = getStatus(client, lapsedDays);
  const isArchived = client.do_not_rebook;

  return (
    <div onClick={() => onSelect(client)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: isArchived ? "#FFF5F5" : C.white, borderRadius: "14px", padding: "16px 18px",
        border: isArchived ? "1.5px solid #FECACA" : `1.5px solid ${highlight ? C.forest : hovered ? C.sage : C.lightGray}`,
        borderLeft: isArchived ? "4px solid #DC2626" : undefined,
        cursor: "pointer", transition: "all 0.2s ease",
        boxShadow: hovered ? "0 8px 24px rgba(42,87,65,0.12)" : "0 1px 4px rgba(0,0,0,0.06)",
        transform: hovered ? "translateY(-2px)" : "none",
        opacity: isArchived ? 0.75 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "50%",
          background: isArchived ? "#9CA3AF" : avatarColor(client.name),
          color: C.white, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "15px", fontWeight: "700", flexShrink: 0 }}>
          {initials(client.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "15px", fontWeight: "700", color: isArchived ? "#6B7280" : C.darkGray, margin: "0 0 2px 0",
            fontFamily: "Georgia, serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {client.name}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <p style={{ fontSize: "12px", color: C.gray, margin: 0 }}>{client.phone || client.email || "-"}</p>
            {client.phone && !isArchived && (
              <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(client.phone); setCopiedPhone(true); setTimeout(() => setCopiedPhone(false), 2000); }}
                style={{ background: copiedPhone ? "#2A5741" : "#F3F4F6", border: "none", borderRadius: "4px", padding: "2px 6px", fontSize: "10px", fontWeight: "600", color: copiedPhone ? "white" : "#6B7280", cursor: "pointer", flexShrink: 0 }}>
                {copiedPhone ? "✓" : "📋"}
              </button>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {/* Active balance chip: shown when the client has an active
              package or membership. Surfaces the same info as the
              full Active Balance card on the client profile so the
              therapist sees it at-a-glance in the list view too.
              Package wins if both exist (rare). */}
          {client.active_package && (
            <span style={{
              background: '#FAF3DC', color: '#92660E',
              fontSize: "10.5px", fontWeight: "700",
              padding: "3px 8px", borderRadius: "20px",
              whiteSpace: "nowrap",
              border: '1px solid #E5D085',
            }}
            title={`${client.active_package.name}: ${client.active_package.remaining} of ${client.active_package.total} sessions remaining`}>
              🎟 {client.active_package.remaining}/{client.active_package.total} left
            </span>
          )}
          {!client.active_package && client.active_membership && (
            <span style={{
              background: '#F0FDF4', color: '#065F46',
              fontSize: "10.5px", fontWeight: "700",
              padding: "3px 8px", borderRadius: "20px",
              whiteSpace: "nowrap",
              border: '1px solid #86EFAC',
            }}
            title={`Active member: ${client.active_membership.name}`}>
              ✨ Member
            </span>
          )}
          <span style={{ background: status.bg, color: status.color, fontSize: "11px", fontWeight: "700",
            padding: "3px 8px", borderRadius: "20px", whiteSpace: "nowrap" }}>
            {status.icon} {status.label}
          </span>
          {status.label === "Lapsed" && client.phone && (
            <a href={"sms:" + client.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent("Hi " + client.name.split(" ")[0] + "! It's been a while - I'd love to see you back. Book your next session: " + window.location.origin + "/" + customUrl)}
              onClick={e => e.stopPropagation()}
              style={{ background: "#D97706", color: "white", width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", textDecoration: "none", flexShrink: 0 }}
              title="Send check-in SMS">
              💬
            </a>
          )}
        </div>
      </div>
      {isArchived && client.dnr_reason && (
        <div style={{ marginBottom: 10, background: "#FEE2E2", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#991B1B" }}>
          {client.dnr_reason}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "10px", borderTop: `1px solid ${C.lightGray}` }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "17px", fontWeight: "700", color: isArchived ? C.gray : C.forest, margin: "0 0 1px 0" }}>{client.total_sessions || 0}</p>
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
      {!isArchived && client.has_pending && (
        <div style={{ marginTop: 10, background: "#E8F5EE", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "#2A5741" }}>
          🧭 Intake done - tap to review session
        </div>
      )}
      {!isArchived && client.has_old_pending && !client.has_pending && (
        <div style={{ marginTop: 10, background: "#F3F4F6", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#6B7280" }}>
          ⚠️ Old incomplete session
        </div>
      )}
      {!isArchived && client.last_session_at && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#6B9E80", fontStyle: "italic" }}>
          📋 Last intake: {formatIntakeDate(client.last_session_at)}
        </div>
      )}
    </div>
  );
}

function LockedClientCard({ client, initials, avatarColor }) {
  return (
    <a href="https://buy.stripe.com/9B6aEYaN4f9udN6eQ0eQM02" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
    <div style={{ background: "#F9F9F9", borderRadius: "14px", padding: "16px 18px",
      border: "1.5px dashed #D4C9B0", position: "relative", overflow: "hidden", cursor: "pointer" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(245,240,232,0.7)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, zIndex: 2 }}>
        <span style={{ fontSize: 20 }}>🔒</span>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#2A5741", margin: 0 }}>Upgrade to Silver to unlock</p>
      </div>
      <div style={{ filter: "blur(4px)", pointerEvents: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: avatarColor(client.name),
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "700" }}>
            {initials(client.name)}
          </div>
          <div>
            <p style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 2px 0" }}>{client.name}</p>
            <p style={{ fontSize: "12px", margin: 0 }}>{client.phone || "-"}</p>
          </div>
        </div>
      </div>
    </div>
    </a>
  );
}

// ────────────────────────────────────────────────────────────────
// SampleCard
// Sample client card rendered in the zero-state of the Clients tab.
// Three of the five sample cards are interactive: tap to open a
// preview modal showing what a real, populated client profile will
// look like once the therapist has clients of their own.
// The remaining two render the same visual but are non-interactive
// (no preview to show for those).
// ────────────────────────────────────────────────────────────────
function SampleCard({ c, onPreview }) {
  const [hover, setHover] = React.useState(false);
  const interactive = !!c.interactive;
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onPreview : undefined}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onPreview();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background:'#FFFFFF',
        borderRadius:12,
        padding:16,
        boxShadow: hover && interactive
          ? '0 6px 18px rgba(28, 43, 34, 0.12)'
          : c.highlight ? '0 2px 8px rgba(220, 38, 38, 0.12)' : '0 1px 4px rgba(0,0,0,0.07)',
        opacity: interactive ? 1 : 0.85,
        border: c.highlight ? '1.5px solid #F4C46C' : '1px solid #E5E7EB',
        position: 'relative',
        cursor: interactive ? 'pointer' : 'default',
        transform: hover && interactive ? 'translateY(-2px)' : 'none',
        transition: 'box-shadow 0.18s ease, transform 0.18s ease',
      }}>
      {c.highlight && (
        <div style={{ position: 'absolute', top: -8, right: 12, background: '#F4C46C', color: '#78350F', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, letterSpacing: "0.04em" }}>
          NEEDS A NUDGE
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
        <div style={{ width:40, height:40, borderRadius:'50%', background:c.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>{c.initials}</div>
        <div style={{ flex:1, minWidth: 0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#1F2937' }}>{c.full_name}</div>
          <div style={{ fontSize:12, color:'#6B7280' }}>Last: {c.last}</div>
        </div>
        <div style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20,
          background: c.status==='active'?'#DCFCE7':c.status==='new'?'#EDE9FE':'#FEE2E2',
          color: c.status==='active'?'#16A34A':c.status==='new'?'#7C3AED':'#DC2626' }}>
          {c.status==='active'?'🌿 Active':c.status==='new'?'🌸 New':'🍂 Lapsed'}
        </div>
      </div>
      <div style={{ fontSize:12, color:'#6B7280', marginBottom:4 }}>📍 Focus: <strong style={{ color:'#1F2937' }}>{c.focus}</strong></div>
      <div style={{ fontSize:12, color:'#6B7280' }}>📋 {c.sessions} sessions recorded</div>
      {interactive && (
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px dashed #E5E7EB',
          fontSize: 11,
          fontWeight: 700,
          color: hover ? '#2A5741' : '#6B7280',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'color 0.18s ease',
        }}>
          <span>Tap to preview</span>
          <span style={{
            fontSize: 14,
            transform: hover ? 'translateX(2px)' : 'translateX(0)',
            transition: 'transform 0.18s ease',
          }}>→</span>
        </div>
      )}
    </div>
  );
}
