// src/components/founder/AgentBoard.jsx
//
// Founder-only command board for the MyBodyMap agent lanes.
//
// Layout: five columns. Engineering 1, Engineering 2, Customer Support,
// Marketing, and a shared column with Strategy on top and Chief of Staff
// below. Each lane splits into three time sections: Now, Next week, Next
// month. Cards in a lane are numbered top to bottom across all three
// sections, so "run 3" in that lane's chat is always card 3.
//
// Card color is the tier: light green safe to run alone, light yellow
// draft for me, light red I do it myself. Check marks on the right show
// progress: none not started, one in progress, two in progress and
// published. Click them to start or stop a card. Done is set in the
// detail and the card drops to Completed at the bottom.
//
// Click a card to open the detail: title, tier, time section, the prompt
// with Generate and Improve-with-my-notes, and Publish to this lane.
//
// Live edits persist to agent_tasks (founder-only via RLS). Publish writes
// the published cards into the brain so an agent reads its numbered prompt.

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";

const C = { forest: "#2A5741", sage: "#6B9E80", cream: "#F5F0E8", ink: "#1F2937", gray: "#6B7280", line: "#E5E7EB" };

const LANES = {
  engineering: { label: "Engineering 1", color: "#2A5741" },
  engineering_2: { label: "Engineering 2", color: "#3A6E54" },
  customer_support: { label: "Customer Support", color: "#2F6F8F" },
  marketing: { label: "Marketing", color: "#C2682E" },
  strategy: { label: "Strategy", color: "#6D5BA6" },
  chief_of_staff: { label: "Chief of Staff", color: "#B58A2E" },
};
const COLUMNS = [
  ["engineering"],
  ["engineering_2"],
  ["customer_support"],
  ["marketing"],
  ["strategy", "chief_of_staff"],
];
const BUCKETS = [
  { key: "now", label: "Now" },
  { key: "next", label: "Next week" },
  { key: "later", label: "Next month" },
];
const bucketRank = { now: 0, next: 1, later: 2 };

const TIERS = {
  green: { label: "Green", hint: "Safe to run on its own", bg: "#DCFCE7", border: "#86EFAC", dot: "#16A34A" },
  yellow: { label: "Yellow", hint: "Draft for me to approve", bg: "#FEF9C3", border: "#FDE047", dot: "#CA8A04" },
  red: { label: "Red", hint: "I do this one myself", bg: "#FEE2E2", border: "#FCA5A5", dot: "#DC2626" },
};
const tierOf = (t) => {
  const v = t && t.tier;
  if (v === "green" || v === "yellow" || v === "red") return v;
  return "yellow";
};
const bucketOf = (t) => (t && bucketRank[t.time_bucket] !== undefined ? t.time_bucket : "now");

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

  // All active cards in a lane, ordered Now then Next week then Next month,
  // then by sort_order. This order drives the continuous numbering.
  const laneOrdered = (laneKey) =>
    tasks.filter((t) => t.agent === laneKey && (t.status === "open" || t.status === "in_progress"))
      .sort((a, b) => (bucketRank[bucketOf(a)] - bucketRank[bucketOf(b)]) || ((a.sort_order || 0) - (b.sort_order || 0)));
  const doneFor = (laneKey) =>
    tasks.filter((t) => t.agent === laneKey && t.status === "done").sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  async function addTask(laneKey, bucketKey) {
    const draftKey = `${laneKey}:${bucketKey}`;
    const title = (drafts[draftKey] || "").trim();
    if (!title) return;
    const maxOrder = Math.max(0, ...tasks.filter((t) => t.agent === laneKey).map((t) => t.sort_order || 0));
    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, agent: laneKey, title, detail: "", status: "open", tier: "yellow", time_bucket: bucketKey, published_at: null, sort_order: maxOrder + 1 };
    setTasks((prev) => [...prev, optimistic]);
    setDrafts((prev) => ({ ...prev, [draftKey]: "" }));
    const { data, error } = await supabase
      .from("agent_tasks")
      .insert({ agent: laneKey, title, detail: "", status: "open", time_bucket: bucketKey, sort_order: maxOrder + 1 })
      .select().single();
    if (!error && data) setTasks((prev) => prev.map((t) => (t.id === tempId ? data : t)));
    else { setTasks((prev) => prev.filter((t) => t.id !== tempId)); setDrafts((prev) => ({ ...prev, [draftKey]: title })); }
  }

  async function patch(task, fields) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...fields } : t)));
    if (String(task.id).startsWith("temp-")) return;
    await supabase.from("agent_tasks").update(fields).eq("id", task.id);
  }
  const setStatus = (task, status) => patch(task, { status });
  const toggleInProgress = (task) => {
    if (task.published_at) return; // published cards stay at two checks until re-edited
    patch(task, { status: task.status === "in_progress" ? "open" : "in_progress" });
  };
  const markDone = (task) => { patch(task, { status: "done" }); if (detailId === task.id) setDetailId(null); };
  async function archive(task) { await patch(task, { status: "archived" }); setRecentlyArchived(task); setDetailId(null); }
  async function undoArchive() { if (!recentlyArchived) return; await patch(recentlyArchived, { status: "open" }); setRecentlyArchived(null); }
  // Editing the prompt makes the brain copy stale, so drop the published mark.
  const saveDetail = (task, detail) => patch(task, { detail, published_at: null });
  const setTier = (task, tier) => patch(task, { tier });
  const setBucket = (task, bucket) => patch(task, { time_bucket: bucket });
  async function moveToTop(task) {
    const minOrder = Math.min(0, ...tasks.filter((t) => t.agent === task.agent).map((t) => t.sort_order || 0));
    await patch(task, { sort_order: minOrder - 1 });
  }
  function toggleSelect(id) { setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }

  async function writeBrief(task, refinement) {
    setBriefingId(task.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/board-brief`;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: task.title, detail: task.detail || "", agent: task.agent, refinement: refinement || "" }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok && body.brief) await patch(task, { detail: body.brief, published_at: null });
    } catch (e) {}
    setBriefingId(null);
  }

  async function publishTasks(ids) {
    setPublishing(true); setPublishMsg(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/board-publish`;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: ids ? JSON.stringify({ ids }) : JSON.stringify({}) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        setPublishMsg({ ok: true, text: `Published. ${body.published} task${body.published === 1 ? "" : "s"} are in the brain. Open the lane's chat and say "run 1".` });
        setSelectMode(false); setSelectedIds(new Set());
        await load();
      } else {
        setPublishMsg({ ok: false, text: body.error || "Publish did not go through. Your tasks are safe, try again." });
      }
    } catch (e) {
      setPublishMsg({ ok: false, text: "Publish did not go through. Your tasks are safe, try again." });
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
      <Legend />
      <div style={publishBar}>
        <span style={{ fontSize: 12, color: C.gray }}>Click a card to open it. Numbers run top to bottom in each lane.</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {selectMode ? (
            <>
              <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }} style={ghostBtn}>Cancel</button>
              <button onClick={() => publishTasks(Array.from(selectedIds))} disabled={publishing || selectedIds.size === 0} style={(publishing || selectedIds.size === 0) ? disabledBtn : primaryBtn}>
                {publishing ? "Publishing..." : `Publish ${selectedIds.size} selected`}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setSelectMode(true)} style={ghostBtn}>Choose</button>
              <button onClick={() => publishTasks(null)} disabled={publishing} style={publishing ? disabledBtn : primaryBtn}>{publishing ? "Publishing..." : "Publish all"}</button>
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

      <div style={boardRow}>
        {COLUMNS.map((laneKeys, ci) => (
          <div key={ci} style={columnWrap}>
            {laneKeys.map((laneKey) => {
              const lane = LANES[laneKey];
              const ordered = laneOrdered(laneKey);
              const numberOf = (id) => ordered.findIndex((t) => t.id === id) + 1;
              const done = doneFor(laneKey);
              return (
                <section key={laneKey} style={laneBox}>
                  <div style={{ ...laneHead, borderTop: `3px solid ${lane.color}` }}>
                    <span style={{ fontFamily: "Georgia, serif", fontSize: 13, fontWeight: 700, color: C.ink }}>{lane.label}</span>
                    <span style={countPill}>{ordered.length}</span>
                  </div>
                  <div style={laneBody}>
                    {BUCKETS.map((bucket) => {
                      const cards = ordered.filter((t) => bucketOf(t) === bucket.key);
                      return (
                        <div key={bucket.key} style={{ marginBottom: 6 }}>
                          <div style={bucketLabel}>{bucket.label}</div>
                          {cards.length === 0 && <div style={bucketEmpty}>{"\u2014"}</div>}
                          {cards.map((task) => (
                            <Card key={task.id} task={task} number={numberOf(task.id)}
                              selectMode={selectMode} selected={selectedIds.has(task.id)}
                              onSelect={() => toggleSelect(task.id)}
                              onOpen={() => setDetailId(task.id)}
                              onToggleProgress={() => toggleInProgress(task)} />
                          ))}
                          <div style={addRow}>
                            <input value={drafts[`${laneKey}:${bucket.key}`] || ""}
                              onChange={(e) => setDrafts((p) => ({ ...p, [`${laneKey}:${bucket.key}`]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter") addTask(laneKey, bucket.key); }}
                              placeholder="Add" style={addInput} />
                            <button onClick={() => addTask(laneKey, bucket.key)} disabled={!(drafts[`${laneKey}:${bucket.key}`] || "").trim()} style={(drafts[`${laneKey}:${bucket.key}`] || "").trim() ? smallAdd : smallAddOff}>+</button>
                          </div>
                        </div>
                      );
                    })}
                    {done.length > 0 && (
                      <div style={{ marginTop: 2, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
                        <button onClick={() => setShowDoneFor((p) => ({ ...p, [laneKey]: !p[laneKey] }))} style={linkBtn}>
                          {showDoneFor[laneKey] ? "Hide completed" : `Completed (${done.length})`}
                        </button>
                        {showDoneFor[laneKey] && done.map((task) => (
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
        ))}
      </div>

      {detailTask && createPortal(
        <TaskDetail task={detailTask} lane={LANES[detailTask.agent]} briefing={briefingId === detailTask.id}
          onClose={() => setDetailId(null)}
          onSaveTitle={(title) => patch(detailTask, { title })}
          onSaveDetail={(detail) => saveDetail(detailTask, detail)}
          onSetTier={(tier) => setTier(detailTask, tier)}
          onSetBucket={(b) => setBucket(detailTask, b)}
          onMoveTop={() => moveToTop(detailTask)}
          onToggleProgress={() => toggleInProgress(detailTask)}
          onMarkDone={() => markDone(detailTask)}
          onArchive={() => archive(detailTask)}
          onGenerate={(refinement) => writeBrief(detailTask, refinement)}
          onPublish={() => publishTasks([detailTask.id])}
          publishing={publishing} />, document.body)}
    </div>
  );
}

function Card({ task, number, selectMode, selected, onSelect, onOpen, onToggleProgress }) {
  const tier = TIERS[tierOf(task)];
  const published = !!task.published_at;
  const inProg = task.status === "in_progress";
  const checks = published ? 2 : inProg ? 1 : 0;
  return (
    <div style={{ ...cardBase, background: tier.bg, border: `1px solid ${tier.border}`, ...(selectMode && selected ? { outline: `2px solid ${C.forest}` } : {}) }}>
      <span style={cardNum}>{number}</span>
      {selectMode && (
        <button onClick={(e) => { e.stopPropagation(); onSelect(); }} style={selected ? { ...selDot, background: C.forest, borderColor: C.forest } : selDot} aria-label="Select" />
      )}
      <button onClick={onOpen} style={titleBtn} title={task.title}>{task.title}</button>
      <button onClick={(e) => { e.stopPropagation(); onToggleProgress(); }} style={checksBtn}
        title={checks === 0 ? "Mark in progress" : checks === 1 ? "In progress, not published" : "In progress and published"}>
        {checks === 0 ? <span style={emptyRing} /> : (
          <span style={{ display: "inline-flex" }}>
            <span style={checkMark}>{"\u2713"}</span>
            {checks === 2 && <span style={{ ...checkMark, marginLeft: -3 }}>{"\u2713"}</span>}
          </span>
        )}
      </button>
    </div>
  );
}

function TaskDetail({ task, lane, briefing, onClose, onSaveTitle, onSaveDetail, onSetTier, onSetBucket, onMoveTop, onToggleProgress, onMarkDone, onArchive, onGenerate, onPublish, publishing }) {
  const [title, setTitle] = useState(task.title || "");
  const [detail, setDetail] = useState(task.detail || "");
  const [refine, setRefine] = useState("");
  useEffect(() => { setDetail(task.detail || ""); }, [task.detail]);
  useEffect(() => { setTitle(task.title || ""); }, [task.title]);
  const tier = tierOf(task);
  const bucket = bucketOf(task);
  const inProgress = task.status === "in_progress";
  const published = !!task.published_at;
  const hasBrief = !!(task.detail && task.detail.trim());

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: lane ? lane.color : C.forest, letterSpacing: ".04em", textTransform: "uppercase" }}>{lane ? lane.label : ""}</span>
          {published && <span style={{ fontSize: 11, fontWeight: 700, color: "#166534", background: "#DCFCE7", borderRadius: 999, padding: "2px 8px" }}>Published</span>}
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 20, color: C.gray, cursor: "pointer", lineHeight: 1 }} aria-label="Close">{"\u00d7"}</button>
        </div>

        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => { if (title.trim() && title !== task.title) onSaveTitle(title.trim()); }} style={detailTitle} />

        <div style={twoCol}>
          <div style={{ flex: 1 }}>
            <div style={fieldLabel}>How it should run</div>
            <div style={{ display: "flex", gap: 6 }}>
              {Object.entries(TIERS).map(([key, t]) => (
                <button key={key} onClick={() => onSetTier(key)} title={t.hint}
                  style={tier === key ? { ...segBtn, background: t.dot, color: "#fff", borderColor: t.dot } : segBtn}>{t.label}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={fieldLabel}>When</div>
            <div style={{ display: "flex", gap: 6 }}>
              {BUCKETS.map((b) => (
                <button key={b.key} onClick={() => onSetBucket(b.key)}
                  style={bucket === b.key ? { ...segBtn, background: C.forest, color: "#fff", borderColor: C.forest } : segBtn}>{b.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.gray, margin: "8px 0 16px" }}>{TIERS[tier].hint}. <button onClick={onMoveTop} style={inlineLink}>Move to top of lane</button></div>

        <div style={fieldLabel}>Prompt for the agent</div>
        <button onClick={() => onGenerate("")} disabled={briefing} style={briefing ? briefBtnOff : briefBtn}>
          {briefing ? "Writing the full prompt..." : hasBrief ? "Generate again from scratch" : "Generate full prompt"}
        </button>
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} onBlur={() => { if (detail !== task.detail) onSaveDetail(detail); }}
          placeholder="The full prompt the agent will run. Write it, or tap Generate." rows={8} style={detailArea} />

        <div style={{ ...fieldLabel, marginTop: 14 }}>Your refinements</div>
        <textarea value={refine} onChange={(e) => setRefine(e.target.value)} placeholder="Add your thinking, and I rework the prompt to match." rows={3} style={detailArea} />
        <button onClick={() => onGenerate(refine)} disabled={briefing || !refine.trim()} style={(briefing || !refine.trim()) ? briefBtnOff : briefBtn}>
          {briefing ? "Improving..." : "Improve with my notes"}
        </button>

        <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={onToggleProgress} disabled={published} style={inProgress ? { ...segBtn, background: "#2563EB", color: "#fff", borderColor: "#2563EB", flex: "none", padding: "8px 12px" } : { ...ghostBtn }}>{inProgress ? "In progress" : "Mark in progress"}</button>
          <button onClick={onPublish} disabled={publishing} style={publishing ? disabledBtn : primaryBtn}>{publishing ? "Publishing..." : `Publish to ${lane ? lane.label : "lane"}`}</button>
          <button onClick={onMarkDone} style={{ ...ghostBtn, color: "#166534", borderColor: "#86EFAC" }}>Mark done</button>
          <button onClick={onArchive} style={{ ...ghostBtn, marginLeft: "auto", color: C.gray }}>Archive</button>
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div style={legendWrap}>
      <span style={legendGroup}>
        <b style={legendTitle}>Card color</b>
        <Chip color={TIERS.green.bg} border={TIERS.green.border} text="Green: runs alone" />
        <Chip color={TIERS.yellow.bg} border={TIERS.yellow.border} text="Yellow: draft for me" />
        <Chip color={TIERS.red.bg} border={TIERS.red.border} text="Red: I do it" />
      </span>
      <span style={legendGroup}>
        <b style={legendTitle}>Check marks</b>
        <span style={legendItem}><span style={emptyRing} /> not started</span>
        <span style={legendItem}><span style={checkMark}>{"\u2713"}</span> in progress</span>
        <span style={legendItem}><span style={checkMark}>{"\u2713"}</span><span style={{ ...checkMark, marginLeft: -3 }}>{"\u2713"}</span> published</span>
      </span>
      <span style={legendGroup}>
        <b style={legendTitle}>Sections</b>
        <span style={legendItem}>Now, Next week, Next month</span>
      </span>
    </div>
  );
}
function Chip({ color, border, text }) {
  return <span style={legendItem}><span style={{ width: 14, height: 14, borderRadius: 4, background: color, border: `1px solid ${border}`, display: "inline-block" }} /> {text}</span>;
}

const primaryBtn = { background: C.forest, color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 };
const disabledBtn = { ...primaryBtn, background: "#CBD5E1", cursor: "default" };
const ghostBtn = { background: "#fff", border: `1px solid ${C.line}`, color: C.ink, borderRadius: 9, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 };
const smallAdd = { background: C.forest, color: "#fff", border: "none", borderRadius: 6, padding: "0 9px", fontSize: 15, fontWeight: 600, cursor: "pointer", flexShrink: 0 };
const smallAddOff = { ...smallAdd, background: "#D1D5DB", cursor: "default" };
const linkBtn = { background: "none", border: "none", color: C.sage, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "4px 2px" };
const inlineLink = { background: "none", border: "none", color: C.sage, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" };
const boardRow = { display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start", WebkitOverflowScrolling: "touch" };
const columnWrap = { flex: "1 1 0", minWidth: 230, display: "flex", flexDirection: "column", gap: 12 };
const laneBox = { background: "#FBF8F3", border: `1px solid ${C.line}`, borderRadius: 12, display: "flex", flexDirection: "column" };
const laneHead = { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottom: `1px solid ${C.line}` };
const laneBody = { padding: "8px 8px 8px" };
const countPill = { marginLeft: "auto", fontSize: 11, fontWeight: 700, color: C.gray, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 999, padding: "1px 8px" };
const bucketLabel = { fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: ".06em", margin: "2px 2px 4px" };
const bucketEmpty = { fontSize: 12, color: "#D1D5DB", padding: "0 2px 4px" };
const cardBase = { display: "flex", alignItems: "center", gap: 7, borderRadius: 7, padding: "5px 7px", marginBottom: 4 };
const cardNum = { fontSize: 12, fontWeight: 800, color: C.ink, flexShrink: 0, minWidth: 14 };
const titleBtn = { flex: 1, textAlign: "left", background: "none", border: "none", fontSize: 13, color: C.ink, cursor: "pointer", padding: 0, minWidth: 0, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const checksBtn = { background: "none", border: "none", cursor: "pointer", padding: "2px 2px", flexShrink: 0, display: "inline-flex", alignItems: "center" };
const checkMark = { color: "#166534", fontWeight: 800, fontSize: 13, lineHeight: 1 };
const emptyRing = { width: 12, height: 12, borderRadius: 999, border: `2px solid ${C.gray}`, display: "inline-block", opacity: 0.5 };
const selDot = { width: 16, height: 16, borderRadius: 999, border: "2px solid #CBD5E1", background: "#fff", cursor: "pointer", flexShrink: 0, padding: 0 };
const addRow = { display: "flex", gap: 5, marginTop: 3, marginBottom: 2 };
const addInput = { flex: 1, border: `1px solid ${C.line}`, borderRadius: 7, padding: "5px 8px", fontSize: 12, color: C.ink, minWidth: 0, background: "#fff" };
const doneRow = { display: "flex", alignItems: "center", gap: 8, padding: "3px 2px" };
const checkDone = { width: 16, height: 16, borderRadius: 5, border: `2px solid ${C.sage}`, background: C.sage, color: "#fff", cursor: "pointer", fontSize: 10, lineHeight: 1, padding: 0, flexShrink: 0 };
const publishBar = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 12, marginBottom: 12, flexWrap: "wrap" };
const noteOk = { background: "#F0FDF4", border: "1px solid #86EFAC", color: "#166534", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 };
const noteWarn = { background: "#FFF7ED", border: "1px solid #FED7AA", color: "#9A3412", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 };
const undoBanner = { display: "flex", alignItems: "center", gap: 12, background: C.cream, border: `1px solid ${C.sage}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 14, color: C.forest };
const undoBtn = { background: C.forest, color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const undoDismiss = { marginLeft: "auto", background: "none", border: "none", color: C.gray, fontSize: 14, cursor: "pointer", padding: 4 };
const legendWrap = { display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center", padding: "10px 14px", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, marginBottom: 12 };
const legendGroup = { display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" };
const legendTitle = { fontSize: 11, color: C.gray, textTransform: "uppercase", letterSpacing: ".05em" };
const legendItem = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: C.ink };
const overlay = { position: "fixed", inset: 0, background: "rgba(20,28,22,.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "50px 16px", zIndex: 1000, overflowY: "auto" };
const panel = { background: "#fff", borderRadius: 16, padding: "20px 22px", width: "100%", maxWidth: 580, boxShadow: "0 20px 60px rgba(20,28,22,.3)" };
const detailTitle = { width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 16, color: C.ink, marginBottom: 16, fontWeight: 600, boxSizing: "border-box" };
const twoCol = { display: "flex", gap: 16, flexWrap: "wrap" };
const fieldLabel = { fontSize: 12, fontWeight: 700, color: C.gray, marginBottom: 6 };
const segBtn = { flex: 1, background: "#fff", border: `1px solid ${C.line}`, color: C.ink, borderRadius: 8, padding: "7px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const detailArea = { width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, color: C.ink, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.5 };
const briefBtn = { width: "100%", background: "#EEF4F0", color: C.forest, border: `1px solid ${C.sage}`, borderRadius: 8, padding: "9px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 8 };
const briefBtnOff = { ...briefBtn, color: C.gray, cursor: "default", borderColor: C.line, background: "#F3F4F6" };

export default AgentBoardEmbedded;
