// src/components/FounderMassSms.jsx
//
// Founder-only mass-text broadcast tool. Sits at the top of FounderDashboard.
// No Twilio cost: uses the sms: URI scheme so each "Text" button opens the
// device's native Messages app pre-filled with the recipient's phone number
// and the broadcast message. HK taps Send, comes back, taps the next person.
//
// Why sms: not Twilio:
//   - Texts come from HK's personal phone number (a recognizable founder
//     touch, not a generic shortcode).
//   - Zero infra cost or setup.
//   - Personal accountability -- replies come back to HK's iPhone Messages.
//   - Works on iPhone immediately. On desktop sms: opens the Messages
//     handler if one is registered (macOS Continuity, etc.).
//
// Tracking: localStorage keeps a set of "sent" therapist IDs per broadcast
// session so HK can see progress (12 of 28 sent) and skip already-texted
// people. Reset button wipes the session and starts fresh.

import { useEffect, useMemo, useState } from "react";

const C = {
  forest: "#2A5741",
  sage: "#6B9E80",
  cream: "#FFF9F3",
  dark: "#1F2937",
  gray: "#6B7280",
  light: "#E8E4DC",
  gold: "#C59550",
  softCream: "#F9F8F5",
};

const STORAGE_KEY = "founder_mass_sms_sent_ids";

const DEFAULT_MESSAGE = `Hey it's HK from MyBodyMap. Big update just shipped: Settings is fully rebuilt, plus Add-ons, Packages, Memberships, and Group Classes are live now. Worth a fresh look: mybodymap.app. Hit me back with any questions or what you'd like to see next.`;

function normalizePhone(p) {
  if (!p) return null;
  const digits = String(p).replace(/[^0-9+]/g, "");
  if (!digits) return null;
  // Already E.164-ish
  if (digits.startsWith("+")) return digits;
  // 10-digit US number
  if (digits.length === 10) return "+1" + digits;
  // 11-digit starting with 1
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  // Anything else, hand back with a + so iOS can try
  return "+" + digits;
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

export default function FounderMassSms({ therapists }) {
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sentIds, setSentIds] = useState(() => loadSentSet());
  const [hideSent, setHideSent] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    saveSentSet(sentIds);
  }, [sentIds]);

  // Build the list once from props. Filter to non-dummy therapists with a
  // valid phone. Don't filter sent-status here -- that's a render decision
  // the user toggles.
  const candidates = useMemo(() => {
    const list = (therapists || [])
      .filter((t) => !t.is_dummy)
      .map((t) => ({
        id: t.id,
        name: t.full_name || t.business_name || t.email || "Unknown",
        email: t.email,
        phone: normalizePhone(t.phone),
        plan: t.plan,
        rawPhone: t.phone,
      }))
      .filter((t) => !!t.phone);
    // Stable sort: alphabetical by name
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return list;
  }, [therapists]);

  const noPhoneCount = (therapists || []).filter((t) => !t.is_dummy && !normalizePhone(t.phone)).length;

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

  const resetAll = () => {
    if (!window.confirm("Reset progress? All recipients will appear as not-yet-texted.")) return;
    setSentIds(new Set());
  };

  // Build a sms: URL. iOS uses ?body=, Android uses ?body=, both work.
  const smsUrl = (phone) => {
    const body = encodeURIComponent(message);
    return `sms:${phone}?body=${body}`;
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
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 20px",
          cursor: "pointer",
          userSelect: "none",
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
              ? `${sentCount} of ${totalCount} texted${noPhoneCount > 0 ? ` · ${noPhoneCount} without phone` : ""}`
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
          {/* Message editor */}
          <div style={{ marginTop: 16, marginBottom: 14 }}>
            <label style={{
              display: "block",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", color: C.sage, marginBottom: 6,
            }}>
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              style={{
                width: "100%",
                background: "#fff",
                border: `1px solid ${C.light}`,
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 14,
                lineHeight: 1.5,
                color: C.dark,
                fontFamily: "inherit",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: C.gray }}>
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

          {/* Controls */}
          <div style={{
            display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
            marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.light}`,
          }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, email, phone…"
              style={{
                flex: 1, minWidth: 180,
                padding: "8px 12px",
                border: `1px solid ${C.light}`,
                borderRadius: 8, fontSize: 13,
                background: "#fff", outline: "none",
              }}
            />
            <label style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, color: C.gray, cursor: "pointer",
            }}>
              <input
                type="checkbox"
                checked={hideSent}
                onChange={(e) => setHideSent(e.target.checked)}
              />
              Hide already texted
            </label>
            <button
              onClick={resetAll}
              style={{
                background: "transparent", border: `1px solid ${C.light}`,
                color: C.gray, padding: "7px 12px", borderRadius: 8,
                fontSize: 12, cursor: "pointer",
              }}
            >
              Reset progress
            </button>
          </div>

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
              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: isSent ? C.softCream : "#fff",
                    border: `1px solid ${C.light}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    opacity: isSent ? 0.7 : 1,
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: isSent ? C.sage : C.light,
                    color: isSent ? "#fff" : C.gray,
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
                      {t.plan && t.plan !== 'free' && (
                        <span style={{
                          marginLeft: 8, fontSize: 10, fontWeight: 700,
                          background: t.plan === 'gold' ? C.gold : C.sage,
                          color: "#fff", padding: "1px 6px", borderRadius: 99,
                          textTransform: "uppercase", letterSpacing: "0.04em",
                        }}>{t.plan}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 1 }}>
                      {t.phone}
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
                  ) : (
                    <a
                      href={smsUrl(t.phone)}
                      onClick={() => {
                        // Mark sent on click. If they didn't actually send,
                        // they can hit Undo. This is the optimistic path.
                        setTimeout(() => markSent(t.id), 250);
                      }}
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
                  )}
                </div>
              );
            })}
          </div>

          {noPhoneCount > 0 && (
            <div style={{
              marginTop: 14, padding: "10px 12px",
              background: "#FEF3C7", border: "1px solid #FDE68A",
              borderRadius: 8, fontSize: 12, color: "#92400E",
            }}>
              <strong>{noPhoneCount}</strong> therapist{noPhoneCount === 1 ? " has" : "s have"} no phone number on file. They'll need an email reach-out.
            </div>
          )}

          <div style={{
            marginTop: 14, padding: "10px 12px",
            background: "#fff", border: `1px solid ${C.light}`,
            borderRadius: 8, fontSize: 11, color: C.gray, lineHeight: 1.5,
          }}>
            <strong style={{ color: C.dark }}>How this works:</strong> Tap "Text" to open Messages with the number and your draft pre-filled. You hit Send and come back. Texts come from your personal number (not Twilio), so replies land in your iPhone Messages. Progress is saved on this device only.
          </div>
        </div>
      )}
    </div>
  );
}
