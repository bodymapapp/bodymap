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

      // Fetch therapists with admin_flag. If the column doesn't exist yet
      // (migration not run), retry without it. The UI will still render;
      // flag updates will show a gentle "Run the migration first" message.
      const therapistQuery = supabase.from("therapists").select(
        "id,email,phone,full_name,business_name,custom_url,plan,created_at,stripe_account_connected,cal_connected,signup_flag_reasons,admin_flag,email_unsubscribed"
      ).order("created_at", { ascending: false });

      let therapistRes = await therapistQuery;
      let adminFlagMissing = false;
      if (therapistRes.error && /admin_flag/i.test(therapistRes.error.message || "")) {
        adminFlagMissing = true;
        therapistRes = await supabase.from("therapists").select(
          "id,email,phone,full_name,business_name,custom_url,plan,created_at,stripe_account_connected,cal_connected,signup_flag_reasons,email_unsubscribed"
        ).order("created_at", { ascending: false });
      }

      // Also handle case where email_unsubscribed column doesn't exist yet
      if (therapistRes.error && /email_unsubscribed/i.test(therapistRes.error.message || "")) {
        therapistRes = await supabase.from("therapists").select(
          "id,email,phone,full_name,business_name,custom_url,plan,created_at,stripe_account_connected,cal_connected,signup_flag_reasons"
        ).order("created_at", { ascending: false });
      }

      const [
        { data: allSessions },
        { data: allClients },
        { data: activation },
        { data: outreachLog },
        { data: referrals },
        { data: allServices },
        { data: allAvailability },
      ] = await Promise.all([
        supabase.from("sessions").select("therapist_id,created_at"),
        supabase.from("clients").select("therapist_id,created_at"),
        supabase.from("activation_events").select("therapist_id,event_name"),
        supabase.from("notification_log")
          .select("therapist_id,notification_type,status,sent_at,subject,body_snippet")
          .like("notification_type", "founder_outreach_%")
          .order("sent_at", { ascending: false }),
        supabase.from("referrals")
          .select("referrer_therapist_id,status,reward_sent"),
        supabase.from("services").select("therapist_id,active"),
        supabase.from("availability").select("therapist_id,active"),
      ]);

      const therapists = therapistRes.data;
      if (adminFlagMissing) {
        console.warn("admin_flag column missing — run supabase/migrations/founder_admin_flag.sql to enable flagging");
      }

      const d7ms = now - 7 * DAY;
      const d14ms = now - 14 * DAY;

      const byId = {};
      for (const t of therapists || []) {
        // admin_flag overrides heuristic. If HK tagged it 'mine' or 'suspicious',
        // treat it as non-real (hidden by default) regardless of email pattern.
        // If flagged 'normal' explicitly, it's real regardless of heuristic.
        const flag = t.admin_flag || "normal";
        let isDummy;
        if (flag === "mine" || flag === "suspicious") isDummy = true;
        else if (flag === "normal") isDummy = isDummyEmail(t.email);
        else isDummy = isDummyEmail(t.email);

        byId[t.id] = {
          ...t,
          admin_flag: flag,
          plan_normalized:
            t.plan === "silver" ? "silver" : t.plan === "gold" ? "gold" : "free",
          is_dummy: isDummy,
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
          last_contact_subject: null,
          // Full history: sorted desc by sent_at. Populated below.
          contact_history: [],
          contact_count: 0,
          // Hard cooldown: days since most recent send, -1 if never contacted
          days_since_last_contact: -1,
          unthanked_referrals: 0,
          emailed_first_session: false,
          emailed_welcome: false,
          emailed_churned: false,
          emailed_setup_nudge: false,
          emailed_checkin: false,
          emailed_reminder: false,
          emailed_testimonial: false,
          emailed_referral_thankyou: false,
          emailed_activation_nudge: false,
        };
      }

      // Process the full outreach log. Log is already ordered desc by sent_at.
      // Build contact_history array per therapist + set dedup flags for
      // every known action type (not just the original four). This is what
      // lets the dashboard display the complete email history and enforce
      // a 3-day cooldown.
      for (const r of outreachLog || []) {
        const t = byId[r.therapist_id];
        if (!t) continue;
        const type = (r.notification_type || "").replace("founder_outreach_", "");

        // Full history entry
        t.contact_history.push({
          sent_at: r.sent_at,
          type,
          subject: r.subject || "(no subject stored)",
          body_snippet: r.body_snippet || "",
          status: r.status,
        });

        // First row per therapist is the most recent (log is desc)
        if (!t.last_contact_at) {
          t.last_contact_at = r.sent_at;
          t.last_contact_type = type;
          t.last_contact_subject = r.subject || null;
          t.days_since_last_contact = Math.floor(
            (now - new Date(r.sent_at).getTime()) / DAY
          );
        }

        // Count successful sends
        if (r.status === "sent") {
          t.contact_count++;
          // Dedup flags for every action type. Once sent, we don't
          // auto-recommend the same template to this person again.
          if (type === "first_session") t.emailed_first_session = true;
          else if (type === "welcome") t.emailed_welcome = true;
          else if (type === "churned") t.emailed_churned = true;
          else if (type === "setup_nudge") t.emailed_setup_nudge = true;
          else if (type === "checkin") t.emailed_checkin = true;
          else if (type === "reminder") t.emailed_reminder = true;
          else if (type === "testimonial") t.emailed_testimonial = true;
          else if (type === "referral_thankyou") t.emailed_referral_thankyou = true;
          else if (type === "activation_nudge") t.emailed_activation_nudge = true;
        }
      }

      // Count unthanked referrals (confirmed but reward_sent=false) per referrer
      for (const r of referrals || []) {
        const t = byId[r.referrer_therapist_id];
        if (!t) continue;
        if (r.status === "confirmed" && !r.reward_sent) {
          t.unthanked_referrals++;
        }
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

      // Compute onboarding step completion per therapist. Mirrors exactly
      // what OnboardingChecklist.js shows to the therapist inside the app.
      // Source of truth is the underlying data, not a separate "completed" flag.
      const servicesByTh = {};
      for (const s of allServices || []) {
        if (!servicesByTh[s.therapist_id]) servicesByTh[s.therapist_id] = 0;
        servicesByTh[s.therapist_id]++;
      }
      const availableByTh = {};
      for (const a of allAvailability || []) {
        if (a.active) availableByTh[a.therapist_id] = true;
      }

      for (const t of Object.values(byId)) {
        const steps = {
          import:  t.clients_total > 0,
          service: (servicesByTh[t.id] || 0) > 0,
          hours:   !!availableByTh[t.id],
          stripe:  !!t.stripe_account_connected,
          intake:  t.sessions_total > 0,
        };
        t.steps = steps;
        t.steps_done = Object.values(steps).filter(Boolean).length;
        t.steps_total = 5;
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

      setData({ therapists: list, stats, adminFlagMissing });
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

  // Update admin_flag on a therapist row. Optimistic: update local state first,
  // then persist. Rollback on error.
  const updateFlag = async (therapistId, newFlag) => {
    if (!data) return;
    const prev = data.therapists.find((t) => t.id === therapistId)?.admin_flag || "normal";
    const newList = data.therapists.map((t) => {
      if (t.id !== therapistId) return t;
      const isDummy = newFlag === "mine" || newFlag === "suspicious" || (newFlag === "normal" && isDummyEmail(t.email));
      return { ...t, admin_flag: newFlag, is_dummy: isDummy };
    });
    setData({ ...data, therapists: newList });

    const { error } = await supabase
      .from("therapists")
      .update({ admin_flag: newFlag })
      .eq("id", therapistId);

    if (error) {
      console.error("updateFlag failed", error);
      // rollback
      const rolledBack = data.therapists.map((t) => {
        if (t.id !== therapistId) return t;
        const isDummy = prev === "mine" || prev === "suspicious" || (prev === "normal" && isDummyEmail(t.email));
        return { ...t, admin_flag: prev, is_dummy: isDummy };
      });
      setData({ ...data, therapists: rolledBack });
      if (/admin_flag/i.test(error.message || "")) {
        alert("The admin_flag column is missing. Run supabase/migrations/founder_admin_flag.sql in the Supabase SQL editor, then refresh.");
      } else {
        alert("Could not save flag: " + error.message);
      }
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
          updateFlag={updateFlag}
          onAfterSend={fetchAll}
        />

        <ActivationSection rows={filtered} updateFlag={updateFlag} onAfterSend={fetchAll} />

        {data.adminFlagMissing && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#FEF9E7", border: "1px solid #E8C890", borderRadius: 8, fontSize: 12, color: "#7A5C1A" }}>
            <strong>Flagging disabled:</strong> run <code>supabase/migrations/founder_admin_flag.sql</code> in the Supabase SQL editor to enable per-account flagging (normal / mine / suspicious). Heuristic dummy detection still works in the meantime.
          </div>
        )}

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
  const name = firstName(t);
  const noActivity = t.sessions_total === 0 && t.clients_total === 0;
  const daysIdle = t.days_since_use;

  // Priority order: first match wins. Rare/celebratory states before nagging states.
  // Welcome is NOT in this list — the auto-firing send-welcome edge function
  // already handles new signups. Adding it here would double-email them.

  // 1. Referral thank-you (highest priority, celebratory, one-off per referral batch)
  if (t.unthanked_referrals > 0 && !t.emailed_referral_thankyou) {
    return {
      key: "referral_thankyou",
      label: `Thank for ${t.unthanked_referrals} referral${t.unthanked_referrals > 1 ? "s" : ""}`,
      button: "Thank",
      subject: `Thank you, ${name}`,
      body: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. Someone just signed up through your link. That means a lot.`,
        ``,
        `You're helping another therapist find something that actually fits how they practice. Thank you.`,
        ``,
        `If there's anything we can do to make BodyMap better for you, reply and tell us.`,
        ``,
        `Cheers!`,
        `MyBodyMap Team`,
      ].join("\n"),
    };
  }

  // 2. First session milestone: they just logged session #1
  if (t.sessions_total === 1 && !t.emailed_first_session) {
    return {
      key: "first_session",
      label: "Celebrate 1st session",
      button: "Celebrate",
      subject: `Congrats on your first session, ${name}`,
      body: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. Just saw you logged your first session. Big moment.`,
        ``,
        `Tip: next time that client books, open their body map 30 seconds before they walk in. You'll see exactly where they hold tension and what pressure they like. Those 30 seconds are what bring clients back.`,
        ``,
        `Here if you need anything.`,
        ``,
        `Cheers!`,
        `MyBodyMap Team`,
      ].join("\n"),
    };
  }

  // 3. Testimonial (power user, recently active)
  if (t.sessions_total >= TESTIMONIAL_MIN_SESSIONS && daysIdle !== null && daysIdle <= 7 && !t.emailed_testimonial) {
    return {
      key: "testimonial",
      label: "Ask for testimonial",
      button: "Ask testimonial",
      subject: `Quick favor, ${name}?`,
      body: [
        `Hi ${name},`,
        ``,
        `Good morning. MyBodyMap Team here. You've logged ${t.sessions_total} sessions on BodyMap. That's a big deal.`,
        ``,
        `Would you be open to sharing a line or two about what the platform does for your practice? We'd put it on the homepage. No pressure either way.`,
        ``,
        `Cheers!`,
        `MyBodyMap Team`,
      ].join("\n"),
    };
  }

  // 4. Churned (30+ days idle, softer than reminder)
  if (daysIdle !== null && daysIdle >= 30 && !t.emailed_churned) {
    return {
      key: "churned",
      label: `Win back (${daysIdle}d gone)`,
      button: "Reach out",
      subject: `Still with us, ${name}?`,
      body: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. It's been ${daysIdle} days since you last used BodyMap. Not writing to push you back in. Writing to ask what didn't work.`,
        ``,
        `One sentence back would mean a lot. Thank you.`,
        ``,
        `Cheers!`,
        `MyBodyMap Team`,
      ].join("\n"),
    };
  }

  // 5. Reminder (7-30 days idle)
  if (daysIdle !== null && daysIdle >= REMINDER_THRESHOLD_DAYS && !t.emailed_reminder) {
    return {
      key: "reminder",
      label: `Remind (${daysIdle}d idle)`,
      button: "Send reminder",
      subject: `Haven't seen you in a bit, ${name}`,
      body: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. It's been about ${daysIdle} days since you last logged in. Everything okay?`,
        ``,
        `If anything is off with the platform or you've got a question, hit reply. We read every message.`,
        ``,
        `Cheers!`,
        `MyBodyMap Team`,
      ].join("\n"),
    };
  }

  // 6. Check in (3+ days, still nothing — asks for full client list per HK's guidance)
  if (noActivity && t.days_on_platform >= COLD_MIN_AGE_DAYS && !t.emailed_checkin) {
    return {
      key: "checkin",
      label: "Check in",
      button: "Check in",
      subject: `Checking in, ${name}`,
      body: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. Saw you signed up a few days ago but haven't brought your client list over yet. Anything getting in the way?`,
        ``,
        `Reply to this email and we'll help you get set up. Usually takes a few minutes.`,
        ``,
        `Cheers!`,
        `MyBodyMap Team`,
      ].join("\n"),
    };
  }

  // 7. Setup nudge (3+ days, using platform, but no Stripe connected)
  // HK clarified: only flag if Stripe NOT connected (Square is optional alt, Cal removed).
  if (t.days_on_platform >= COLD_MIN_AGE_DAYS && !t.stripe_account_connected && !t.emailed_setup_nudge) {
    return {
      key: "setup_nudge",
      label: "Nudge setup",
      button: "Send nudge",
      subject: `One quick thing, ${name}`,
      body: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. You're using the platform but haven't connected Stripe or Square yet.`,
        ``,
        `Without this, clients can't pay you through your BodyMap link. Takes about a minute in Settings. Want us to walk you through it? Just reply.`,
        ``,
        `Cheers!`,
        `MyBodyMap Team`,
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

function TherapistTable({ rows, sortKey, sortDir, onSort, updateFlag, onAfterSend }) {
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
              <Row key={t.id} t={t} firstColCell={firstColCell} updateFlag={updateFlag} onAfterSend={onAfterSend} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ t, firstColCell, updateFlag, onAfterSend }) {
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
      <td style={{ ...firstColCell, padding: "8px 10px", borderTop: `1px solid ${C.light}` }}>
        <div style={{ fontWeight: 700, color: C.dark, fontSize: 13 }}>
          {t.business_name || t.full_name || "(no name)"}
          <FlagBadge flag={t.admin_flag} isDummy={t.is_dummy} unsubscribed={t.email_unsubscribed} />
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
        <FlagMenu flag={t.admin_flag} onChange={(f) => updateFlag && updateFlag(t.id, f)} />
      </td>

      <td style={{ padding: "8px 10px", whiteSpace: "nowrap", fontSize: 12 }}>
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

      <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: C.dark, fontSize: 12 }}>
        {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
      </td>

      <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: C.dark, fontSize: 13, fontWeight: 600 }}>
        {t.days_on_platform === 0 ? "Today" : `${t.days_on_platform} day${t.days_on_platform === 1 ? "" : "s"}`}
      </td>

      <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: lastUsedColor, fontSize: 13, fontWeight: 600 }}>
        {lastUsedLabel}
      </td>

      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
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

      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
        <div style={{ fontWeight: 700, color: C.dark }}>{t.sessions_total}</div>
        <div style={{ fontSize: 11, color: C.gray }}>{t.sessions_7d} this 7d</div>
      </td>

      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
        <div style={{ fontWeight: 700, color: C.dark }}>{t.clients_total}</div>
        <div style={{ fontSize: 11, color: C.gray }}>{t.clients_7d} this 7d</div>
      </td>

      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
        <div style={{ color: momColor, fontWeight: 700, fontSize: 14 }}>
          {momArrow} {t.momentum > 0 ? "+" : ""}{t.momentum}
        </div>
        <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{momLabel}</div>
      </td>

      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
        <ActionCell t={t} onAfterSend={onAfterSend} />
      </td>
    </tr>
  );
}

function ActionCell({ t, onAfterSend }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // 'sent' | 'copied' | 'failed' | null
  const [errorMsg, setErrorMsg] = useState("");
  const [override, setOverride] = useState(false);

  const a = t.action;

  const openModal = () => {
    setResult(null);
    setErrorMsg("");
    setModalOpen(true);
  };

  const onSend = async ({ subject, body }) => {
    if (sending) return;
    setSending(true);
    setResult(null);
    setErrorMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("founder-outreach", {
        body: {
          therapist_id: t.id,
          action_type: a.key,
          custom_subject: subject,
          custom_body: body,
        },
      });
      if (error) {
        setResult("failed");
        setErrorMsg(`transport: ${error.message || "unknown"}`);
      } else if (!data?.ok) {
        setResult("failed");
        setErrorMsg(`${data?.step || "?"}: ${data?.error || "Send failed"}`);
      } else {
        setResult("sent");
        setModalOpen(false);
        // Refetch dashboard data so the row shows the new contact, cooldown
        // kicks in, and Email button updates without a manual refresh.
        if (onAfterSend) {
          try { await onAfterSend(); } catch (_e) { /* non-blocking */ }
        }
      }
    } catch (e) {
      setResult("failed");
      setErrorMsg(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const copySms = async () => {
    // SMS voice: replace the email-team signature with the founder sig.
    // Keep the message structure, just switch the label/tone for SMS.
    const smsText = (a.body || "")
      .replace(/MyBodyMap Team here/g, "MyBodyMap founder here")
      .replace(/MyBodyMap Team/g, "MyBodyMap founder")
      .split("\n")
      .filter((l) => l.trim() !== "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    try {
      await navigator.clipboard.writeText(smsText);
      setResult("copied");
      setTimeout(() => setResult(null), 3000);
    } catch (e) {
      setResult("failed");
      setErrorMsg("Clipboard blocked");
    }
  };

  if (!a.button) {
    const color = a.key === "ontrack" ? C.rise : C.gray;
    return (
      <div style={{ fontSize: 12, color, fontWeight: 600 }}>
        {a.label}
        {t.contact_count > 0 && <ContactHistoryBadge t={t} />}
      </div>
    );
  }

  const btnColors = {
    welcome: { bg: C.sage, fg: "#fff" },
    checkin: { bg: C.actionBlue, fg: "#fff" },
    reminder: { bg: C.fall, fg: "#fff" },
    testimonial: { bg: C.gold, fg: "#fff" },
    first_session: { bg: C.rise, fg: "#fff" },
    setup_nudge: { bg: C.actionBlue, fg: "#fff" },
    churned: { bg: "#6B4A8A", fg: "#fff" },
    referral_thankyou: { bg: C.forest, fg: "#fff" },
  }[a.key] || { bg: C.forest, fg: "#fff" };

  // 3-day cooldown: hard block until 72 hours have passed since last send.
  // Override link exposed for urgent cases so HK isn't truly locked out.
  const COOLDOWN_DAYS = 3;
  const inCooldown = t.last_contact_at && daysAgoNumeric(t.last_contact_at) < COOLDOWN_DAYS;
  const coolDaysLeft = inCooldown ? COOLDOWN_DAYS - daysAgoNumeric(t.last_contact_at) : 0;
  const isUnsubscribed = !!t.email_unsubscribed;
  const sendBlocked = isUnsubscribed || (inCooldown && !override);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, minWidth: 180 }}>
      <div style={{ fontSize: 11, color: C.gray, fontWeight: 600, lineHeight: 1.3 }}>
        {a.label}
        {t.contact_count > 0 && (
          <ContactHistoryBadge t={t} />
        )}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={sendBlocked ? undefined : openModal}
          disabled={sendBlocked}
          style={{
            background: isUnsubscribed ? "#F3E9D7" : (inCooldown && !override ? "#E8E4DC" : btnColors.bg),
            color: isUnsubscribed ? "#8A6F3C" : (inCooldown && !override ? "#6B7280" : btnColors.fg),
            padding: "5px 10px",
            borderRadius: 6,
            border: "none",
            fontSize: 11,
            fontWeight: 700,
            cursor: sendBlocked ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            opacity: sendBlocked ? 0.75 : 1,
          }}
          title={
            isUnsubscribed
              ? "This therapist unsubscribed from marketing emails."
              : inCooldown && !override
              ? `Cooldown: you emailed them ${daysAgo(t.last_contact_at)}. Next possible send in ${coolDaysLeft} day${coolDaysLeft === 1 ? "" : "s"}.`
              : "Open editor, tune the message, send via BodyMap"
          }
        >
          {isUnsubscribed ? "Unsubscribed" : inCooldown && !override ? `Sent ${daysAgo(t.last_contact_at)}` : "Email"}
        </button>
        {inCooldown && !override && !isUnsubscribed && (
          <button
            onClick={() => setOverride(true)}
            style={{
              background: "transparent",
              color: C.fall,
              border: "none",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
            title="Override the 3-day cooldown. Use for urgent cases only."
          >
            override
          </button>
        )}
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
          ✓ Sent from BodyMap
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

      {modalOpen && (
        <SendModal
          t={t}
          action={a}
          sending={sending}
          errorMsg={errorMsg}
          onClose={() => setModalOpen(false)}
          onSend={onSend}
        />
      )}
    </div>
  );
}

function SendModal({ t, action, sending, errorMsg, onClose, onSend }) {
  const [subject, setSubject] = useState(action.subject);
  const [body, setBody] = useState(action.body);

  // Keyboard shortcuts for speed: Cmd/Ctrl+Enter = send, Esc = cancel
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (subject.trim() && body.trim()) onSend({ subject, body });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [subject, body, onClose, onSend]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26, 38, 32, 0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          maxWidth: 620,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 25px 80px rgba(0,0,0,0.25)",
          border: `1.5px solid ${C.light}`,
        }}
      >
        {/* Compact header: who + where */}
        <div style={{ padding: "14px 20px", borderBottom: `1.5px solid ${C.light}`, background: C.softCream, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: C.sage, textTransform: "uppercase" }}>
              {action.label}
            </div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: C.dark, fontWeight: 700, marginTop: 2 }}>
              {t.business_name || t.full_name || t.email}
            </div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
              To: {t.email} · BCC: {"bodymapdemo@gmail.com"}
            </div>
          </div>
          <span style={{ fontSize: 10, color: C.gray, fontStyle: "italic" }}>
            ⌘↩ to send · Esc to cancel
          </span>
        </div>

        {/* Subject */}
        <div style={{ padding: "12px 20px 0" }}>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: `1.5px solid ${C.light}`,
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Body */}
        <div style={{ padding: "10px 20px 0" }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: `1.5px solid ${C.light}`,
              borderRadius: 8,
              fontSize: 14,
              fontFamily: "Georgia, serif",
              lineHeight: 1.55,
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
        </div>

        {/* Error inline */}
        {errorMsg && (
          <div style={{ padding: "10px 20px 0" }}>
            <div style={{ background: "#FEF2F1", border: `1px solid ${C.fall}`, color: C.fall, padding: "8px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
              ✗ {errorMsg}
            </div>
          </div>
        )}

        {/* Footer: Send prominent, Cancel quiet */}
        <div style={{ padding: "14px 20px 16px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: C.gray,
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSend({ subject, body })}
            disabled={sending || !subject.trim() || !body.trim()}
            style={{
              background: sending ? C.stale : C.forest,
              color: "#fff",
              padding: "10px 24px",
              borderRadius: 8,
              border: "none",
              fontSize: 14,
              fontWeight: 700,
              cursor: sending ? "wait" : "pointer",
            }}
          >
            {sending ? "Sending..." : "Send email"}
          </button>
        </div>
      </div>
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

// The 5 onboarding steps mirror OnboardingChecklist.js. Column keys map to
// the t.steps bitmap set in fetchAll().
const ACTIVATION_STEPS = [
  { key: "import",  label: "Clients imported", short: "Clients",  icon: "📥" },
  { key: "service", label: "Service added",    short: "Service",  icon: "🛁" },
  { key: "hours",   label: "Hours set",        short: "Hours",    icon: "🕐" },
  { key: "stripe",  label: "Stripe connected", short: "Stripe",   icon: "💳" },
  { key: "intake",  label: "First intake sent", short: "Intake",  icon: "📋" },
];

function ActivationSection({ rows, updateFlag, onAfterSend }) {
  const [onlyStuck, setOnlyStuck] = useState(false);
  const [sortKey, setSortKey] = useState("steps_done");
  const [sortDir, setSortDir] = useState("asc"); // least-done first — these need help most

  // Aggregate: how many therapists completed each step
  const total = rows.length;
  const stepCounts = ACTIVATION_STEPS.reduce((acc, s) => {
    acc[s.key] = rows.filter((t) => t?.steps?.[s.key]).length;
    return acc;
  }, {});
  const fullyActivated = rows.filter((t) => t?.steps_done === 5).length;

  let activationRows = [...rows];
  if (onlyStuck) {
    activationRows = activationRows.filter((t) => (t?.steps_done || 0) < 5);
  }
  activationRows.sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "business_name") {
      return (a.business_name || a.full_name || "").localeCompare(b.business_name || b.full_name || "") * dir;
    }
    if (sortKey === "days_on_platform") {
      return ((a.days_on_platform || 0) - (b.days_on_platform || 0)) * dir;
    }
    // default: steps_done
    const av = a?.steps_done || 0;
    const bv = b?.steps_done || 0;
    return (av - bv) * dir;
  });

  const onSort = (k) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "steps_done" ? "asc" : "desc"); }
  };

  if (total === 0) return null;

  return (
    <div style={{ marginTop: 36 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.sage }}>
            Activation checklist
          </div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, color: C.dark, margin: "4px 0 0" }}>
            Which therapists finished setup. Which are stuck.
          </h2>
          <p style={{ fontSize: 12, color: C.gray, margin: "4px 0 0" }}>
            Therapists who complete all 5 steps see the full product. Those who don't, churn.
          </p>
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: C.dark, cursor: "pointer", userSelect: "none", padding: "6px 10px", borderRadius: 8, background: onlyStuck ? C.softCream : "#fff", border: `1.5px solid ${C.light}` }}>
          <input type="checkbox" checked={onlyStuck} onChange={(e) => setOnlyStuck(e.target.checked)} style={{ margin: 0 }} />
          Only show stuck
        </label>
      </div>

      {/* Rollup: completion % per step */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 14 }}>
        {ACTIVATION_STEPS.map((s) => {
          const count = stepCounts[s.key] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const barColor = pct >= 70 ? C.rise : pct >= 40 ? C.gold : C.fall;
          return (
            <div key={s.key} style={{ background: "#fff", border: `1.5px solid ${C.light}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: C.gray, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                {s.icon} {s.short}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.dark, fontFamily: "Georgia, serif" }}>
                {count} <span style={{ fontSize: 12, color: C.gray, fontWeight: 500 }}>of {total}</span>
              </div>
              <div style={{ height: 4, background: C.light, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: barColor }} />
              </div>
              <div style={{ fontSize: 10, color: C.gray, marginTop: 3, fontWeight: 600 }}>{pct}% completed</div>
            </div>
          );
        })}
        <div style={{ background: fullyActivated > 0 ? "#EEF7F0" : "#fff", border: `1.5px solid ${fullyActivated > 0 ? C.sage : C.light}`, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: C.forest, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            ✓ Fully activated
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.forest, fontFamily: "Georgia, serif" }}>
            {fullyActivated} <span style={{ fontSize: 12, color: C.gray, fontWeight: 500 }}>of {total}</span>
          </div>
          <div style={{ fontSize: 11, color: C.gray, marginTop: 6, fontWeight: 600 }}>
            All 5 steps done
          </div>
        </div>
      </div>

      {/* Per-therapist table */}
      <div style={{ background: "#fff", border: `1.5px solid ${C.light}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13, minWidth: 900 }}>
            <thead>
              <tr>
                <th
                  onClick={() => onSort("business_name")}
                  style={{
                    position: "sticky", top: 0, left: 0, zIndex: 5,
                    background: C.softCream, borderBottom: `1.5px solid ${C.light}`,
                    padding: "10px 12px", textAlign: "left", cursor: "pointer",
                    color: sortKey === "business_name" ? C.forest : C.gray,
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                    whiteSpace: "nowrap", userSelect: "none", minWidth: 240,
                    boxShadow: "1px 0 0 rgba(0,0,0,0.04)",
                  }}
                >
                  Therapist {sortKey === "business_name" ? (sortDir === "asc" ? "\u2191" : "\u2193") : "⇅"}
                </th>
                <th
                  onClick={() => onSort("days_on_platform")}
                  style={sortableHead(sortKey === "days_on_platform", sortDir)}
                >
                  Days on platform {sortKey === "days_on_platform" ? (sortDir === "asc" ? "\u2191" : "\u2193") : "⇅"}
                </th>
                <th
                  onClick={() => onSort("steps_done")}
                  style={sortableHead(sortKey === "steps_done", sortDir)}
                >
                  Progress {sortKey === "steps_done" ? (sortDir === "asc" ? "\u2191" : "\u2193") : "⇅"}
                </th>
                {ACTIVATION_STEPS.map((s) => (
                  <th
                    key={s.key}
                    title={s.label}
                    style={{ ...plainHead(), textAlign: "center", minWidth: 90 }}
                  >
                    {s.icon} {s.short}
                  </th>
                ))}
                <th style={plainHead()}>
                  Next step to push
                </th>
                <th style={plainHead()}>
                  Nudge
                </th>
              </tr>
            </thead>
            <tbody>
              {activationRows.map((t) => (
                <ActivationRow key={t.id} t={t} updateFlag={updateFlag} onAfterSend={onAfterSend} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function sortableHead(active, sortDir) {
  return {
    position: "sticky", top: 0, background: C.softCream, zIndex: 3,
    borderBottom: `1.5px solid ${C.light}`,
    padding: "10px 12px", textAlign: "left",
    color: active ? C.forest : C.gray,
    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
    whiteSpace: "nowrap", cursor: "pointer", userSelect: "none",
  };
}

function plainHead() {
  return {
    position: "sticky", top: 0, background: C.softCream, zIndex: 3,
    borderBottom: `1.5px solid ${C.light}`,
    padding: "10px 12px", textAlign: "left",
    color: C.gray, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
    whiteSpace: "nowrap",
  };
}

function ActivationRow({ t, updateFlag, onAfterSend }) {
  const done = t.steps_done || 0;
  const pct = Math.round((done / 5) * 100);
  const progressColor = done === 5 ? C.rise : done >= 3 ? C.gold : C.fall;

  // Find first uncompleted step (ordered by the list) — that's what to push them toward
  const nextStep = ACTIVATION_STEPS.find((s) => !t.steps?.[s.key]);

  // Build the activation_nudge action on demand — grandma-voice, names the missing steps
  const nudgeAction = buildActivationNudge(t);

  return (
    <tr style={{ borderTop: `1px solid ${C.light}`, verticalAlign: "top" }}>
      {/* Sticky therapist column */}
      <td style={{
        position: "sticky", left: 0, background: "#fff", zIndex: 2,
        padding: "8px 10px", minWidth: 240,
        boxShadow: "1px 0 0 rgba(0,0,0,0.04)",
        borderTop: `1px solid ${C.light}`,
      }}>
        <div style={{ fontWeight: 700, color: C.dark, fontSize: 13 }}>
          {t.business_name || t.full_name || "(no name)"}
          <FlagBadge flag={t.admin_flag} isDummy={t.is_dummy} unsubscribed={t.email_unsubscribed} />
        </div>
        <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{t.email}</div>
        {t.phone && (
          <div style={{ fontSize: 11, color: C.sage, marginTop: 2 }}>
            <a href={`tel:${(t.phone || "").replace(/\D/g, "")}`} style={{ color: C.sage, textDecoration: "none" }}>
              {formatPhoneDisplay(t.phone)}
            </a>
          </div>
        )}
        <FlagMenu flag={t.admin_flag} onChange={(f) => updateFlag && updateFlag(t.id, f)} />
      </td>

      {/* Days on platform */}
      <td style={{ padding: "8px 10px", whiteSpace: "nowrap", fontSize: 13, fontWeight: 600, color: C.dark }}>
        {t.days_on_platform === 0 ? "Today" : `${t.days_on_platform} day${t.days_on_platform === 1 ? "" : "s"}`}
      </td>

      {/* Progress bar + X/5 */}
      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 60, height: 6, background: C.light, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: progressColor }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: progressColor }}>{done}/5</span>
        </div>
      </td>

      {/* 5 step cells */}
      {ACTIVATION_STEPS.map((s) => {
        const ok = !!t.steps?.[s.key];
        return (
          <td key={s.key} style={{ padding: "8px 10px", textAlign: "center" }}>
            {ok ? (
              <span title={s.label + " complete"} style={{
                display: "inline-block", width: 22, height: 22, lineHeight: "22px",
                background: C.sage, color: "#fff", borderRadius: "50%",
                fontSize: 12, fontWeight: 800,
              }}>✓</span>
            ) : (
              <span title={s.label + " not done"} style={{
                display: "inline-block", width: 22, height: 22, lineHeight: "22px",
                background: "#fff", color: C.stale, border: `1.5px solid ${C.light}`, borderRadius: "50%",
                fontSize: 12, fontWeight: 800,
              }}>·</span>
            )}
          </td>
        );
      })}

      {/* Next step to push */}
      <td style={{ padding: "8px 10px", whiteSpace: "nowrap", fontSize: 12 }}>
        {nextStep ? (
          <span style={{ color: C.dark, fontWeight: 600 }}>
            {nextStep.icon} {nextStep.short}
          </span>
        ) : (
          <span style={{ color: C.rise, fontWeight: 700 }}>✓ All done</span>
        )}
      </td>

      {/* Nudge: Email + Copy SMS buttons with grandma-voice activation copy */}
      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
        {nudgeAction ? (
          <NudgeButtons t={t} action={nudgeAction} onAfterSend={onAfterSend} />
        ) : (
          <span style={{ fontSize: 11, color: C.rise, fontWeight: 700 }}>✓ Activated</span>
        )}
      </td>
    </tr>
  );
}

// ========================================================================
// Flag components
// ========================================================================

function FlagBadge({ flag, isDummy, unsubscribed }) {
  // Unsubscribed takes priority — most important signal
  if (unsubscribed) {
    return (
      <span style={{ marginLeft: 6, fontSize: 10, background: "#FCE8E6", color: "#8A2F2F", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }} title="This therapist unsubscribed from marketing emails">UNSUBSCRIBED</span>
    );
  }
  if (flag === "mine") {
    return (
      <span style={{ marginLeft: 6, fontSize: 10, background: "#E3F0FB", color: "#1E5F8A", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>MINE</span>
    );
  }
  if (flag === "suspicious") {
    return (
      <span style={{ marginLeft: 6, fontSize: 10, background: "#FDE7E3", color: "#B44A3A", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>SUSPICIOUS</span>
    );
  }
  if (isDummy) {
    return (
      <span style={{ marginLeft: 6, fontSize: 10, background: "#F3E9D7", color: "#8A6F3C", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>TEST</span>
    );
  }
  return null;
}

function FlagMenu({ flag, onChange }) {
  const current = flag || "normal";
  const btn = (key, label, activeBg, activeFg) => {
    const active = current === key;
    return (
      <button
        key={key}
        onClick={() => onChange(key)}
        style={{
          background: active ? activeBg : "#fff",
          color: active ? activeFg : C.gray,
          border: `1px solid ${active ? activeBg : C.light}`,
          borderRadius: 999,
          padding: "2px 8px",
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: "0.03em",
        }}
        title={`Mark as ${label}`}
      >
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
      {btn("normal", "Normal", C.sage, "#fff")}
      {btn("mine", "Mine", "#1E5F8A", "#fff")}
      {btn("suspicious", "Suspicious", "#B44A3A", "#fff")}
    </div>
  );
}

// ========================================================================
// Activation nudge action + buttons
// ========================================================================

// Generates a warm, 70-year-old-grandma-friendly email naming the specific
// steps this therapist still needs to complete. Returns null if they're done.
function buildActivationNudge(t) {
  if (!t || !t.steps) return null;
  const missing = ACTIVATION_STEPS.filter((s) => !t.steps[s.key]);
  if (missing.length === 0) return null;

  const name = firstName(t);

  // Map each step key to a short, action-oriented phrase HK would actually write.
  // Not the full label, not a list — just the one concrete thing they need to do.
  const stepPhrase = {
    import:  "import your clients",
    service: "add your first service",
    hours:   "set your working hours",
    stripe:  "connect Stripe to accept payments",
    intake:  "send your first intake to a client",
  };

  const firstMissing = missing[0];
  const firstStepText = stepPhrase[firstMissing.key] || firstMissing.label.toLowerCase();

  const subject = `Quick hello from BodyMap`;

  // One voice, one template. Names the single most important next step.
  // If more steps remain, mention there are a few but don't list them all — keeps it light.
  const moreStepsNote =
    missing.length > 1
      ? ` There are a couple more small things after that, but let's get this one first.`
      : "";

  // Email variant: signed 'MyBodyMap Team'. Used when you click Email.
  const emailBody = [
    `Hi ${name},`,
    ``,
    `Good morning. MyBodyMap Team here. Just wanted to send a message so you can reach out to us directly if you need any help.`,
    ``,
    `First step for you is to ${firstStepText}.${moreStepsNote}`,
    ``,
    `Cheers!`,
    `MyBodyMap Team`,
  ];

  // SMS variant: signed 'MyBodyMap founder'. More personal, from your Google Voice.
  const smsBody = [
    `Hi ${name},`,
    ``,
    `Good morning. This is MyBodyMap founder. Just wanted to send a message so you can reach out to me directly if you need any help.`,
    ``,
    `First step for you is to ${firstStepText}.${moreStepsNote}`,
    ``,
    `Cheers!`,
    `MyBodyMap founder`,
  ];

  return {
    key: "activation_nudge",
    label: `Nudge (${t.steps_done}/5)`,
    button: "Nudge",
    subject,
    body: emailBody.join("\n"),       // default (Email modal uses body)
    sms_body: smsBody.join("\n"),     // Copy SMS uses this
  };
}

function NudgeButtons({ t, action, onAfterSend }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [override, setOverride] = useState(false);

  const openModal = () => {
    setResult(null);
    setErrorMsg("");
    setModalOpen(true);
  };

  const onSend = async ({ subject, body }) => {
    if (sending) return;
    setSending(true);
    setResult(null);
    setErrorMsg("");
    try {
      // Send as activation_nudge so it logs distinctly from generic checkin.
      // Edge function accepts custom_subject/custom_body; the template key
      // just determines the notification_type stored in notification_log.
      const { data, error } = await supabase.functions.invoke("founder-outreach", {
        body: {
          therapist_id: t.id,
          action_type: "activation_nudge",
          custom_subject: subject,
          custom_body: body,
        },
      });
      if (error) {
        setResult("failed");
        setErrorMsg(`transport: ${error.message || "unknown"}`);
      } else if (!data?.ok) {
        setResult("failed");
        setErrorMsg(`${data?.step || "?"}: ${data?.error || "Send failed"}`);
      } else {
        setResult("sent");
        setModalOpen(false);
        // Refetch so cooldown + history reflect the new send immediately
        if (onAfterSend) {
          try { await onAfterSend(); } catch (_e) { /* non-blocking */ }
        }
      }
    } catch (e) {
      setResult("failed");
      setErrorMsg(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const copySms = async () => {
    // Prefer the dedicated sms_body (signed 'MyBodyMap founder' for warmer SMS tone);
    // fall back to body if not provided. Collapse blank lines into a single space.
    const source = action.sms_body || action.body || "";
    const smsText = source
      .split("\n")
      .filter((l) => l.trim() !== "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    try {
      await navigator.clipboard.writeText(smsText);
      setResult("copied");
      setTimeout(() => setResult(null), 3000);
    } catch (e) {
      setResult("failed");
      setErrorMsg("Clipboard blocked");
    }
  };

  const COOLDOWN_DAYS = 3;
  const inCooldown = t.last_contact_at && daysAgoNumeric(t.last_contact_at) < COOLDOWN_DAYS;
  const coolDaysLeft = inCooldown ? COOLDOWN_DAYS - daysAgoNumeric(t.last_contact_at) : 0;
  const isUnsubscribed = !!t.email_unsubscribed;
  const sendBlocked = isUnsubscribed || (inCooldown && !override);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, minWidth: 140 }}>
      {t.contact_count > 0 && (
        <ContactHistoryBadge t={t} />
      )}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={sendBlocked ? undefined : openModal}
          disabled={sendBlocked}
          style={{
            background: isUnsubscribed ? "#F3E9D7" : (inCooldown && !override ? "#E8E4DC" : C.sage),
            color: isUnsubscribed ? "#8A6F3C" : (inCooldown && !override ? "#6B7280" : "#fff"),
            padding: "5px 10px",
            borderRadius: 6,
            border: "none",
            fontSize: 11,
            fontWeight: 700,
            cursor: sendBlocked ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            opacity: sendBlocked ? 0.75 : 1,
          }}
          title={
            isUnsubscribed
              ? "This therapist unsubscribed from marketing emails."
              : inCooldown && !override
              ? `Cooldown: you emailed them ${daysAgo(t.last_contact_at)}. Next possible send in ${coolDaysLeft} day${coolDaysLeft === 1 ? "" : "s"}.`
              : "Send a warm email naming their next setup step"
          }
        >
          {isUnsubscribed ? "Unsubscribed" : inCooldown && !override ? `Sent ${daysAgo(t.last_contact_at)}` : "Email"}
        </button>
        {inCooldown && !override && !isUnsubscribed && (
          <button
            onClick={() => setOverride(true)}
            style={{
              background: "transparent",
              color: C.fall,
              border: "none",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
            title="Override the 3-day cooldown. Use for urgent cases only."
          >
            override
          </button>
        )}
        {t.phone ? (
          <button
            onClick={copySms}
            style={{
              background: "#fff",
              color: C.dark,
              padding: "5px 10px",
              borderRadius: 6,
              border: `1.5px solid ${C.light}`,
              fontSize: 11,
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
          ✓ Sent
        </div>
      )}
      {result === "copied" && (
        <div style={{ fontSize: 11, color: C.rise, fontWeight: 700 }}>
          ✓ Copied
        </div>
      )}
      {result === "failed" && (
        <div style={{ fontSize: 10, color: C.fall, fontWeight: 700, maxWidth: 180 }}>
          ✗ {errorMsg || "Failed"}
        </div>
      )}

      {modalOpen && (
        <SendModal
          t={t}
          action={action}
          sending={sending}
          errorMsg={errorMsg}
          onClose={() => setModalOpen(false)}
          onSend={onSend}
        />
      )}
    </div>
  );
}

// ========================================================================
// Contact history badge + expandable timeline
// Shows next to the action button in both tables. Click the "📧 3" pill
// to expand a timeline of every founder email ever sent to this therapist,
// with date, template type, subject line, and delivery status. This is
// what prevents HK from accidentally re-sending the same message.
// ========================================================================

function ContactHistoryBadge({ t }) {
  const [open, setOpen] = useState(false);
  const count = t.contact_count || 0;
  if (count === 0) return null;

  const label = TEMPLATE_LABELS;

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{
          marginLeft: 6,
          background: open ? C.forest : "#EEF4F1",
          color: open ? "#fff" : C.forest,
          border: "none",
          borderRadius: 10,
          padding: "1px 7px",
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: "0.02em",
          verticalAlign: "baseline",
        }}
        title={`Click to see all ${count} email${count === 1 ? "" : "s"} sent to this therapist`}
      >
        📧 {count} {open ? "▲" : "▼"}
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 6,
            background: "#FAFBFA",
            border: `1px solid ${C.light}`,
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 11,
            lineHeight: 1.5,
            color: C.dark,
            width: "100%",
            maxWidth: 360,
            boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: C.gray,
            marginBottom: 6,
          }}>
            Email history · most recent first
          </div>
          {(t.contact_history || []).map((h, i) => (
            <div key={i} style={{
              paddingBottom: 6,
              marginBottom: 6,
              borderBottom: i === t.contact_history.length - 1 ? "none" : `1px dashed ${C.light}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.sage, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {label[h.type] || h.type}
                </span>
                <span style={{ fontSize: 10, color: C.gray, whiteSpace: "nowrap" }}>
                  {formatShortDate(h.sent_at)}
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.dark, marginTop: 2 }}>
                {h.subject || "(no subject stored)"}
              </div>
              {h.body_snippet && (
                <div style={{ fontSize: 10, color: C.gray, fontStyle: "italic", marginTop: 2, lineHeight: 1.4 }}>
                  {h.body_snippet.length >= 200 ? h.body_snippet + "..." : h.body_snippet}
                </div>
              )}
              {h.status !== "sent" && (
                <div style={{ fontSize: 10, color: C.fall, fontWeight: 700, marginTop: 2 }}>
                  ✗ {h.status}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const TEMPLATE_LABELS = {
  welcome: "Welcome",
  checkin: "Check in",
  reminder: "Reminder",
  testimonial: "Testimonial",
  first_session: "First session",
  setup_nudge: "Setup nudge",
  churned: "Churned",
  referral_thankyou: "Referral thanks",
  activation_nudge: "Activation nudge",
};

function formatShortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const opts = sameYear
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" };
  return d.toLocaleString("en-US", opts);
}
