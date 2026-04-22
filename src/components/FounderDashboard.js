// Founder dashboard. Only visible to admins via /founder route.
// Shows platform-wide stats plus a per-therapist retention intelligence table.
// Tabs: Momentum (default), Cold Signups, Champions, All Therapists.
// Momentum is defined as sessions this 7d minus sessions prior 7d.
//
// Schema notes (verified in codebase, not guessed):
//   therapists.plan values: 'silver' | 'gold' | null/'free'. Column is NOT 'tier'.
//   last activity is derived from sessions.created_at + clients.created_at
//   since last_sign_in_at lives in auth.users, not therapists.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

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
};

const DAY = 86400000;

export default function FounderDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [tab, setTab] = useState("momentum");
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [sortKey, setSortKey] = useState("momentum");
  const [sortDir, setSortDir] = useState("desc");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const now = Date.now();

      const [
        { data: therapists },
        { data: allSessions },
        { data: allClients },
        { data: activation },
      ] = await Promise.all([
        supabase.from("therapists").select(
          "id,email,full_name,business_name,custom_url,plan,created_at,stripe_account_connected,cal_connected,signup_flag_reasons"
        ).order("created_at", { ascending: false }),
        supabase.from("sessions").select("therapist_id,created_at"),
        supabase.from("clients").select("therapist_id,created_at"),
        supabase.from("activation_events").select("therapist_id,event_name"),
      ]);

      const d7ms = now - 7 * DAY;
      const d14ms = now - 14 * DAY;

      const byId = {};
      for (const t of therapists || []) {
        byId[t.id] = {
          ...t,
          plan_normalized:
            t.plan === "silver" ? "silver" : t.plan === "gold" ? "gold" : "free",
          sessions_total: 0,
          sessions_7d: 0,
          sessions_prev_7d: 0,
          clients_total: 0,
          clients_7d: 0,
          last_session_at: null,
          last_client_at: null,
          activation_events: [],
        };
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
        const lastAct = Math.max(lastSess, lastCli, signedUp);
        t.days_on_platform = Math.max(0, Math.floor((now - signedUp) / DAY));
        t.last_activity_at = new Date(lastAct).toISOString();
        t.days_since_activity = Math.floor((now - lastAct) / DAY);
        t.momentum = t.sessions_7d - t.sessions_prev_7d;
        t.has_activation =
          t.activation_events.length > 0 || t.sessions_total > 0 || t.clients_total > 0;
        t.activation_pct = Math.min(
          100,
          Math.round(
            ((t.activation_events.length > 0 ? 1 : 0) +
              (t.sessions_total > 0 ? 1 : 0) +
              (t.clients_total > 0 ? 1 : 0) +
              (t.stripe_account_connected ? 1 : 0) +
              (t.cal_connected ? 1 : 0)) *
              20
          )
        );
      }

      const list = Object.values(byId).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      const h24 = now - DAY;
      const d7 = now - 7 * DAY;
      const d30 = now - 30 * DAY;

      const stats = {
        signups_24h: list.filter((t) => new Date(t.created_at).getTime() >= h24).length,
        signups_7d: list.filter((t) => new Date(t.created_at).getTime() >= d7).length,
        signups_30d: list.filter((t) => new Date(t.created_at).getTime() >= d30).length,
        total: list.length,
        silver: list.filter((t) => t.plan_normalized === "silver").length,
        free: list.filter((t) => t.plan_normalized === "free").length,
        gold: list.filter((t) => t.plan_normalized === "gold").length,
        sessions_24h: (allSessions || []).filter(
          (s) => new Date(s.created_at).getTime() >= h24
        ).length,
        sessions_7d: (allSessions || []).filter(
          (s) => new Date(s.created_at).getTime() >= d7
        ).length,
        clients_7d: (allClients || []).filter(
          (c) => new Date(c.created_at).getTime() >= d7
        ).length,
        active_7d: list.filter(
          (t) =>
            new Date(t.last_activity_at).getTime() >= d7 &&
            (t.sessions_total > 0 || t.clients_total > 0)
        ).length,
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
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.therapists;

    if (planFilter !== "all") rows = rows.filter((t) => t.plan_normalized === planFilter);

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

    if (tab === "momentum") {
      rows = [...rows].sort((a, b) => {
        if (b.momentum !== a.momentum) return b.momentum - a.momentum;
        return b.sessions_7d - a.sessions_7d;
      });
    } else if (tab === "cold") {
      rows = rows
        .filter((t) => t.days_on_platform >= 3)
        .filter((t) => t.sessions_total === 0 || t.days_since_activity >= 14)
        .sort((a, b) => b.days_since_activity - a.days_since_activity);
    } else if (tab === "champions") {
      rows = [...rows]
        .filter((t) => t.sessions_total > 0 || t.clients_total > 0)
        .sort((a, b) => {
          const aScore = a.sessions_total * 2 + a.clients_total + a.sessions_7d * 3;
          const bScore = b.sessions_total * 2 + b.clients_total + b.sessions_7d * 3;
          return bScore - aScore;
        });
    } else if (tab === "all") {
      rows = [...rows].sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        const av = a[sortKey];
        const bv = b[sortKey];
        if (typeof av === "string" && typeof bv === "string") {
          return av.localeCompare(bv) * dir;
        }
        return ((av || 0) - (bv || 0)) * dir;
      });
    }
    return rows;
  }, [data, tab, search, planFilter, sortKey, sortDir]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.cream, padding: 48, textAlign: "center", color: C.gray }}>
        Loading founder intelligence...
      </div>
    );
  }
  if (!data) return null;

  const s = data.stats;
  const convRate = s.total > 0 ? Math.round(((s.silver + s.gold) / s.total) * 100) : 0;
  const coldCount = data.therapists.filter(
    (t) => t.days_on_platform >= 3 && (t.sessions_total === 0 || t.days_since_activity >= 14)
  ).length;
  const champCount = data.therapists.filter((t) => t.sessions_total > 0 || t.clients_total > 0).length;

  return (
    <div style={{ minHeight: "100vh", background: C.cream, padding: "24px 16px 48px", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.sage, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              🌿 Founder · Retention Intelligence
            </div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: 28, color: C.dark, margin: "4px 0 0" }}>
              Who signed up. How they're doing. Who needs a nudge.
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: C.gray }}>Updated {lastUpdated}</p>
          </div>
          <button
            onClick={fetchAll}
            style={{ padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${C.light}`, background: "#fff", cursor: "pointer", fontSize: 13, color: C.dark, fontWeight: 600 }}
          >
            Refresh
          </button>
        </div>

        {/* Top-line stats */}
        <SectionLabel>Signups</SectionLabel>
        <Grid>
          <Stat value={s.signups_24h} label="Last 24h" />
          <Stat value={s.signups_7d} label="Last 7 days" />
          <Stat value={s.signups_30d} label="Last 30 days" />
          <Stat value={s.total} label="All time" />
        </Grid>

        <SectionLabel>Plans & Activity</SectionLabel>
        <Grid>
          <Stat value={s.free} label="Free (bronze)" sub="No plan set" />
          <Stat value={s.silver} label="Silver" sub="Phase 0: free for all" />
          <Stat value={s.gold} label="Gold" sub="Not yet active" />
        </Grid>
        <div style={{ height: 10 }} />
        <Grid>
          <Stat value={s.active_7d} label="Active (7d)" sub="Logged session or client" />
          <Stat value={s.sessions_7d} label="Sessions (7d)" sub={`${s.sessions_24h} today`} />
          <Stat value={s.clients_7d} label="Clients added (7d)" sub="Across platform" />
        </Grid>

        <SectionLabel>Conversion Health</SectionLabel>
        <Grid>
          <Stat value={`${convRate}%`} label="On a paid plan" sub={`${s.silver + s.gold} of ${s.total}`} />
          <Stat value={coldCount} label="Cold signups" sub="Need a nudge" tint={C.fall} />
          <Stat value={champCount} label="Active champions" sub="Actually using it" tint={C.rise} />
        </Grid>

        {/* Tabs */}
        <div style={{ marginTop: 28, marginBottom: 12, display: "flex", gap: 4, flexWrap: "wrap", borderBottom: `1.5px solid ${C.light}` }}>
          <Tab active={tab === "momentum"} onClick={() => setTab("momentum")}>
            Momentum
          </Tab>
          <Tab active={tab === "cold"} onClick={() => setTab("cold")}>
            Cold Signups <Badge>{coldCount}</Badge>
          </Tab>
          <Tab active={tab === "champions"} onClick={() => setTab("champions")}>
            Champions <Badge>{champCount}</Badge>
          </Tab>
          <Tab active={tab === "all"} onClick={() => setTab("all")}>
            All Therapists <Badge>{s.total}</Badge>
          </Tab>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <input
            placeholder="Search email, business, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: "1 1 220px", padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.light}`, fontSize: 13, background: "#fff" }}
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
        </div>

        <TabHint tab={tab} />

        <TherapistTable
          rows={filtered}
          tab={tab}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={(k) => {
            if (tab !== "all") return;
            if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
            else {
              setSortKey(k);
              setSortDir("desc");
            }
          }}
        />

        <p style={{ fontSize: 11, color: "#ccc", textAlign: "center", marginTop: 24 }}>
          Founder-only view. Not visible to therapists.
        </p>
      </div>
    </div>
  );
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
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`, gap: 10 }}>
      {children}
    </div>
  );
}

function Stat({ value, label, sub, tint }) {
  return (
    <div style={{ background: "#fff", border: `1.5px solid ${C.light}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: tint || C.forest, fontFamily: "Georgia, serif", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.dark, marginTop: 6, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: active ? 700 : 600,
        color: active ? C.forest : C.gray,
        cursor: "pointer",
        borderBottom: active ? `2.5px solid ${C.forest}` : "2.5px solid transparent",
        marginBottom: -1.5,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {children}
    </button>
  );
}

function Badge({ children }) {
  return (
    <span style={{ background: C.softCream, color: C.gray, border: `1px solid ${C.light}`, borderRadius: 10, fontSize: 11, fontWeight: 700, padding: "1px 7px" }}>
      {children}
    </span>
  );
}

function TabHint({ tab }) {
  const hints = {
    momentum: "Sorted by sessions this week minus sessions last week. Green arrow means rising, red means slowing, gray means cold.",
    cold: "Signed up at least 3 days ago and either have zero sessions or no activity in 14 days. These are your retention email targets. Click Email to open a pre-drafted check-in.",
    champions: "Actually using the platform. These are your Silver conversion candidates, testimonial asks, and referral seeds.",
    all: "Every therapist on the platform. Click a column header to sort.",
  };
  return (
    <p style={{ fontSize: 12, color: C.gray, margin: "0 0 12px", fontStyle: "italic" }}>
      {hints[tab]}
    </p>
  );
}

function TherapistTable({ rows, tab, sortKey, sortDir, onSort }) {
  if (rows.length === 0) {
    return (
      <div style={{ background: "#fff", border: `1.5px solid ${C.light}`, borderRadius: 12, padding: 32, textAlign: "center", color: C.gray, fontSize: 13 }}>
        No therapists match this view.
      </div>
    );
  }

  const showColdAction = tab === "cold";

  const header = (key, label) => {
    const sortable = tab === "all";
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
        {active ? (sortDir === "asc" ? " \u2191" : " \u2193") : ""}
      </th>
    );
  };

  return (
    <div style={{ background: "#fff", border: `1.5px solid ${C.light}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
          <thead>
            <tr style={{ background: C.softCream, borderBottom: `1.5px solid ${C.light}` }}>
              {header("email", "Therapist")}
              {header("created_at", "Signed up")}
              {header("plan_normalized", "Plan")}
              {header("momentum", "Momentum (7d vs prev)")}
              {header("sessions_total", "Sessions")}
              {header("clients_total", "Clients")}
              {header("last_activity_at", "Last active")}
              {header("activation_pct", "Setup")}
              {showColdAction && <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: C.gray, fontSize: 11, textTransform: "uppercase" }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <Row key={t.id} t={t} showColdAction={showColdAction} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ t, showColdAction }) {
  const momColor =
    t.momentum > 0 ? C.rise : t.momentum < 0 ? C.fall : t.sessions_7d === 0 && t.sessions_prev_7d === 0 ? C.stale : C.gray;
  const momArrow = t.momentum > 0 ? "\u2191" : t.momentum < 0 ? "\u2193" : "\u2500";
  const momLabel =
    t.sessions_7d === 0 && t.sessions_prev_7d === 0
      ? "No sessions"
      : `${t.sessions_7d} vs ${t.sessions_prev_7d}`;

  const lastActiveLabel =
    t.days_since_activity === 0
      ? "Today"
      : t.days_since_activity === 1
      ? "Yesterday"
      : `${t.days_since_activity}d ago`;

  const planColors =
    t.plan_normalized === "silver"
      ? { bg: "#E8F5EE", fg: "#1A5C38", bd: "#B2D8C0" }
      : t.plan_normalized === "gold"
      ? { bg: "#FDF4E3", fg: "#8A5A1C", bd: "#E8C890" }
      : { bg: "#F5F0E8", fg: "#7A5C1A", bd: "#D8C8A0" };

  const mailto = buildColdEmail(t);

  return (
    <tr style={{ borderTop: `1px solid ${C.light}`, verticalAlign: "top" }}>
      <td style={{ padding: "12px", minWidth: 200 }}>
        <div style={{ fontWeight: 700, color: C.dark, fontSize: 13 }}>
          {t.business_name || t.full_name || "(no name)"}
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

      <td style={{ padding: "12px", whiteSpace: "nowrap", color: C.gray, fontSize: 12 }}>
        <div style={{ color: C.dark, fontSize: 12 }}>
          {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
        <div style={{ fontSize: 11, color: C.gray }}>
          {t.days_on_platform === 0 ? "Today" : `${t.days_on_platform}d ago`}
        </div>
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
        <div style={{ color: momColor, fontWeight: 700, fontSize: 14 }}>
          {momArrow} {t.momentum > 0 ? "+" : ""}
          {t.momentum}
        </div>
        <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{momLabel}</div>
      </td>

      <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
        <div style={{ fontWeight: 700, color: C.dark }}>{t.sessions_total}</div>
        <div style={{ fontSize: 11, color: C.gray }}>{t.sessions_7d} this 7d</div>
      </td>

      <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
        <div style={{ fontWeight: 700, color: C.dark }}>{t.clients_total}</div>
        <div style={{ fontSize: 11, color: C.gray }}>{t.clients_7d} this 7d</div>
      </td>

      <td style={{ padding: "12px", whiteSpace: "nowrap", fontSize: 12, color: C.dark }}>
        {lastActiveLabel}
      </td>

      <td style={{ padding: "12px", whiteSpace: "nowrap", fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 42, height: 5, background: C.light, borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                width: `${t.activation_pct}%`,
                height: "100%",
                background:
                  t.activation_pct >= 60
                    ? C.rise
                    : t.activation_pct >= 40
                    ? C.gold
                    : C.fall,
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: C.gray }}>{t.activation_pct}%</span>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <Dot on={t.stripe_account_connected} label="Stripe" />
          <Dot on={t.cal_connected} label="Cal" />
          <Dot on={t.has_activation} label="Used" />
        </div>
      </td>

      {showColdAction && (
        <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
          <a
            href={mailto}
            style={{
              background: C.forest,
              color: "#fff",
              padding: "7px 12px",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 600,
              display: "inline-block",
            }}
          >
            Email
          </a>
        </td>
      )}
    </tr>
  );
}

function Dot({ on, label }) {
  return (
    <span
      title={label + (on ? " connected" : " not connected")}
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: on ? "#fff" : C.gray,
        background: on ? C.sage : C.softCream,
        border: `1px solid ${on ? C.sage : C.light}`,
        borderRadius: 10,
        padding: "1px 6px",
      }}
    >
      {label}
    </span>
  );
}

function buildColdEmail(t) {
  const firstName = (t.full_name || "").split(" ")[0] || "there";
  const subject = `Checking in on BodyMap, ${firstName}`;
  const body = [
    `Hi ${firstName},`,
    ``,
    `I'm the founder of BodyMap. I saw you signed up ${t.days_on_platform} days ago and wanted to check in.`,
    ``,
    `What brought you in? And what would make the platform actually useful for how you run your practice?`,
    ``,
    `I read every reply.`,
    ``,
    `MyBodyMap`,
  ].join("\n");
  return `mailto:${encodeURIComponent(t.email)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}
