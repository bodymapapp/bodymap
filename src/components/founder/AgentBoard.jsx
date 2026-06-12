// src/components/founder/AgentBoard.jsx
//
// Founder-only command board for the five MyBodyMap agents. Each agent
// has its own list of tasks HK can add, reorder, mark done, drill into,
// and archive. Live edits persist to the agent_tasks Supabase table
// (founder-only via RLS), the same pattern the Income Statement uses for
// finance_line_items, so there are no git commits per keystroke.
//
// Phase 1 (this file): the board itself.
// Phase 1b (next): a Publish button that writes the open tasks into the
//   brain so the other agents read their assignments at startup.
// Phase 2: a per-agent "what am I missing" suggestion via the Claude API.

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
  { key: "engineering", num: 1, label: "Engineering" },
  { key: "customer_support", num: 2, label: "Customer Support" },
  { key: "marketing", num: 3, label: "Marketing" },
  { key: "strategy", num: 4, label: "Strategy" },
  { key: "chief_of_staff", num: 5, label: "Chief of Staff" },
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

  function byAgent(key, status) {
    return tasks
      .filter((t) => t.agent === key && t.status === status)
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
    const optimistic = {
      id: tempId,
      agent: agentKey,
      title,
      detail: "",
      status: "open",
      sort_order: maxOrder + 1,
    };
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
    const siblings = byAgent(task.agent, task.status);
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
      {publishMsg && (
        <div style={publishMsg.ok ? noteOk : noteWarn}>{publishMsg.text}</div>
      )}

      {recentlyArchived && (
        <div style={undoBanner}>
          <span>Task archived.</span>
          <button onClick={undoArchive} style={undoBtn}>Undo</button>
          <button onClick={() => setRecentlyArchived(null)} style={undoDismiss} aria-label="Dismiss">x</button>
        </div>
      )}

      {AGENTS.map((agent) => {
        const active = tasks
          .filter((t) => t.agent === agent.key && (t.status === "open" || t.status === "in_progress"))
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        const done = byAgent(agent.key, "done");
        const draft = drafts[agent.key] || "";
        return (
          <section key={agent.key} style={agentSection}>
            <div style={agentHeader}>
              <span style={numBadge}>{agent.num}</span>
              <span style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, color: C.ink }}>
                {agent.label}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: C.gray }}>
                {active.length} active
              </span>
            </div>

            {active.length === 0 && (
              <p style={{ fontSize: 13, color: C.gray, margin: "8px 2px 12px" }}>
                Nothing here yet. Add the first task below.
              </p>
            )}

            {active.map((task, idx) => (
              <TaskCard
                key={task.id}
                task={task}
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
                placeholder={`Add a task for ${agent.label}`}
                style={addInput}
              />
              <button onClick={() => addTask(agent.key)} disabled={!draft.trim()} style={draft.trim() ? primaryBtn : disabledBtn}>
                Add
              </button>
            </div>

            {done.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => setShowDoneFor((p) => ({ ...p, [agent.key]: !p[agent.key] }))}
                  style={linkBtn}
                >
                  {showDoneFor[agent.key] ? "Hide done" : `Show done (${done.length})`}
                </button>
                {showDoneFor[agent.key] && done.map((task) => (
                  <div key={task.id} style={doneRow}>
                    <button onClick={() => toggleDone(task)} style={checkDone} aria-label="Reopen">✓</button>
                    <span style={{ flex: 1, fontSize: 14, color: C.gray, textDecoration: "line-through" }}>
                      {task.title}
                    </span>
                    <button onClick={() => archive(task)} style={tinyGhost}>Archive</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TaskCard({ task, isFirst, isLast, expanded, onToggleExpand, onToggleDone, onMove, onArchive, onSetStatus, onSaveDetail, onSaveTitle }) {
  const [detail, setDetail] = useState(task.detail || "");
  const [title, setTitle] = useState(task.title || "");
  const inProgress = task.status === "in_progress";

  useEffect(() => { setDetail(task.detail || ""); }, [task.detail]);
  useEffect(() => { setTitle(task.title || ""); }, [task.title]);

  return (
    <div style={inProgress ? cardActive : card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onToggleDone} style={checkbox} aria-label="Mark done" />
        <button onClick={onToggleExpand} style={titleBtn}>
          {task.title}
        </button>
        {inProgress && <span style={ipBadge}>In progress</span>}
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <button onClick={() => onMove("up")} disabled={isFirst} style={isFirst ? arrowOff : arrow} aria-label="Move up">↑</button>
          <button onClick={() => onMove("down")} disabled={isLast} style={isLast ? arrowOff : arrow} aria-label="Move down">↓</button>
          <button onClick={onToggleExpand} style={arrow} aria-label="Details">{expanded ? "‹" : "›"}</button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, paddingLeft: 32 }}>
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
            placeholder="Add detail, links, or context for this task"
            rows={3}
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

const primaryBtn = {
  background: C.forest, color: "#fff", border: "none", borderRadius: 10,
  padding: "9px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", flexShrink: 0,
};
const disabledBtn = { ...primaryBtn, background: "#CBD5E1", cursor: "default" };
const linkBtn = { background: "none", border: "none", color: C.sage, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "6px 2px" };
const agentSection = { marginBottom: 22, paddingBottom: 18, borderBottom: `1px solid ${C.softLine}` };
const agentHeader = { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 };
const numBadge = {
  width: 24, height: 24, borderRadius: 8, background: C.cream, color: C.forest,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  fontSize: 13, fontWeight: 700, flexShrink: 0,
};
const card = {
  background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12,
  padding: "10px 12px", marginBottom: 8,
};
const checkbox = {
  width: 20, height: 20, borderRadius: 6, border: `2px solid ${C.sage}`,
  background: "#fff", cursor: "pointer", flexShrink: 0, padding: 0,
};
const checkDone = {
  width: 20, height: 20, borderRadius: 6, border: `2px solid ${C.sage}`,
  background: C.sage, color: "#fff", cursor: "pointer", flexShrink: 0, fontSize: 12, lineHeight: 1, padding: 0,
};
const titleBtn = {
  flex: 1, textAlign: "left", background: "none", border: "none",
  fontSize: 15, color: C.ink, cursor: "pointer", padding: 0, minWidth: 0,
};
const arrow = {
  width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.line}`,
  background: "#fff", color: C.forest, cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0,
};
const arrowOff = { ...arrow, color: "#D1D5DB", cursor: "default" };
const addRow = { display: "flex", gap: 8, marginTop: 6 };
const addInput = {
  flex: 1, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 12px",
  fontSize: 14, color: C.ink, minWidth: 0,
};
const detailTitle = {
  width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px",
  fontSize: 14, color: C.ink, marginBottom: 8, fontWeight: 600,
};
const detailArea = {
  width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px",
  fontSize: 14, color: C.ink, resize: "vertical", fontFamily: "inherit",
};
const doneRow = { display: "flex", alignItems: "center", gap: 10, padding: "6px 2px" };
const tinyGhost = {
  background: "none", border: `1px solid ${C.line}`, borderRadius: 8,
  color: C.gray, fontSize: 12, padding: "4px 10px", cursor: "pointer",
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
const cardActive = {
  background: "#fff", border: `1px solid ${C.line}`, borderLeft: "3px solid #D97706",
  borderRadius: 12, padding: "10px 12px", marginBottom: 8,
};
const ipBadge = {
  flexShrink: 0, fontSize: 11, fontWeight: 700, color: "#B45309",
  background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 999, padding: "2px 8px",
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
