// src/components/founder/AgentBoard.jsx
//
// Founder-only command board for the MyBodyMap agents, Trello-style.
//
// Level 1 (this view): one column per agent, compact one-line cards.
// Drag a card to reorder it, or drop it onto another agent to reassign.
// Each card has two clear buttons, Doing and Done, and a small tier dot
// (green safe to run alone, amber draft for me, red I do myself). Status
// shows as the card's left edge: grey not started, amber in progress.
//
// Level 2 (click a card): the detail panel, where the instructions live
// and where "Generate full prompt" writes the full agent prompt.
//
// Publish writes the numbered tasks and their prompts into the brain, so
// "run engineering 1" in an agent chat reads that exact prompt.
//
// Live edits persist to the agent_tasks Supabase table, founder-only via RLS.

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { supabase } from "../../lib/supabase";

const C = { forest: "#2A5741", sage: "#6B9E80", cream: "#F5F0E8", ink: "#1F2937", gray: "#6B7280", line: "#E5E7EB" };
const GREY = "#CBD5E1";
const AMBER = "#D97706";
const GREEN = "#16A34A";

// Agents live here for now. Adding one is a single line until we move
// these into a table (planned once a sixth agent is real).
const AGENTS = [
  { key: "engineering", num: 1, label: "Engineering", color: "#2A5741" },
  { key: "customer_support", num: 2, label: "Customer Support", color: "#2F6F8F" },
  { key: "marketing", num: 3, label: "Marketing", color: "#C2682E" },
  { key: "strategy", num: 4, label: "Strategy", color: "#6D5BA6" },
  { key: "chief_of_staff", num: 5, label: "Chief of Staff", color: "#B58A2E" },
];

const TIERS = {
  green: { label: "Green", hint: "Safe to run on its own", color: GREEN },
  amber: { label: "Amber", hint: "Draft for me to approve", color: AMBER },
  red: { label: "Red", hint: "I do this myself", color: "#DC2626" },
};
const tierOf = (t) => (t && TIERS[t.tier] ? t.tier : "amber");

export function AgentBoardEmbedded() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [detailId, setDetailId] = useState(null);
  const [showDoneFor, setShowDoneFor] = useState({});
  const [recentlyArchived, setRecentlyArchived] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState(null);
  const [briefingId, setBriefingId] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    const { data, error } = await supabase.from("agent_tasks").select("*").order("sort_order", { ascending: true });
    if (error) { setLoadError(true); setLoading(false); return; }
    setTasks(data || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const activeFor = (key) =>
    tasks.filter((t) => t.agent === key && (t.status === "open" || t.status === "in_progress"))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const doneFor = (key) =>
    tasks.filter((t) => t.agent === key && t.status === "done")
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  async function addTask(agentKey) {
    const title = (drafts[agentKey] || "").trim();
    if (!title) return;
    const maxOrder = Math.max(0, ...tasks.filter((t) => t.agent === agentKey).map((t) => t.sort_order || 0));
    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, agent: agentKey, title, detail: "", status: "open", tier: "amber", sort_order: maxOrder + 1 };
    setTasks((prev) => [...prev, optimistic]);
    setDrafts((prev) => ({ ...prev, [agentKey]: "" }));
    const { data, error } = await supabase
      .from("agent_tasks")
      .insert({ agent: agentKey, title, detail: "", status: "open", tier: "amber", sort_order: maxOrder + 1 })
      .select().single();
    if (!error && data) setTasks((prev) => prev.map((t) => (t.id === tempId ? data : t)));
    else { setTasks((prev) => prev.filter((t) => t.id !== tempId)); setDrafts((prev) => ({ ...prev, [agentKey]: title })); }
  }

  async function patch(task, fields) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...fields } : t)));
    if (String(task.id).startsWith("temp-")) return;
    await supabase.from("agent_tasks").update(fields).eq("id", task.id);
  }
  const setStatus = (task, status) => patch(task, { status });
  const toggleDoing = (task) => patch(task, { status: task.status === "in_progress" ? "open" : "in_progress" });
  const markDone = (task) => { patch(task, { status: "done" }); if (detailId === task.id) setDetailId(null); };
  async function archive(task) { await patch(task, { status: "archived" }); setRecentlyArchived(task); setDetailId(null); }
  async function undoArchive() { if (!recentlyArchived) return; await patch(recentlyArchived, { status: "open" }); setRecentlyArchived(null); }
  function toggleSelect(id) { setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }

  async function onDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const fromKey = source.droppableId, toKey = destination.droppableId;
    const activeIn = (list, key) => list.filter((t) => t.agent === key && (t.status === "open" || t.status === "in_progress")).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const base = tasks.map((t) => ({ ...t }));
    const movedObj = base.find((t) => t.id === draggableId);
    if (!movedObj) return;
    const changed = [];
    const srcList = activeIn(base, fromKey).filter((t) => t.id !== draggableId);
    if (fromKey === toKey) {
      srcList.splice(destination.index, 0, movedObj);
      srcList.forEach((t, i) => { if (t.sort_order !== i) { t.sort_order = i; changed.push(t); } });
    } else {
      movedObj.agent = toKey;
      const dstList = activeIn(base, toKey).filter((t) => t.id !== draggableId);
      dstList.splice(destination.index, 0, movedObj);
      dstList.forEach((t, i) => { if (t.sort_order !== i || t.id === draggableId) { t.sort_order = i; if (!changed.includes(t)) changed.push(t); } });
      srcList.forEach((t, i) => { if (t.sort_order !== i) { t.sort_order = i; changed.push(t); } });
      if (!changed.includes(movedObj)) changed.push(movedObj);
    }
    setTasks(base);
    for (const t of changed) {
      if (String(t.id).startsWith("temp-")) continue;
      await supabase.from("agent_tasks").update({ sort_order: t.sort_order, agent: t.agent }).eq("id", t.id);
    }
  }

  async function writeBrief(task) {
    setBriefingId(task.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/board-brief`;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: task.title, detail: task.detail || "", agent: task.agent }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok && body.brief) await patch(task, { detail: body.brief });
    } catch (e) {}
    setBriefingId(null);
  }

  async function publish() {
    setPublishing(true); setPublishMsg(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/board-publish`;
      const idsArr = selectMode && selectedIds.size ? Array.from(selectedIds) : null;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: idsArr ? JSON.stringify({ ids: idsArr }) : JSON.stringify({}) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        const n = body.published;
        setPublishMsg({ ok: true, text: `Published. The agents will see ${n} task${n === 1 ? "" : "s"} the next time you open them.` });
        setSelectMode(false); setSelectedIds(new Set());
      } else {
        setPublishMsg({ ok: false, text: body.error || "Publish did not go through. Your tasks are safe, try again in a moment." });
      }
    } catch (e) {
      setPublishMsg({ ok: false, text: "Publish did not go through. Your tasks are safe, try again in a moment." });
    }
    setPublishing(false);
  }

  if (loading) return <div style={{ padding: 24, color: C.gray, fontSize: 14 }}>Loading the board...</div>;
  if (loadError) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: C.ink, fontSize: 15, marginBottom: 12 }}>The board could not load just now. Your tasks are safe.</p>
        <button onClick={load} style={primaryBtn}>Try again</button>
      </div>
    );
  }

  const detailTask = detailId ? tasks.find((t) => t.id === detailId) : null;

  return (
    <div>
      <div style={publishBar}>
        <span style={{ fontSize: 12, color: C.gray }}>Drag a card to reorder, or drop it on another agent.</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {selectMode ? (
            <>
              <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }} style={ghostBtn}>Cancel</button>
              <button onClick={publish} disabled={publishing || selectedIds.size === 0} style={(publishing || selectedIds.size === 0) ? disabledBtn : primaryBtn}>
                {publishing ? "Publishing..." : `Publish ${selectedIds.size} selected`}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setSelectMode(true)} style={ghostBtn}>Choose</button>
              <button onClick={publish} disabled={publishing} style={publishing ? disabledBtn : primaryBtn}>{publishing ? "Publishing..." : "Publish all"}</button>
            </>
          )}
        </div>
      </div>
      {publishMsg && <div style={publishMsg.ok ? noteOk : noteWarn}>{publishMsg.text}</div>}
      {recentlyArchived && (
        <div style={undoBanner}>
          <span>Task archived.</span>
          <button onClick={undoArchive} style={undoBtn}>Undo</button>
          <button onClick={() => setRecentlyArchived(null)} style={undoDismiss} aria-label="Dismiss">{"\u00d7"}</button>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div style={boardRow}>
          {AGENTS.map((agent) => {
            const active = activeFor(agent.key);
            const done = doneFor(agent.key);
            const draft = drafts[agent.key] || "";
            return (
              <section key={agent.key} style={column}>
                <div style={{ ...columnHead, borderTop: `3px solid ${agent.color}` }}>
                  <span style={{ ...numBadge, background: agent.color }}>{agent.num}</span>
                  <span style={{ fontFamily: "Georgia, serif", fontSize: 14, fontWeight: 700, color: C.ink }}>{agent.label}</span>
                  <span style={countPill}>{active.length}</span>
                </div>

                <Droppable droppableId={agent.key}>
                  {(prov, snap) => (
                    <div ref={prov.innerRef} {...prov.droppableProps}
                      style={{ ...columnBody, background: snap.isDraggingOver ? "#F0F4F1" : "transparent" }}>
                      {active.length === 0 && !snap.isDraggingOver && (
                        <p style={{ fontSize: 12, color: C.gray, margin: "2px 2px 8px" }}>Nothing here yet.</p>
                      )}
                      {active.map((task, idx) => (
                        <Draggable key={task.id} draggableId={String(task.id)} index={idx}>
                          {(dp, dsnap) => {
                            const inProgress = task.status === "in_progress";
                            const edge = inProgress ? AMBER : GREY;
                            const tier = tierOf(task);
                            return (
                              <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps}
                                style={{
                                  ...cardBase, borderLeft: `4px solid ${edge}`,
                                  boxShadow: dsnap.isDragging ? "0 6px 18px rgba(28,43,34,.18)" : "none",
                                  ...(selectMode && selectedIds.has(task.id) ? { background: agent.color + "0D", borderColor: agent.color } : {}),
                                  ...dp.draggableProps.style,
                                }}>
                                <span style={{ ...tierDot, background: TIERS[tier].color }} title={TIERS[tier].hint} />
                                {selectMode && (
                                  <button onClick={(e) => { e.stopPropagation(); toggleSelect(task.id); }}
                                    style={selectedIds.has(task.id) ? { ...selDot, background: agent.color, borderColor: agent.color } : selDot} aria-label="Select" />
                                )}
                                <button onClick={() => setDetailId(task.id)} style={titleBtn}>{task.title}</button>
                                <button onClick={(e) => { e.stopPropagation(); toggleDoing(task); }}
                                  style={inProgress ? doingOn : doingOff} title="In progress">Doing</button>
                                <button onClick={(e) => { e.stopPropagation(); markDone(task); }} style={doneBtn} title="Done">{"\u2713"}</button>
                              </div>
                            );
                          }}
                        </Draggable>
                      ))}
                      {prov.placeholder}
                    </div>
                  )}
                </Droppable>

                <div style={columnFoot}>
                  <div style={addRow}>
                    <input value={draft}
                      onChange={(e) => setDrafts((p) => ({ ...p, [agent.key]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") addTask(agent.key); }}
                      placeholder="Add a task" style={addInput} />
                    <button onClick={() => addTask(agent.key)} disabled={!draft.trim()} style={draft.trim() ? smallAdd : smallAddOff}>Add</button>
                  </div>
                  {done.length > 0 && (
                    <div style={{ marginTop: 2 }}>
                      <button onClick={() => setShowDoneFor((p) => ({ ...p, [agent.key]: !p[agent.key] }))} style={linkBtn}>
                        {showDoneFor[agent.key] ? "Hide done" : `Show done (${done.length})`}
                      </button>
                      {showDoneFor[agent.key] && done.map((task) => (
                        <div key={task.id} style={doneRow}>
                          <button onClick={() => setStatus(task, "open")} style={checkDone} aria-label="Reopen">{"\u2713"}</button>
                          <span style={{ flex: 1, fontSize: 12, color: C.gray, textDecoration: "line-through" }}>{task.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </DragDropContext>

      {detailTask && createPortal(
        <TaskDetail
          task={detailTask}
          agent={AGENTS.find((a) => a.key === detailTask.agent)}
          briefing={briefingId === detailTask.id}
          onClose={() => setDetailId(null)}
          onSaveTitle={(title) => patch(detailTask, { title })}
          onSaveDetail={(detail) => patch(detailTask, { detail })}
          onSetTier={(tier) => patch(detailTask, { tier })}
          onSetStatus={(s) => setStatus(detailTask, s)}
          onMarkDone={() => markDone(detailTask)}
          onArchive={() => archive(detailTask)}
          onWriteBrief={() => writeBrief(detailTask)}
        />, document.body)}
    </div>
  );
}

function TaskDetail({ task, agent, briefing, onClose, onSaveTitle, onSaveDetail, onSetTier, onSetStatus, onMarkDone, onArchive, onWriteBrief }) {
  const [title, setTitle] = useState(task.title || "");
  const [detail, setDetail] = useState(task.detail || "");
  useEffect(() => { setDetail(task.detail || ""); }, [task.detail]);
  useEffect(() => { setTitle(task.title || ""); }, [task.title]);
  const inProgress = task.status === "in_progress";
  const tier = tierOf(task);
  const hasBrief = !!(task.detail && task.detail.trim());

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ ...numBadge, background: agent ? agent.color : C.forest }}>{agent ? agent.num : "?"}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.gray, letterSpacing: ".04em", textTransform: "uppercase" }}>{agent ? agent.label : ""}</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 20, color: C.gray, cursor: "pointer", lineHeight: 1 }} aria-label="Close">{"\u00d7"}</button>
        </div>

        <input value={title} onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title.trim() && title !== task.title) onSaveTitle(title.trim()); }} style={detailTitle} />

        <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, margin: "4px 0 6px" }}>How it should run</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {Object.entries(TIERS).map(([key, t]) => (
            <button key={key} onClick={() => onSetTier(key)}
              style={tier === key ? { ...tierBtn, background: t.color, color: "#fff", borderColor: t.color } : tierBtn}
              title={t.hint}>{t.label}</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.gray, marginTop: -10, marginBottom: 16 }}>{TIERS[tier].hint}</div>

        <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, marginBottom: 6 }}>Instructions for the agent</div>
        <button onClick={onWriteBrief} disabled={briefing} style={briefing ? briefBtnOff : briefBtn}>
          {briefing ? "Writing the full prompt..." : hasBrief ? "Rewrite full prompt" : "Generate full prompt"}
        </button>
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)}
          onBlur={() => { if (detail !== task.detail) onSaveDetail(detail); }}
          placeholder="The full prompt the agent will run. Write it, or tap Generate." rows={9} style={detailArea} />

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={() => onSetStatus(inProgress ? "open" : "in_progress")} style={inProgress ? doingOn : ghostBtn}>{inProgress ? "In progress" : "Mark in progress"}</button>
          <button onClick={onMarkDone} style={{ ...ghostBtn, color: GREEN, borderColor: GREEN }}>Mark done</button>
          <button onClick={onArchive} style={{ ...ghostBtn, marginLeft: "auto", color: C.gray }}>Archive</button>
        </div>
      </div>
    </div>
  );
}

const primaryBtn = { background: C.forest, color: "#fff", border: "none", borderRadius: 9, padding: "8px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 };
const disabledBtn = { ...primaryBtn, background: "#CBD5E1", cursor: "default" };
const ghostBtn = { background: "#fff", border: `1px solid ${C.line}`, color: C.ink, borderRadius: 9, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 };
const smallAdd = { background: C.forest, color: "#fff", border: "none", borderRadius: 7, padding: "6px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 };
const smallAddOff = { ...smallAdd, background: "#CBD5E1", cursor: "default" };
const linkBtn = { background: "none", border: "none", color: C.sage, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "5px 2px" };
const boardRow = { display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start", WebkitOverflowScrolling: "touch" };
const column = { flex: "1 1 0", minWidth: 235, background: "#FBF8F3", border: `1px solid ${C.line}`, borderRadius: 12, alignSelf: "stretch", display: "flex", flexDirection: "column" };
const columnHead = { display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottom: `1px solid ${C.line}` };
const columnBody = { padding: "8px 9px 2px", minHeight: 36, flex: 1 };
const columnFoot = { padding: "2px 9px 9px" };
const numBadge = { width: 20, height: 20, borderRadius: 6, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 };
const countPill = { marginLeft: "auto", fontSize: 11, fontWeight: 700, color: C.gray, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 999, padding: "1px 8px" };
const cardBase = { display: "flex", alignItems: "center", gap: 7, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 8px", marginBottom: 6, userSelect: "none" };
const tierDot = { width: 9, height: 9, borderRadius: 3, flexShrink: 0 };
const titleBtn = { flex: 1, textAlign: "left", background: "none", border: "none", fontSize: 13, color: C.ink, cursor: "pointer", padding: 0, minWidth: 0, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const doingOff = { background: "#fff", border: `1px solid ${C.line}`, color: C.gray, borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 };
const doingOn = { ...doingOff, background: AMBER, color: "#fff", borderColor: AMBER };
const doneBtn = { width: 22, height: 22, borderRadius: 6, border: `1px solid ${C.sage}`, background: "#fff", color: C.sage, cursor: "pointer", fontSize: 12, lineHeight: 1, padding: 0, flexShrink: 0 };
const selDot = { width: 18, height: 18, borderRadius: 999, border: "2px solid #CBD5E1", background: "#fff", cursor: "pointer", flexShrink: 0, padding: 0 };
const addRow = { display: "flex", gap: 6, marginTop: 4, marginBottom: 2 };
const addInput = { flex: 1, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 9px", fontSize: 12, color: C.ink, minWidth: 0 };
const doneRow = { display: "flex", alignItems: "center", gap: 8, padding: "4px 2px" };
const checkDone = { width: 16, height: 16, borderRadius: 5, border: `2px solid ${C.sage}`, background: C.sage, color: "#fff", cursor: "pointer", fontSize: 10, lineHeight: 1, padding: 0, flexShrink: 0 };
const publishBar = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 12, marginBottom: 12, flexWrap: "wrap" };
const noteOk = { background: "#F0FDF4", border: "1px solid #86EFAC", color: "#166534", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 };
const noteWarn = { background: "#FFF7ED", border: "1px solid #FED7AA", color: "#9A3412", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 };
const undoBanner = { display: "flex", alignItems: "center", gap: 12, background: C.cream, border: `1px solid ${C.sage}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 14, color: C.forest };
const undoBtn = { background: C.forest, color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const undoDismiss = { marginLeft: "auto", background: "none", border: "none", color: C.gray, fontSize: 14, cursor: "pointer", padding: 4 };
const overlay = { position: "fixed", inset: 0, background: "rgba(20,28,22,.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 16px", zIndex: 1000, overflowY: "auto" };
const panel = { background: "#fff", borderRadius: 16, padding: "20px 22px", width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(20,28,22,.3)" };
const detailTitle = { width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 16, color: C.ink, marginBottom: 16, fontWeight: 600, boxSizing: "border-box" };
const detailArea = { width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, color: C.ink, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.5 };
const tierBtn = { flex: 1, background: "#fff", border: `1px solid ${C.line}`, color: C.ink, borderRadius: 9, padding: "8px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const briefBtn = { width: "100%", background: "#EEF4F0", color: C.forest, border: `1px solid ${C.sage}`, borderRadius: 8, padding: "9px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 8 };
const briefBtnOff = { ...briefBtn, color: C.gray, cursor: "default", borderColor: C.line, background: "#F3F4F6" };

export default AgentBoardEmbedded;
