// src/components/EmailReview.js
//
// /founder/emails — a single-page email review tool.
//
// Left sidebar: list of all email templates grouped by category.
// Right pane: rendered HTML preview of the selected email in an iframe,
// with subject line, when-it-fires note, and a feedback box.
//
// Feedback is stored in email_feedback table (see migration). When HK
// leaves a note it's attributed to his email and marked 'open'. Claude
// walks the open feedback queue when rewriting emails.

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
};

export default function EmailReview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [emails, setEmails] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [feedbackByEmail, setFeedbackByEmail] = useState({}); // {email_id: [rows]}
  const [newFeedback, setNewFeedback] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);

  useEffect(() => {
    loadEverything();
  }, []);

  async function loadEverything() {
    setLoading(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getSession();
      const emailOfUser = auth?.session?.user?.email || null;
      setCurrentUserEmail(emailOfUser);

      // Call preview edge function
      const { data, error: invokeErr } = await supabase.functions.invoke("preview-emails", { body: {} });
      if (invokeErr || !data?.ok) {
        throw new Error(invokeErr?.message || data?.error || "Failed to load emails");
      }
      setEmails(data.emails || []);
      if ((data.emails || []).length > 0 && !selectedId) {
        setSelectedId(data.emails[0].id);
      }

      // Load all feedback
      const { data: fb, error: fbErr } = await supabase
        .from("email_feedback")
        .select("*")
        .order("created_at", { ascending: false });
      if (!fbErr && fb) {
        const grouped = {};
        for (const row of fb) {
          if (!grouped[row.email_id]) grouped[row.email_id] = [];
          grouped[row.email_id].push(row);
        }
        setFeedbackByEmail(grouped);
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

  async function saveFeedback() {
    if (!newFeedback.trim() || !selected) return;
    setSavingFeedback(true);
    try {
      const { error: insErr } = await supabase.from("email_feedback").insert({
        email_id: selected.id,
        feedback: newFeedback.trim(),
        status: "open",
        created_by: currentUserEmail,
      });
      if (insErr) {
        // If the table doesn't exist yet, offer to run the migration.
        // Supabase returns various error shapes: "relation does not exist",
        // "Could not find the table", schema-cache errors, PGRST codes.
        const msg = (insErr.message || "") + " " + (insErr.code || "") + " " + (insErr.details || "");
        const isMissingTable = /does not exist|not.{0,5}find.{0,15}table|schema.cache|PGRST|relation/i.test(msg);
        if (isMissingTable) {
          if (window.confirm("The email_feedback table doesn't exist yet. Run the migration to create it now?")) {
            await runMigration();
            // Retry save
            const { error: retryErr } = await supabase.from("email_feedback").insert({
              email_id: selected.id,
              feedback: newFeedback.trim(),
              status: "open",
              created_by: currentUserEmail,
            });
            if (retryErr) throw retryErr;
          } else {
            return;
          }
        } else {
          throw insErr;
        }
      }
      setNewFeedback("");
      await loadEverything();
    } catch (e) {
      alert("Failed to save: " + (e.message || "unknown"));
    } finally {
      setSavingFeedback(false);
    }
  }

  async function runMigration() {
    try {
      const { data, error } = await supabase.functions.invoke("run-migration", { body: { name: "email_feedback" } });
      if (error) {
        throw new Error(error.message || "migration invoke failed");
      }
      if (data?.fallback && data?.sql) {
        // Function couldn't run DDL automatically; show the SQL for user to paste
        const proceed = window.confirm(
          "Auto-migration wasn't able to run. Click OK to copy the SQL to your clipboard, then paste it into Supabase SQL editor (one-time setup)."
        );
        if (proceed) {
          try {
            await navigator.clipboard.writeText(data.sql);
            window.alert("SQL copied to clipboard.\n\nGo to Supabase dashboard → SQL editor → paste → Run. Then come back and try saving feedback again.");
          } catch (_) {
            window.prompt("Copy this SQL and paste it in Supabase SQL editor:", data.sql);
          }
        }
        throw new Error("Migration needs manual step (SQL was copied to clipboard)");
      }
      if (!data?.ok) {
        throw new Error(data?.error || "migration failed");
      }
      return data;
    } catch (e) {
      alert("Migration step: " + (e.message || "unknown"));
      throw e;
    }
  }

  async function markAddressed(fbId) {
    const note = window.prompt("Optional note on how this was addressed:");
    if (note === null) return; // cancelled
    try {
      const { error: updErr } = await supabase
        .from("email_feedback")
        .update({
          status: "addressed",
          addressed_at: new Date().toISOString(),
          addressed_note: note || null,
        })
        .eq("id", fbId);
      if (updErr) throw updErr;
      await loadEverything();
    } catch (e) {
      alert("Failed to update: " + (e.message || "unknown"));
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
        <button onClick={loadEverything} style={{ marginTop: 16, padding: "8px 20px", background: C.forest, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Georgia, serif", background: C.cream, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.sage }}>
              Founder tools
            </div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: 28, color: C.dark, margin: "4px 0 0" }}>
              Email Review
            </h1>
            <p style={{ fontSize: 13, color: C.gray, margin: "6px 0 0", maxWidth: 680 }}>
              Every email BodyMap sends to therapists. Preview, leave feedback, track what needs rewriting.
              Sample data uses fake therapist Sarah Mitchell.
            </p>
          </div>
          <button
            onClick={() => navigate("/founder")}
            style={{ padding: "8px 14px", background: "#fff", border: `1px solid ${C.light}`, borderRadius: 6, cursor: "pointer", fontSize: 12, color: C.dark, fontFamily: "system-ui" }}
          >
            ← Back to /founder
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 320px) 1fr", gap: 20, alignItems: "start" }}>
          {/* Sidebar */}
          <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.light}`, padding: "12px 0", position: "sticky", top: 20 }}>
            {Object.keys(grouped).map((cat) => (
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
                  <div style={{ marginTop: 10, padding: "8px 12px", background: C.softCream, borderRadius: 6, fontSize: 12, color: C.dark, fontFamily: "system-ui" }}>
                    <strong style={{ fontWeight: 700 }}>Subject:</strong> {selected.subject}
                  </div>
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
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#f5f5f0;}</style></head><body>${selected.html}</body></html>`}
                    style={{ width: "100%", height: 680, border: "none", display: "block" }}
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
                          background: f.status === "open" ? "#FEF9E7" : f.status === "addressed" ? "#F0FDF4" : C.softCream,
                          borderLeft: `3px solid ${f.status === "open" ? C.gold : f.status === "addressed" ? C.rise : C.gray}`,
                          borderRadius: 4,
                          fontFamily: "system-ui",
                          fontSize: 13,
                          color: C.dark,
                          lineHeight: 1.5,
                        }}>
                          <div style={{ whiteSpace: "pre-wrap" }}>{f.feedback}</div>
                          <div style={{ marginTop: 6, fontSize: 10, color: C.gray, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <span>
                              {f.status.toUpperCase()} · by {f.created_by || "admin"} · {new Date(f.created_at).toLocaleString()}
                              {f.status === "addressed" && f.addressed_note && (
                                <span style={{ fontStyle: "italic" }}> · Resolved: {f.addressed_note}</span>
                              )}
                            </span>
                            {f.status === "open" && (
                              <button
                                onClick={() => markAddressed(f.id)}
                                style={{ fontSize: 10, padding: "3px 10px", background: C.rise, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "system-ui", fontWeight: 700 }}
                              >
                                Mark addressed
                              </button>
                            )}
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
                    placeholder={`Leave feedback on "${selected.label}"... Be specific. E.g. "line 3 too cold, suggest something warmer about the therapist's experience"`}
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
                      disabled={savingFeedback || !newFeedback.trim()}
                      style={{
                        padding: "8px 18px",
                        background: (!newFeedback.trim() || savingFeedback) ? C.light : C.forest,
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        cursor: (!newFeedback.trim() || savingFeedback) ? "default" : "pointer",
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "system-ui",
                      }}
                    >
                      {savingFeedback ? "Saving..." : "Save feedback"}
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
