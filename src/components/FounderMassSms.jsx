// src/components/FounderMassSms.jsx
//
// Founder-only mass-text broadcast tool. Three modes layered:
//
//   1. ONE AT A TIME (default): tap "Text" per row -> Messages opens
//      pre-filled. Each link is personalized with {name} substitution.
//
//   2. GUIDED SEQUENCE: multi-select via checkboxes, then step through
//      the chosen recipients one Messages tap at a time. No copy-paste,
//      no list-scrolling between sends.
//
//   3. TWILIO BATCH (advanced, opt-in): paste your Twilio credentials
//      once (stored in localStorage), select recipients, hit send. The
//      send-sms Edge Function is called per recipient with each message
//      personalized. Real send, not Messages-app handoff. ~$0.01/text.
//
// Why all three modes:
//   - "One at a time" matches the founder-from-personal-number feel.
//   - "Guided sequence" preserves the personal feel but accelerates
//     the workflow (no scroll, no marking-sent friction).
//   - "Twilio batch" handles 100+ recipients without any taps. Texts
//     come from your registered Twilio number (less personal, more
//     scalable).

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const C = {
  forest: "#2A5741",
  sage: "#6B9E80",
  cream: "#FFF9F3",
  dark: "#1F2937",
  gray: "#6B7280",
  light: "#E8E4DC",
  gold: "#C59550",
  softCream: "#F9F8F5",
  rose: "#B44A3A",
  blue: "#1E5F8A",
};

const STORAGE_KEY = "founder_mass_sms_sent_ids";
const TWILIO_KEY = "founder_twilio_creds_v1";

const ADMIN_EMAILS = new Set([
  "bodymap01@gmail.com",
  "bodymapdemo@gmail.com",
  "harshk.mba@gmail.com",
]);

const DEFAULT_MESSAGE = `Hey {name}, it's HK from MyBodyMap. Big update just shipped: Settings is fully rebuilt, plus Add-ons, Packages, Memberships, and Group Classes are live now. Worth a fresh look: mybodymap.app. Hit me back with any questions or what you'd like to see next.`;

function normalizePhone(p) {
  if (!p) return null;
  const digits = String(p).replace(/[^0-9+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return "+" + digits;
}

function firstNameFrom(fullName) {
  if (!fullName) return "there";
  const f = fullName.trim().split(/\s+/)[0];
  if (!f) return "there";
  // Capitalize properly in case input is uppercase or lowercase
  return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
}

function personalize(template, firstName) {
  return (template || "")
    .replace(/\{name\}/gi, firstName || "there")
    .replace(/\{first_name\}/gi, firstName || "there");
}

function loadSentSet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveSentSet(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

function loadTwilio() {
  try {
    const raw = localStorage.getItem(TWILIO_KEY);
    if (!raw) return { sid: "", token: "", from: "" };
    const parsed = JSON.parse(raw);
    return { sid: parsed.sid || "", token: parsed.token || "", from: parsed.from || "" };
  } catch {
    return { sid: "", token: "", from: "" };
  }
}

function saveTwilio(creds) {
  try {
    localStorage.setItem(TWILIO_KEY, JSON.stringify(creds));
  } catch {
    /* ignore */
  }
}

// AccountAudit -- collapsible diagnostic panel that lists EVERY row in the
// therapists table along with why it does or does not show in the broadcast
// list. Helps HK quickly verify nothing is silently filtered out.
function AccountAudit({ therapists, includeAdmins }) {
  const [open, setOpen] = useState(false);
  const list = therapists || [];

  const enriched = list.map((t) => {
    const phone = normalizePhone(t.phone);
    const isAdmin = t.email && ADMIN_EMAILS.has(t.email.toLowerCase());
    const isDummy = !!t.is_dummy;
    const reasons = [];
    if (isDummy && !includeAdmins) reasons.push("Hidden (test/demo)");
    if (!phone) reasons.push("No phone");
    if (!t.email) reasons.push("No email");
    return {
      id: t.id,
      full_name: t.full_name,
      business_name: t.business_name,
      email: t.email,
      phone,
      isAdmin,
      isDummy,
      shown: !(isDummy && !includeAdmins),
      reasons,
    };
  });

  enriched.sort((a, b) => {
    if (a.shown !== b.shown) return a.shown ? -1 : 1;
    return (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "");
  });

  return (
    <div style={{
      marginTop: 16, marginBottom: 14,
      background: "#fff", border: `1px solid ${C.light}`,
      borderRadius: 10, overflow: "hidden",
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: C.dark }}>
          📋 Account audit · {list.length} total in database
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.18s" }}>
          <path d="M4 2l4 4-4 4" />
        </svg>
      </div>
      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${C.light}` }}>
          <p style={{ fontSize: 11, color: C.gray, margin: "10px 0 12px", lineHeight: 1.5 }}>
            Every row in the <code>therapists</code> table. If an account is missing here, it does not exist in Supabase. If it appears in yellow, the reason is shown on the right.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontFamily: "monospace" }}>
            {enriched.map((t) => (
              <div key={t.id} style={{
                display: "flex", gap: 8, alignItems: "center",
                padding: "6px 10px", borderRadius: 6,
                background: t.shown ? "#F0FDF4" : "#FEF3C7",
                border: `1px solid ${t.shown ? "#BBF7D0" : "#FDE68A"}`,
                flexWrap: "wrap",
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: t.shown ? C.sage : "#92400E",
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1, minWidth: 200, color: C.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <strong>{t.full_name || t.business_name || "(no name)"}</strong>
                  {" · "}
                  <span style={{ color: C.gray }}>{t.email || "(no email)"}</span>
                  {" · "}
                  <span style={{ color: C.gray }}>{t.phone || "(no phone)"}</span>
                </span>
                {t.isAdmin && <span style={{ background: C.gold, color: "#fff", padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>YOU</span>}
                {t.isDummy && !t.isAdmin && <span style={{ background: "#9CA3AF", color: "#fff", padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>TEST</span>}
                {t.reasons.length > 0 && (
                  <span style={{ color: "#92400E", fontSize: 10 }}>
                    {t.reasons.join(" · ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FounderMassSms({ therapists }) {
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sentIds, setSentIds] = useState(() => loadSentSet());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [includeAdmins, setIncludeAdmins] = useState(false);
  const [hideSent, setHideSent] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(true);

  // Twilio backend mode state
  const [twilio, setTwilio] = useState(loadTwilio);
  const [twilioPanelOpen, setTwilioPanelOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ done: 0, total: 0, errors: [] });

  // Guided sequence state
  const [sequenceQueue, setSequenceQueue] = useState(null); // null | { ids: [...], index: 0 }

  useEffect(() => {
    saveSentSet(sentIds);
  }, [sentIds]);

  useEffect(() => {
    saveTwilio(twilio);
  }, [twilio]);

  // Build candidate list. By default hide is_dummy accounts (test, demo,
  // admin emails are all flagged is_dummy by isDummyEmail in the parent).
  // When showTest is on, surface them with a 'TEST' badge so HK can verify
  // his broadcast on his own demo account before sending to real users.
  //
  // We do NOT filter out accounts without phones -- HK needs to SEE every
  // account so he knows who's missing a phone (vs silently dropping them
  // and being confused why the count is short). No-phone rows render with
  // a disabled Text button and an Email button instead.
  const candidates = useMemo(() => {
    const list = (therapists || [])
      .filter((t) => {
        if (t.is_dummy && !includeAdmins) return false;
        return true;
      })
      .map((t) => {
        const isAdmin = t.email && ADMIN_EMAILS.has(t.email.toLowerCase());
        const phone = normalizePhone(t.phone);
        return {
          id: t.id,
          name: t.full_name || t.business_name || t.email || "Unknown",
          firstName: firstNameFrom(t.full_name || t.business_name),
          email: t.email,
          phone,
          plan: t.plan,
          rawPhone: t.phone,
          isAdmin,
          isTest: !!t.is_dummy,
          hasPhone: !!phone,
        };
      });
    list.sort((a, b) => {
      // Sort: phoneless accounts at the end so HK works through textable ones first
      if (a.hasPhone !== b.hasPhone) return a.hasPhone ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    });
    return list;
  }, [therapists, includeAdmins]);

  const noPhoneCount = candidates.filter((t) => !t.hasPhone).length;
  const hasPhoneCount = candidates.filter((t) => t.hasPhone).length;

  const filtered = useMemo(() => {
    let list = candidates;
    if (hideSent) list = list.filter((t) => !sentIds.has(t.id));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) =>
        (t.name || "").toLowerCase().includes(q) ||
        (t.email || "").toLowerCase().includes(q) ||
        (t.phone || "").includes(q)
      );
    }
    return list;
  }, [candidates, hideSent, sentIds, search]);

  const sentCount = candidates.filter((t) => sentIds.has(t.id)).length;
  const totalCount = candidates.length;
  const selectedInFiltered = filtered.filter((t) => selectedIds.has(t.id)).length;
  const allFilteredSelected = filtered.length > 0 && selectedInFiltered === filtered.filter((t) => t.hasPhone).length && filtered.filter((t) => t.hasPhone).length > 0;
  const twilioReady = !!(twilio.sid && twilio.token && twilio.from);

  const markSent = (id) => {
    setSentIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const unmarkSent = (id) => {
    setSentIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((t) => { if (t.hasPhone) next.add(t.id); });
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const resetAll = () => {
    if (!window.confirm("Reset progress? All recipients will appear as not-yet-texted.")) return;
    setSentIds(new Set());
    clearSelection();
  };

  const smsUrl = (phone, personalizedMsg) =>
    `sms:${phone}?body=${encodeURIComponent(personalizedMsg)}`;

  // ─── Guided sequence ──────────────────────────────────────────────
  const startSequence = () => {
    const ids = filtered.filter((t) => selectedIds.has(t.id) && !sentIds.has(t.id)).map((t) => t.id);
    if (ids.length === 0) return;
    setSequenceQueue({ ids, index: 0 });
  };

  const sequenceCurrent = sequenceQueue
    ? candidates.find((t) => t.id === sequenceQueue.ids[sequenceQueue.index])
    : null;

  const sequenceAdvance = () => {
    if (!sequenceQueue) return;
    if (sequenceCurrent) markSent(sequenceCurrent.id);
    const nextIndex = sequenceQueue.index + 1;
    if (nextIndex >= sequenceQueue.ids.length) {
      setSequenceQueue(null);
      clearSelection();
    } else {
      setSequenceQueue({ ...sequenceQueue, index: nextIndex });
    }
  };

  const sequenceSkip = () => {
    if (!sequenceQueue) return;
    const nextIndex = sequenceQueue.index + 1;
    if (nextIndex >= sequenceQueue.ids.length) {
      setSequenceQueue(null);
    } else {
      setSequenceQueue({ ...sequenceQueue, index: nextIndex });
    }
  };

  const sequenceCancel = () => setSequenceQueue(null);

  // ─── Twilio batch send ────────────────────────────────────────────
  const sendViaTwilio = async () => {
    if (!twilioReady) {
      window.alert("Add Twilio credentials first (Account SID, Auth Token, From Number).");
      return;
    }
    const recipients = filtered.filter((t) => selectedIds.has(t.id));
    if (recipients.length === 0) {
      window.alert("Select at least one recipient.");
      return;
    }
    if (!window.confirm(`Send Twilio SMS to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}? Estimated cost ~$${(recipients.length * 0.01).toFixed(2)} (Twilio US rates).`)) return;

    setSending(true);
    setSendProgress({ done: 0, total: recipients.length, errors: [] });

    // Process in small parallel batches to avoid Twilio rate limits.
    const batchSize = 5;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(batch.map(async (t) => {
        const personalizedMsg = personalize(message, t.firstName);
        try {
          const { data, error } = await supabase.functions.invoke("send-sms", {
            body: {
              to: t.phone,
              message: personalizedMsg,
              account_sid: twilio.sid,
              auth_token: twilio.token,
              from_number: twilio.from,
            },
          });
          if (error || (data && data.error)) {
            setSendProgress((prev) => ({
              ...prev,
              done: prev.done + 1,
              errors: [...prev.errors, { name: t.name, error: (error?.message) || (data?.error?.message || data?.error || "unknown") }],
            }));
          } else {
            markSent(t.id);
            setSendProgress((prev) => ({ ...prev, done: prev.done + 1 }));
          }
        } catch (e) {
          setSendProgress((prev) => ({
            ...prev,
            done: prev.done + 1,
            errors: [...prev.errors, { name: t.name, error: e.message || String(e) }],
          }));
        }
      }));
    }

    setSending(false);
    clearSelection();
  };

  return (
    <div style={{
      background: C.cream,
      border: `1px solid ${C.light}`,
      borderRadius: 14,
      padding: 0,
      marginBottom: 24,
      overflow: "hidden",
    }}>
      {/* Collapsed header */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "16px 20px", cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: C.forest, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 5h14v11H10l-3 3v-3H5z" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>
            Mass text broadcast
          </div>
          <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
            {totalCount > 0
              ? `${sentCount} of ${hasPhoneCount} textable · ${totalCount} shown · ${(therapists || []).length} in database${selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ""}`
              : "Loading recipients…"}
          </div>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 12 12" fill="none"
          stroke={collapsed ? "#9CA3AF" : C.forest}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: collapsed ? "rotate(0deg)" : "rotate(90deg)", transition: "transform 0.18s" }}
        >
          <path d="M4 2l4 4-4 4" />
        </svg>
      </div>

      {!collapsed && (
        <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${C.light}` }}>
          {/* Quick toggle for testing -- prominent placement so HK can flip
              it without scrolling to the filter row below. */}
          <div style={{
            marginTop: 16,
            padding: "10px 14px",
            background: includeAdmins ? "#FFFBEB" : C.softCream,
            border: `1px solid ${includeAdmins ? "#FDE68A" : C.light}`,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: C.dark, cursor: "pointer", flex: 1, minWidth: 0 }}>
              <input
                type="checkbox"
                checked={includeAdmins}
                onChange={(e) => setIncludeAdmins(e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              Test mode: include my test &amp; demo accounts in the broadcast list
            </label>
            {includeAdmins && (
              <span style={{ fontSize: 11, color: "#92400E", fontWeight: 600, fontStyle: "italic" }}>
                Test mode ON · your accounts now textable above
              </span>
            )}
          </div>

          {/* Account audit -- shows EVERY row in the therapists table so HK
              can see who's missing and why. Toggle to expand. */}
          <AccountAudit therapists={therapists} includeAdmins={includeAdmins} />

          {/* Message editor */}
          <div style={{ marginTop: 16, marginBottom: 14 }}>
            <label style={{
              display: "block",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", color: C.sage, marginBottom: 6,
            }}>
              Message · use <code style={{ background: C.softCream, padding: "1px 6px", borderRadius: 4, fontSize: 10 }}>{"{name}"}</code> for first-name personalization
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              style={{
                width: "100%", background: "#fff", border: `1px solid ${C.light}`,
                borderRadius: 10, padding: "12px 14px", fontSize: 14,
                lineHeight: 1.5, color: C.dark, fontFamily: "inherit",
                outline: "none", resize: "vertical", boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: C.gray, gap: 8, flexWrap: "wrap" }}>
              <span>{message.length} chars · {Math.ceil(message.length / 160)} SMS segment{Math.ceil(message.length / 160) === 1 ? "" : "s"}</span>
              <button
                onClick={() => setMessage(DEFAULT_MESSAGE)}
                style={{
                  background: "transparent", border: "none", color: C.gray,
                  fontSize: 11, cursor: "pointer", padding: 0,
                  textDecoration: "underline",
                }}
              >
                Reset to default
              </button>
            </div>
          </div>

          {/* Twilio panel (collapsible) */}
          <div style={{
            background: "#fff", border: `1px solid ${C.light}`,
            borderRadius: 10, marginBottom: 14, overflow: "hidden",
          }}>
            <div
              onClick={() => setTwilioPanelOpen(!twilioPanelOpen)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", cursor: "pointer", userSelect: "none",
              }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: twilioReady ? C.sage : C.light, flexShrink: 0,
              }} />
              <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: C.dark }}>
                Twilio batch send {twilioReady ? "· ready" : "· not configured"}
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: twilioPanelOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.18s" }}>
                <path d="M4 2l4 4-4 4" />
              </svg>
            </div>
            {twilioPanelOpen && (
              <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${C.light}` }}>
                <p style={{ fontSize: 11, color: C.gray, margin: "10px 0 12px", lineHeight: 1.5 }}>
                  Pasted credentials are stored in your browser only (localStorage on this device). Once configured, you can select recipients and send via Twilio in one batch with no Messages-app handoff. ~$0.01 per US SMS.
                </p>
                <div style={{ display: "grid", gap: 8 }}>
                  <input type="text" value={twilio.sid}
                    onChange={(e) => setTwilio({ ...twilio, sid: e.target.value })}
                    placeholder="Twilio Account SID (starts with AC...)"
                    style={{ padding: "8px 12px", border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 12, fontFamily: "monospace", outline: "none" }}
                  />
                  <input type="password" value={twilio.token}
                    onChange={(e) => setTwilio({ ...twilio, token: e.target.value })}
                    placeholder="Twilio Auth Token"
                    style={{ padding: "8px 12px", border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 12, fontFamily: "monospace", outline: "none" }}
                  />
                  <input type="text" value={twilio.from}
                    onChange={(e) => setTwilio({ ...twilio, from: e.target.value })}
                    placeholder="From number (E.164, e.g. +18325550100)"
                    style={{ padding: "8px 12px", border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 12, fontFamily: "monospace", outline: "none" }}
                  />
                </div>
                <div style={{ marginTop: 10, fontSize: 10, color: C.gray, lineHeight: 1.5 }}>
                  Find these at <a href="https://console.twilio.com" target="_blank" rel="noreferrer" style={{ color: C.forest }}>console.twilio.com</a>. From Number must be a Twilio-verified phone (or a verified caller ID for trial accounts).
                </div>
              </div>
            )}
          </div>

          {/* Filters and toggles */}
          <div style={{
            display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
            marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.light}`,
          }}>
            <input type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, email, phone…"
              style={{
                flex: 1, minWidth: 180, padding: "8px 12px",
                border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13,
                background: "#fff", outline: "none",
              }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.gray, cursor: "pointer" }}>
              <input type="checkbox" checked={hideSent} onChange={(e) => setHideSent(e.target.checked)} />
              Hide already texted
            </label>
            <button onClick={resetAll}
              style={{
                background: "transparent", border: `1px solid ${C.light}`,
                color: C.gray, padding: "7px 12px", borderRadius: 8,
                fontSize: 12, cursor: "pointer",
              }}
            >
              Reset progress
            </button>
          </div>

          {/* Selection toolbar — appears when 1+ selected */}
          {selectedIds.size > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              padding: "12px 14px", marginBottom: 14,
              background: C.softCream, border: `1px solid ${C.light}`,
              borderRadius: 10,
            }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: C.dark }}>
                {selectedIds.size} selected
              </div>
              <button onClick={clearSelection}
                style={{
                  background: "transparent", border: `1px solid ${C.light}`,
                  color: C.gray, padding: "7px 12px", borderRadius: 8,
                  fontSize: 12, cursor: "pointer",
                }}
              >
                Clear
              </button>
              <button onClick={startSequence}
                disabled={selectedIds.size === 0}
                style={{
                  background: C.blue, color: "#fff", border: "none",
                  padding: "8px 14px", borderRadius: 8,
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                Step through ({selectedIds.size}) →
              </button>
              <button onClick={sendViaTwilio}
                disabled={!twilioReady || sending}
                title={twilioReady ? "" : "Add Twilio credentials above to enable"}
                style={{
                  background: twilioReady ? C.forest : "#D1D5DB",
                  color: "#fff", border: "none",
                  padding: "8px 14px", borderRadius: 8,
                  fontSize: 12, fontWeight: 600,
                  cursor: twilioReady && !sending ? "pointer" : "not-allowed",
                }}
              >
                {sending ? `Sending ${sendProgress.done}/${sendProgress.total}…` : `Send via Twilio (${selectedIds.size})`}
              </button>
            </div>
          )}

          {/* Send-progress banner (Twilio mode) */}
          {sendProgress.total > 0 && !sending && (
            <div style={{
              marginBottom: 14, padding: "10px 14px",
              background: sendProgress.errors.length === 0 ? "#F0FDF4" : "#FEF3C7",
              border: `1px solid ${sendProgress.errors.length === 0 ? "#86EFAC" : "#FDE68A"}`,
              borderRadius: 10, fontSize: 12, color: C.dark,
            }}>
              <strong>Twilio batch complete:</strong> {sendProgress.done - sendProgress.errors.length}/{sendProgress.total} sent
              {sendProgress.errors.length > 0 && (
                <>
                  , {sendProgress.errors.length} failed.
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: "pointer", color: C.gray }}>Show errors</summary>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 11 }}>
                      {sendProgress.errors.map((e, i) => (
                        <li key={i}><strong>{e.name}:</strong> {e.error}</li>
                      ))}
                    </ul>
                  </details>
                </>
              )}
              <button onClick={() => setSendProgress({ done: 0, total: 0, errors: [] })}
                style={{
                  background: "transparent", border: "none", color: C.gray,
                  fontSize: 11, marginLeft: 8, cursor: "pointer", textDecoration: "underline",
                }}>
                dismiss
              </button>
            </div>
          )}

          {/* Bulk select toolbar */}
          {filtered.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 0 12px", fontSize: 12, color: C.gray,
            }}>
              <button
                onClick={allFilteredSelected ? clearSelection : selectAllFiltered}
                style={{
                  background: "transparent", border: `1px solid ${C.light}`,
                  color: C.dark, padding: "5px 10px", borderRadius: 6,
                  fontSize: 11, cursor: "pointer",
                }}
              >
                {allFilteredSelected ? "Deselect all visible" : `Select all visible (${filtered.length})`}
              </button>
            </div>
          )}

          {/* Recipient list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.length === 0 && (
              <div style={{
                padding: 24, textAlign: "center",
                color: C.gray, fontSize: 13,
                background: "#fff", borderRadius: 10,
                border: `1px dashed ${C.light}`,
              }}>
                {hideSent && sentCount === totalCount
                  ? "All recipients texted. Tap 'Reset progress' to start a new round."
                  : "No recipients match the filter."}
              </div>
            )}

            {filtered.map((t) => {
              const isSent = sentIds.has(t.id);
              const isSelected = selectedIds.has(t.id);
              const personalizedMsg = personalize(message, t.firstName);
              const previewSnippet = personalizedMsg.slice(0, 60) + (personalizedMsg.length > 60 ? "…" : "");
              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: isSelected ? "#EFF6FF" : (isSent ? C.softCream : "#fff"),
                    border: `1px solid ${isSelected ? "#BFDBFE" : C.light}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    opacity: isSent && !isSelected ? 0.7 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!t.hasPhone}
                    onChange={() => toggleSelected(t.id)}
                    style={{ flexShrink: 0, cursor: t.hasPhone ? "pointer" : "not-allowed", width: 16, height: 16 }}
                  />
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: isSent ? C.sage : (t.hasPhone ? C.light : "#FEE2E2"),
                    color: isSent ? "#fff" : (t.hasPhone ? C.gray : C.rose),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 600, flexShrink: 0,
                  }}>
                    {isSent ? "✓" : (t.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: C.dark,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      textDecoration: isSent ? "line-through" : "none",
                    }}>
                      {t.name}
                      {t.isTest && (
                        <span style={{
                          marginLeft: 8, fontSize: 9, fontWeight: 700,
                          background: t.isAdmin ? C.gold : "#9CA3AF",
                          color: "#fff",
                          padding: "1px 6px", borderRadius: 99,
                          textTransform: "uppercase", letterSpacing: "0.04em",
                        }}>{t.isAdmin ? "You" : "Test"}</span>
                      )}
                      {t.plan && t.plan !== "free" && (
                        <span style={{
                          marginLeft: 6, fontSize: 9, fontWeight: 700,
                          background: t.plan === "gold" ? C.gold : C.sage,
                          color: "#fff", padding: "1px 6px", borderRadius: 99,
                          textTransform: "uppercase", letterSpacing: "0.04em",
                        }}>{t.plan}</span>
                      )}
                      {!t.hasPhone && (
                        <span style={{
                          marginLeft: 6, fontSize: 9, fontWeight: 700,
                          background: C.rose, color: "#fff",
                          padding: "1px 6px", borderRadius: 99,
                          textTransform: "uppercase", letterSpacing: "0.04em",
                        }}>No phone</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 1 }}>
                      {t.hasPhone
                        ? `${t.phone} · "${previewSnippet}"`
                        : (t.email
                            ? `${t.email} · no phone on file`
                            : "no phone or email on file")}
                    </div>
                  </div>
                  {isSent ? (
                    <button
                      onClick={() => unmarkSent(t.id)}
                      style={{
                        background: "transparent", border: `1px solid ${C.light}`,
                        color: C.gray, padding: "6px 10px", borderRadius: 7,
                        fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
                      }}
                    >
                      Undo
                    </button>
                  ) : t.hasPhone ? (
                    <a
                      href={smsUrl(t.phone, personalizedMsg)}
                      onClick={() => { setTimeout(() => markSent(t.id), 250); }}
                      style={{
                        background: C.forest, color: "#fff",
                        border: "none", padding: "7px 14px", borderRadius: 7,
                        fontSize: 12, fontWeight: 600,
                        textDecoration: "none", whiteSpace: "nowrap",
                        cursor: "pointer",
                      }}
                    >
                      Text
                    </a>
                  ) : t.email ? (
                    <a
                      href={`mailto:${t.email}?subject=${encodeURIComponent("Quick update from MyBodyMap")}&body=${encodeURIComponent(personalizedMsg)}`}
                      onClick={() => { setTimeout(() => markSent(t.id), 250); }}
                      style={{
                        background: C.blue, color: "#fff",
                        border: "none", padding: "7px 14px", borderRadius: 7,
                        fontSize: 12, fontWeight: 600,
                        textDecoration: "none", whiteSpace: "nowrap",
                        cursor: "pointer",
                      }}
                      title="No phone on file — opens email instead"
                    >
                      Email
                    </a>
                  ) : (
                    <span style={{
                      fontSize: 11, color: C.gray, fontStyle: "italic",
                      whiteSpace: "nowrap", padding: "7px 10px",
                    }}>
                      No contact
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {noPhoneCount > 0 && (
            <div style={{
              marginTop: 14, padding: "10px 12px",
              background: "#FEF3C7", border: "1px solid #FDE68A",
              borderRadius: 8, fontSize: 12, color: "#92400E", lineHeight: 1.5,
            }}>
              <strong>{noPhoneCount}</strong> {noPhoneCount === 1 ? "account has" : "accounts have"} no phone on file (shown at the bottom of the list with a "No phone" badge). Use the blue <strong>Email</strong> button to reach them via mailto:, or update their phone in Supabase to enable SMS.
            </div>
          )}

          <div style={{
            marginTop: 14, padding: "10px 12px",
            background: "#fff", border: `1px solid ${C.light}`,
            borderRadius: 8, fontSize: 11, color: C.gray, lineHeight: 1.5,
          }}>
            <strong style={{ color: C.dark }}>Three ways to send:</strong> (1) Tap "Text" on any row to open Messages pre-filled — one tap per person, comes from your number. (2) Check several rows and tap "Step through" to be guided through them one at a time. (3) Configure Twilio above and tap "Send via Twilio" to send all selected at once with no Messages handoff (~$0.01/text).
          </div>
        </div>
      )}

      {/* Guided sequence modal */}
      {sequenceQueue && sequenceCurrent && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(31,41,55,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: 20,
        }}
          onClick={(e) => { if (e.target === e.currentTarget) sequenceCancel(); }}
        >
          <div style={{
            background: "#fff", borderRadius: 16, maxWidth: 420, width: "100%",
            padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.sage, marginBottom: 4 }}>
              {sequenceQueue.index + 1} of {sequenceQueue.ids.length}
            </div>
            <h3 style={{ margin: "0 0 4px", fontSize: 22, fontFamily: "Georgia, serif", color: C.dark }}>
              Text {sequenceCurrent.firstName}
            </h3>
            <p style={{ fontSize: 12, color: C.gray, margin: "0 0 16px" }}>
              {sequenceCurrent.name} · {sequenceCurrent.phone}
            </p>
            <div style={{
              background: C.softCream, border: `1px solid ${C.light}`,
              borderRadius: 10, padding: "12px 14px", marginBottom: 16,
              fontSize: 13, lineHeight: 1.5, color: C.dark,
            }}>
              {personalize(message, sequenceCurrent.firstName)}
            </div>
            <a
              href={smsUrl(sequenceCurrent.phone, personalize(message, sequenceCurrent.firstName))}
              onClick={() => setTimeout(sequenceAdvance, 350)}
              style={{
                display: "block", textAlign: "center",
                background: C.forest, color: "#fff",
                padding: "12px 20px", borderRadius: 10,
                fontSize: 14, fontWeight: 600, textDecoration: "none",
                marginBottom: 8,
              }}
            >
              Open Messages →
            </a>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={sequenceSkip}
                style={{
                  flex: 1, background: "transparent",
                  border: `1px solid ${C.light}`, color: C.gray,
                  padding: "10px", borderRadius: 8, fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Skip
              </button>
              <button onClick={sequenceCancel}
                style={{
                  flex: 1, background: "transparent",
                  border: `1px solid ${C.light}`, color: C.gray,
                  padding: "10px", borderRadius: 8, fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel sequence
              </button>
            </div>
            <p style={{ fontSize: 11, color: C.gray, margin: "12px 0 0", textAlign: "center", lineHeight: 1.5 }}>
              After tapping Open Messages, hit Send in iOS, then come back here. The next recipient appears automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
