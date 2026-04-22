// Founder dashboard at /founder. Admin-only via email allowlist.
// Per-therapist retention intelligence: who signed up, how engaged they are,
// and one-click action for each row.
//
// Schema notes (verified in codebase, not guessed):
//   therapists.plan values: 'silver' | 'gold' | null/'free'. Column is NOT 'tier'.
//   last activity is derived from max(sessions.created_at, clients.created_at, created_at)
//   since last_sign_in_at lives in auth.users, not therapists.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const ADMIN_EMAILS = new Set([
  "bodymap01@gmail.com",
  "bodymapdemo@gmail.com",
  "harshk.mba@gmail.com",
]);

const C = {
  forest: "#2A5741",
  sage: "#6B9E80",
  cream: "#FFF9F3",
  dark: "#1F2937",
  gray: "#6B7280",
  light: "#E8E4DC",
  gold: "#C59550",
  rise: "#2A7F5F",
  fall: "#B44A3A",
  stale: "#9CA3AF",
  softCream: "#F9F8F5",
  actionBlue: "#1E5F8A",
};

const DAY = 86400000;
const REMINDER_THRESHOLD_DAYS = 7;
const COLD_MIN_AGE_DAYS = 3;
const TESTIMONIAL_MIN_SESSIONS = 10;

// Heuristic dummy detection. Conservative: only emails that pattern-match
// obvious test shapes or admin accounts. Does NOT flag someone just because
// they haven't added a client yet (they might be a real new signup).
function isDummyEmail(email) {
  const e = (email || "").toLowerCase().trim();
  if (!e) return true;
  if (ADMIN_EMAILS.has(e)) return true;
  const patterns = [
    /^hk\d*@/,
    /^test\d*@/,
    /^demo\d*@/,
    /^asdf/,
    /^qwer/,
    /\+test@/,
    /@test\./,
    /@example\./,
    /@email\.com$/,
    /mailinator/,
    /guerrilla/,
    /tempmail/,
    /throwaway/,
    /\.test$/,
  ];
  return patterns.some((p) => p.test(e));
}

export default function FounderDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [hideDummies, setHideDummies] = useState(true);
  const [sortKey, setSortKey] = useState("sessions_total");
  const [sortDir, setSortDir] = useState("desc");

  // Admin allowlist. Kick anyone else back to dashboard.
  useEffect(() => {
    if (user && !ADMIN_EMAILS.has((user.email || "").toLowerCase())) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const now = Date.now();

      const [
        { data: therapists },
        { data: allSessions },
        { data: allClients },
        { data: activation },
        { data: outreachLog },
      ] = await Promise.all([
        supabase.from("therapists").select(
          "id,email,phone,full_name,business_name,custom_url,plan,created_at,stripe_account_connected,cal_connected,signup_flag_reasons"
        ).order("created_at", { ascending: false }),
        supabase.from("sessions").select("therapist_id,created_at"),
        supabase.from("clients").select("therapist_id,created_at"),
        supabase.from("activation_events").select("therapist_id,event_name"),
        supabase.from("notification_log")
          .select("therapist_id,notification_type,status,sent_at")
          .like("notification_type", "founder_outreach_%")
          .order("sent_at", { ascending: false }),
      ]);

      const d7ms = now - 7 * DAY;
      const d14ms = now - 14 * DAY;

      const byId = {};
      for (const t of therapists || []) {
        byId[t.id] = {
          ...t,
          plan_normalized:
            t.plan === "silver" ? "silver" : t.plan === "gold" ? "gold" : "free",
          is_dummy: isDummyEmail(t.email),
          sessions_total: 0,
          sessions_7d: 0,
          sessions_prev_7d: 0,
          clients_total: 0,
          clients_7d: 0,
          last_session_at: null,
          last_client_at: null,
          activation_events: [],
          last_contact_at: null,
          last_contact_type: null,
        };
      }

      // Layer in outreach log. Log is ordered desc, so first hit per therapist = most recent.
      for (const r of outreachLog || []) {
        const t = byId[r.therapist_id];
        if (!t || t.last_contact_at) continue;
        t.last_contact_at = r.sent_at;
        t.last_contact_type = (r.notification_type || "").replace("founder_outreach_", "");
      }

      for (const s of allSessions || []) {
        const t = byId[s.therapist_id];
        if (!t) continue;
        t.sessions_total++;
        const ts = new Date(s.created_at).getTime();
        if (!t.last_session_at || ts > new Date(t.last_session_at).getTime()) {
          t.last_session_at = s.created_at;
        }
        if (ts >= d7ms) t.sessions_7d++;
        else if (ts >= d14ms) t.sessions_prev_7d++;
      }

      for (const c of allClients || []) {
        const t = byId[c.therapist_id];
        if (!t) continue;
        t.clients_total++;
        const ts = new Date(c.created_at).getTime();
        if (!t.last_client_at || ts > new Date(t.last_client_at).getTime()) {
          t.last_client_at = c.created_at;
        }
        if (ts >= d7ms) t.clients_7d++;
      }

      for (const e of activation || []) {
        const t = byId[e.therapist_id];
        if (t) t.activation_events.push(e.event_name);
      }

      for (const t of Object.values(byId)) {
        const signedUp = new Date(t.created_at).getTime();
        const lastSess = t.last_session_at ? new Date(t.last_session_at).getTime() : 0;
        const lastCli = t.last_client_at ? new Date(t.last_client_at).getTime() : 0;
        const hasAnyActivity = lastSess > 0 || lastCli > 0;
        const lastAct = hasAnyActivity ? Math.max(lastSess, lastCli) : 0;

        t.days_on_platform = Math.max(0, Math.floor((now - signedUp) / DAY));
        t.last_activity_at = hasAnyActivity ? new Date(lastAct).toISOString() : null;
        t.days_since_use = hasAnyActivity
          ? Math.floor((now - lastAct) / DAY)
          : null;
        t.momentum = t.sessions_7d - t.sessions_prev_7d;
        t.has_activation = t.activation_events.length > 0 || t.sessions_total > 0 || t.clients_total > 0;
        t.action = recommendAction(t);
      }

      const list = Object.values(byId).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      const h24 = now - DAY;
      const d7 = now - 7 * DAY;
      const d30 = now - 30 * DAY;

      // Stats exclude dummies by default
      const real = list.filter((t) => !t.is_dummy);
      const stats = {
        signups_24h: real.filter((t) => new Date(t.created_at).getTime() >= h24).length,
        signups_7d: real.filter((t) => new Date(t.created_at).getTime() >= d7).length,
        signups_30d: real.filter((t) => new Date(t.created_at).getTime() >= d30).length,
        total: real.length,
        silver: real.filter((t) => t.plan_normalized === "silver").length,
        free: real.filter((t) => t.plan_normalized === "free").length,
        gold: real.filter((t) => t.plan_normalized === "gold").length,
        dummies: list.length - real.length,
        active_7d: real.filter(
          (t) => t.days_since_use !== null && t.days_since_use <= 7
        ).length,
        sessions_7d: real.reduce((sum, t) => sum + t.sessions_7d, 0),
        sessions_24h: (allSessions || []).filter(
          (s) => new Date(s.created_at).getTime() >= h24
        ).length,
        clients_7d: real.reduce((sum, t) => sum + t.clients_7d, 0),
        cold: real.filter((t) => t.action.key === "checkin" || t.action.key === "reminder").length,
        champions: real.filter((t) => t.sessions_total >= 3).length,
      };

      setData({ therapists: list, stats });
      setLastUpdated(
        new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      );
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && ADMIN_EMAILS.has((user.email || "").toLowerCase())) {
      fetchAll();
    }
  }, [user]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.therapists;

    if (hideDummies) rows = rows.filter((t) => !t.is_dummy);
    if (planFilter !== "all") rows = rows.filter((t) => t.plan_normalized === planFilter);

    if (cohortFilter === "cold") {
      rows = rows.filter((t) => t.action.key === "checkin" || t.action.key === "reminder");
    } else if (cohortFilter === "champions") {
      rows = rows.filter((t) => t.sessions_total >= 3);
    } else if (cohortFilter === "active_7d") {
      rows = rows.filter((t) => t.days_since_use !== null && t.days_since_use <= 7);
    } else if (cohortFilter === "new_7d") {
      rows = rows.filter((t) => t.days_on_platform <= 7);
    } else if (cohortFilter === "silver") {
      rows = rows.filter((t) => t.plan_normalized === "silver");
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (t) =>
          (t.email || "").toLowerCase().includes(q) ||
          (t.business_name || "").toLowerCase().includes(q) ||
          (t.full_name || "").toLowerCase().includes(q) ||
          (t.custom_url || "").toLowerCase().includes(q)
      );
    }

    return [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === "last_activity_at") {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      } else if (sortKey === "created_at") {
        av = new Date(av).getTime();
        bv = new Date(bv).getTime();
      } else if (sortKey === "days_since_use") {
        av = av === null ? Number.MAX_SAFE_INTEGER : av;
        bv = bv === null ? Number.MAX_SAFE_INTEGER : bv;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      return ((av || 0) - (bv || 0)) * dir;
    });
  }, [data, hideDummies, planFilter, cohortFilter, search, sortKey, sortDir]);

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: C.cream, padding: 48, textAlign: "center", color: C.gray }}>
        Checking access...
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.cream, padding: 48, textAlign: "center", color: C.gray }}>
        Loading founder intelligence...
      </div>
    );
  }
  if (!data) return null;

  const s = data.stats;
  const activateFilter = (key) => {
    setCohortFilter(cohortFilter === key ? "all" : key);
    // Smooth scroll to table
    setTimeout(() => {
      const el = document.getElementById("therapist-table");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const onSort = (k) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.cream, padding: "24px 16px 48px", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.sage, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              🌿 Founder · Retention Intelligence
            </div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: 28, color: C.dark, margin: "4px 0 0" }}>
              Who signed up. How they're doing. Who needs a nudge.
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: C.gray }}>
              Updated {lastUpdated} · Excluding {s.dummies} test accounts from totals. Click any stat card to filter the table below.
            </p>
          </div>
          <button
            onClick={fetchAll}
            style={{ padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${C.light}`, background: "#fff", cursor: "pointer", fontSize: 13, color: C.dark, fontWeight: 600 }}
          >
            Refresh
          </button>
        </div>

        {/* Macro stats — clickable */}
        <SectionLabel>Signups · click to filter table</SectionLabel>
        <Grid>
          <ClickStat value={s.signups_24h} label="Last 24h" active={false} />
          <ClickStat value={s.signups_7d} label="New this 7d" onClick={() => activateFilter("new_7d")} active={cohortFilter === "new_7d"} />
          <ClickStat value={s.signups_30d} label="Last 30 days" active={false} />
          <ClickStat value={s.total} label="All time (real)" sub={`${s.dummies} test excluded`} active={false} />
        </Grid>

        <SectionLabel>Plans · click Silver to filter</SectionLabel>
        <Grid>
          <ClickStat value={s.free} label="Free (bronze)" sub="No plan set" active={false} />
          <ClickStat value={s.silver} label="Silver" sub="Phase 0: free" onClick={() => activateFilter("silver")} active={cohortFilter === "silver"} />
          <ClickStat value={s.gold} label="Gold" sub="Not yet active" active={false} />
        </Grid>

        <SectionLabel>Engagement · click to filter</SectionLabel>
        <Grid>
          <ClickStat value={s.active_7d} label="Active last 7d" sub="Used platform recently" onClick={() => activateFilter("active_7d")} active={cohortFilter === "active_7d"} tint={C.rise} />
          <ClickStat value={s.cold} label="Need a nudge" sub={`No activity in ${REMINDER_THRESHOLD_DAYS}+ days`} onClick={() => activateFilter("cold")} active={cohortFilter === "cold"} tint={C.fall} />
          <ClickStat value={s.champions} label="Champions" sub="3+ sessions logged" onClick={() => activateFilter("champions")} active={cohortFilter === "champions"} tint={C.rise} />
        </Grid>

        {/* Table controls */}
        <div id="therapist-table" style={{ marginTop: 28, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, color: C.dark, margin: 0 }}>
              Therapists
              {cohortFilter !== "all" && (
                <button
                  onClick={() => setCohortFilter("all")}
                  style={{ marginLeft: 10, fontSize: 12, padding: "3px 10px", borderRadius: 999, background: C.sage, color: "#fff", border: "none", cursor: "pointer", fontFamily: "system-ui", fontWeight: 600 }}
                >
                  Filter: {filterLabel(cohortFilter)} ✕
                </button>
              )}
            </h2>
            <span style={{ fontSize: 12, color: C.gray }}>
              Showing {filtered.length} of {hideDummies ? data.therapists.filter((t) => !t.is_dummy).length : data.therapists.length}
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              placeholder="Search email, business, name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: "1 1 220px", minWidth: 180, padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.light}`, fontSize: 13, background: "#fff" }}
            />
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.light}`, fontSize: 13, background: "#fff" }}
            >
              <option value="all">All plans</option>
              <option value="silver">Silver only</option>
              <option value="free">Free only</option>
              <option value="gold">Gold only</option>
            </select>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: C.dark, cursor: "pointer", userSelect: "none", padding: "6px 10px", borderRadius: 8, background: hideDummies ? C.softCream : "#fff", border: `1.5px solid ${C.light}` }}>
              <input type="checkbox" checked={hideDummies} onChange={(e) => setHideDummies(e.target.checked)} style={{ margin: 0 }} />
              Hide {s.dummies} test accounts
            </label>
          </div>
        </div>

        <TherapistTable
          rows={filtered}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
        />

        <p style={{ fontSize: 11, color: "#ccc", textAlign: "center", marginTop: 24 }}>
          Founder-only view. Not visible to therapists.
        </p>
      </div>
    </div>
  );
}

function filterLabel(key) {
  return {
    cold: "Need a nudge",
    champions: "Champions",
    active_7d: "Active 7d",
    new_7d: "New 7d",
    silver: "Silver",
  }[key] || key;
}

function recommendAction(t) {
  if (t.is_dummy) return { key: "none", label: "Test account", button: null };
  const noActivity = t.sessions_total === 0 && t.clients_total === 0;

  if (t.days_on_platform < COLD_MIN_AGE_DAYS && noActivity) {
    return {
      key: "welcome",
      label: "Welcome them",
      button: "Welcome",
      subject: `Welcome to BodyMap, ${firstName(t)}`,
      body: [
        `Hi ${firstName(t)},`,
        ``,
        `I'm the founder. Just wanted to say welcome to BodyMap personally.`,
        ``,
        `If you have 30 seconds, what brought you in? Anything I can help with to get you set up?`,
        ``,
        `MyBodyMap`,
      ].join("\n"),
    };
  }

  if (noActivity && t.days_on_platform >= COLD_MIN_AGE_DAYS) {
    return {
      key: "checkin",
      label: "Check in",
      button: "Check in",
      subject: `Checking in, ${firstName(t)}`,
      body: [
        `Hi ${firstName(t)},`,
        ``,
        `I'm the founder of BodyMap. I saw you signed up ${t.days_on_platform} days ago but haven't added a client yet.`,
        ``,
        `What's in the way? I'd love to help you get your first client imported so you can see the platform in action.`,
        ``,
        `MyBodyMap`,
      ].join("\n"),
    };
  }

  if (t.days_since_use !== null && t.days_since_use >= REMINDER_THRESHOLD_DAYS) {
    return {
      key: "reminder",
      label: `Remind (${t.days_since_use}d idle)`,
      button: "Send reminder",
      subject: `Haven't seen you in a bit, ${firstName(t)}`,
      body: [
        `Hi ${firstName(t)},`,
        ``,
        `Noticed it's been ${t.days_since_use} days since you last used BodyMap. Everything okay?`,
        ``,
        `Is there something friction-y getting in the way, or just busy? Either way I'd love to hear.`,
        ``,
        `MyBodyMap`,
      ].join("\n"),
    };
  }

  if (t.sessions_total >= TESTIMONIAL_MIN_SESSIONS && t.days_since_use !== null && t.days_since_use <= 7) {
    return {
      key: "testimonial",
      label: "Ask for testimonial",
      button: "Ask testimonial",
      subject: `Quick favor, ${firstName(t)}?`,
      body: [
        `Hi ${firstName(t)},`,
        ``,
        `You've logged ${t.sessions_total} sessions on BodyMap. That's amazing.`,
        ``,
        `Would you be open to sharing a one or two sentence testimonial about what BodyMap does for your practice? I'd like to feature it on the homepage.`,
        ``,
        `No pressure. And thank you either way.`,
        ``,
        `MyBodyMap`,
      ].join("\n"),
    };
  }

  return { key: "ontrack", label: "On track", button: null };
}

function firstName(t) {
  return (t.full_name || "").split(" ")[0] || "there";
}

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.gray, margin: "20px 0 10px" }}>
      {children}
    </p>
  );
}

function Grid({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))`, gap: 10 }}>
      {children}
    </div>
  );
}

function ClickStat({ value, label, sub, tint, onClick, active }) {
  const clickable = !!onClick;
  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      style={{
        background: active ? "#F0EEE8" : "#fff",
        border: `1.5px solid ${active ? C.forest : C.light}`,
        borderRadius: 12,
        padding: "14px 16px",
        textAlign: "left",
        cursor: clickable ? "pointer" : "default",
        transition: "transform 0.08s, border 0.15s",
        fontFamily: "inherit",
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 700, color: tint || C.forest, fontFamily: "Georgia, serif", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.dark, marginTop: 6, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{sub}</div>}
      {clickable && (
        <div style={{ fontSize: 10, color: active ? C.forest : C.sage, marginTop: 6, fontWeight: 700, letterSpacing: "0.05em" }}>
          {active ? "FILTERED ✓" : "FILTER →"}
        </div>
      )}
    </button>
  );
}

function TherapistTable({ rows, sortKey, sortDir, onSort }) {
  if (rows.length === 0) {
    return (
      <div style={{ background: "#fff", border: `1.5px solid ${C.light}`, borderRadius: 12, padding: 32, textAlign: "center", color: C.gray, fontSize: 13 }}>
        No therapists match this view.
      </div>
    );
  }

  // Sticky header styles. Position sticky works relative to nearest scrolling ancestor.
  // The page itself is the vertical scroller, so top:0 pins to viewport as user scrolls.
  // For horizontal scroll inside the overflow-x wrapper, left:0 pins the first column
  // within that container.
  const stickyHead = {
    position: "sticky",
    top: 0,
    background: C.softCream,
    zIndex: 3,
    borderBottom: `1.5px solid ${C.light}`,
    boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
  };

  const firstColHead = {
    ...stickyHead,
    left: 0,
    zIndex: 5,
    minWidth: 240,
    boxShadow: "1px 0 0 rgba(0,0,0,0.04), 0 1px 0 rgba(0,0,0,0.04)",
  };

  const firstColCell = {
    position: "sticky",
    left: 0,
    background: "#fff",
    zIndex: 2,
    minWidth: 240,
    boxShadow: "1px 0 0 rgba(0,0,0,0.04)",
  };

  const header = (key, label, sortable = true) => {
    const active = sortable && sortKey === key;
    return (
      <th
        onClick={() => sortable && onSort(key)}
        style={{
          padding: "10px 12px",
          textAlign: "left",
          fontWeight: 700,
          color: active ? C.forest : C.gray,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          cursor: sortable ? "pointer" : "default",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {label}
        {active ? (sortDir === "asc" ? " \u2191" : " \u2193") : sortable ? " ⇅" : ""}
      </th>
    );
  };

  return (
    <div style={{ background: "#fff", border: `1.5px solid ${C.light}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13, minWidth: 1240 }}>
          <thead>
            <tr>
              <th style={firstColHead} onClick={() => onSort("business_name")}>
                <div style={{ color: sortKey === "business_name" ? C.forest : C.gray, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "10px 12px", textAlign: "left", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                  Therapist {sortKey === "business_name" ? (sortDir === "asc" ? "\u2191" : "\u2193") : "⇅"}
                </div>
              </th>
              {header("phone", "Phone", false)}
              {header("created_at", "Signed up")}
              {header("days_on_platform", "Days on platform")}
              {header("last_activity_at", "Last used")}
              {header("plan_normalized", "Plan")}
              {header("sessions_total", "Sessions")}
              {header("clients_total", "Clients")}
              {header("momentum", "Momentum 7d")}
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                Recommended action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <Row key={t.id} t={t} firstColCell={firstColCell} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ t, firstColCell }) {
  const momColor =
    t.momentum > 0 ? C.rise : t.momentum < 0 ? C.fall : t.sessions_7d === 0 && t.sessions_prev_7d === 0 ? C.stale : C.gray;
  const momArrow = t.momentum > 0 ? "\u2191" : t.momentum < 0 ? "\u2193" : "\u2500";
  const momLabel =
    t.sessions_7d === 0 && t.sessions_prev_7d === 0
      ? "No sessions"
      : `${t.sessions_7d} vs ${t.sessions_prev_7d}`;

  const lastUsedLabel =
    t.days_since_use === null
      ? "Never"
      : t.days_since_use === 0
      ? "Today"
      : t.days_since_use === 1
      ? "Yesterday"
      : `${t.days_since_use}d ago`;

  const lastUsedColor =
    t.days_since_use === null
      ? C.fall
      : t.days_since_use >= REMINDER_THRESHOLD_DAYS
      ? C.fall
      : t.days_since_use <= 2
      ? C.rise
      : C.dark;

  const planColors =
    t.plan_normalized === "silver"
      ? { bg: "#E8F5EE", fg: "#1A5C38", bd: "#B2D8C0" }
      : t.plan_normalized === "gold"
      ? { bg: "#FDF4E3", fg: "#8A5A1C", bd: "#E8C890" }
      : { bg: "#F5F0E8", fg: "#7A5C1A", bd: "#D8C8A0" };

  return (
    <tr style={{ borderTop: `1px solid ${C.light}`, verticalAlign: "top" }}>
      <td style={{ ...firstColCell, padding: "12px", borderTop: `1px solid ${C.light}` }}>
        <div style={{ fontWeight: 700, color: C.dark, fontSize: 13 }}>
          {t.business_name || t.full_name || "(no name)"}
          {t.is_dummy && (
            <span style={{ marginLeft: 6, fontSize: 10, background: "#F3E9D7", color: "#8A6F3C", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>TEST</span>
          )}
          {t.stripe_account_connected && (
            <span style={{ marginLeft: 6, fontSize: 10, background: "#E8F5EE", color: "#1A5C38", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>STRIPE</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{t.email}</div>
        {t.custom_url && (
          <a
            href={`https://mybodymap.app/${t.custom_url}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 11, color: C.sage, textDecoration: "none" }}
          >
            /{t.custom_url}
          </a>
        )}
        {t.signup_flag_reasons && t.signup_flag_reasons.length > 0 && (
          <div style={{ fontSize: 10, color: C.fall, marginTop: 3, fontWeight: 600 }}>
            flagged: {t.signup_flag_reasons.join(", ")}
          </div>
        )}
      </td>

      <td style={{ padding: "12px", whiteSpace: "nowrap", fontSize: 12 }}>
        {t.phone ? (
          <div>
            <div style={{ color: C.dark, fontWeight: 600 }}>{formatPhoneDisplay(t.phone)}</div>
            <a
              href={`tel:${t.phone.replace(/\D/g, "")}`}
              style={{ fontSize: 11, color: C.sage, textDecoration: "none" }}
            >
              tap to call
            </a>
          </div>
        ) : (
          <span style={{ color: C.stale, fontStyle: "italic", fontSize: 12 }}>No phone</span>
        )}
      </td>

      <td style={{ padding: "12px", whiteSpace: "nowrap", color: C.dark, fontSize: 12 }}>
        {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
      </td>

      <td style={{ padding: "12px", whiteSpace: "nowrap", color: C.dark, fontSize: 13, fontWeight: 600 }}>
        {t.days_on_platform === 0 ? "Today" : `${t.days_on_platform} day${t.days_on_platform === 1 ? "" : "s"}`}
      </td>

      <td style={{ padding: "12px", whiteSpace: "nowrap", color: lastUsedColor, fontSize: 13, fontWeight: 600 }}>
        {lastUsedLabel}
      </td>

      <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
        <span
          style={{
            background: planColors.bg,
            color: planColors.fg,
            border: `1px solid ${planColors.bd}`,
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "capitalize",
          }}
        >
          {t.plan_normalized}
        </span>
      </td>

      <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
        <div style={{ fontWeight: 700, color: C.dark }}>{t.sessions_total}</div>
        <div style={{ fontSize: 11, color: C.gray }}>{t.sessions_7d} this 7d</div>
      </td>

      <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
        <div style={{ fontWeight: 700, color: C.dark }}>{t.clients_total}</div>
        <div style={{ fontSize: 11, color: C.gray }}>{t.clients_7d} this 7d</div>
      </td>

      <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
        <div style={{ color: momColor, fontWeight: 700, fontSize: 14 }}>
          {momArrow} {t.momentum > 0 ? "+" : ""}{t.momentum}
        </div>
        <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{momLabel}</div>
      </td>

      <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
        <ActionCell t={t} />
      </td>
    </tr>
  );
}

function ActionCell({ t }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // 'sent' | 'failed' | 'copied' | null
  const [errorMsg, setErrorMsg] = useState("");

  const a = t.action;

  const sendEmail = async () => {
    if (sending) return;
    setSending(true);
    setResult(null);
    setErrorMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("founder-outreach", {
        body: { therapist_id: t.id, action_type: a.key },
      });
      if (error || !data?.ok) {
        setResult("failed");
        setErrorMsg(error?.message || data?.error || "Send failed");
      } else {
        setResult("sent");
      }
    } catch (e) {
      setResult("failed");
      setErrorMsg(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const copySms = async () => {
    const smsBody = (a.body || "").split("\n").filter((l) => l !== "MyBodyMap").join(" ").trim();
    try {
      await navigator.clipboard.writeText(smsBody);
      setResult("copied");
      setTimeout(() => setResult(null), 3000);
    } catch (e) {
      setResult("failed");
      setErrorMsg("Clipboard blocked");
    }
  };

  // Non-actionable row (dummy or on track)
  if (!a.button) {
    const color = a.key === "ontrack" ? C.rise : C.gray;
    return (
      <div style={{ fontSize: 12, color, fontWeight: 600 }}>
        {a.label}
        {t.last_contact_at && (
          <div style={{ fontSize: 10, color: C.gray, fontWeight: 500, marginTop: 2 }}>
            Last emailed {daysAgo(t.last_contact_at)}
          </div>
        )}
      </div>
    );
  }

  const btnColors = {
    welcome: { bg: C.sage, fg: "#fff" },
    checkin: { bg: C.actionBlue, fg: "#fff" },
    reminder: { bg: C.fall, fg: "#fff" },
    testimonial: { bg: C.gold, fg: "#fff" },
  }[a.key] || { bg: C.forest, fg: "#fff" };

  const recentlyContacted = t.last_contact_at && daysAgoNumeric(t.last_contact_at) <= 3;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5, minWidth: 180 }}>
      <div style={{ fontSize: 11, color: C.gray, fontWeight: 600 }}>
        {a.label}
        {t.last_contact_at && (
          <span style={{ color: recentlyContacted ? C.fall : C.gray, marginLeft: 6, fontWeight: 500 }}>
            · last {t.last_contact_type || "email"} {daysAgo(t.last_contact_at)}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        <button
          onClick={sendEmail}
          disabled={sending}
          style={{
            background: sending ? C.stale : btnColors.bg,
            color: btnColors.fg,
            padding: "6px 11px",
            borderRadius: 6,
            border: "none",
            fontSize: 12,
            fontWeight: 700,
            cursor: sending ? "wait" : "pointer",
            whiteSpace: "nowrap",
            opacity: recentlyContacted ? 0.75 : 1,
          }}
          title={recentlyContacted ? "You emailed this person recently. Click again if you still want to send." : "Send branded BodyMap email from reminders@mybodymap.app"}
        >
          {sending ? "Sending..." : "Email"}
        </button>
        {t.phone ? (
          <button
            onClick={copySms}
            style={{
              background: "#fff",
              color: C.dark,
              padding: "6px 11px",
              borderRadius: 6,
              border: `1.5px solid ${C.light}`,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            title={`Copy SMS text. Paste into Messages and send to ${t.phone}.`}
          >
            Copy SMS
          </button>
        ) : (
          <span style={{ fontSize: 10, color: C.stale, fontStyle: "italic", alignSelf: "center" }}>no phone</span>
        )}
      </div>
      {result === "sent" && (
        <div style={{ fontSize: 11, color: C.rise, fontWeight: 700 }}>
          ✓ Email sent from BodyMap
        </div>
      )}
      {result === "copied" && (
        <div style={{ fontSize: 11, color: C.rise, fontWeight: 700 }}>
          ✓ Copied. Paste into Messages.
        </div>
      )}
      {result === "failed" && (
        <div style={{ fontSize: 11, color: C.fall, fontWeight: 700 }}>
          ✗ {errorMsg || "Failed"}
        </div>
      )}
    </div>
  );
}

function daysAgo(iso) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d}d ago`;
}

function daysAgoNumeric(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
}

function formatPhoneDisplay(raw) {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}
