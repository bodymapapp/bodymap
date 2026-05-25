// src/components/AiCostCard.jsx
//
// AI cost meter for the founder dashboard.
//
// HK May 14 2026: 'I need to know how much the website is costing me
// in terms of AI cost. That is just the AI that is run for SOAP notes
// or anything within the website, not the work we are doing here.'
//
// Data source: ai_call_log table. Every Anthropic API call made by
// the platform's edge functions inserts a row with tokens + USD cost.
// We aggregate today / this month / lifetime and break down by caller.
//
// What is NOT tracked here:
//   - HK's chats in claude.ai (that's HK's personal account)
//   - Local Claude Code or other dev tooling

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const C = {
  forest: "#2A5741",
  sage: "#6B9E80",
  cream: "#FFF9F3",
  dark: "#1F2937",
  gray: "#6B7280",
  muted: "#9CA3AF",
  light: "#E8E4DC",
  paper: "#FFFFFF",
  green: "#16A34A",
  amber: "#D97706",
};

function fmtUsd(n) {
  if (n == null || isNaN(n)) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  if (n < 100) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtInt(n) {
  if (n == null) return "0";
  return n.toLocaleString();
}

export default function AiCostCard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [stats, setStats] = useState({
    today: 0,
    today_calls: 0,
    month: 0,
    month_calls: 0,
    lifetime: 0,
    lifetime_calls: 0,
    by_caller: [], // [{ caller, purpose, calls, cost }]
    last_call_at: null,
  });

  async function fetchStats() {
    setLoading(true);
    setErr("");
    try {
      // Today: rows since start of today (UTC for simplicity, fine for $ rollup)
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      const startOfMonth = new Date();
      startOfMonth.setUTCDate(1);
      startOfMonth.setUTCHours(0, 0, 0, 0);

      const [{ data: todayRows, error: e1 }, { data: monthRows, error: e2 }, { data: lifetimeRows, error: e3 }, { data: callerRows, error: e4 }, { data: lastRow }] = await Promise.all([
        supabase.from("ai_call_log").select("total_cost_usd").gte("created_at", startOfToday.toISOString()),
        supabase.from("ai_call_log").select("total_cost_usd").gte("created_at", startOfMonth.toISOString()),
        supabase.from("ai_call_log").select("total_cost_usd"),
        // For breakdown, group on the client (small N expected)
        supabase.from("ai_call_log")
          .select("caller, purpose, total_cost_usd, created_at")
          .gte("created_at", startOfMonth.toISOString())
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase.from("ai_call_log").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (e1 || e2 || e3 || e4) {
        const m = (e1 || e2 || e3 || e4)?.message || "Failed to load AI cost data.";
        setErr(m);
        setLoading(false);
        return;
      }

      const sum = (rows) => (rows || []).reduce((s, r) => s + Number(r.total_cost_usd || 0), 0);

      // Group monthly rows by caller+purpose for the breakdown bars
      const byKey = {};
      (callerRows || []).forEach((r) => {
        const key = `${r.caller}|${r.purpose || ""}`;
        byKey[key] = byKey[key] || { caller: r.caller, purpose: r.purpose || null, calls: 0, cost: 0 };
        byKey[key].calls += 1;
        byKey[key].cost += Number(r.total_cost_usd || 0);
      });
      const breakdown = Object.values(byKey).sort((a, b) => b.cost - a.cost);

      setStats({
        today: sum(todayRows),
        today_calls: (todayRows || []).length,
        month: sum(monthRows),
        month_calls: (monthRows || []).length,
        lifetime: sum(lifetimeRows),
        lifetime_calls: (lifetimeRows || []).length,
        by_caller: breakdown,
        last_call_at: lastRow?.created_at || null,
      });
    } catch (e) {
      setErr(e.message || "Failed to load AI cost data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
    // Refresh every 30 seconds so the counter feels live during testing.
    const t = setInterval(fetchStats, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      marginTop: 18,
      marginBottom: 14,
      padding: 16,
      background: C.paper,
      border: `1px solid ${C.light}`,
      borderRadius: 12,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 12,
        gap: 12,
        flexWrap: "wrap",
      }}>
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.sage,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 2,
          }}>
            AI cost meter
          </div>
          <div style={{ fontSize: 12, color: C.gray }}>
            Anthropic API calls made by the platform. Updated every 30 seconds.
          </div>
        </div>
        <button
          onClick={fetchStats}
          style={{
            padding: "5px 12px",
            borderRadius: 8,
            border: `1px solid ${C.light}`,
            background: "#fff",
            cursor: "pointer",
            fontSize: 11,
            color: C.gray,
            fontWeight: 600,
          }}
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>
          Loading AI usage...
        </div>
      )}

      {err && !loading && (
        <div style={{ fontSize: 12, color: "#B44A3A", fontWeight: 600 }}>
          {err}
        </div>
      )}

      {!loading && !err && (
        <>
          {/* Three big numbers: today, month, lifetime */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            marginBottom: 14,
          }}>
            <Stat label="Today" cost={stats.today} calls={stats.today_calls} accent={C.green} />
            <Stat label="This month" cost={stats.month} calls={stats.month_calls} accent={C.forest} />
            <Stat label="Lifetime" cost={stats.lifetime} calls={stats.lifetime_calls} accent={C.dark} />
          </div>

          {/* Breakdown by caller + purpose this month */}
          {stats.by_caller.length > 0 ? (
            <div style={{ borderTop: `1px solid ${C.light}`, paddingTop: 12 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.muted,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}>
                This month, by feature
              </div>
              {stats.by_caller.slice(0, 8).map((row) => (
                <Bar key={`${row.caller}-${row.purpose}`} row={row} maxCost={stats.by_caller[0].cost} />
              ))}
            </div>
          ) : (
            <div style={{
              padding: 12,
              background: C.cream,
              borderRadius: 8,
              fontSize: 12,
              color: C.gray,
              fontStyle: "italic",
              textAlign: "center",
            }}>
              No AI calls this month yet. The counter will start populating as therapists use the PracticeIQ or other AI features.
            </div>
          )}

          {stats.last_call_at && (
            <div style={{
              marginTop: 10,
              fontSize: 11,
              color: C.muted,
              textAlign: "right",
            }}>
              Last call: {new Date(stats.last_call_at).toLocaleString()}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, cost, calls, accent }) {
  return (
    <div style={{
      padding: "10px 12px",
      background: C.cream,
      borderRadius: 10,
      border: `1px solid ${C.light}`,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: C.muted,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: 3,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "Georgia, serif",
        fontSize: 22,
        fontWeight: 700,
        color: accent,
        lineHeight: 1,
      }}>
        {fmtUsd(cost)}
      </div>
      <div style={{
        fontSize: 11,
        color: C.gray,
        marginTop: 3,
      }}>
        {fmtInt(calls)} call{calls === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function Bar({ row, maxCost }) {
  const widthPct = maxCost > 0 ? Math.max(2, (row.cost / maxCost) * 100) : 0;
  const label = row.purpose
    ? `${row.caller} · ${row.purpose}`
    : row.caller;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 3,
        fontSize: 12,
      }}>
        <span style={{ color: C.dark, fontWeight: 600 }}>{label}</span>
        <span style={{ color: C.gray }}>
          {fmtUsd(row.cost)} <span style={{ color: C.muted, fontSize: 11 }}>· {row.calls}x</span>
        </span>
      </div>
      <div style={{
        height: 4,
        background: C.light,
        borderRadius: 2,
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${widthPct}%`,
          background: C.sage,
          transition: "width 0.3s",
        }} />
      </div>
    </div>
  );
}
