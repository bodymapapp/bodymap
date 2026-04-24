// src/components/EmailReview.js
//
// /founder/emails — email review page.
//
// Left sidebar: every email template grouped by category with E-codes.
// Right pane: rendered preview in iframe + subject + feedback textarea.
// Feedback saves to browser localStorage. No database, no setup.

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

const C = {
  forest: "#2A5741",
  sage: "#6B9E80",
  gold: "#C59550",
  dark: "#1F2937",
  gray: "#6B7280",
  light: "#E8E4DC",
  softCream: "#F9F8F5",
  cream: "#FFF9F3",
  rise: "#2A7F5F",
  fall: "#B44A3A",
};

const CATEGORY_LABELS = {
  auto_drip: "Auto Drip (fires on cron)",
  founder_outreach: "Founder Outreach (manual)",
  sms_auto: "Auto SMS (transactional to clients)",
  sms_manual: "Manual SMS (therapist to clients)",
  sms_founder: "Founder SMS (HK to therapists)",
};

const CATEGORY_ORDER = ["auto_drip", "founder_outreach", "sms_auto", "sms_manual", "sms_founder"];

// SMS categories render at a smaller iframe height since content is shorter
const SMS_CATEGORIES = new Set(["sms_auto", "sms_manual", "sms_founder"]);

const STORAGE_KEY = "bodymap_email_feedback_v1";

// ─── localStorage helpers ───

function loadAllFeedback() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAllFeedback(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export default function EmailReview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [emails, setEmails] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [feedbackByEmail, setFeedbackByEmail] = useState({});
  const [newFeedback, setNewFeedback] = useState("");

  useEffect(() => {
    loadEmails();
    setFeedbackByEmail(loadAllFeedback());
  }, []);

  async function loadEmails() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("preview-emails", { body: {} });
      if (invokeErr || !data?.ok) {
        throw new Error(invokeErr?.message || data?.error || "Failed to load emails");
      }
      setEmails(data.emails || []);
      if ((data.emails || []).length > 0 && !selectedId) {
        setSelectedId(data.emails[0].id);
      }
    } catch (e) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => {
    const g = {};
    for (const e of emails) {
      if (!g[e.category]) g[e.category] = [];
      g[e.category].push(e);
    }
    return g;
  }, [emails]);

  const selected = useMemo(() => emails.find((e) => e.id === selectedId), [emails, selectedId]);
  const selectedFeedback = selected ? (feedbackByEmail[selected.id] || []) : [];
  const openCount = (id) => (feedbackByEmail[id] || []).filter((f) => f.status === "open").length;

  function saveFeedback() {
    if (!newFeedback.trim() || !selected) return;
    const next = { ...feedbackByEmail };
    if (!next[selected.id]) next[selected.id] = [];
    next[selected.id] = [
      {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        email_id: selected.id,
        feedback: newFeedback.trim(),
        status: "open",
        created_at: new Date().toISOString(),
      },
      ...next[selected.id],
    ];
    if (saveAllFeedback(next)) {
      setFeedbackByEmail(next);
      setNewFeedback("");
    } else {
      alert("Browser storage full or blocked. Try clearing some site data.");
    }
  }

  function markAddressed(fbId) {
    const next = { ...feedbackByEmail };
    for (const eid of Object.keys(next)) {
      next[eid] = next[eid].map((f) =>
        f.id === fbId ? { ...f, status: "addressed", addressed_at: new Date().toISOString() } : f
      );
    }
    saveAllFeedback(next);
    setFeedbackByEmail(next);
  }

  function deleteFeedback(fbId) {
    if (!window.confirm("Delete this feedback?")) return;
    const next = { ...feedbackByEmail };
    for (const eid of Object.keys(next)) {
      next[eid] = next[eid].filter((f) => f.id !== fbId);
    }
    saveAllFeedback(next);
    setFeedbackByEmail(next);
  }

  function exportAll() {
    // Collect all open feedback into a single readable block
    const openItems = [];
    for (const e of emails) {
      const fbs = (feedbackByEmail[e.id] || []).filter((f) => f.status === "open");
      for (const f of fbs) {
        openItems.push({ code: e.code, label: e.label, feedback: f.feedback, at: f.created_at });
      }
    }
    if (openItems.length === 0) {
      alert("No open feedback to export.");
      return;
    }
    const text = openItems.map((i) => `[${i.code}] ${i.label}\n${i.feedback}\n(noted ${new Date(i.at).toLocaleString()})`).join("\n\n---\n\n");
    try {
      navigator.clipboard.writeText(text);
      alert(`${openItems.length} open feedback item${openItems.length === 1 ? "" : "s"} copied to clipboard. Paste it to HK or into Claude to process.`);
    } catch {
      window.prompt("Copy this feedback:", text);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: C.gray, fontFamily: "Georgia, serif" }}>
        Loading email templates...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: C.fall, fontFamily: "Georgia, serif" }}>
        <h2>Could not load</h2>
        <p>{error}</p>
        <button onClick={loadEmails} style={{ marginTop: 16, padding: "8px 20px", background: C.forest, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
          Retry
        </button>
      </div>
    );
  }

  const totalOpen = Object.values(feedbackByEmail).flat().filter((f) => f.status === "open").length;

  return (
    <div style={{ fontFamily: "Georgia, serif", background: C.cream, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.sage }}>
              Founder tools
            </div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: 28, color: C.dark, margin: "4px 0 0" }}>
              Email & SMS Review
            </h1>
            <p style={{ fontSize: 13, color: C.gray, margin: "6px 0 0", maxWidth: 680 }}>
              Every email and text MyBodyMap sends. Preview, leave feedback, track what needs rewriting.
              Feedback saves to your browser and stays private to this device.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {totalOpen > 0 && (
              <button
                onClick={exportAll}
                style={{ padding: "8px 14px", background: C.forest, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "system-ui" }}
              >
                📋 Copy {totalOpen} open feedback
              </button>
            )}
            <button
              onClick={() => navigate("/founder")}
              style={{ padding: "8px 14px", background: "#fff", border: `1px solid ${C.light}`, borderRadius: 6, cursor: "pointer", fontSize: 12, color: C.dark, fontFamily: "system-ui" }}
            >
              ← Back to /founder
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 320px) 1fr", gap: 20, alignItems: "start" }}>
          {/* Sidebar */}
          <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.light}`, padding: "12px 0", position: "sticky", top: 20 }}>
            {CATEGORY_ORDER.filter(cat => grouped[cat]).map((cat) => (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{
                  padding: "8px 16px 6px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: C.sage,
                  fontFamily: "system-ui",
                }}>
                  {CATEGORY_LABELS[cat] || cat}
                </div>
                {grouped[cat].map((e) => {
                  const isSelected = e.id === selectedId;
                  const open = openCount(e.id);
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelectedId(e.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 16px",
                        background: isSelected ? C.softCream : "transparent",
                        border: "none",
                        borderLeft: isSelected ? `3px solid ${C.forest}` : "3px solid transparent",
                        cursor: "pointer",
                        fontFamily: "system-ui",
                        fontSize: 13,
                        color: C.dark,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                        <span style={{ fontWeight: isSelected ? 700 : 500, flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: C.sage, fontWeight: 700, minWidth: 28 }}>{e.code || ""}</span>
                          <span>{e.label}</span>
                        </span>
                        {open > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: C.gold, color: "#fff", borderRadius: 10, padding: "1px 7px" }}>
                            {open}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Preview pane */}
          <div>
            {selected ? (
              <div>
                {/* Meta */}
                <div style={{ background: "#fff", border: `1px solid ${C.light}`, borderRadius: 10, padding: "16px 18px", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                    {selected.code && (
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: C.sage, fontWeight: 700 }}>{selected.code}</span>
                    )}
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.sage, fontFamily: "system-ui" }}>
                      · {CATEGORY_LABELS[selected.category]}
                    </div>
                  </div>
                  <h2 style={{ fontSize: 20, color: C.dark, margin: "4px 0 0" }}>{selected.label}</h2>
                  {!SMS_CATEGORIES.has(selected.category) && (
                    <div style={{ marginTop: 10, padding: "8px 12px", background: C.softCream, borderRadius: 6, fontSize: 12, color: C.dark, fontFamily: "system-ui" }}>
                      <strong style={{ fontWeight: 700 }}>Subject:</strong> {selected.subject}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 12, color: C.gray, fontFamily: "system-ui", lineHeight: 1.5 }}>
                    <strong>Fires:</strong> {selected.when_fires}
                  </div>
                  {selected.notes && (
                    <div style={{ marginTop: 6, fontSize: 12, color: C.gray, fontFamily: "system-ui", lineHeight: 1.5, fontStyle: "italic" }}>
                      {selected.notes}
                    </div>
                  )}
                </div>

                {/* Email iframe */}
                <div style={{ background: "#fff", border: `1px solid ${C.light}`, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
                  <iframe
                    title={selected.label}
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:${SMS_CATEGORIES.has(selected.category) ? "#fff" : "#f5f5f0"};}</style></head><body>${selected.html}</body></html>`}
                    style={{ width: "100%", height: SMS_CATEGORIES.has(selected.category) ? 320 : 680, border: "none", display: "block" }}
                  />
                </div>

                {/* Feedback */}
                <div style={{ background: "#fff", border: `1px solid ${C.light}`, borderRadius: 10, padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.sage, fontFamily: "system-ui", marginBottom: 8 }}>
                    Feedback for this email
                  </div>

                  {selectedFeedback.length > 0 ? (
                    <div style={{ marginBottom: 16 }}>
                      {selectedFeedback.map((f) => (
                        <div key={f.id} style={{
                          padding: "10px 12px",
                          marginBottom: 8,
                          background: f.status === "open" ? "#FEF9E7" : "#F0FDF4",
                          borderLeft: `3px solid ${f.status === "open" ? C.gold : C.rise}`,
                          borderRadius: 4,
                          fontFamily: "system-ui",
                          fontSize: 13,
                          color: C.dark,
                          lineHeight: 1.5,
                        }}>
                          <div style={{ whiteSpace: "pre-wrap" }}>{f.feedback}</div>
                          <div style={{ marginTop: 6, fontSize: 10, color: C.gray, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <span>
                              {f.status.toUpperCase()} · {new Date(f.created_at).toLocaleString()}
                            </span>
                            <span style={{ display: "flex", gap: 6 }}>
                              {f.status === "open" && (
                                <button
                                  onClick={() => markAddressed(f.id)}
                                  style={{ fontSize: 10, padding: "3px 10px", background: C.rise, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "system-ui", fontWeight: 700 }}
                                >
                                  Mark addressed
                                </button>
                              )}
                              <button
                                onClick={() => deleteFeedback(f.id)}
                                style={{ fontSize: 10, padding: "3px 10px", background: "transparent", color: C.gray, border: `1px solid ${C.light}`, borderRadius: 4, cursor: "pointer", fontFamily: "system-ui" }}
                              >
                                Delete
                              </button>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: 12, fontSize: 12, color: C.gray, fontFamily: "system-ui", fontStyle: "italic" }}>
                      No feedback yet. First impressions below.
                    </div>
                  )}

                  <textarea
                    value={newFeedback}
                    onChange={(e) => setNewFeedback(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        saveFeedback();
                      }
                    }}
                    placeholder={`Feedback on "${selected.label}". Be specific. E.g. "line 3 sounds too cold, something warmer about the therapist's day". Cmd+Enter to save.`}
                    style={{
                      width: "100%",
                      minHeight: 80,
                      padding: 10,
                      fontSize: 13,
                      fontFamily: "system-ui",
                      border: `1.5px solid ${C.light}`,
                      borderRadius: 6,
                      resize: "vertical",
                      boxSizing: "border-box",
                      color: C.dark,
                    }}
                  />
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={saveFeedback}
                      disabled={!newFeedback.trim()}
                      style={{
                        padding: "8px 18px",
                        background: !newFeedback.trim() ? C.light : C.forest,
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        cursor: !newFeedback.trim() ? "default" : "pointer",
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "system-ui",
                      }}
                    >
                      Save feedback
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: C.gray }}>Select an email from the left.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
