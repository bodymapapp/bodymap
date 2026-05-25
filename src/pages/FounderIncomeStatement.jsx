// src/pages/FounderIncomeStatement.jsx
//
// Founder-only living income statement. Tracks every line item HK has
// mentioned across chats: infrastructure subscriptions (Vercel,
// Supabase, Resend, Anthropic, Twilio, Stripe), legal & insurance,
// domain renewals, future-potential expenses (E&O, attorney). Each
// line item is inline-editable so HK can confirm/correct without
// going back to Claude. Stored in finance_line_items table.
//
// Design principle #17: no popups. All edits inline.
// Design principle for the income statement (HK May 25 2026):
// "no touch from me as you are getting all the information from me
// in these chats" - I seed the table with everything I already know
// at first render. HK just confirms or corrects. Future items I
// learn about in chats get appended to the seed list and HK will
// confirm them next time he opens the page.

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";

const C = {
  paper: "#FAF6EE",
  card: "#fff",
  ink: "#1F2937",
  inkMute: "#6B7280",
  border: "#E5DDD2",
  forest: "#2A5741",
  forestSoft: "#4B8A6A",
  sage: "#6B9E80",
  cream: "#F5F0E8",
  red: "#B91C1C",
  redSoft: "#FEE2E2",
  amber: "#92400E",
  amberSoft: "#FEF3C7",
  green: "#15803D",
  greenSoft: "#DCFCE7",
};

// Seed line items. Everything I know from HK's chats up to May 25 2026.
// Each item has: category, label, monthly_cost, status (active /
// queued / future), notes, source. HK can edit any field inline.
// When I learn new costs in chats, append a new SEED_LINE here and
// the page will prompt HK to confirm.
const SEED_LINES = [
  // ─── Infrastructure (recurring monthly) ───
  { key: "vercel", category: "Infrastructure", label: "Vercel hosting", monthly_cost: 0, status: "active", notes: "Free Hobby tier. Pro is $20/mo when traffic grows.", source: "chat: HK confirmed free tier May 2026" },
  { key: "supabase", category: "Infrastructure", label: "Supabase Pro", monthly_cost: 25, status: "active", notes: "Pro plan. Daily backups, point-in-time recovery, dedicated resources.", source: "chat: HK has Pro tier May 2026" },
  { key: "resend", category: "Infrastructure", label: "Resend email", monthly_cost: 0, status: "active", notes: "Free tier today (3k/mo, 100/day). Upgrading to Pro $20/mo for 50k/mo + 10k/day after May 25.", source: "chat: May 25 2026 Resend audit" },
  { key: "twilio_a2p_brand", category: "Infrastructure", label: "Twilio A2P 10DLC brand fee", monthly_cost: 1.5, status: "queued", notes: "$4 brand + $10 campaign one-time + ~$1.50/mo per campaign. Pending TCR approval.", source: "chat: SMS production blockers May 2026" },
  { key: "stripe_fees", category: "Infrastructure", label: "Stripe Connect fees", monthly_cost: null, status: "active", notes: "Variable: 2.9% + 30¢ per transaction + 0.25% + 25¢ Connect transfer fee. Revenue-driven cost.", source: "chat: Stripe Connect Express live" },
  { key: "anthropic", category: "Infrastructure", label: "Anthropic Claude API", monthly_cost: null, status: "active", notes: "PracticeIQ drafts (SOAP, recap, summaries). Variable by usage. HK to confirm current monthly burn.", source: "chat: bodymap-ai edge function, draft-note mode" },
  { key: "google_apis", category: "Infrastructure", label: "Google Calendar APIs", monthly_cost: 0, status: "active", notes: "Free tier, OAuth + Calendar API. Has quotas but well within for current scale.", source: "chat: Cal.com + Google Calendar reverse sync" },
  { key: "domain", category: "Infrastructure", label: "Domain (mybodymap.app)", monthly_cost: 1.5, status: "active", notes: "Estimated $15-30/year amortized monthly. HK to confirm registrar and annual rate.", source: "chat: domain in use" },
  { key: "github", category: "Infrastructure", label: "GitHub", monthly_cost: 0, status: "active", notes: "Free tier, private repo, Actions enabled.", source: "chat: bodymapapp/bodymap.git" },
  { key: "cal_com", category: "Infrastructure", label: "Cal.com", monthly_cost: 0, status: "active", notes: "OAuth integration, no subscription cost.", source: "chat: Cal.com OAuth approved" },

  // ─── Legal & Compliance ───
  { key: "llc_filing", category: "Legal & Compliance", label: "Wyoming LLC annual filing", monthly_cost: 5, status: "active", notes: "$60/year via Northwest Registered Agent amortized.", source: "chat: BodyMap LLC Wyoming, Northwest RA" },
  { key: "tx_attorney", category: "Legal & Compliance", label: "TX attorney review (one-time)", monthly_cost: null, status: "queued", notes: "$500-1,000 one-time, for ToS/Privacy/structure validation. Not yet engaged.", source: "BLOCK_PLAN item 0.3" },
  { key: "trade_name", category: "Legal & Compliance", label: "MyBodyMap trade name (one-time)", monthly_cost: null, status: "queued", notes: "$100 one-time via Northwest. Legal entity is BodyMap LLC, customer-facing is MyBodyMap.", source: "BLOCK_PLAN item 0.3d" },
  { key: "tx_foreign_llc", category: "Legal & Compliance", label: "TX foreign LLC qualification", monthly_cost: null, status: "future", notes: "$750 if TX attorney determines required. HK is TX-based, BodyMap LLC is Wyoming.", source: "BLOCK_PLAN item 0.3e" },

  // ─── Insurance (high-priority queued) ───
  { key: "eo_insurance", category: "Insurance", label: "E&O / Tech E&O insurance", monthly_cost: 100, status: "queued", notes: "Estimated $800-2,500/year amortized ($66-208/mo). PRIORITY 0, not yet purchased. Single most important purchase per BLOCK_PLAN.", source: "BLOCK_PLAN item 0.1" },
  { key: "gl_insurance", category: "Insurance", label: "General Liability insurance", monthly_cost: 50, status: "future", notes: "$400-800/year. Lower priority than E&O. Required for in-person events or co-working.", source: "BLOCK_PLAN item 0.4" },

  // ─── Revenue ───
  { key: "rev_subscriptions", category: "Revenue", label: "Therapist subscriptions (Bronze/Silver/Gold)", monthly_cost: null, status: "active", notes: "Founding therapists currently on free period. 5 real therapists onboarded. Pricing TBD.", source: "chat: founding therapist program" },
  { key: "rev_processing", category: "Revenue", label: "Platform processing fee (1% of GMV)", monthly_cost: null, status: "active", notes: "MyBodyMap fee on top of Stripe (Phase 23 spec). HK to confirm whether this is live.", source: "chat: BILLING_STRATEGY.md" },
];

// Categories as displayed groups, in order.
const CATEGORY_ORDER = [
  "Revenue",
  "Infrastructure",
  "Insurance",
  "Legal & Compliance",
];

const STATUS_META = {
  active:  { label: "Active",  bg: "#DCFCE7", color: "#15803D" },
  queued:  { label: "Queued",  bg: "#FEF3C7", color: "#92400E" },
  future:  { label: "Future",  bg: "#E0E7FF", color: "#3730A3" },
  paused:  { label: "Paused",  bg: "#F3F4F6", color: "#6B7280" },
};

function formatMoney(n) {
  if (n === null || n === undefined || isNaN(n)) return "-";
  if (n === 0) return "$0";
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function FounderIncomeStatement() {
  return <IncomeStatementBody embedded={false} />;
}

// Embedded variant for use inside FounderHub.
export function FounderIncomeStatementEmbedded() {
  return <IncomeStatementBody embedded={true} />;
}

function IncomeStatementBody({ embedded }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);

  // Load from finance_line_items. If table is empty (first run),
  // seed it with SEED_LINES so HK has a starting point. Future
  // seed additions: any SEED_LINE whose key isn't in the table
  // yet will be inserted on load.
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("finance_line_items")
        .select("*")
        .order("category")
        .order("label");

      if (!alive) return;

      if (error) {
        console.warn("[finance] load error:", error.message);
        // Table likely does not exist yet. Show seed lines in
        // read-only mode and prompt HK to run the migration.
        setLines(SEED_LINES.map(s => ({ ...s, id: null, __missing_table: true })));
        setLoading(false);
        return;
      }

      const existingKeys = new Set((data || []).map(d => d.key));
      const missingSeeds = SEED_LINES.filter(s => !existingKeys.has(s.key));

      if (missingSeeds.length > 0) {
        // Insert seed lines not yet in the table. This is how new
        // line items I learn about in chats get auto-added on the
        // next page load.
        const { error: insertError } = await supabase
          .from("finance_line_items")
          .insert(missingSeeds);
        if (insertError) {
          console.warn("[finance] seed insert error:", insertError.message);
        }
        // Re-fetch with the seeds included.
        const { data: refreshed } = await supabase
          .from("finance_line_items")
          .select("*")
          .order("category")
          .order("label");
        if (alive) setLines(refreshed || []);
      } else {
        setLines(data || []);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  async function updateLine(line, changes) {
    if (line.__missing_table) return; // Read-only mode
    setSavingKey(line.key);
    const optimistic = lines.map(l => l.key === line.key ? { ...l, ...changes } : l);
    setLines(optimistic);
    const { error } = await supabase
      .from("finance_line_items")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("key", line.key);
    if (error) {
      console.warn("[finance] update error:", error.message);
    }
    setSavingKey(null);
  }

  // Group lines by category in the canonical order.
  const grouped = useMemo(() => {
    const byCat = {};
    for (const l of lines) {
      if (!byCat[l.category]) byCat[l.category] = [];
      byCat[l.category].push(l);
    }
    return CATEGORY_ORDER.map(cat => ({
      category: cat,
      lines: byCat[cat] || [],
    })).filter(g => g.lines.length > 0);
  }, [lines]);

  // Totals: only count 'active' status, only count numeric monthly_cost.
  const totals = useMemo(() => {
    const revenue = lines
      .filter(l => l.category === "Revenue" && l.status === "active" && typeof l.monthly_cost === "number")
      .reduce((sum, l) => sum + Number(l.monthly_cost), 0);
    const expensesActive = lines
      .filter(l => l.category !== "Revenue" && l.status === "active" && typeof l.monthly_cost === "number")
      .reduce((sum, l) => sum + Number(l.monthly_cost), 0);
    const expensesQueued = lines
      .filter(l => l.category !== "Revenue" && l.status === "queued" && typeof l.monthly_cost === "number")
      .reduce((sum, l) => sum + Number(l.monthly_cost), 0);
    const expensesFuture = lines
      .filter(l => l.category !== "Revenue" && l.status === "future" && typeof l.monthly_cost === "number")
      .reduce((sum, l) => sum + Number(l.monthly_cost), 0);
    const netActive = revenue - expensesActive;
    return { revenue, expensesActive, expensesQueued, expensesFuture, netActive };
  }, [lines]);

  const missingTable = lines.some(l => l.__missing_table);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: C.inkMute }}>
        Loading income statement…
      </div>
    );
  }

  return (
    <div style={{
      padding: embedded ? 0 : 40,
      maxWidth: 980,
      margin: embedded ? 0 : "0 auto",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: C.ink,
    }}>
      {!embedded && (
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px", fontFamily: "Georgia, serif" }}>
            Income statement
          </h1>
          <p style={{ fontSize: 14, color: C.inkMute, margin: 0, lineHeight: 1.6 }}>
            A living view of every recurring cost and revenue line. Edit any cell inline.
          </p>
        </div>
      )}

      {missingTable && (
        <div style={{
          background: C.amberSoft,
          border: `1px solid #FDE68A`,
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 20,
          fontSize: 13,
          color: C.amber,
          lineHeight: 1.6,
        }}>
          <strong>Migration needed.</strong> Run this SQL in Supabase to enable editing:
          <pre style={{
            margin: "10px 0 0",
            padding: 12,
            background: "#fff",
            border: "1px solid #FDE68A",
            borderRadius: 8,
            fontSize: 12,
            overflow: "auto",
          }}>{`CREATE TABLE IF NOT EXISTS finance_line_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  category    TEXT NOT NULL,
  label       TEXT NOT NULL,
  monthly_cost NUMERIC(10,2),
  status      TEXT NOT NULL DEFAULT 'active',
  notes       TEXT,
  source      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE finance_line_items ENABLE ROW LEVEL SECURITY;
-- Founder-only access. Replace with your founder uuid policy.
CREATE POLICY "founder_can_read" ON finance_line_items FOR SELECT USING (true);
CREATE POLICY "founder_can_write" ON finance_line_items FOR ALL USING (true);`}</pre>
        </div>
      )}

      {/* Summary tiles */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
        marginBottom: 24,
      }}>
        <SummaryTile label="Revenue, active monthly" value={formatMoney(totals.revenue)} accent={C.green} />
        <SummaryTile label="Expenses, active monthly" value={formatMoney(totals.expensesActive)} accent={C.forest} />
        <SummaryTile
          label="Net monthly"
          value={formatMoney(totals.netActive)}
          accent={totals.netActive >= 0 ? C.green : C.red}
          subtle
        />
        <SummaryTile label="Queued expenses" value={formatMoney(totals.expensesQueued)} accent={C.amber} subtle />
        <SummaryTile label="Future potential" value={formatMoney(totals.expensesFuture)} accent={C.inkMute} subtle />
      </div>

      {/* Grouped tables */}
      {grouped.map(group => (
        <CategoryBlock
          key={group.category}
          category={group.category}
          lines={group.lines}
          onUpdate={updateLine}
          savingKey={savingKey}
          readonly={missingTable}
        />
      ))}

      {/* Footer note */}
      <div style={{
        marginTop: 24,
        padding: "14px 16px",
        background: C.cream,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        fontSize: 12,
        color: C.inkMute,
        lineHeight: 1.6,
      }}>
        <strong style={{ color: C.ink }}>How this stays current:</strong> when Claude learns about a new cost or revenue line from a chat, it adds a new entry to the SEED_LINES array. The next time you open this page, that line is inserted into the table and shows up below for you to confirm or correct. Lines with a "-" cost are awaiting your confirmation.
      </div>
    </div>
  );
}

function SummaryTile({ label, value, accent, subtle = false }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: "14px 16px",
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.inkMute,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: subtle ? 18 : 22,
        fontWeight: 700,
        color: accent,
        fontFamily: "Georgia, serif",
      }}>
        {value}
      </div>
    </div>
  );
}

function CategoryBlock({ category, lines, onUpdate, savingKey, readonly }) {
  const subtotal = lines
    .filter(l => l.status === "active" && typeof l.monthly_cost === "number")
    .reduce((sum, l) => sum + Number(l.monthly_cost), 0);
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 10,
        paddingBottom: 8,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <h2 style={{
          fontSize: 15,
          fontWeight: 700,
          color: C.ink,
          margin: 0,
          fontFamily: "Georgia, serif",
          letterSpacing: "-0.005em",
        }}>
          {category}
        </h2>
        <div style={{ fontSize: 12, color: C.inkMute }}>
          Active subtotal: <strong style={{ color: C.ink }}>{formatMoney(subtotal)}</strong>/mo
        </div>
      </div>
      <div style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: "hidden",
      }}>
        {lines.map((line, i) => (
          <FinanceLineRow
            key={line.key}
            line={line}
            isLast={i === lines.length - 1}
            onUpdate={onUpdate}
            saving={savingKey === line.key}
            readonly={readonly}
          />
        ))}
      </div>
    </div>
  );
}

function FinanceLineRow({ line, isLast, onUpdate, saving, readonly }) {
  const [editingCost, setEditingCost] = useState(false);
  const [costDraft, setCostDraft] = useState(line.monthly_cost ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(line.notes ?? "");

  const statusMeta = STATUS_META[line.status] || STATUS_META.active;

  async function saveCost() {
    const parsed = costDraft === "" ? null : Number(costDraft);
    if (parsed !== null && isNaN(parsed)) {
      setEditingCost(false);
      setCostDraft(line.monthly_cost ?? "");
      return;
    }
    await onUpdate(line, { monthly_cost: parsed });
    setEditingCost(false);
  }

  async function saveNotes() {
    await onUpdate(line, { notes: notesDraft });
    setEditingNotes(false);
  }

  async function cycleStatus() {
    const order = ["active", "queued", "future", "paused"];
    const next = order[(order.indexOf(line.status) + 1) % order.length];
    await onUpdate(line, { status: next });
  }

  return (
    <div style={{
      padding: "14px 16px",
      borderBottom: isLast ? "none" : `1px solid ${C.border}`,
      background: saving ? "#FAFAF7" : "transparent",
    }}>
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}>
        {/* Label + status pill */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{line.label}</span>
            <button
              type="button"
              onClick={readonly ? undefined : cycleStatus}
              disabled={readonly}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: statusMeta.color,
                background: statusMeta.bg,
                border: "none",
                borderRadius: 999,
                padding: "2px 10px",
                cursor: readonly ? "default" : "pointer",
                fontFamily: "inherit",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
              title={readonly ? "" : "Click to cycle status"}
            >
              {statusMeta.label}
            </button>
          </div>
          {editingNotes ? (
            <div style={{ marginTop: 6 }}>
              <textarea
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
                autoFocus
                onBlur={saveNotes}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveNotes();
                  if (e.key === "Escape") { setNotesDraft(line.notes ?? ""); setEditingNotes(false); }
                }}
                style={{
                  width: "100%",
                  minHeight: 60,
                  padding: 8,
                  fontSize: 12,
                  border: `1px solid ${C.forestSoft}`,
                  borderRadius: 6,
                  fontFamily: "inherit",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ fontSize: 10, color: C.inkMute, marginTop: 2 }}>
                Cmd/Ctrl+Enter to save · Esc to cancel
              </div>
            </div>
          ) : (
            <div
              onClick={readonly ? undefined : () => setEditingNotes(true)}
              style={{
                fontSize: 12,
                color: C.inkMute,
                lineHeight: 1.5,
                cursor: readonly ? "default" : "text",
                padding: "2px 0",
              }}
              title={readonly ? "" : "Click to edit"}
            >
              {line.notes || (readonly ? "" : "Click to add notes…")}
            </div>
          )}
          {line.source && (
            <div style={{
              fontSize: 10,
              color: C.inkMute,
              marginTop: 4,
              fontStyle: "italic",
              opacity: 0.7,
            }}>
              {line.source}
            </div>
          )}
        </div>

        {/* Cost cell */}
        <div style={{ minWidth: 110, textAlign: "right" }}>
          {editingCost ? (
            <input
              type="number"
              step="0.01"
              value={costDraft}
              onChange={e => setCostDraft(e.target.value)}
              autoFocus
              onBlur={saveCost}
              onKeyDown={e => {
                if (e.key === "Enter") saveCost();
                if (e.key === "Escape") { setCostDraft(line.monthly_cost ?? ""); setEditingCost(false); }
              }}
              placeholder="0.00"
              style={{
                width: "100%",
                padding: "6px 8px",
                fontSize: 14,
                border: `1px solid ${C.forestSoft}`,
                borderRadius: 6,
                fontFamily: "inherit",
                outline: "none",
                textAlign: "right",
                boxSizing: "border-box",
              }}
            />
          ) : (
            <div
              onClick={readonly ? undefined : () => setEditingCost(true)}
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: line.monthly_cost === null ? C.amber : C.ink,
                fontFamily: "Georgia, serif",
                cursor: readonly ? "default" : "text",
                padding: "2px 6px",
                borderRadius: 6,
                background: line.monthly_cost === null ? C.amberSoft : "transparent",
                border: line.monthly_cost === null ? `1px dashed ${C.amber}` : "1px solid transparent",
                display: "inline-block",
                minWidth: 60,
              }}
              title={readonly ? "" : "Click to edit"}
            >
              {line.monthly_cost === null ? "Confirm $" : formatMoney(line.monthly_cost)}
            </div>
          )}
          <div style={{ fontSize: 10, color: C.inkMute, marginTop: 2 }}>per month</div>
        </div>
      </div>
    </div>
  );
}
