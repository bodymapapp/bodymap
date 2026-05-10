// src/components/SessionList.js
import React, { useState, useEffect } from "react";
import { db, supabase } from "../lib/supabase";
import BookingModal from "./BookingModal";
import { getStripePublishableKey } from "../lib/paymentMode";

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

  // Card on file
  const [cardOnFile, setCardOnFile] = useState(client?.card_last4 ? { last4: client.card_last4, brand: client.card_brand, payment_method_id: client.payment_method_id } : null);
  const [showSaveCard, setShowSaveCard] = useState(false);
  const [showCharge, setShowCharge] = useState(false);
  const [chargeAmount, setChargeAmount] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [sendReceipt, setSendReceipt] = useState(true);
  const [charging, setCharging] = useState(false);
  const [chargeMsg, setChargeMsg] = useState(null);
  const [savingCard, setSavingCard] = useState(false);

  async function saveCard() {
    if (!therapist?.stripe_account_id) { alert('Connect Stripe in Settings first.'); return; }
    setSavingCard(true);
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
    const res = await fetch(`${supabaseUrl}/functions/v1/save-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
      body: JSON.stringify({
        stripe_account_id: therapist.stripe_account_id,
        client_id: client.id,
        client_email: client.email,
        client_name: client.name,
        therapist_id: therapistId,
      }),
    });
    const data = await res.json();
    setSavingCard(false);
    if (data.error) { alert(data.error); return; }
    // Load Stripe.js and collect card
    if (!window.Stripe) {
      await new Promise(resolve => {
        const s = document.createElement('script');
        s.src = 'https://js.stripe.com/v3/';
        s.onload = resolve;
        document.head.appendChild(s);
      });
    }
    const stripe = window.Stripe(getStripePublishableKey(), { stripeAccount: therapist.stripe_account_id });
    const elements = stripe.elements({ clientSecret: data.client_secret });
    const cardEl = elements.create('card', { style: { base: { fontSize: '16px', color: '#1A3A28' } } });
    const mountDiv = document.getElementById('bm-card-mount');
    if (mountDiv) cardEl.mount('#bm-card-mount');
    window._bmStripe = stripe;
    window._bmElements = elements;
    window._bmCardEl = cardEl;
    window._bmClientSecret = data.client_secret;
    window._bmCustomerId = data.customer_id;
  }

  async function confirmSaveCard() {
    setSavingCard(true);
    const { setupIntent, error } = await window._bmStripe.confirmCardSetup(window._bmClientSecret, {
      payment_method: { card: window._bmCardEl }
    });
    if (error) { alert(error.message); setSavingCard(false); return; }
    // Save card details to client record
    const pmId = setupIntent.payment_method;
    const pmRes = await fetch(`https://api.stripe.com/v1/payment_methods/${pmId}`, {
      headers: { 'Authorization': `Bearer ${getStripePublishableKey()}`, 'Stripe-Account': therapist.stripe_account_id }
    });
    // Store payment_method_id + last4 + brand on client
    await supabase.from('clients').update({
      payment_method_id: pmId,
      stripe_customer_id: window._bmCustomerId,
    }).eq('id', client.id);
    setCardOnFile({ last4: '••••', brand: 'Card', payment_method_id: pmId });
    setShowSaveCard(false);
    setSavingCard(false);
    setChargeMsg({ type: 'ok', text: 'Card saved successfully.' });
  }

  async function chargeCard() {
    if (!chargeAmount || parseFloat(chargeAmount) <= 0) { setChargeMsg({ type: 'err', text: 'Enter an amount.' }); return; }
    setCharging(true); setChargeMsg(null);
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

    const isSquare = therapist?.square_connected && client?.square_card_id;
    const endpoint = isSquare ? 'square-charge-card' : 'charge-card';

    const body = isSquare ? {
      therapist_id: therapistId,
      square_card_id: client.square_card_id,
      square_customer_id: client.square_customer_id,
      amount_cents: Math.round(parseFloat(chargeAmount) * 100),
      tip_cents: tipAmount ? Math.round(parseFloat(tipAmount) * 100) : 0,
      description: `Session with ${therapist.business_name || therapist.full_name}`,
      client_email: client.email,
      send_receipt: sendReceipt,
    } : {
      stripe_account_id: therapist.stripe_account_id,
      customer_id: client.stripe_customer_id,
      payment_method_id: cardOnFile.payment_method_id,
      amount_cents: Math.round(parseFloat(chargeAmount) * 100),
      tip_cents: tipAmount ? Math.round(parseFloat(tipAmount) * 100) : 0,
      description: `Session with ${therapist.business_name || therapist.full_name}`,
      client_email: client.email,
      send_receipt: sendReceipt,
    };

    const res = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setCharging(false);
    if (data.error) { setChargeMsg({ type: 'err', text: data.error }); return; }
    const total = (parseFloat(chargeAmount) + (parseFloat(tipAmount) || 0)).toFixed(2);
    setChargeMsg({ type: 'ok', text: `Charged $${total} successfully.` });
    setChargeAmount(''); setTipAmount(''); setShowCharge(false);
  }

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

  // Delete a session row. Confirmation happens INLINE in the row
  // itself via a confirm pill (handled in SessionRow), so this function
  // just performs the delete. The row only calls handleDeleteSession
  // after the therapist taps Yes on the inline pill.
  async function handleDeleteSession(sessionId) {
    const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
    if (error) {
      alert('Could not delete: ' + error.message);
      return;
    }
    await loadSessions();
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
          // "Total" shows the raw row count so the math always reconciles
          // with Complete + Intake Done. Sublabel makes it clear that this
          // is "all sessions on record" — intakes count toward this total
          // even before the session is marked complete. Common confusion
          // point: a friend tests the intake → row appears here.
          { label: "Total", sublabel: "intakes + completed", value: sessions.length, color: C.forest },
          { label: "✅ Complete", value: sessions.filter(s => s.completed).length, color: C.sage },
          { label: "🧭 Intake Done", value: sessions.filter(s => !s.completed).length, color: C.forest },
        ].map((stat, i) => (
          <div key={i} style={{ background: C.white, borderRadius: "12px", padding: "16px", border: `1px solid ${C.lightGray}`, textAlign: "center" }}>
            <p style={{ fontSize: "24px", fontWeight: "700", color: stat.color, margin: "0 0 4px 0" }}>{stat.value}</p>
            <p style={{ fontSize: "12px", color: C.gray, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>{stat.label}</p>
            {stat.sublabel && (
              <p style={{ fontSize: "10px", color: C.gray, margin: "2px 0 0", textTransform: "none", letterSpacing: 0, fontStyle: "italic", opacity: 0.8 }}>{stat.sublabel}</p>
            )}
          </div>
        ))}
      </div>


      {/* Card on File */}
      {(therapist?.stripe_account_connected || therapist?.square_connected) && (
        <div style={{ background: C.white, border: `1.5px solid ${C.lightGray}`, borderRadius: 14, padding: 20, marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: chargeMsg ? 12 : 0 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.darkGray }}>
                💳 {cardOnFile ? `Card on file: ${cardOnFile.brand} ••••${cardOnFile.last4}` : 'No card on file'}
              </div>
              {!cardOnFile && <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>Save a card to enable one-tap checkout</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {cardOnFile && (
                <button onClick={() => { setShowCharge(v => !v); setChargeMsg(null); }}
                  style={{ background: '#2A5741', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {showCharge ? 'Cancel' : '💵 Charge'}
                </button>
              )}
              <button onClick={() => { setShowSaveCard(v => !v); if (!showSaveCard) saveCard(); }}
                style={{ background: '#F9FAFB', border: `1.5px solid ${C.lightGray}`, color: C.gray, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {cardOnFile ? '🔄 Update card' : '+ Save card'}
              </button>
            </div>
          </div>

          {/* Charge panel */}
          {showCharge && cardOnFile && (
            <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 10, padding: 16, marginTop: 12 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amount ($)</label>
                <input type="number" min="0" step="0.01" value={chargeAmount} onChange={e => setChargeAmount(e.target.value)}
                  placeholder="0.00" style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${C.lightGray}`, borderRadius: 8, fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Tip selector - percentage chips + custom + skip.
                  Uses therapist's configured presets (default 15/18/20).
                  Hidden entirely if therapist has accept_tips = false.
                  Lindsey #2 (May 10 2026): no dropdowns. */}
              {therapist?.accept_tips !== false && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tip</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { label: 'Skip', kind: 'skip', value: 0 },
                      { label: `${therapist?.tip_preset_1 ?? 15}%`, kind: 'percent', value: therapist?.tip_preset_1 ?? 15 },
                      { label: `${therapist?.tip_preset_2 ?? 18}%`, kind: 'percent', value: therapist?.tip_preset_2 ?? 18 },
                      { label: `${therapist?.tip_preset_3 ?? 20}%`, kind: 'percent', value: therapist?.tip_preset_3 ?? 20 },
                      { label: 'Custom', kind: 'custom', value: null },
                    ].map((chip, idx) => {
                      const charge = parseFloat(chargeAmount) || 0;
                      const computed = chip.kind === 'percent' ? (charge * chip.value / 100) : null;
                      const currentTip = parseFloat(tipAmount) || 0;
                      let isActive = false;
                      if (chip.kind === 'skip') isActive = !tipAmount || currentTip === 0;
                      else if (chip.kind === 'percent' && computed !== null) {
                        isActive = Math.abs(currentTip - computed) < 0.01 && currentTip > 0;
                      }
                      // Custom never auto-active; user must type
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (chip.kind === 'skip') setTipAmount('');
                            else if (chip.kind === 'percent') setTipAmount(computed.toFixed(2));
                            else { /* custom: focus the field, leave value */ }
                          }}
                          style={{
                            padding: '7px 14px', borderRadius: 999,
                            border: `1.5px solid ${isActive ? '#2A5741' : C.lightGray}`,
                            background: isActive ? '#2A5741' : '#fff',
                            color: isActive ? '#fff' : C.dark,
                            fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            fontFamily: 'system-ui',
                          }}>
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                  {/* Custom amount field shown always but greyed out when a chip is active */}
                  <div style={{ marginTop: 8 }}>
                    <input type="number" min="0" step="0.01" value={tipAmount}
                      onChange={e => setTipAmount(e.target.value)}
                      placeholder="0.00"
                      style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${C.lightGray}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <input type="checkbox" id="send-receipt" checked={sendReceipt} onChange={e => setSendReceipt(e.target.checked)} />
                <label htmlFor="send-receipt" style={{ fontSize: 13, color: C.gray, cursor: 'pointer' }}>Email receipt to {client.email || 'client'}</label>
              </div>
              {chargeAmount && (
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2A5741', marginBottom: 12 }}>
                  Total: ${(parseFloat(chargeAmount || 0) + parseFloat(tipAmount || 0)).toFixed(2)}
                </div>
              )}
              <button onClick={chargeCard} disabled={charging || !chargeAmount}
                style={{ width: '100%', padding: '11px 0', background: charging || !chargeAmount ? '#D1D5DB' : '#2A5741', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: charging || !chargeAmount ? 'not-allowed' : 'pointer' }}>
                {charging ? 'Charging...' : `Charge ${cardOnFile.brand} ••••${cardOnFile.last4}`}
              </button>
            </div>
          )}

          {/* Save card panel */}
          {showSaveCard && (
            <div style={{ marginTop: 12 }}>
              <div id="bm-card-mount" style={{ border: `1.5px solid ${C.lightGray}`, borderRadius: 8, padding: '12px 14px', background: '#fff', marginBottom: 10 }} />
              <button onClick={confirmSaveCard} disabled={savingCard}
                style={{ width: '100%', padding: '11px 0', background: savingCard ? '#D1D5DB' : '#2A5741', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {savingCard ? 'Saving...' : 'Save card'}
              </button>
            </div>
          )}

          {chargeMsg && (
            <div style={{ fontSize: 13, fontWeight: 600, color: chargeMsg.type === 'ok' ? '#16A34A' : '#DC2626', marginTop: 10 }}>
              {chargeMsg.type === 'ok' ? '✓' : '⚠'} {chargeMsg.text}
            </div>
          )}
        </div>
      )}

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
            <SessionRow
              key={session.id}
              session={session}
              onSelect={onSelectSession}
              onDelete={() => handleDeleteSession(session.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({ session, onSelect, onDelete }) {
  const [hovered, setHovered] = useState(false);
  // Inline confirm state. When therapist taps the × button we do not
  // immediately delete and we do not pop a modal. Instead we replace
  // the × button with a tiny pill containing the question and Yes/No
  // buttons, all within the row itself. Tapping Yes calls onDelete
  // and resets. Tapping No just resets. This keeps the interaction
  // contained in the row context the therapist is already looking
  // at — no modal flashing in from elsewhere on the screen.
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      onClick={() => { if (!confirming) onSelect(session); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); /* Auto-cancel confirm on mouse out keeps this from sticking forever. */ if (confirming) setConfirming(false); }}
      style={{
        background: C.white, borderRadius: "12px", padding: "16px 20px",
        border: `1.5px solid ${hovered ? "#6B9E80" : C.lightGray}`,
        cursor: confirming ? "default" : "pointer",
        transition: "all 0.15s ease",
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
          {focusCountText(session)}
        </div>
      </div>

      {confirming ? (
        // ----- INLINE CONFIRM PILL -----
        // Replaces × + › arrow with the question and Yes/No. Stops
        // propagation so taps on the buttons or the surrounding pill
        // do not also trigger row click.
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#FEF2F2",
            border: "1.5px solid #FECACA",
            borderRadius: 999,
            padding: "4px 6px 4px 12px",
          }}>
          <span style={{ fontSize: 12, color: "#991B1B", fontWeight: 600, whiteSpace: "nowrap" }}>
            {session.completed ? "Delete this session?" : "Delete this intake?"}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); setConfirming(false); }}
            style={{
              background: "#DC2626", color: "#fff",
              border: "none", borderRadius: 999,
              padding: "4px 12px",
              fontSize: 12, fontWeight: 700,
              cursor: "pointer",
            }}>
            Yes
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
            style={{
              background: "transparent", color: "#6B7280",
              border: "1px solid #D1D5DB", borderRadius: 999,
              padding: "3px 11px",
              fontSize: 12, fontWeight: 600,
              cursor: "pointer",
            }}>
            No
          </button>
        </div>
      ) : (
        <>
          <span style={{
            background: session.completed ? "#D1FAE5" : "#E8F5EE",
            color: session.completed ? "#065F46" : "#2A5741",
            padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap"
          }}>
            {session.completed ? "✅ Complete" : "🧭 Intake Done"}
          </span>
          {/* × delete button. On click, opens the inline confirm pill
              instead of deleting immediately or popping a modal. */}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
              title={session.completed ? "Delete this completed session" : "Delete this incomplete intake"}
              style={{
                background: hovered ? "#FEF2F2" : "transparent",
                border: hovered ? "1px solid #FECACA" : "1px solid transparent",
                color: hovered ? "#DC2626" : "transparent",
                width: 28, height: 28,
                borderRadius: "50%",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
                padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
            >×</button>
          )}
          <span style={{ color: hovered ? "#6B9E80" : "#E8E4DC", fontSize: "20px", transition: "color 0.15s" }}>›</span>
        </>
      )}
    </div>
  );
}

// Helper used inside SessionRow to render the focus/avoid counts
// without duplicating the calculation across both branches.
function focusCountText(session) {
  const focusCount = (session.front_focus?.length || 0) + (session.back_focus?.length || 0);
  const avoidCount = (session.front_avoid?.length || 0) + (session.back_avoid?.length || 0);
  return (
    <>
      {focusCount > 0 && <span style={{ fontSize: "13px", color: "#6B9E80" }}>🟢 {focusCount} focus</span>}
      {avoidCount > 0 && <span style={{ fontSize: "13px", color: "#EF4444" }}>🔴 {avoidCount} avoid</span>}
    </>
  );
}
