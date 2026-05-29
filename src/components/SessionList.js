// src/components/SessionList.js
import React, { useState, useEffect } from "react";
import { db, supabase } from "../lib/supabase";
import { getSampleSessions } from "../data/sampleClients";
import BookingModal from "./BookingModal";
import SidePanel from "./SidePanel";
import { getStripePublishableKey } from "../lib/paymentMode";
import { formatUSPhone } from "../lib/formatters/phone";

const C = {
  sage: "#6B9E80", forest: "#2A5741", beige: "#F5F0E8",
  darkGray: "#1A1A2E", gray: "#6B7280", lightGray: "#E8E4DC",
  white: "#FFFFFF", gold: "#C9A84C"
};

export default function SessionList({ client, therapistId, therapist, onBack, onSelectSession, compact = false, previewSessions = null, externalShowEdit = null, onExternalEditClose = null, externalShowArchive = null, onExternalArchiveClose = null, externalShowRebook = null, onExternalRebookClose = null, externalShowMerge = null, onExternalMergeClose = null, onEditClient = null }) {
  const [sessions, setSessions] = useState(previewSessions || []);
  // Bookings = the actual appointment records this client has had.
  // Distinct from `sessions` (SOAP-note records). The header count
  // and stat boxes at the top of the page derive from bookings;
  // sessions still drive the per-row SOAP list below.
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Derived counts. Filter to confirmed/completed status (null
  // counts as confirmed for legacy rows).
  const bookedCount = bookings.filter(b => !b.status || ['confirmed', 'completed'].includes(b.status)).length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;

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
    if (!therapist?.stripe_account_id && !therapist?.square_access_token) {
      // HK May 22 2026: was alert('Connect Stripe in Settings first.').
      // alert() violates Design Principle (no native popups), and only
      // mentioning Stripe ignores Square as a valid peer processor.
      // Save-card itself currently routes through Stripe specifically;
      // the broader 'route by which processor is connected' refactor is
      // queued, but the user-facing message must already acknowledge both.
      setChargeMsg('Connect Stripe or Square in Settings first to save cards on file. Both work equally well.');
      return;
    }
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

  // External Edit trigger from the ClientProfile hero pencil button.
  // When parent flips externalShowEdit true, open the modal here.
  // When the modal closes locally, call onExternalEditClose so parent
  // resets its own state. Lets the hero pencil and the SOAP-area
  // 'Edit details' button share one modal source-of-truth.
  useEffect(() => {
    if (externalShowEdit) {
      setEditName(client?.name || "");
      setEditEmail(client?.email || "");
      setEditPhone(client?.phone || "");
      setEditNotes(client?.notes || "");
      setShowEdit(true);
    }
  }, [externalShowEdit]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!showEdit && externalShowEdit) {
      onExternalEditClose?.();
    }
  }, [showEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (externalShowArchive) setShowArchiveMenu(true);
  }, [externalShowArchive]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!showArchiveMenu && externalShowArchive) {
      onExternalArchiveClose?.();
    }
  }, [showArchiveMenu]); // eslint-disable-line react-hooks/exhaustive-deps

  // HK May 27 2026 Ship 1: if the client is already archived and the
  // ProfileHeader 'Restore' button is tapped, skip the reason picker
  // and un-archive immediately. The picker only makes sense when
  // archiving, not restoring.
  useEffect(() => {
    if (showArchiveMenu && isArchived) {
      toggleArchive(null);
      setShowArchiveMenu(false);
    }
  }, [showArchiveMenu, isArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  // HK May 27 2026 Ship 1: rebook bridge. ProfileHeader now hosts
  // the four primary action buttons; this lets it trigger the
  // existing modals SessionList already owns. (Merge bridge moved
  // below showMerge declaration to avoid temporal dead zone.)
  useEffect(() => {
    if (externalShowRebook) setShowRebook(true);
  }, [externalShowRebook]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!showRebook && externalShowRebook) {
      onExternalRebookClose?.();
    }
  }, [showRebook]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveClient() {
    if (!editName.trim()) { setEditMsg("Name is required."); return; }
    setEditSaving(true);
    // Sample client: show the saved indicator but don't write.
    if (client.__sample) {
      setEditSaving(false);
      setEditMsg("✓ Saved");
      setTimeout(() => { setEditMsg(""); setShowEdit(false); }, 1200);
      return;
    }
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

  // HK May 27 2026 Ship 1: merge bridge from ProfileHeader. Sits
  // after showMerge declaration because referencing showMerge in a
  // useEffect dep array before useState declares it is a temporal
  // dead zone error and crashes the page on render.
  useEffect(() => {
    if (externalShowMerge) setShowMerge(true);
  }, [externalShowMerge]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!showMerge && externalShowMerge) {
      onExternalMergeClose?.();
    }
  }, [showMerge]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // Sample client: flip the local UI state only.
    if (client.__sample) {
      setIsArchived(newVal);
      setDnrReason(newVal ? reason : "");
      setShowArchiveMenu(false);
      setArchiveSaving(false);
      return;
    }
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
    // Sample client: return the other sample cards filtered by name.
    // Gives the therapist something to see in the merge UI.
    if (client.__sample) {
      const others = ['s1','s2','s3','s5']
        .filter(k => `sample-${k}` !== client.id)
        .map(k => {
          const data = { s1:'Sarah Mitchell', s2:'Jennifer Kim', s3:'Maria Lopez', s5:'Dana Park' };
          return { id: `sample-${k}`, name: data[k], email: null, phone: null, created_at: new Date().toISOString() };
        })
        .filter(r => r.name.toLowerCase().includes(q.trim().toLowerCase()));
      setMergeResults(others.slice(0, 8));
      return;
    }
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
      // Sample client: just close the modal. Nothing to merge.
      if (client.__sample) {
        setShowMerge(false);
        setMergeTarget(null);
        setMergeSearch("");
        setMergeResults([]);
        setMergeSaving(false);
        return;
      }
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
    // Preview mode: sessions came in via the previewSessions prop
    // and bookings stay empty. Skip the Supabase load entirely so
    // the demo modal doesn't issue queries with a fake therapist id.
    if (previewSessions) {
      setSessions(previewSessions);
      setLoading(false);
      return;
    }
    // Sample client routed by URL. Load sessions from the sample
    // store. Same shape the real loadSessions populates, so the
    // SOAP list, journey, and per-session detail all work.
    if (client?.__sample) {
      setSessions(getSampleSessions(client.id));
      setLoading(false);
      return;
    }
    if (client?.id) loadSessions();
  }, [client?.id, client?.__sample, previewSessions]);

  async function loadSessions() {
    setLoading(true);
    try {
      // SOAP-note records (what the per-row list below shows)
      const { data, error } = await supabase
        .from("sessions").select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });
      if (!error) setSessions(data || []);

      // Bookings for this client (the real appointment record).
      // Counts at the top of the page derive from this so they
      // reflect what the client list card and dashboard counters
      // show. Bookings are joined by client_email since some
      // legacy bookings don't have client_id set.
      const { data: bookingRows } = await supabase
        .from("bookings")
        .select("id, booking_date, status")
        .eq("therapist_id", therapistId)
        .or(`client_email.eq.${client.email || ''},client_phone.eq.${client.phone || ''}`)
        .order("booking_date", { ascending: false });
      setBookings(bookingRows || []);
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
      {/* Edit client SIDE PANEL. HK May 27 2026 Design Principle 31:
          migrated from a centered modal to a right-side slide-over.
          Same form, no scroll-to-submit trap, no modal-in-modal on
          mobile. Save button lives in the panel's sticky footer. */}
      <SidePanel
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="Edit client"
        subtitle="Name, email, phone, and internal notes."
        footer={(
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setShowEdit(false)}
              style={{
                flex: 1,
                padding: "12px 0",
                borderRadius: 10,
                border: "1.5px solid #E8E4DC",
                background: "#fff",
                color: C.gray,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
            <button
              onClick={saveClient}
              disabled={editSaving}
              style={{
                flex: 2,
                padding: "12px 0",
                borderRadius: 10,
                border: "none",
                background: C.forest,
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: editSaving ? "wait" : "pointer",
                opacity: editSaving ? 0.6 : 1,
                fontFamily: "inherit",
              }}
            >
              {editSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        )}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Name *</label>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Full name"
              style={{ width: "100%", padding: "11px 12px", border: "1.5px solid #E8E4DC", borderRadius: 10, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Email</label>
            <input
              value={editEmail}
              onChange={e => setEditEmail(e.target.value)}
              placeholder="email@example.com"
              type="email"
              style={{ width: "100%", padding: "11px 12px", border: "1.5px solid #E8E4DC", borderRadius: 10, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Phone</label>
            <input
              value={editPhone}
              onChange={e => setEditPhone(e.target.value)}
              placeholder="(512) 555-1234"
              type="tel"
              style={{ width: "100%", padding: "11px 12px", border: "1.5px solid #E8E4DC", borderRadius: 10, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Notes</label>
            <textarea
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              rows={4}
              placeholder="Internal notes about this client..."
              style={{ width: "100%", padding: "11px 12px", border: "1.5px solid #E8E4DC", borderRadius: 10, fontSize: 15, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", minHeight: 90 }}
            />
          </div>
          {editMsg && (
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: editMsg.startsWith("✓") ? "#16A34A" : "#DC2626",
              padding: "6px 0",
            }}>
              {editMsg}
            </div>
          )}
        </div>
      </SidePanel>
      {showRebook && therapist && (
        <BookingModal
          therapist={therapist}
          mode="rebook"
          prefillClient={{ name: client.name, email: client.email, phone: client.phone }}
          onClose={() => setShowRebook(false)}
          onSuccess={() => setShowRebook(false)}
        />
      )}

      {/* Archive reason picker modal. HK May 27 2026 Ship 1: when the
          old bottom-row Archive button was removed, the inline reason
          dropdown that lived under it went with it. ProfileHeader's
          Archive button still triggers setShowArchiveMenu(true) via
          externalShowArchive. We now render the reason list as a
          standalone modal so the flow still works. If client is
          already archived, ProfileHeader shows 'Restore' and we just
          un-archive immediately on tap (handled below). */}
      {showArchiveMenu && !isArchived && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowArchiveMenu(false); }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,30,0.55)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            zIndex: 3000,
            padding: "max(20px, env(safe-area-inset-top, 20px)) 16px calc(20px + env(safe-area-inset-bottom, 0px))",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div style={{
            background: "#fff",
            borderRadius: 16,
            width: "100%",
            maxWidth: 360,
            maxHeight: "calc(100dvh - max(40px, env(safe-area-inset-top, 40px)) - env(safe-area-inset-bottom, 20px))",
            boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            <div style={{ padding: "18px 20px 12px", borderBottom: "1px solid #F3F4F6" }}>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: "#1F4030", margin: "0 0 4px" }}>
                Archive {client?.name?.split(' ')[0] || 'client'}?
              </h3>
              <p style={{ fontSize: 12.5, color: "#6B7280", margin: 0, lineHeight: 1.5 }}>
                Pick a reason. They will be hidden from your active client list. You can restore them anytime.
              </p>
            </div>
            <div style={{ padding: "12px 12px 8px", overflowY: "auto", flex: 1, minHeight: 0 }}>
              {DNR_REASONS.map(r => (
                <button key={r} onClick={() => toggleArchive(r)} disabled={archiveSaving}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "#FAFAF7",
                    border: "1px solid #E5E7EB",
                    padding: "12px 14px",
                    borderRadius: 10,
                    fontSize: 14,
                    color: "#1F4030",
                    cursor: archiveSaving ? "wait" : "pointer",
                    fontWeight: 600,
                    fontFamily: "inherit",
                    marginBottom: 6,
                  }}>
                  {r}
                </button>
              ))}
            </div>
            <div style={{
              padding: "12px 16px",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
              borderTop: "1px solid #F3F4F6",
              flexShrink: 0,
            }}>
              <button onClick={() => setShowArchiveMenu(false)} disabled={archiveSaving}
                style={{
                  width: "100%",
                  background: "#fff",
                  color: "#6B7280",
                  border: "1.5px solid #E5E7EB",
                  borderRadius: 10,
                  padding: "10px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore path: handled by a useEffect at the top of the file
          that watches showArchiveMenu + isArchived. Setting the menu
          true on an already-archived client immediately calls
          toggleArchive(null) and resets. */}
      {/* Merge Modal */}
      {/* Merge duplicate client SIDE PANEL. HK May 27 2026 Design
          Principle 31: migrated from centered modal to side panel. */}
      <SidePanel
        open={showMerge}
        onClose={() => { setShowMerge(false); setMergeTarget(null); setMergeSearch(""); setMergeResults([]); }}
        title="Merge duplicate client"
        subtitle={`All sessions from the duplicate will move to ${client.name}, then the duplicate is deleted.`}
        footer={(
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setShowMerge(false); setMergeTarget(null); setMergeSearch(""); setMergeResults([]); }}
              style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: `1.5px solid ${C.lightGray}`, background: "#fff", color: C.gray, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
            <button onClick={executeMerge} disabled={!mergeTarget || mergeSaving}
              style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: mergeTarget ? "#DC2626" : "#E5E7EB", color: "#fff", fontSize: 14, fontWeight: 700, cursor: mergeTarget ? "pointer" : "not-allowed", opacity: mergeSaving ? 0.6 : 1, fontFamily: "inherit" }}>
              {mergeSaving ? "Merging..." : "Merge and delete duplicate"}
            </button>
          </div>
        )}
      >
        {/* Primary client */}
        <div style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#16A34A", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Keep this record (primary)</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.darkGray }}>{client.name}</div>
          <div style={{ fontSize: 12, color: C.gray }}>{client.email || formatUSPhone(client.phone) || "No contact on file"}</div>
        </div>

        {/* Search for duplicate */}
        <input
          autoFocus
          value={mergeSearch}
          onChange={e => searchClients(e.target.value)}
          placeholder="Search for the duplicate by name..."
          style={{ width: "100%", padding: "11px 14px", border: `1.5px solid ${C.lightGray}`, borderRadius: 10, fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 10, fontFamily: "inherit" }}
        />

        {mergeResults.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {mergeResults.map(r => (
              <div key={r.id} onClick={() => setMergeTarget(r)}
                style={{ padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${mergeTarget?.id === r.id ? "#DC2626" : C.lightGray}`,
                  background: mergeTarget?.id === r.id ? "#FEF2F2" : "#fff", cursor: "pointer", transition: "all 0.15s" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: mergeTarget?.id === r.id ? "#DC2626" : C.darkGray }}>{r.name}</div>
                <div style={{ fontSize: 12, color: C.gray }}>{r.email || formatUSPhone(r.phone) || "No contact"} · Added {new Date(r.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}

        {mergeTarget && (
          <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 12, padding: "12px 16px", marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Duplicate to delete after merge</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#991B1B" }}>{mergeTarget.name}</div>
            <div style={{ fontSize: 12, color: "#DC2626" }}>{mergeTarget.email || formatUSPhone(mergeTarget.phone) || "No contact on file"}</div>
          </div>
        )}

        {mergeError && <div style={{ fontSize: 13, color: "#DC2626", marginTop: 6, fontWeight: 600 }}>⚠ {mergeError}</div>}
      </SidePanel>

      {!compact && (
      <div style={{ marginBottom: "20px" }}>
        {/* Top row: back + name + sessions count.
            In compact mode (mounted inside ClientProfile),
            ProfileHeader already shows the name + back button,
            so this whole row is hidden via the outer conditional.
            Action buttons and balance card below are kept visible. */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: 10 }}>
          <button onClick={onBack} style={{ background: "transparent", border: `1.5px solid ${C.lightGray}`, color: C.gray, padding: "8px 14px", borderRadius: "8px", fontSize: "13px", cursor: "pointer", fontFamily: "system-ui", whiteSpace: "nowrap", flexShrink: 0 }}>
            ← All
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(20px, 5.5vw, 28px)", fontWeight: "700", color: isArchived ? "#6B7280" : C.darkGray, margin: 0, letterSpacing: "-0.5px", lineHeight: 1.15 }}>
                {client.name}
              </h2>
              {isArchived && (
                <span style={{ background: "#FEE2E2", color: "#991B1B", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
                  ⛔ {dnrReason || "Archived"}
                </span>
              )}
            </div>
            <p style={{ fontSize: "13px", color: C.gray, margin: "2px 0 0" }}>{bookedCount} session{bookedCount !== 1 ? "s" : ""} on record</p>
          </div>
        </div>
      </div>
      )}

      {/* Action buttons row.
          Edit / Book Next / Merge / Archive access lives inside the
          Sessions and SOAP notes section. The package + membership
          balance display previously lived here (ClientPackageBalance)
          but moved to its own dedicated 'Memberships & Packages'
          section in the May 24 2026 redesign. Keeping a duplicate
          here caused two display bugs: (1) it rendered inside the
          wrong section visually, and (2) it didn't refresh when the
          therapist cancelled a package or membership in the new
          section, leaving stale 'active' rows on screen. */}
      {/* HK May 27 2026 Ship 1: the four action buttons that used to
          live here (Edit details / Book next / Merge / Archive) moved
          UP to ProfileHeader so the 70yo persona can reach them
          without scrolling past 4-5 cards. Removing the duplicate
          row here per HK: 'we need to remove the buttons from Session
          and SOAP notes. They should not be duplicated.'
          The Archive inline sub-menu logic still lives below, gated
          by setShowArchiveMenu which the ProfileHeader Archive button
          now triggers via externalShowArchive. */}
      <div style={{ marginBottom: "20px" }}>
      </div>

      {!compact && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          // "Total" = appointments booked (from bookings table, the
          // real appointment record). Sublabel makes it clear that
          // this includes pending intake states.
          // "Complete" = bookings marked completed.
          // "Intake Done" = SOAP-note records (sessions table) that
          // have not yet been finalized. Surfaces the day-of workflow
          // bottleneck of intakes filled but no notes written.
          { label: "Total", sublabel: "appointments booked", value: bookedCount, color: C.forest },
          { label: "✅ Complete", value: completedCount, color: C.sage },
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
      )}


      {/* HK May 29 2026: removed the inline Card on File widget that
          lived here. State is now shown in the StatusStrip tile at the
          top of the client profile. Save/charge actions will move to
          a dedicated surface in a follow-up; for now we are not
          duplicating the affordance inside Sessions and SOAP notes. */}

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: C.gray }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🌿</div>
          <p style={{ fontFamily: "Georgia, serif" }}>Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px 24px", color: C.gray }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <path d="M18 14 L42 14 L46 18 L46 52 L18 52 Z" stroke="#4A6B54" strokeWidth="1.4" fill="#FFFFFF" />
              <path d="M42 14 L42 18 L46 18" stroke="#4A6B54" strokeWidth="1.4" fill="none" />
              <line x1="24" y1="28" x2="40" y2="28" stroke="#4A6B54" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
              <line x1="24" y1="34" x2="40" y2="34" stroke="#4A6B54" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
              <line x1="24" y1="40" x2="36" y2="40" stroke="#4A6B54" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
            </svg>
          </div>
          <p style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 700, color: "#1F3A2C", margin: "0 0 4px", letterSpacing: "-0.005em" }}>Notes will gather here</p>
          <p style={{ fontSize: 12.5, color: "#8A9C90", maxWidth: 320, margin: "0 auto", lineHeight: 1.5 }}>SOAP notes appear after each session. The client submits intake before the visit; you write the note after.</p>
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
          {/* Hover-reveal Delete button. On click, opens the inline
              confirm pill instead of deleting immediately or popping
              a modal. Per HK May 16 2026: the bare × glyph is not
              understood by older personas; the word "Delete" is. */}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
              aria-label={session.completed ? "Delete this completed session" : "Delete this incomplete intake"}
              title={session.completed ? "Delete this completed session" : "Delete this incomplete intake"}
              style={{
                background: hovered ? "#FEF2F2" : "transparent",
                border: hovered ? "1px solid #FECACA" : "1px solid transparent",
                color: hovered ? "#DC2626" : "transparent",
                minHeight: 32,
                padding: "4px 12px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.02em',
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >Delete</button>
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
