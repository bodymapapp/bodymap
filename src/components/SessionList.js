// src/components/SessionList.js
import React, { useState, useEffect } from "react";
import { db, supabase } from "../lib/supabase";
import BookingModal from "./BookingModal";

const C = {
  sage: "#6B9E80", forest: "#2A5741", beige: "#F5F0E8",
  darkGray: "#1A1A2E", gray: "#6B7280", lightGray: "#E8E4DC",
  white: "#FFFFFF", gold: "#C9A84C"
};

export default function SessionList({ client, therapistId, therapist, onBack, onSelectSession }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isArchived, setIsArchived] = useState(client?.do_not_rebook || false);
  const [dnrReason, setDnrReason] = useState(client?.dnr_reason || "");
  const [showArchiveMenu, setShowArchiveMenu] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [showRebook, setShowRebook] = useState(false);

  // Edit client
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(client?.name || "");
  const [editEmail, setEditEmail] = useState(client?.email || "");
  const [editPhone, setEditPhone] = useState(client?.phone || "");
  const [editNotes, setEditNotes] = useState(client?.notes || "");
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState("");

  async function saveClient() {
    if (!editName.trim()) { setEditMsg("Name is required."); return; }
    setEditSaving(true);
    const { error } = await supabase.from("clients").update({
      name:  editName.trim(),
      email: editEmail.trim().toLowerCase() || null,
      phone: editPhone.trim() || null,
      notes: editNotes.trim() || null,
    }).eq("id", client.id);
    setEditSaving(false);
    if (error) { setEditMsg("Save failed: " + error.message); }
    else { setEditMsg("✓ Saved"); setTimeout(() => { setEditMsg(""); setShowEdit(false); }, 1200); }
  }

  // Merge state
  const [showMerge, setShowMerge] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeResults, setMergeResults] = useState([]);
  const [mergeTarget, setMergeTarget] = useState(null); // the duplicate to absorb
  const [mergeSaving, setMergeSaving] = useState(false);
  const [mergeError, setMergeError] = useState("");

  const DNR_REASONS = [
    "Do not rebook",
    "Deceased",
    "Moved away",
    "Requested removal",
    "Other",
  ];

  async function toggleArchive(reason) {
    setArchiveSaving(true);
    const newVal = !isArchived;
    await supabase.from("clients")
      .update({ do_not_rebook: newVal, dnr_reason: newVal ? reason : null })
      .eq("id", client.id);
    setIsArchived(newVal);
    setDnrReason(newVal ? reason : "");
    setShowArchiveMenu(false);
    setArchiveSaving(false);
  }

  async function searchClients(q) {
    setMergeSearch(q);
    if (q.trim().length < 2) { setMergeResults([]); return; }
    const { data } = await supabase.from("clients")
      .select("id, name, email, phone, created_at")
      .eq("therapist_id", therapistId)
      .neq("id", client.id)
      .ilike("name", `%${q}%`)
      .limit(8);
    setMergeResults(data || []);
  }

  async function executeMerge() {
    if (!mergeTarget) return;
    setMergeSaving(true);
    setMergeError("");
    try {
      // Move all sessions from duplicate to primary (this client)
      const { error: sessErr } = await supabase.from("sessions")
        .update({ client_id: client.id })
        .eq("client_id", mergeTarget.id);
      if (sessErr) throw sessErr;

      // Move any bookings from duplicate to primary
      await supabase.from("bookings")
        .update({ client_id: client.id })
        .eq("client_id", mergeTarget.id);

      // Delete the duplicate client
      const { error: delErr } = await supabase.from("clients")
        .delete()
        .eq("id", mergeTarget.id);
      if (delErr) throw delErr;

      // Reload sessions to reflect merged data
      await loadSessions();
      setShowMerge(false);
      setMergeTarget(null);
      setMergeSearch("");
      setMergeResults([]);
    } catch (err) {
      setMergeError("Merge failed: " + (err.message || "unknown error"));
    } finally {
      setMergeSaving(false);
    }
  }

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
      {/* Edit client modal */}
      {showEdit && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:3000, padding:20 }}
          onClick={e => { if (e.target===e.currentTarget) setShowEdit(false); }}>
          <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:440, boxShadow:"0 24px 64px rgba(0,0,0,0.25)", overflow:"hidden" }}>
            <div style={{ padding:"24px 24px 16px", borderBottom:"1px solid #E8E4DC", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <h3 style={{ fontFamily:"Georgia, serif", fontSize:20, fontWeight:700, color:C.darkGray, margin:0 }}>Edit Client</h3>
              <button onClick={() => setShowEdit(false)} style={{ background:"#F3F4F6", border:"none", borderRadius:"50%", width:32, height:32, cursor:"pointer", fontSize:16, color:C.gray }}>✕</button>
            </div>
            <div style={{ padding:24, display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:6 }}>Name *</label>
                <input value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Full name"
                  style={{ width:"100%", padding:"10px 12px", border:"1.5px solid #E8E4DC", borderRadius:10, fontSize:14, outline:"none", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:6 }}>Email</label>
                <input value={editEmail} onChange={e=>setEditEmail(e.target.value)} placeholder="email@example.com" type="email"
                  style={{ width:"100%", padding:"10px 12px", border:"1.5px solid #E8E4DC", borderRadius:10, fontSize:14, outline:"none", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:6 }}>Phone</label>
                <input value={editPhone} onChange={e=>setEditPhone(e.target.value)} placeholder="(512) 555-1234" type="tel"
                  style={{ width:"100%", padding:"10px 12px", border:"1.5px solid #E8E4DC", borderRadius:10, fontSize:14, outline:"none", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:6 }}>Notes</label>
                <textarea value={editNotes} onChange={e=>setEditNotes(e.target.value)} rows={2} placeholder="Internal notes about this client…"
                  style={{ width:"100%", padding:"10px 12px", border:"1.5px solid #E8E4DC", borderRadius:10, fontSize:14, outline:"none", resize:"vertical", boxSizing:"border-box", fontFamily:"system-ui" }} />
              </div>
              {editMsg && (
                <div style={{ fontSize:13, fontWeight:600, color: editMsg.startsWith("✓") ? "#16A34A" : "#DC2626" }}>{editMsg}</div>
              )}
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setShowEdit(false)}
                  style={{ flex:1, padding:"11px 0", borderRadius:10, border:"1.5px solid #E8E4DC", background:"#fff", color:C.gray, fontSize:14, fontWeight:600, cursor:"pointer" }}>
                  Cancel
                </button>
                <button onClick={saveClient} disabled={editSaving}
                  style={{ flex:1, padding:"11px 0", borderRadius:10, border:"none", background:C.forest, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", opacity:editSaving?0.6:1 }}>
                  {editSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showRebook && therapist && (
        <BookingModal
          therapist={therapist}
          mode="rebook"
          prefillClient={{ name: client.name, email: client.email, phone: client.phone }}
          onClose={() => setShowRebook(false)}
          onSuccess={() => setShowRebook(false)}
        />
      )}

      {/* Merge Modal */}
      {showMerge && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowMerge(false); setMergeTarget(null); setMergeSearch(""); setMergeResults([]); }}}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h3 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, color: C.darkGray, margin: "0 0 4px" }}>Merge Duplicate Client</h3>
                <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>All sessions from the duplicate will move to <strong>{client.name}</strong>, then the duplicate is deleted.</p>
              </div>
              <button onClick={() => { setShowMerge(false); setMergeTarget(null); setMergeSearch(""); setMergeResults([]); }}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.gray, padding: 4 }}>✕</button>
            </div>

            {/* Primary client */}
            <div style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#16A34A", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Keep this record (primary)</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.darkGray }}>{client.name}</div>
              <div style={{ fontSize: 12, color: C.gray }}>{client.email || client.phone || "No contact on file"}</div>
            </div>

            {/* Search for duplicate */}
            <input
              autoFocus
              value={mergeSearch}
              onChange={e => searchClients(e.target.value)}
              placeholder="Search for the duplicate by name…"
              style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${C.lightGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 10 }}
            />

            {mergeResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, maxHeight: 220, overflowY: "auto" }}>
                {mergeResults.map(r => (
                  <div key={r.id} onClick={() => setMergeTarget(r)}
                    style={{ padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${mergeTarget?.id === r.id ? "#DC2626" : C.lightGray}`,
                      background: mergeTarget?.id === r.id ? "#FEF2F2" : "#fff", cursor: "pointer", transition: "all 0.15s" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: mergeTarget?.id === r.id ? "#DC2626" : C.darkGray }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: C.gray }}>{r.email || r.phone || "No contact"} · Added {new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}

            {mergeTarget && (
              <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Duplicate to delete after merge</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#991B1B" }}>{mergeTarget.name}</div>
                <div style={{ fontSize: 12, color: "#DC2626" }}>{mergeTarget.email || mergeTarget.phone || "No contact on file"}</div>
              </div>
            )}

            {mergeError && <div style={{ fontSize: 13, color: "#DC2626", marginBottom: 12, fontWeight: 600 }}>⚠ {mergeError}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShowMerge(false); setMergeTarget(null); setMergeSearch(""); setMergeResults([]); }}
                style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: `1.5px solid ${C.lightGray}`, background: "#fff", color: C.gray, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={executeMerge} disabled={!mergeTarget || mergeSaving}
                style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: mergeTarget ? "#DC2626" : "#E5E7EB", color: "#fff", fontSize: 14, fontWeight: 700, cursor: mergeTarget ? "pointer" : "not-allowed", opacity: mergeSaving ? 0.6 : 1 }}>
                {mergeSaving ? "Merging…" : "Merge & Delete Duplicate"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px", flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ background: "transparent", border: `1.5px solid ${C.lightGray}`, color: C.gray, padding: "8px 16px", borderRadius: "8px", fontSize: "14px", cursor: "pointer", fontFamily: "system-ui" }}>
          ← All Clients
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "28px", fontWeight: "700", color: isArchived ? "#6B7280" : C.darkGray, margin: "0 0 2px 0", letterSpacing: "-0.5px" }}>
              {client.name}
            </h2>
            {isArchived && (
              <span style={{ background: "#FEE2E2", color: "#991B1B", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
                ⛔ {dnrReason || "Archived"}
              </span>
            )}
          </div>
          <p style={{ fontSize: "14px", color: C.gray, margin: 0 }}>{sessions.length} session{sessions.length !== 1 ? "s" : ""} on record</p>
        </div>

        {/* Edit client */}
        <button onClick={() => setShowEdit(true)}
          style={{ background:"#F9FAFB", border:"1.5px solid #E5E7EB", color:C.dark, padding:"8px 14px", borderRadius:"8px", fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
          ✏️ Edit
        </button>

        {/* Book Next Appointment */}
        {!isArchived && (
          <button onClick={() => setShowRebook(true)}
            style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", color: "#16A34A", padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
            📅 Book Next
          </button>
        )}

        {/* Merge button */}
        <button onClick={() => setShowMerge(true)}
          style={{ background: "#F5F3FF", border: "1.5px solid #C4B5FD", color: "#7C3AED", padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
          ⟵⟶ Merge
        </button>

        {/* Archive toggle */}
        <div style={{ position: "relative" }}>
          {isArchived ? (
            <button onClick={() => toggleArchive(null)} disabled={archiveSaving}
              style={{ background: "#F3F4F6", border: "1.5px solid #D1D5DB", color: "#6B7280", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              {archiveSaving ? "Restoring…" : "↩ Restore"}
            </button>
          ) : (
            <button onClick={() => setShowArchiveMenu(v => !v)}
              style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626", padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              ⛔ Archive
            </button>
          )}
          {showArchiveMenu && (
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#fff", border: "1.5px solid #FECACA", borderRadius: 10, padding: "8px", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 190 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px 6px" }}>Reason</p>
              {DNR_REASONS.map(r => (
                <button key={r} onClick={() => toggleArchive(r)} disabled={archiveSaving}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "8px 10px", borderRadius: 7, fontSize: 13, color: "#374151", cursor: "pointer", fontWeight: 500 }}
                  onMouseEnter={e => e.target.style.background = "#FEF2F2"}
                  onMouseLeave={e => e.target.style.background = "transparent"}>
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Total Sessions", value: sessions.length, color: C.forest },
          { label: "✅ Complete", value: sessions.filter(s => s.completed).length, color: C.sage },
          { label: "🧭 Intake Done", value: sessions.filter(s => !s.completed).length, color: C.forest },
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
        display: "flex", alignItems: "center", gap: "8px", overflow: "hidden"
      }}
    >
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <p style={{ fontSize: "15px", fontWeight: "600", color: "#1A1A2E", margin: "0 0 4px 0", fontFamily: "Georgia, serif" }}>
          {new Date(session.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {session.goal && <span style={{ fontSize: "13px", color: "#6B7280" }}>Goal: <strong>{session.goal}</strong></span>}
          {session.pressure && <span style={{ fontSize: "13px", color: "#6B7280" }}>Pressure: <strong>{session.pressure}/5</strong></span>}
          {focusCount > 0 && <span style={{ fontSize: "13px", color: "#6B9E80" }}>🟢 {focusCount} focus</span>}
          {avoidCount > 0 && <span style={{ fontSize: "13px", color: "#EF4444" }}>🔴 {avoidCount} avoid</span>}
        </div>
      </div>
      <span style={{
        background: session.completed ? "#D1FAE5" : "#E8F5EE",
        color: session.completed ? "#065F46" : "#2A5741",
        padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap"
      }}>
        {session.completed ? "✅ Complete" : "🧭 Intake Done"}
      </span>
      <span style={{ color: hovered ? "#6B9E80" : "#E8E4DC", fontSize: "20px", transition: "color 0.15s" }}>›</span>
    </div>
  );
}
