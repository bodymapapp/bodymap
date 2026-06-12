// src/components/founder/AgentBoard.jsx
//
// Founder-only command board for the five MyBodyMap agents, laid out as
// color-coded columns of cards (a Trello-style board). Each agent has its
// own column. Cards are numbered per agent, so you can dispatch them by
// number in an agent's chat (for example "complete Engineering 1").
//
// Live edits persist to the agent_tasks Supabase table, founder-only via
// RLS. Publish writes the active tasks into the brain so the agents read
// their assignments.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";

const C = {
  forest: "#2A5741",
  sage: "#6B9E80",
  cream: "#F5F0E8",
  ink: "#1F2937",
  gray: "#6B7280",
  line: "#E5E7EB",
  softLine: "#F3F4F6",
};

const AGENTS = [
  { key: "engineering", num: 1, label: "Engineering", color: "#2A5741" },
  { key: "customer_support", num: 2, label: "Customer Support", color: "#2F6F8F" },
  { key: "marketing", num: 3, label: "Marketing", color: "#C2682E" },
  { key: "strategy", num: 4, label: "Strategy", color: "#6D5BA6" },
  { key: "chief_of_staff", num: 5, label: "Chief of Staff", color: "#B58A2E" },
];

export function AgentBoardEmbedded() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [showDoneFor, setShowDoneFor] = useState({});
  const [recentlyArchived, setRecentlyArchived] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from("agent_tasks")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setTasks(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function activeFor(key) {
    return tasks
      .filter((t) => t.agent === key && (t.status === "open" || t.status === "in_progress"))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }
  function doneFor(key) {
    return tasks
      .filter((t) => t.agent === key && t.status === "done")
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  async function addTask(agentKey) {
    const title = (drafts[agentKey] || "").trim();
    if (!title) return;
    const maxOrder = Math.max(
      0,
      ...tasks.filter((t) => t.agent === agentKey).map((t) => t.sort_order || 0)
    );
    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, agent: agentKey, title, detail: "", status: "open", sort_order: maxOrder + 1 };
    setTasks((prev) => [...prev, optimistic]);
    setDrafts((prev) => ({ ...prev, [agentKey]: "" }));
    const { data, error } = await supabase
      .from("agent_tasks")
      .insert({ agent: agentKey, title, detail: "", status: "open", sort_order: maxOrder + 1 })
      .select()
      .single();
    if (!error && data) {
      setTasks((prev) => prev.map((t) => (t.id === tempId ? data : t)));
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setDrafts((prev) => ({ ...prev, [agentKey]: title }));
    }
  }

  async function patch(task, fields) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...fields } : t)));
    if (String(task.id).startsWith("temp-")) return;
    await supabase.from("agent_tasks").update(fields).eq("id", task.id);
  }

  async function toggleDone(task) {
    await patch(task, { status: task.status === "done" ? "open" : "done" });
  }

  async function archive(task) {
    await patch(task, { status: "archived" });
    setRecentlyArchived(task);
    setExpandedId(null);
  }

  async function undoArchive() {
    if (!recentlyArchived) return;
    await patch(recentlyArchived, { status: "open" });
    setRecentlyArchived(null);
  }

  async function move(task, dir) {
    const siblings = activeFor(task.agent);
    const i = siblings.findIndex((t) => t.id === task.id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= siblings.length) return;
    const other = siblings[j];
    const a = task.sort_order || 0;
    const b = other.sort_order || 0;
    await patch(task, { sort_order: b });
    await patch(other, { sort_order: a });
  }

  async function setStatus(task, status) {
    await patch(task, { status });
  }

  async function publish() {
    setPublishing(true);
    setPublishMsg(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/board-publish`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        const n = body.published;
        setPublishMsg({ ok: true, text: `Published. The agents will see ${n} task${n === 1 ? "" : "s"} the next time you open them.` });
      } else {
        setPublishMsg({ ok: false, text: body.error || "Publish did not go through. Your tasks are safe, try again in a moment." });
      }
    } catch (e) {
      setPublishMsg({ ok: false, text: "Publish did not go through. Your tasks are safe, try again in a moment." });
    }
    setPublishing(false);
  }

  if (loading) {
    return <div style={{ padding: 24, color: C.gray, fontSize: 14 }}>Loading the board...</div>;
  }

  if (loadError) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: C.ink, fontSize: 15, marginBottom: 12 }}>
          The board could not load just now. Your tasks are safe.
        </p>
        <button onClick={load} style={primaryBtn}>Try again</button>
        <p style={{ color: C.gray, fontSize: 13, marginTop: 12 }}>
          If this keeps happening, the agent_tasks table may not be set up yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "4px 0 24px" }}>
      <div style={publishBar}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 700, color: C.ink }}>
            Plan here, publish to the agents
          </div>
          <div style={{ fontSize: 12, color: C.gray }}>
            Publish writes the open work into the brain. Each agent reads its part next time you open it.
          </div>
        </div>
        <button onClick={publish} disabled={publishing} style={publishing ? disabledBtn : primaryBtn}>
          {publishing ? "Publishing..." : "Publish to agents"}
        </button>
      </div>
      {publishMsg && <div style={publishMsg.ok ? noteOk : noteWarn}>{publishMsg.text}</div>}

      {recentlyArchived && (
        <div style={undoBanner}>
          <span>Task archived.</span>
          <button onClick={undoArchive} style={undoBtn}>Undo</button>
          <button onClick={() => setRecentlyArchived(null)} style={undoDismiss} aria-label="Dismiss">x</button>
        </div>
      )}

      <div style={boardRow}>
        {AGENTS.map((agent) => {
          const active = activeFor(agent.key);
          const done = doneFor(agent.key);
          const draft = drafts[agent.key] || "";
          return (
            <section key={agent.key} style={column}>
              <div style={{ ...columnHead, background: tint(agent.color) }}>
                <span style={{ ...numBadge, background: agent.color }}>{agent.num}</span>
                <span style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 700, color: C.ink }}>
                  {agent.label}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: C.gray }}>{active.length}</span>
              </div>

              <div style={{ padding: "10px 10px 4px" }}>
                {active.length === 0 && (
                  <p style={{ fontSize: 13, color: C.gray, margin: "4px 2px 10px" }}>
                    Nothing here yet. Add the first task below.
                  </p>
                )}

                {active.map((task, idx) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    number={idx + 1}
                    accent={agent.color}
                    isFirst={idx === 0}
                    isLast={idx === active.length - 1}
                    expanded={expandedId === task.id}
                    onToggleExpand={() => setExpandedId(expandedId === task.id ? null : task.id)}
                    onToggleDone={() => toggleDone(task)}
                    onMove={(dir) => move(task, dir)}
                    onArchive={() => archive(task)}
                    onSetStatus={(s) => setStatus(task, s)}
                    onSaveDetail={(detail) => patch(task, { detail })}
                    onSaveTitle={(title) => patch(task, { title })}
                  />
                ))}

                <div style={addRow}>
                  <input
                    value={draft}
                    onChange={(e) => setDrafts((p) => ({ ...p, [agent.key]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") addTask(agent.key); }}
                    placeholder="Add a task"
                    style={addInput}
                  />
                  <button onClick={() => addTask(agent.key)} disabled={!draft.trim()} style={draft.trim() ? smallAdd : smallAddOff}>
                    Add
                  </button>
                </div>

                {done.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <button
                      onClick={() => setShowDoneFor((p) => ({ ...p, [agent.key]: !p[agent.key] }))}
                      style={linkBtn}
                    >
                      {showDoneFor[agent.key] ? "Hide done" : `Show done (${done.length})`}
                    </button>
                    {showDoneFor[agent.key] && done.map((task) => (
                      <div key={task.id} style={doneRow}>
                        <button onClick={() => toggleDone(task)} style={checkDone} aria-label="Reopen">✓</button>
                        <span style={{ flex: 1, fontSize: 13, color: C.gray, textDecoration: "line-through" }}>
                          {task.title}
                        </span>
                        <button onClick={() => archive(task)} style={tinyGhost}>Archive</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({ task, number, accent, isFirst, isLast, expanded, onToggleExpand, onToggleDone, onMove, onArchive, onSetStatus, onSaveDetail, onSaveTitle }) {
  const [detail, setDetail] = useState(task.detail || "");
  const [title, setTitle] = useState(task.title || "");
  const inProgress = task.status === "in_progress";

  useEffect(() => { setDetail(task.detail || ""); }, [task.detail]);
  useEffect(() => { setTitle(task.title || ""); }, [task.title]);

  const dotColor = inProgress ? "#D97706" : "#CBD5E1";

  return (
    <div style={inProgress ? { ...card, borderLeft: `3px solid ${accent}` } : card}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <button onClick={onToggleDone} style={checkbox} aria-label="Mark done" />
        <span style={{ ...cardNum, color: accent }}>{number}</span>
        <button onClick={onToggleExpand} style={titleBtn}>{task.title}</button>
        <span style={{ ...statusDot, background: dotColor }} title={inProgress ? "In progress" : "Not started"} />
      </div>

      <div style={{ display: "flex", gap: 2, marginTop: 6, paddingLeft: 28 }}>
        <button onClick={() => onMove("up")} disabled={isFirst} style={isFirst ? arrowOff : arrow} aria-label="Move up">↑</button>
        <button onClick={() => onMove("down")} disabled={isLast} style={isLast ? arrowOff : arrow} aria-label="Move down">↓</button>
        <button onClick={onToggleExpand} style={arrow} aria-label="Details">{expanded ? "‹" : "›"}</button>
        {inProgress && <span style={ipBadge}>In progress</span>}
      </div>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { if (title.trim() && title !== task.title) onSaveTitle(title.trim()); }}
            style={detailTitle}
          />
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            onBlur={() => { if (detail !== task.detail) onSaveDetail(detail); }}
            placeholder="Detail, links, or the full instructions for this task"
            rows={4}
            style={detailArea}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <button onClick={() => onSetStatus(inProgress ? "open" : "in_progress")} style={tinyGhost}>
              {inProgress ? "Mark not started" : "Mark in progress"}
            </button>
            <button onClick={onArchive} style={tinyGhost}>Archive</button>
          </div>
        </div>
      )}
    </div>
  );
}

function tint(hex) {
  return hex + "14";
}

const primaryBtn = {
  background: C.forest, color: "#fff", border: "none", borderRadius: 10,
  padding: "9px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", flexShrink: 0,
};
const disabledBtn = { ...primaryBtn, background: "#CBD5E1", cursor: "default" };
const smallAdd = {
  background: C.forest, color: "#fff", border: "none", borderRadius: 8,
  padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0,
};
const smallAddOff = { ...smallAdd, background: "#CBD5E1", cursor: "default" };
const linkBtn = { background: "none", border: "none", color: C.sage, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "6px 2px" };
const boardRow = {
  display: "flex", gap: 12, overflowX: "auto", paddingBottom: 10,
  WebkitOverflowScrolling: "touch", scrollSnapType: "x proximity",
};
const column = {
  flex: "0 0 290px", width: 290, background: "#FBF8F3",
  border: `1px solid ${C.line}`, borderRadius: 14, scrollSnapAlign: "start",
  alignSelf: "flex-start",
};
const columnHead = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "11px 12px", borderTopLeftRadius: 14, borderTopRightRadius: 14,
  borderBottom: `1px solid ${C.line}`,
};
const numBadge = {
  width: 22, height: 22, borderRadius: 7, color: "#fff",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  fontSize: 12, fontWeight: 700, flexShrink: 0,
};
const card = {
  background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10,
  padding: "9px 10px", marginBottom: 8,
};
const cardNum = { fontSize: 13, fontWeight: 800, flexShrink: 0, marginTop: 1 };
const checkbox = {
  width: 18, height: 18, borderRadius: 6, border: `2px solid ${C.sage}`,
  background: "#fff", cursor: "pointer", flexShrink: 0, padding: 0, marginTop: 1,
};
const checkDone = {
  width: 18, height: 18, borderRadius: 6, border: `2px solid ${C.sage}`,
  background: C.sage, color: "#fff", cursor: "pointer", flexShrink: 0, fontSize: 11, lineHeight: 1, padding: 0,
};
const titleBtn = {
  flex: 1, textAlign: "left", background: "none", border: "none",
  fontSize: 14, color: C.ink, cursor: "pointer", padding: 0, minWidth: 0, lineHeight: 1.35,
};
const statusDot = { width: 9, height: 9, borderRadius: 999, flexShrink: 0, marginTop: 5 };
const arrow = {
  width: 26, height: 26, borderRadius: 7, border: `1px solid ${C.line}`,
  background: "#fff", color: C.forest, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0,
};
const arrowOff = { ...arrow, color: "#D1D5DB", cursor: "default" };
const addRow = { display: "flex", gap: 6, marginTop: 4, marginBottom: 4 };
const addInput = {
  flex: 1, border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 10px",
  fontSize: 13, color: C.ink, minWidth: 0,
};
const detailTitle = {
  width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px",
  fontSize: 14, color: C.ink, marginBottom: 8, fontWeight: 600, boxSizing: "border-box",
};
const detailArea = {
  width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px",
  fontSize: 14, color: C.ink, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
};
const doneRow = { display: "flex", alignItems: "center", gap: 8, padding: "5px 2px" };
const tinyGhost = {
  background: "none", border: `1px solid ${C.line}`, borderRadius: 8,
  color: C.gray, fontSize: 12, padding: "4px 10px", cursor: "pointer",
};
const ipBadge = {
  marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "#B45309",
  background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 999, padding: "2px 8px",
};
const undoBanner = {
  display: "flex", alignItems: "center", gap: 12, background: C.cream,
  border: `1px solid ${C.sage}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14,
  fontSize: 14, color: C.forest,
};
const undoBtn = {
  background: C.forest, color: "#fff", border: "none", borderRadius: 8,
  padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const undoDismiss = {
  marginLeft: "auto", background: "none", border: "none", color: C.gray,
  fontSize: 14, cursor: "pointer", padding: 4,
};
const publishBar = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
  padding: "12px 14px", background: C.cream, border: `1px solid ${C.line}`,
  borderRadius: 12, marginBottom: 12,
};
const noteOk = {
  background: "#F0FDF4", border: "1px solid #86EFAC", color: "#166534",
  borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12,
};
const noteWarn = {
  background: "#FFF7ED", border: "1px solid #FED7AA", color: "#9A3412",
  borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12,
};

export default AgentBoardEmbedded;
