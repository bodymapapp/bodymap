// Founder dashboard at /founder. Admin-only via email allowlist.
// Per-therapist retention intelligence: who signed up, how engaged they are,
// and one-click action for each row.
//
// Schema notes (verified in codebase, not guessed):
//   therapists.plan values: 'silver' | 'gold' | null/'free'. Column is NOT 'tier'.
//   last activity is derived from max(sessions.created_at, clients.created_at, created_at)
//   since last_sign_in_at lives in auth.users, not therapists.

import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import FounderMassSms from "./FounderMassSms";
import AiCostCard from "./AiCostCard";
import { formatUSPhone } from "../lib/formatters/phone";
import { ADMIN_EMAILS } from "../lib/founderAllowlist";


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

  // Batch-send state: which therapists are checked for a multi-send
  const [selected, setSelected] = useState(() => new Set());
  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelected = () => setSelected(new Set());
  const selectAll = (ids) => setSelected(new Set(ids));

  // One-click "Email all customers". A single header button opens a compose
  // box pre-filled with the latest product-update template, aimed at every
  // visible therapist, so emailing customers is 2 clicks (open then Send)
  // instead of scrolling to the batch bar and picking a template. We clear
  // any saved draft on open so a stale half-edited draft can never resurrect
  // itself in the box.
  const [composeAll, setComposeAll] = useState(null);            // { subject, body } | null
  const [composeSending, setComposeSending] = useState(false);
  const [composeProgress, setComposeProgress] = useState(null);  // { done, total } | null
  const COMPOSE_DRAFT_KEY = "founder_outreach_draft_product_update";

  // Table 3 clickable-cell queue state. Cell keys are "therapistId:colKey".
  const [queuedCells, setQueuedCells] = useState(() => new Set());

  // Which dashboard tables are expanded. Default all collapsed because the
  // page is dense -- HK tap to drill in.
  const [openTables, setOpenTables] = useState({ t1: false, t2: false, t3: false, t4: false });
  const toggleTable = (k) => setOpenTables((prev) => ({ ...prev, [k]: !prev[k] }));
  const toggleCell = (therapistId, colKey) => {
    const k = therapistId + ":" + colKey;
    setQueuedCells((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };
  const clearQueue = () => setQueuedCells(new Set());

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
          .eq("audience", "therapist")
          .order("sent_at", { ascending: false }),
        supabase.from("referrals")
          .select("referrer_therapist_id,status,reward_sent"),
        supabase.from("services").select("therapist_id,active"),
        supabase.from("availability").select("therapist_id,active"),
      ]);

      const therapists = therapistRes.data;
      if (adminFlagMissing) {
        console.warn("admin_flag column missing, run supabase/migrations/founder_admin_flag.sql to enable flagging");
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
    // Auto-open Table 1 since stat clicks filter the therapist roster
    setOpenTables((prev) => ({ ...prev, t1: true }));
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

  // Open the compose-to-all box, pre-filled with the latest product-update
  // template, name placeholder intact for per-recipient substitution.
  function openComposeAll() {
    const targets = filtered;
    if (!targets || targets.length === 0) {
      window.alert("No customers to email with the current filter.");
      return;
    }
    // Clear any stale saved draft so the current template shows, not old text.
    try { localStorage.removeItem(COMPOSE_DRAFT_KEY); } catch (_e) {}
    const sample = targets[0];
    const action = buildActionFor("product_update", sample);
    if (!action) {
      window.alert("Could not load the email template.");
      return;
    }
    const sampleName = firstName(sample);
    const genericSubject = action.subject.replace(new RegExp("\\b" + sampleName + "\\b", "g"), "{name}");
    const genericBody = action.body.replace(new RegExp("\\b" + sampleName + "\\b", "g"), "{name}");
    setComposeAll({ subject: genericSubject, body: genericBody });
  }

  // Send the composed email to every visible therapist. {name} is substituted
  // per recipient. One confirm guards the irreversible blast.
  async function runComposeAll({ subject, body }) {
    const targets = filtered || [];
    const count = targets.length;
    if (composeSending || count === 0 || !subject?.trim() || !body?.trim()) return;
    const ok = window.confirm(
      `Send this email to ${count} customer${count === 1 ? "" : "s"}?\n\nThis fires immediately. Emails cannot be unsent.`
    );
    if (!ok) return;
    setComposeSending(true);
    setComposeProgress({ done: 0, total: count });
    let sent = 0;
    let failed = 0;
    for (const t of targets) {
      try {
        const recipientName = firstName(t);
        const { data: res, error } = await supabase.functions.invoke("founder-outreach", {
          body: {
            therapist_id: t.id,
            action_type: "product_update",
            custom_subject: subject.replace(/\{name\}/g, recipientName),
            custom_body: body.replace(/\{name\}/g, recipientName),
          },
        });
        if (error || !res?.ok) failed++; else sent++;
      } catch (_e) {
        failed++;
      }
      setComposeProgress({ done: sent + failed, total: count });
    }
    setComposeSending(false);
    setComposeAll(null);
    setComposeProgress(null);
    try { localStorage.removeItem(COMPOSE_DRAFT_KEY); } catch (_e) {}
    window.alert(`Done. ${sent} sent${failed ? `, ${failed} failed` : ""}.`);
    try { await fetchAll(); } catch (_e) {}
  }

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
              Updated {lastUpdated} · Excluding {s.dummies} test accounts from totals. Click any stat below to filter the tables.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            <button
              onClick={openComposeAll}
              title="Compose one email and send it to every customer"
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: C.forest, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "system-ui" }}
            >
              ✉️ Email all customers
            </button>
            <a
              href="/admin/emails"
              style={{ padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${C.light}`, background: "#fff", cursor: "pointer", fontSize: 13, color: C.dark, fontWeight: 600, textDecoration: "none", fontFamily: "system-ui" }}
            >
              📧 Email & SMS review
            </a>
            <RunDigestButton />
            <SquareSweepButton />
            <button
              onClick={fetchAll}
              style={{ padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${C.light}`, background: "#fff", cursor: "pointer", fontSize: 13, color: C.dark, fontWeight: 600 }}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* One-click compose-to-all modal. Reuses SendModal; sends to every
            visible therapist via runComposeAll. */}
        {composeAll && (
          <SendModal
            t={filtered[0]}
            action={{
              key: "product_update",
              label: `Email all customers (${filtered.length})`,
              button: `Send to ${filtered.length}`,
              subject: composeAll.subject,
              body: composeAll.body,
            }}
            sending={composeSending}
            errorMsg=""
            onClose={() => { if (!composeSending) setComposeAll(null); }}
            onSend={({ subject, body }) => runComposeAll({ subject, body })}
          />
        )}

        {composeSending && composeProgress && (
          <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 1100, background: C.forest, color: "#fff", padding: "10px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700, fontFamily: "system-ui", boxShadow: "0 6px 20px rgba(0,0,0,0.2)" }}>
            Sending {composeProgress.done}/{composeProgress.total}…
          </div>
        )}

        {/* Thin stats strip, same info as before, 90% less vertical space */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 18,
          padding: "10px 14px",
          marginBottom: 24,
          background: "#fff",
          border: `1px solid ${C.light}`,
          borderRadius: 6,
          fontFamily: "system-ui",
          fontSize: 12,
        }}>
          <InlineStat n={s.total} label="total" sub={`${s.dummies} test excluded`} />
          <InlineStat n={s.signups_24h} label="24h" />
          <InlineStat n={s.signups_7d} label="7d" onClick={() => activateFilter("new_7d")} active={cohortFilter === "new_7d"} />
          <InlineStat n={s.signups_30d} label="30d" />
          <InlineDivider />
          <InlineStat n={s.silver} label="Silver" onClick={() => activateFilter("silver")} active={cohortFilter === "silver"} />
          <InlineStat n={s.free} label="Free" />
          <InlineDivider />
          <InlineStat n={s.active_7d} label="active 7d" tint={C.rise} onClick={() => activateFilter("active_7d")} active={cohortFilter === "active_7d"} />
          <InlineStat n={s.cold} label="need nudge" tint={C.fall} onClick={() => activateFilter("cold")} active={cohortFilter === "cold"} />
          <InlineStat n={s.champions} label="champions" tint={C.rise} onClick={() => activateFilter("champions")} active={cohortFilter === "champions"} />
        </div>

        {/* AI cost meter. HK May 14 2026: 'I need to know how much
            the website is costing me in terms of AI cost.' Tracks
            every Anthropic API call made by the platform code (not
            HK's dev work in Claude.ai chat, that is separate). Reads
            from ai_call_log via the ai_cost_rollup view. */}
        <AiCostCard />

        {/* Shared filter bar - applies to all three tables */}
        <div style={{ marginTop: 20, marginBottom: 14 }}>
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
            {cohortFilter !== "all" && (
              <button
                onClick={() => setCohortFilter("all")}
                style={{ fontSize: 12, padding: "4px 12px", borderRadius: 999, background: C.sage, color: "#fff", border: "none", cursor: "pointer", fontFamily: "system-ui", fontWeight: 600 }}
              >
                Filter: {filterLabel(cohortFilter)} ✕
              </button>
            )}
            <span style={{ fontSize: 12, color: C.gray, marginLeft: "auto" }}>
              {filtered.length} of {hideDummies ? data.therapists.filter((t) => !t.is_dummy).length : data.therapists.length} therapists
            </span>
          </div>
        </div>

        <FounderMassSms therapists={data.therapists} />

        {/* ====== TABLE 1: Therapists ====== */}
        <CollapsibleTableCard
          number={1}
          title="Therapists"
          subtitle="Full roster. Activity, plan, flags, and recent sessions. Click column headers to sort."
          summary={`${filtered.length} ${filtered.length === 1 ? "row" : "rows"}${cohortFilter !== "all" ? ` · filtered: ${filterLabel(cohortFilter)}` : ""}`}
          isOpen={openTables.t1}
          onToggle={() => toggleTable("t1")}
          anchorId="therapist-table"
        >
          <BatchSendBar
            selectedIds={selected}
            rows={filtered}
            onClearSelected={clearSelected}
            onSelectAll={() => selectAll(filtered.map(r => r.id))}
            onAfterSend={fetchAll}
          />
          <TherapistTable
            rows={filtered}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            updateFlag={updateFlag}
            onAfterSend={fetchAll}
            selected={selected}
            toggleSelected={toggleSelected}
            selectAll={selectAll}
            clearSelected={clearSelected}
          />
        </CollapsibleTableCard>

        {/* ====== TABLE 2: Activation Checklist ====== */}
        <CollapsibleTableCard
          number={2}
          title="Activation Checklist"
          subtitle="Which therapists finished setup. Which are stuck. Therapists who complete all 5 steps see the full product. Those who don't, churn."
          summary={`${filtered.filter(t => t?.steps_done === 5).length} of ${filtered.length} fully activated`}
          isOpen={openTables.t2}
          onToggle={() => toggleTable("t2")}
        >
          <ActivationSection rows={filtered} updateFlag={updateFlag} onAfterSend={fetchAll} hideOwnHeader />
        </CollapsibleTableCard>

        {/* ====== TABLE 3: Comms Log ====== */}
        <CollapsibleTableCard
          number={3}
          title="Comms Log"
          subtitle="Every email sent to each therapist. Auto sends (Welcome, Drip, Pulse) and manual founder outreach side by side. Hover any cell to see subject and date."
          summary={`${filtered.length} therapists in the grid`}
          isOpen={openTables.t3}
          onToggle={() => toggleTable("t3")}
        >
          <CommsLogGrid
            rows={filtered}
            updateFlag={updateFlag}
            onAfterBackfill={fetchAll}
            queuedCells={queuedCells}
            toggleCell={toggleCell}
            clearQueue={clearQueue}
            onAfterSend={fetchAll}
            hideOwnHeader
          />
        </CollapsibleTableCard>

        {/* ====== TABLE 4: Test Plan ====== */}
        <CollapsibleTableCard
          number={4}
          title="Test Plan"
          subtitle="What still needs hands-on testing. Check items off as you verify them on a real device. Saved to your account."
          summary={`${TEST_PLAN_ITEMS.length} items`}
          isOpen={openTables.t4}
          onToggle={() => toggleTable("t4")}
          anchorId="test-plan"
        >
          <FounderTestPlan />
        </CollapsibleTableCard>

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

// Returns an action object suitable for SendModal given an action_type string
// and a therapist row. Mirrors the templates in supabase/functions/founder-outreach.
// Used by Table 3 cell-click flow so HK can edit subject + body before sending.
function buildActionFor(actionType, t) {
  const name = firstName(t);
  const days_since_use = t.days_since_use;
  const sessions_total = t.sessions_total || 0;

  const dispatch = {
    welcome: () => ({
      key: "welcome",
      label: "Founder Welcome",
      button: "Send",
      subject: `${name}, the 60-second question that decides how this goes`,
      body: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. We already sent you the real welcome email with all the steps. So this one is different.`,
        ``,
        `This is the honest one.`,
        ``,
        `Get your full client list in today. Not tomorrow. Today.`,
        ``,
        `If you have a CSV export from your current tool, send it to us as a reply. Vagaro, MassageBook, Square, a messy spreadsheet, anything. We will clean it and load it for you. Reply "import".`,
        ``,
        `Or do it yourself: https://mybodymap.app/dashboard`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ].join("\n"),
    }),
    checkin: () => ({
      key: "checkin",
      label: "Check-in",
      button: "Send",
      subject: `${name}, how are your hands?`,
      body: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. Just checking in.`,
        ``,
        `Want us to import your client list for you? Send us a CSV from your current tool, or a photo of a handwritten list.`,
        ``,
        `Or if something else is in the way, hit reply and tell us.`,
        ``,
        `Take care of your hands this week.`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ].join("\n"),
    }),
    reminder: () => ({
      key: "reminder",
      label: "Reminder",
      button: "Send",
      subject: `${name}, still thinking about you`,
      body: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. It has been about ${days_since_use ?? "a while"} days since you last opened MyBodyMap.`,
        ``,
        `Want a 2-minute video walkthrough of what's new? Reply "yes video" and we will send one.`,
        ``,
        `Or tell us honestly if it didn't click. Either is useful.`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ].join("\n"),
    }),
    testimonial: () => ({
      key: "testimonial",
      label: "Testimonial ask",
      button: "Send",
      subject: `${name}, the kindest thing you could do for another therapist`,
      body: [
        `Hi ${name},`,
        ``,
        `MyBodyMap Team here. You have logged ${sessions_total} sessions on MyBodyMap so far.`,
        ``,
        `Would you share one sentence about how this works for you? Hit reply with how you would say it to a friend over coffee.`,
        ``,
        `Reply "pass" and we will never ask again.`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ].join("\n"),
    }),
    first_session: () => ({
      key: "first_session",
      label: "First session",
      button: "Send",
      subject: `Congrats on your first session, ${name}`,
      body: [
        `Hi ${name},`,
        ``,
        `Just saw you logged your first session. Big moment.`,
        ``,
        `Tip: next time that client books, open their body map 30 seconds before they walk in.`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ].join("\n"),
    }),
    setup_nudge: () => ({
      key: "setup_nudge",
      label: "Setup nudge",
      button: "Send",
      subject: `${name}, some free career advice`,
      body: [
        `Hi ${name},`,
        ``,
        `You haven't connected Stripe or Square yet. Clients can't pay you when they book.`,
        ``,
        `One minute in Settings and it's done.`,
        ``,
        `Want a hand walking through it? Hit reply.`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ].join("\n"),
    }),
    churned: () => ({
      key: "churned",
      label: "Churned",
      button: "Send",
      subject: `${name}, we miss your hands`,
      body: [
        `Hi ${name},`,
        ``,
        `Not writing to sell. We just noticed you have not been back in about ${days_since_use ?? "over a month"} days.`,
        ``,
        `If MyBodyMap fell short somehow, we want to know. Reply with one sentence, or "call" for a 15-minute slot.`,
        ``,
        `Whatever the reason, thank you for trying us.`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ].join("\n"),
    }),
    referral_thankyou: () => ({
      key: "referral_thankyou",
      label: "Referral thank-you",
      button: "Send",
      subject: `Thank you, ${name}`,
      body: [
        `Hi ${name},`,
        ``,
        `Someone just signed up through your link. That means a lot.`,
        ``,
        `If there's anything we can do to make MyBodyMap better for you, reply and tell us.`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ].join("\n"),
    }),
    activation_nudge: () => ({
      key: "activation_nudge",
      label: "Activation nudge",
      button: "Send",
      subject: `${name}, small things left`,
      body: [
        `Hi ${name},`,
        ``,
        `Just a quiet nudge. You've got a couple of setup steps left. No urgency.`,
        ``,
        `If something is in the way, tell us. We help in one reply.`,
        ``,
        `Reply "call" and we'll send a 15-minute slot.`,
        ``,
        `Cheers,`,
        `MyBodyMap Team`,
      ].join("\n"),
    }),
    product_update: () => ({
      key: "product_update",
      label: "Product update",
      button: "Send",
      subject: `${name}, things you can use today`,
      body: [
        `Hi ${name},`,
        ``,
        `We've been listening, and a lot of this came straight from you. The platform stays free for you while we keep adding.`,
        ``,
        `1) Block your year in one go.`,
        `Settings > Plan your year (2.6). Pick a date or up to 90 days and the booking page closes those slots for you.`,
        ``,
        `2) Two locations, one schedule.`,
        `Settings > Services & hours > Locations (2.1.2). Clients see the right address for each booking.`,
        ``,
        `3) Recurring weekly clients.`,
        `Schedule > Book Appointment > Recurring Booking. Pick the day, weekly or biweekly, done.`,
        ``,
        `4) Your calendar colors tell a story.`,
        `Open any past booking and a banner shows no-show, cancelled, refunded, or rescheduled. No more "wait, did I refund?"`,
        ``,
        `5) Smart Outreach.`,
        `Schedule > left panel. See who is overdue, who has gone quiet, where you have room. Tap one and the right clients are ready for a warm note.`,
        ``,
        `6) Coupon codes.`,
        `Settings > Coupon codes (2.7). Make a percent or dollar code and clients enter it at booking.`,
        ``,
        `7) Send a pay link.`,
        `Set a client up with a package or session and send a link to pay. They tap, you both get a receipt.`,
        ``,
        `8) Forms by client.`,
        `Send an intake or consent form to any client, then see what they finished on their record.`,
        ``,
        `Sign in: https://mybodymap.app`,
        ``,
        `Reply and a real person answers.`,
        ``,
        `- Joy`,
      ].join("\n"),
    }),
  };

  const fn = dispatch[actionType];
  if (!fn) return null;
  return fn();
}

function recommendAction(t) {
  const name = firstName(t);
  const noActivity = t.sessions_total === 0 && t.clients_total === 0;
  const daysIdle = t.days_since_use;

  // Priority order: first match wins. Rare/celebratory states before nagging states.
  // Welcome is NOT in this list, the auto-firing send-welcome edge function
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
        `If there's anything we can do to make MyBodyMap better for you, reply and tell us.`,
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
        `Good morning. MyBodyMap Team here. You've logged ${t.sessions_total} sessions on MyBodyMap. That's a big deal.`,
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
        `MyBodyMap Team here. It's been ${daysIdle} days since you last used MyBodyMap. Not writing to push you back in. Writing to ask what didn't work.`,
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

  // 6. Check in (3+ days, still nothing, asks for full client list per HK's guidance)
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
        `Without this, clients can't pay you through your MyBodyMap link. Takes about a minute in Settings. Want us to walk you through it? Just reply.`,
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

// Collapsible card wrapper for the three main dashboard tables. Closed
// state shows a single-row tappable header with the table number, title,
// and one-line summary. Open state expands into the full table content.
// Default styling matches the page's cream + sage palette.
// HK Jun 4 2026: durable test plan. The item list is the version-
// controlled record; done state persists in founder_test_plan (per
// founder, cross-device). Append items here as features ship.
const TEST_PLAN_ITEMS = [
  { key: 'av_sched_bar_hours', area: 'Availability · Schedule', label: 'Hours bar shows the right hours for each day (swipe across the day strip).' },
  { key: 'av_sched_adjusted', area: 'Availability · Schedule', label: 'After setting a custom day, the bar shows the "adjusted" badge.' },
  { key: 'av_sched_dayoff', area: 'Availability · Schedule', label: 'Set a Day off for a date, then the public booking page shows no slots that date.' },
  { key: 'av_sched_custom', area: 'Availability · Schedule', label: 'Set custom hours for a date, then the booking page only offers slots inside those hours.' },
  { key: 'av_open_closed', area: 'Availability · Schedule', label: 'Set custom hours on a normally-closed weekday, confirm the booking page now opens that day.' },
  { key: 'av_sched_remove', area: 'Availability · Schedule', label: 'Remove adjustment reverts the date to the weekly hours.' },
  { key: 'av_set_single', area: 'Availability · Settings', label: 'Date-specific hours: add a single date, confirm it appears in the upcoming list.' },
  { key: 'av_set_multi', area: 'Availability · Settings', label: 'Add several dates as chips, tap "Apply to N dates", confirm all saved.' },
  { key: 'av_set_edit', area: 'Availability · Settings', label: 'Edit changes an override\u2019s hours; Remove deletes it.' },
  { key: 'av_link', area: 'Availability · Settings', label: 'Schedule sheet "Edit my recurring weekly hours" link lands on Settings at Working hours.' },
  { key: 'av_booking_fresh', area: 'Availability · Booking', label: 'Overrides take effect on a fresh booking-page load (signed out / incognito).' },
  { key: 'av_home_demo', area: 'Availability · Marketing', label: 'Home page Find & Book: the "Date-specific hours" animation shows in the carousel and loops through usual / shortened / day-off.' },
  { key: 'av_features_card', area: 'Availability · Marketing', label: 'Features page: the "Availability & hours" card now mentions date-specific hours and copy a week forward.' },
  { key: 'av_copy_week', area: 'Availability · Settings', label: 'Copy a week forward: set a week of overrides, copy it N weeks ahead, confirm the same weekdays get the same hours.' },
  { key: 'wh_drag', area: 'Weekly hours', label: 'Settings Working hours: drag a day\u2019s green bar to set its hours, reopen, and confirm it saved.' },
  { key: 'wh_presets', area: 'Weekly hours', label: 'Presets (Weekdays 9 to 5, etc.) and "Make Tue to Fri match Monday" set the right days; toggling a day off/on works.' },
  { key: 'wh_split', area: 'Weekly hours', label: 'Tap + on a day to add a break (split shift) and confirm two green windows save.' },
  { key: 'wh_booking', area: 'Weekly hours', label: 'Booking page reflects the new weekly hours (slots only inside the bars).' },
];

function FounderTestPlan() {
  const [uid, setUid] = useState(null);
  const [doneMap, setDoneMap] = useState({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const id = u?.user?.id || null;
      if (cancelled) return;
      setUid(id);
      if (id) {
        const { data } = await supabase.from('founder_test_plan').select('item_key,done').eq('user_id', id);
        if (cancelled) return;
        const m = {};
        for (const r of (data || [])) m[r.item_key] = r.done;
        setDoneMap(m);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);
  const toggle = async (key) => {
    if (!uid) return;
    const next = !doneMap[key];
    setDoneMap(prev => ({ ...prev, [key]: next }));
    try {
      await supabase.from('founder_test_plan').upsert({ user_id: uid, item_key: key, done: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id,item_key' });
    } catch {
      setDoneMap(prev => ({ ...prev, [key]: !next }));
    }
  };
  const groups = useMemo(() => {
    const order = [];
    const byArea = {};
    for (const it of TEST_PLAN_ITEMS) {
      if (!byArea[it.area]) { byArea[it.area] = []; order.push(it.area); }
      byArea[it.area].push(it);
    }
    return order.map(area => ({ area, items: byArea[area] }));
  }, []);
  const doneCount = TEST_PLAN_ITEMS.filter(i => doneMap[i.key]).length;
  return (
    <div style={{ padding: '4px 2px' }}>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>
        {loading ? 'Loading...' : `${doneCount} of ${TEST_PLAN_ITEMS.length} done`}{!uid && !loading ? ' (sign in to save check marks)' : ''}
      </div>
      {groups.map(g => (
        <div key={g.area} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8A8A8A', marginBottom: 8 }}>{g.area}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.items.map(it => {
              const checked = !!doneMap[it.key];
              return (
                <button key={it.key} onClick={() => toggle(it.key)} disabled={!uid}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left', background: checked ? '#F2F7F4' : '#F9FAFB', border: '1px solid #EEF2F7', borderRadius: 8, padding: '9px 11px', cursor: uid ? 'pointer' : 'default', width: '100%' }}>
                  <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${checked ? '#2A5741' : '#CBD5E1'}`, background: checked ? '#2A5741' : '#fff', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{checked ? '✓' : ''}</span>
                  <span style={{ fontSize: 13, color: checked ? '#6B7280' : '#1F2937', textDecoration: checked ? 'line-through' : 'none', lineHeight: 1.4 }}>{it.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CollapsibleTableCard({ number, title, subtitle, summary, isOpen, onToggle, anchorId, children }) {
  return (
    <div
      id={anchorId}
      style={{
        marginTop: 24,
        background: "#fff",
        border: `1.5px solid ${C.light}`,
        borderRadius: 14,
        // overflow:hidden was here for clean rounded corners but it breaks
        // position:sticky on descendant table headers. Removed. Inner
        // children that needed corner clipping (like the colored header
        // band) handle it themselves with their own border-radius.
      }}
    >
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 20px",
          cursor: "pointer",
          userSelect: "none",
          background: isOpen ? C.softCream : "#fff",
          transition: "background 0.12s",
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: C.forest, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "Georgia, serif", fontSize: 18, fontStyle: "italic",
          flexShrink: 0,
        }}>
          {number}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.sage, marginBottom: 1 }}>
            Table {number}
          </div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18, color: C.dark, lineHeight: 1.2 }}>
            {title}
            {summary && (
              <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: C.gray, marginLeft: 10, fontWeight: 400 }}>
                · {summary}
              </span>
            )}
          </div>
          {isOpen && subtitle && (
            <p style={{ fontSize: 12, color: C.gray, margin: "4px 0 0", lineHeight: 1.4 }}>
              {subtitle}
            </p>
          )}
        </div>
        <svg
          width="14" height="14" viewBox="0 0 12 12" fill="none"
          stroke={isOpen ? C.forest : "#9CA3AF"}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{
            flexShrink: 0,
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.18s",
          }}
        >
          <path d="M4 2l4 4-4 4" />
        </svg>
      </div>
      {isOpen && (
        <div style={{ padding: "16px 20px 20px", borderTop: `1px solid ${C.light}` }}>
          {children}
        </div>
      )}
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

// Inline stat (thin strip at top) - compact number + label pair, optionally clickable.
// Kept deliberately minimal so 10 of them fit in one horizontal row.
function InlineStat({ n, label, sub, tint, onClick, active }) {
  const clickable = !!onClick;
  const color = tint || C.forest;
  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        padding: active ? "4px 10px" : "4px 8px",
        background: active ? "#F0EEE8" : "transparent",
        border: active ? `1px solid ${C.forest}` : "1px solid transparent",
        borderRadius: 999,
        cursor: clickable ? "pointer" : "default",
        fontFamily: "inherit",
        fontSize: 12,
        color: C.dark,
        whiteSpace: "nowrap",
      }}
      title={sub || undefined}
    >
      <span style={{ fontSize: 16, fontWeight: 700, color: color, fontFamily: "Georgia, serif", lineHeight: 1 }}>{n}</span>
      <span style={{ color: C.gray }}>{label}</span>
    </button>
  );
}

function InlineDivider() {
  return (
    <span style={{ width: 1, background: C.light, alignSelf: "stretch", margin: "0 4px" }} aria-hidden="true" />
  );
}

// ─── Batch Send Bar ─────────────────────────────────────────────────────
// Floats above the Therapists table when one or more rows are selected.
// Pick an email type, press send, watch the per-therapist progress.
// Uses the same founder-outreach edge function as single-therapist sends,
// calls it once per therapist in sequence (not parallel) to avoid hitting
// Resend's rate limits and to keep the notification_log clean.
const BATCH_EMAIL_OPTIONS = [
  { value: "product_update",    code: "E2.10", label: "Product update broadcast (Settings rebuild + new features)" },
  { value: "setup_nudge",       code: "E2.6", label: "Setup nudge (Stripe/Square)" },
  { value: "activation_nudge",  code: "E2.9", label: "Activation nudge (incomplete setup)" },
  { value: "welcome",           code: "E2.1", label: "Founder Welcome" },
  { value: "checkin",           code: "E2.2", label: "Check-in (how are your hands?)" },
  { value: "reminder",          code: "E2.3", label: "Reminder (still thinking about you)" },
  { value: "testimonial",       code: "E2.4", label: "Testimonial ask" },
  { value: "first_session",     code: "E2.5", label: "First session celebration" },
  { value: "churned",           code: "E2.7", label: "Churned (we miss your hands)" },
  { value: "referral_thankyou", code: "E2.8", label: "Referral thank-you" },
];

function BatchSendBar({ selectedIds, rows, onClearSelected, onSelectAll, onAfterSend }) {
  const [actionType, setActionType] = useState("product_update");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total, results: [{id, name, status, error?}] }
  // Edit-before-batch-send: when set, opens SendModal pre-filled with the
  // template. HK edits, hits Send, then runBatch fires with the same edited
  // subject + body to ALL selected therapists. {name} is auto-substituted
  // per recipient in the Edge Function.
  const [editingTemplate, setEditingTemplate] = useState(null); // { subject, body } | null
  const [pendingCustom, setPendingCustom] = useState(null); // { subject, body } | null - what runBatch should send

  const selectedRows = rows.filter((r) => selectedIds.has(r.id));
  const count = selectedRows.length;
  // HK Jun 1 2026: do NOT early-return when count === 0. Bar must stay
  // visible so therapists can discover the email options. Empty state
  // surfaces an explicit "select therapists first" guide AND a one-tap
  // "Select all" shortcut so the founder can broadcast to everyone in
  // 2 taps from cold-open.

  const chosen = BATCH_EMAIL_OPTIONS.find((o) => o.value === actionType);

  // Open the edit modal pre-filled with the template for the FIRST selected
  // therapist. The {name} placeholder is left as-is so it substitutes per
  // recipient during the actual send. HK can replace any text he wants.
  function openEditModal() {
    const sample = selectedRows[0];
    const action = buildActionFor(actionType, sample);
    if (!action) {
      window.alert("Could not build template for " + actionType);
      return;
    }
    // Replace the first name with {name} placeholder so the substitution works
    // for each recipient during send.
    const sampleName = firstName(sample);
    const genericSubject = action.subject.replace(new RegExp("\\b" + sampleName + "\\b", "g"), "{name}");
    const genericBody = action.body.replace(new RegExp("\\b" + sampleName + "\\b", "g"), "{name}");
    setEditingTemplate({ subject: genericSubject, body: genericBody });
  }

  async function runBatch(customOverride) {
    if (sending || count === 0) return;

    const useCustom = customOverride && customOverride.subject && customOverride.body;
    const labelText = useCustom ? `${chosen.label} (edited)` : chosen.label;
    const confirmMsg = `Send "${labelText}" (${chosen.code}) to ${count} therapist${count === 1 ? "" : "s"}?\n\nThis fires immediately. Emails cannot be unsent.`;
    if (!window.confirm(confirmMsg)) return;

    setSending(true);
    setProgress({ done: 0, total: count, results: [] });
    const results = [];

    for (const t of selectedRows) {
      try {
        // Build per-recipient body. If HK edited the template, substitute
        // {name} per therapist; otherwise let the Edge Function build the
        // default template by passing only therapist_id + action_type.
        const recipientName = firstName(t);
        const requestBody = useCustom
          ? {
              therapist_id: t.id,
              action_type: actionType,
              custom_subject: customOverride.subject.replace(/\{name\}/g, recipientName),
              custom_body: customOverride.body.replace(/\{name\}/g, recipientName),
            }
          : { therapist_id: t.id, action_type: actionType };

        const { data, error } = await supabase.functions.invoke("founder-outreach", {
          body: requestBody,
        });
        if (error) {
          results.push({ id: t.id, name: t.business_name || t.full_name || t.email, status: "failed", error: error.message || "transport" });
        } else if (!data?.ok) {
          results.push({ id: t.id, name: t.business_name || t.full_name || t.email, status: "failed", error: `${data?.step || "?"}: ${data?.error || "send failed"}` });
        } else {
          results.push({ id: t.id, name: t.business_name || t.full_name || t.email, status: "sent" });
        }
      } catch (e) {
        results.push({ id: t.id, name: t.business_name || t.full_name || t.email, status: "failed", error: e?.message || "exception" });
      }
      // Update progress incrementally so the UI reflects each send
      setProgress({ done: results.length, total: count, results: [...results] });
    }

    setSending(false);
    // Refresh the dashboard so notification_log and cooldowns show the new sends
    if (onAfterSend) {
      try { await onAfterSend(); } catch (_e) { /* non-blocking */ }
    }
  }

  const sentCount = progress?.results.filter((r) => r.status === "sent").length || 0;
  const failedCount = progress?.results.filter((r) => r.status === "failed").length || 0;
  const isDone = progress && progress.done === progress.total && !sending;

  return (
    <div style={{
      position: "sticky",
      top: 12,
      zIndex: 10,
      background: "#fff",
      border: `2px solid ${C.forest}`,
      borderRadius: 12,
      padding: "12px 16px",
      marginBottom: 14,
      boxShadow: "0 4px 16px rgba(42, 87, 65, 0.12)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.forest }}>
          📧 Email broadcast
        </div>
        {count > 0 ? (
          <div style={{ fontSize: 13, color: C.dark, fontWeight: 600 }}>
            {count} selected
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: C.gray }}>
              No therapists selected
            </div>
            {onSelectAll && rows.length > 0 && (
              <button
                onClick={onSelectAll}
                style={{
                  padding: "5px 12px",
                  background: "#fff",
                  color: C.forest,
                  border: `1.5px solid ${C.forest}`,
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "system-ui",
                }}
                title={`Select all ${rows.length} visible therapists`}
              >
                ✓ Select all {rows.length}
              </button>
            )}
          </>
        )}

        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          disabled={sending}
          style={{
            padding: "7px 10px",
            border: `1.5px solid ${C.light}`,
            borderRadius: 6,
            fontSize: 13,
            color: C.dark,
            background: "#fff",
            fontFamily: "system-ui",
            minWidth: 300,
          }}
        >
          {BATCH_EMAIL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.code} · {opt.label}
            </option>
          ))}
        </select>

        <button
          onClick={openEditModal}
          disabled={sending || count === 0}
          title={count === 0 ? "Select therapists below first" : "Edit subject and body once, then send to all selected"}
          style={{
            padding: "7px 14px",
            background: (sending || count === 0) ? C.light : "#FFF9F3",
            color: (sending || count === 0) ? C.gray : C.forest,
            border: `1.5px solid ${(sending || count === 0) ? C.light : C.forest}`,
            borderRadius: 6,
            cursor: (sending || count === 0) ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "system-ui",
            opacity: count === 0 ? 0.6 : 1,
          }}
        >
          ✎ Edit &amp; Send
        </button>

        <button
          onClick={() => runBatch(null)}
          disabled={sending || count === 0}
          title={count === 0 ? "Select therapists below first" : `Send template to ${count} therapist${count === 1 ? '' : 's'}`}
          style={{
            padding: "7px 16px",
            background: (sending || count === 0) ? C.light : C.forest,
            color: (sending || count === 0) ? C.gray : "#fff",
            border: "none",
            borderRadius: 6,
            cursor: (sending || count === 0) ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "system-ui",
            opacity: count === 0 ? 0.6 : 1,
          }}
        >
          {sending ? `Sending ${progress?.done || 0}/${progress?.total || count}…` : (count === 0 ? "Send" : `Send to ${count}`)}
        </button>

        {count > 0 && (
          <button
            onClick={onClearSelected}
            disabled={sending}
            style={{
              padding: "7px 12px",
              background: "transparent",
              color: C.gray,
              border: `1px solid ${C.light}`,
              borderRadius: 6,
              cursor: sending ? "default" : "pointer",
              fontSize: 12,
              fontFamily: "system-ui",
            }}
          >
            Clear
          </button>
        )}

        {progress && (
          <div style={{ marginLeft: "auto", fontSize: 12, color: C.gray, fontFamily: "system-ui" }}>
            {sentCount > 0 && <span style={{ color: C.rise, fontWeight: 700, marginRight: 8 }}>✓ {sentCount} sent</span>}
            {failedCount > 0 && <span style={{ color: C.fall, fontWeight: 700 }}>✗ {failedCount} failed</span>}
          </div>
        )}
      </div>

      {/* Per-therapist progress detail, shown during/after send */}
      {progress && (progress.results.length > 0) && (
        <div style={{ marginTop: 10, maxHeight: 140, overflowY: "auto", borderTop: `1px solid ${C.light}`, paddingTop: 8 }}>
          {progress.results.map((r) => (
            <div key={r.id} style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "4px 0",
              fontSize: 12,
              fontFamily: "system-ui",
              color: r.status === "sent" ? C.rise : C.fall,
            }}>
              <span style={{ width: 16, textAlign: "center" }}>{r.status === "sent" ? "✓" : "✗"}</span>
              <span style={{ color: C.dark, fontWeight: 600 }}>{r.name}</span>
              {r.error && <span style={{ color: C.fall }}>· {r.error}</span>}
            </div>
          ))}
          {isDone && (
            <div style={{ marginTop: 8, fontSize: 12, color: C.gray, fontFamily: "system-ui" }}>
              Batch complete. {sentCount} sent, {failedCount} failed.
              {failedCount === 0 && (
                <button
                  onClick={onClearSelected}
                  style={{ marginLeft: 10, padding: "2px 8px", background: "transparent", color: C.forest, border: `1px solid ${C.light}`, borderRadius: 4, cursor: "pointer", fontSize: 11, fontFamily: "system-ui", fontWeight: 700 }}
                >
                  Clear selection
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {editingTemplate && (
        <SendModal
          t={selectedRows[0]}
          action={{
            key: actionType,
            label: chosen.label,
            button: `Send to ${count}`,
            subject: editingTemplate.subject,
            body: editingTemplate.body,
          }}
          sending={sending}
          errorMsg=""
          onClose={() => setEditingTemplate(null)}
          onSend={({ subject, body }) => {
            // Close modal then fire batch with the edited subject + body
            setEditingTemplate(null);
            runBatch({ subject, body });
          }}
        />
      )}
    </div>
  );
}

function TherapistTable({ rows, sortKey, sortDir, onSort, updateFlag, onAfterSend, selected, toggleSelected, selectAll, clearSelected }) {
  if (rows.length === 0) {
    return (
      <div style={{ background: "#fff", border: `1.5px solid ${C.light}`, borderRadius: 12, padding: 32, textAlign: "center", color: C.gray, fontSize: 13 }}>
        No therapists match this view.
      </div>
    );
  }

  // Sticky header styles. The table wrapper above each table now has
  // overflowY:"auto" with a maxHeight cap, so each table scrolls inside
  // its own box. position:sticky + top:0 pins the header to the top of
  // that scrolling container (NOT the viewport). This means the header
  // stays visible no matter how far down the user scrolls within the
  // table — even with 30+ therapists.
  //
  // For horizontal scroll within the same wrapper, left:0 pins the
  // first column within the container.
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
          position: "sticky",
          top: 0,
          background: C.softCream,
          zIndex: 3,
          borderBottom: `1.5px solid ${C.light}`,
          boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
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

  const visibleIds = rows.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected?.has(id));
  const someVisibleSelected = visibleIds.some((id) => selected?.has(id));

  const onHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearSelected && clearSelected();
    } else {
      selectAll && selectAll(visibleIds);
    }
  };

  return (
    <div style={{ background: "#fff", border: `1.5px solid ${C.light}`, borderRadius: 12 }}>
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13, minWidth: 1280 }}>
          <thead>
            <tr>
              <th style={{ ...stickyHead, left: 0, zIndex: 6, minWidth: 36, padding: "10px 8px 10px 14px" }}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                  onChange={onHeaderCheckboxChange}
                  title={allVisibleSelected ? "Clear all" : "Select all visible"}
                  style={{ cursor: "pointer", width: 15, height: 15 }}
                />
              </th>
              <th style={{ ...firstColHead, left: 36 }} onClick={() => onSort("business_name")}>
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
              <th style={{ position: "sticky", top: 0, background: C.softCream, zIndex: 3, borderBottom: `1.5px solid ${C.light}`, boxShadow: "0 1px 0 rgba(0,0,0,0.04)", padding: "10px 12px", textAlign: "left", fontWeight: 700, color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                Recommended action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, idx) => (
              <Row
                key={t.id}
                t={t}
                idx={idx}
                firstColCell={firstColCell}
                updateFlag={updateFlag}
                onAfterSend={onAfterSend}
                isSelected={selected?.has(t.id) || false}
                onToggleSelect={() => toggleSelected && toggleSelected(t.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ t, idx, firstColCell, updateFlag, onAfterSend, isSelected, onToggleSelect }) {
  const zebra = idx % 2 === 1 ? "#FBFAF5" : "#fff";
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
    <tr style={{ borderTop: `1px solid ${C.light}`, verticalAlign: "top", background: isSelected ? "#F0FDF4" : zebra }}>
      <td style={{ position: "sticky", left: 0, background: isSelected ? "#F0FDF4" : zebra, zIndex: 2, padding: "8px 8px 8px 14px", borderTop: `1px solid ${C.light}`, minWidth: 36 }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          style={{ cursor: "pointer", width: 15, height: 15 }}
        />
      </td>
      <td style={{ ...firstColCell, left: 36, background: isSelected ? "#F0FDF4" : zebra, padding: "8px 10px", borderTop: `1px solid ${C.light}` }}>
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
            <div style={{ color: C.dark, fontWeight: 600 }}>{formatUSPhone(t.phone)}</div>
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
              : "Open editor, tune the message, send via MyBodyMap"
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
          ✓ Sent from MyBodyMap
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
  // HK Jun 1 2026: persist draft to localStorage keyed by action.key so a
  // careful edit isn't lost when the modal closes by accident (Esc tap,
  // tab switch on iOS, backdrop click). Restore on reopen. Clear on
  // successful send. Also: backdrop tap no longer closes (was data-loss
  // landmine).
  const DRAFT_KEY = `founder_outreach_draft_${action.key || 'default'}`;

  // Initial state: localStorage draft wins over template default so HK
  // doesn't lose work between sessions.
  const [subject, setSubject] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.subject) return parsed.subject;
      }
    } catch (_e) {}
    return action.subject;
  });
  const [body, setBody] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.body) return parsed.body;
      }
    } catch (_e) {}
    return action.body;
  });
  const [savedAt, setSavedAt] = useState(null);
  const [insertError, setInsertError] = useState(null);
  const bodyRef = useRef(null);

  // Persist every keystroke. Throttled by React batching, fine for our
  // edit pace. Avoids losing edits even if the page crashes mid-compose.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ subject, body, at: Date.now() }));
      setSavedAt(new Date());
    } catch (_e) {}
  }, [subject, body, DRAFT_KEY]);

  // Cmd/Ctrl+Enter = send, Esc = ASK before closing (don't insta-close).
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        // Confirm before losing work. Soft guard, no harsh modal.
        const ok = window.confirm("Close without sending? Your draft is saved and will be here when you reopen.");
        if (ok) onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (subject.trim() && body.trim()) onSend({ subject, body });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [subject, body, onClose, onSend]);

  // Insert a marker at the cursor position in the body textarea. The
  // marker syntax [[img:URL]] and [[video:URL]] gets parsed by the
  // founder-outreach edge function into safe HTML on send. Keeping it
  // as a marker means the textarea stays plain-text editable, no
  // contenteditable complexity, and the edge function controls the
  // exact HTML output (no XSS risk from raw paste).
  function insertAtCursor(marker) {
    const el = bodyRef.current;
    if (!el) {
      // Fallback: append to end
      setBody(prev => (prev || '') + (prev?.endsWith('\n') ? '' : '\n\n') + marker + '\n');
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = body.slice(0, start);
    const after = body.slice(end);
    // Always wrap markers in their own paragraph so they render cleanly.
    const needsLineBefore = before.length > 0 && !before.endsWith('\n');
    const needsLineAfter = after.length > 0 && !after.startsWith('\n');
    const wrapped = (needsLineBefore ? '\n\n' : '') + marker + (needsLineAfter ? '\n\n' : '');
    const next = before + wrapped + after;
    setBody(next);
    // Move cursor to end of inserted marker
    setTimeout(() => {
      if (el) {
        const pos = (before + wrapped).length;
        el.setSelectionRange(pos, pos);
        el.focus();
      }
    }, 0);
  }

  async function handleImageInsert() {
    setInsertError(null);
    const url = window.prompt(
      'Paste an image URL (must be publicly accessible, https://...).\n\nTip: upload to Imgur, Google Drive (shared), or any image host first.',
      ''
    );
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setInsertError('Image URL must start with http:// or https://');
      setTimeout(() => setInsertError(null), 4000);
      return;
    }
    insertAtCursor(`[[img:${url.trim()}]]`);
  }

  function handleVideoInsert() {
    setInsertError(null);
    const url = window.prompt(
      'Paste a video link (Loom, YouTube, Vimeo, or any URL).\n\nThe email will show a "Watch video" button that opens this link.',
      ''
    );
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setInsertError('Video URL must start with http:// or https://');
      setTimeout(() => setInsertError(null), 4000);
      return;
    }
    const label = window.prompt('Button label?', '▶ Watch video (45 seconds)') || '▶ Watch video';
    insertAtCursor(`[[video:${url.trim()}|${label}]]`);
  }

  // Wrap onSend so we clear the draft after a successful send. The
  // parent calls onSend and then closes the modal; if the send fails
  // (errorMsg surfaces), the draft is still there.
  const handleSend = () => {
    onSend({ subject, body });
    try { localStorage.removeItem(DRAFT_KEY); } catch (_e) {}
  };

  // Confirm before closing if there are unsaved-to-server changes.
  const handleClose = () => {
    const hasDraftChanges = subject !== action.subject || body !== action.body;
    if (hasDraftChanges) {
      const ok = window.confirm("Close without sending? Your draft is saved and will be here when you reopen.");
      if (!ok) return;
    }
    onClose();
  };

  return (
    <div
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

        {/* Insert image / video buttons. Sit above the body textarea so
            HK doesn't have to scroll to find them. */}
        <div style={{ padding: "10px 20px 0", display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleImageInsert}
            style={{
              background: '#fff', border: `1.5px solid ${C.light}`,
              color: C.dark, padding: '6px 12px',
              borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
            title="Insert image URL. Image must be publicly accessible."
          >
            🖼 Insert image
          </button>
          <button
            type="button"
            onClick={handleVideoInsert}
            style={{
              background: '#fff', border: `1.5px solid ${C.light}`,
              color: C.dark, padding: '6px 12px',
              borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
            title="Insert link to a video (Loom/YouTube/Vimeo). Renders as a Watch button."
          >
            ▶ Insert video link
          </button>
          <button
            type="button"
            onClick={() => {
              setSubject(action.subject || "");
              setBody(action.body || "");
              try { localStorage.removeItem(DRAFT_KEY); } catch (_e) {}
            }}
            title="Reset the subject and body to the template and discard the saved draft"
            style={{
              background: '#fff', border: `1.5px solid ${C.light}`,
              color: C.gray, padding: '6px 12px',
              borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', marginLeft: savedAt ? 0 : 'auto',
            }}
          >
            ↺ Start fresh
          </button>
          {savedAt && (
            <span style={{ fontSize: 10, color: C.gray, marginLeft: 'auto', fontStyle: 'italic' }}>
              Draft saved · safe to close
            </span>
          )}
        </div>

        {insertError && (
          <div style={{ padding: '6px 20px 0' }}>
            <div style={{
              background: '#FEF2F1', border: `1px solid ${C.fall}`,
              color: C.fall, padding: '6px 10px', borderRadius: 6,
              fontSize: 11.5, fontWeight: 600,
            }}>
              {insertError}
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: "10px 20px 0" }}>
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
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
          <div style={{ fontSize: 10.5, color: C.gray, marginTop: 4, lineHeight: 1.5 }}>
            Use <code style={{ background: C.softCream, padding: '1px 4px', borderRadius: 3 }}>{'{name}'}</code> for first name substitution. Tap Insert image or Insert video link above to add media. Image URLs must be publicly accessible (https://).
          </div>
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
            onClick={handleClose}
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
            onClick={handleSend}
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

// formatPhoneDisplay removed; the canonical formatter lives in
// src/lib/formatters/phone.js as formatUSPhone (Design Principle 16).
// All three usages below now call formatUSPhone directly.

// The 5 onboarding steps mirror OnboardingChecklist.js. Column keys map to
// the t.steps bitmap set in fetchAll().
const ACTIVATION_STEPS = [
  { key: "import",  label: "Clients imported", short: "Clients",  icon: "📥" },
  { key: "service", label: "Service added",    short: "Service",  icon: "🛁" },
  { key: "hours",   label: "Hours set",        short: "Hours",    icon: "🕐" },
  { key: "stripe",  label: "Stripe connected", short: "Stripe",   icon: "💳" },
  { key: "intake",  label: "First intake sent", short: "Intake",  icon: "📋" },
];

function ActivationSection({ rows, updateFlag, onAfterSend, hideOwnHeader = false }) {
  const [onlyStuck, setOnlyStuck] = useState(false);
  const [sortKey, setSortKey] = useState("steps_done");
  const [sortDir, setSortDir] = useState("asc"); // least-done first, these need help most

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
    <div style={{ marginTop: hideOwnHeader ? 0 : 36 }}>
      {!hideOwnHeader && (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.sage }}>
            Table 2
          </div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, color: C.dark, margin: "4px 0 0" }}>
            Activation Checklist
          </h2>
          <p style={{ fontSize: 12, color: C.gray, margin: "4px 0 0" }}>
            Which therapists finished setup. Which are stuck. Therapists who complete all 5 steps see the full product. Those who don't, churn.
          </p>
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: C.dark, cursor: "pointer", userSelect: "none", padding: "6px 10px", borderRadius: 8, background: onlyStuck ? C.softCream : "#fff", border: `1.5px solid ${C.light}` }}>
          <input type="checkbox" checked={onlyStuck} onChange={(e) => setOnlyStuck(e.target.checked)} style={{ margin: 0 }} />
          Only show stuck
        </label>
      </div>
      )}
      {hideOwnHeader && (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: C.dark, cursor: "pointer", userSelect: "none", padding: "6px 10px", borderRadius: 8, background: onlyStuck ? C.softCream : "#fff", border: `1.5px solid ${C.light}` }}>
          <input type="checkbox" checked={onlyStuck} onChange={(e) => setOnlyStuck(e.target.checked)} style={{ margin: 0 }} />
          Only show stuck
        </label>
      </div>
      )}

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
      <div style={{ background: "#fff", border: `1.5px solid ${C.light}`, borderRadius: 12 }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh" }}>
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
              {activationRows.map((t, idx) => (
                <ActivationRow key={t.id} t={t} idx={idx} updateFlag={updateFlag} onAfterSend={onAfterSend} />
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

function ActivationRow({ t, idx, updateFlag, onAfterSend }) {
  const zebra = idx % 2 === 1 ? "#FBFAF5" : "#fff";
  const done = t.steps_done || 0;
  const pct = Math.round((done / 5) * 100);
  const progressColor = done === 5 ? C.rise : done >= 3 ? C.gold : C.fall;

  // Find first uncompleted step (ordered by the list), that's what to push them toward
  const nextStep = ACTIVATION_STEPS.find((s) => !t.steps?.[s.key]);

  // Build the activation_nudge action on demand, grandma-voice, names the missing steps
  const nudgeAction = buildActivationNudge(t);

  return (
    <tr style={{ borderTop: `1px solid ${C.light}`, verticalAlign: "top", background: zebra }}>
      {/* Sticky therapist column */}
      <td style={{
        position: "sticky", left: 0, background: zebra, zIndex: 2,
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
              {formatUSPhone(t.phone)}
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

      {/* 5 step cells: each shows TWO things stacked , 
          top: did the therapist complete this step (✓ green or · gray)
          bottom: have I emailed them about it (📧 + date, or nothing) */}
      {ACTIVATION_STEPS.map((s) => {
        const ok = !!t.steps?.[s.key];
        // Find most recent founder email that mentioned THIS step. Case-
        // insensitive match on a set of phrases that could appear in any
        // activation nudge body for this step. Also matches old checkin
        // emails that mentioned bringing clients over.
        const stepPhrases = {
          import: ["import your clients", "bring your client", "client list over"],
          service: ["add your first service", "first service"],
          hours: ["set your working hours", "working hours"],
          stripe: ["connect stripe", "stripe or square", "accept payments"],
          intake: ["send your first intake", "first intake"],
        }[s.key] || [];
        const emailedAboutThis = stepPhrases.length
          ? (t.contact_history || []).find((h) => {
              const body = (h.body_snippet || "").toLowerCase();
              return stepPhrases.some((p) => body.includes(p));
            })
          : null;
        return (
          <td key={s.key} style={{ padding: "6px 8px", textAlign: "center", verticalAlign: "top" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
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
              {emailedAboutThis && (
                <span
                  title={`Emailed about this step ${daysAgo(emailedAboutThis.sent_at)}: "${emailedAboutThis.subject || ""}"`}
                  style={{
                    fontSize: 9, color: C.forest, fontWeight: 700,
                    background: "#EEF4F1", padding: "1px 5px", borderRadius: 8,
                    whiteSpace: "nowrap", lineHeight: 1.3,
                  }}
                >
                  📧 {daysAgoNumeric(emailedAboutThis.sent_at) === 0 ? "today" : `${daysAgoNumeric(emailedAboutThis.sent_at)}d`}
                </span>
              )}
            </div>
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
  // Unsubscribed takes priority, most important signal
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
  // Not the full label, not a list, just the one concrete thing they need to do.
  const stepPhrase = {
    import:  "import your clients",
    service: "add your first service",
    hours:   "set your working hours",
    stripe:  "connect Stripe to accept payments",
    intake:  "send your first intake to a client",
  };

  const firstMissing = missing[0];
  const firstStepText = stepPhrase[firstMissing.key] || firstMissing.label.toLowerCase();

  const subject = `Quick hello from MyBodyMap`;

  // One voice, one template. Names the single most important next step.
  // If more steps remain, mention there are a few but don't list them all, keeps it light.
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
      // Send as activation_nudge so it logs distinctly from generic checkin
      // in notification_log. This keeps the history view accurate, dedup
      // flags correct, and the audit trail clean.
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

// ========================================================================
// Run Founder Digest button
// Fires the founder-digest edge function on demand. Shows status inline.
// Helpful for (a) getting the email now without waiting for 8pm cron
// and (b) verifying the function works end-to-end.
// ========================================================================

function RunDigestButton() {
  const [status, setStatus] = useState("idle"); // idle | running | sent | failed
  const [errorMsg, setErrorMsg] = useState("");

  const run = async () => {
    if (status === "running") return;
    setStatus("running");
    setErrorMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("founder-digest", {
        body: {},
      });
      if (error) {
        setStatus("failed");
        setErrorMsg(error.message || "transport error");
        return;
      }
      // founder-digest doesn't return a detailed ok/fail shape, so success = no error
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 6000);
    } catch (e) {
      setStatus("failed");
      setErrorMsg(e?.message || "request failed");
    }
  };

  const bg = status === "running" ? C.stale
    : status === "sent" ? C.rise
    : status === "failed" ? C.fall
    : C.forest;
  const label = status === "running" ? "Sending..."
    : status === "sent" ? "✓ Sent, check inbox"
    : status === "failed" ? "✗ Failed"
    : "Run Founder Digest";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
      <button
        onClick={run}
        disabled={status === "running"}
        style={{
          padding: "8px 14px",
          borderRadius: 8,
          border: "none",
          background: bg,
          color: "#fff",
          cursor: status === "running" ? "wait" : "pointer",
          fontSize: 13,
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
        title="Invoke the founder-digest edge function now. Email lands in bodymap01@gmail.com within ~30 seconds."
      >
        {label}
      </button>
      {status === "failed" && errorMsg && (
        <div style={{ fontSize: 10, color: C.fall, fontWeight: 600, maxWidth: 220, textAlign: "right" }}>
          {errorMsg}
        </div>
      )}
      {status === "sent" && (
        <div style={{ fontSize: 10, color: C.rise, fontWeight: 600 }}>
          Landing in bodymap01@gmail.com
        </div>
      )}
    </div>
  );
}

// HK Jun 2 2026: one-tap Square health sweep. Tests every connected Square
// token against a MERCHANT_PROFILE_READ-gated endpoint and flags the stale
// ones (square_needs_reconnect), so their dashboard nudges them to reconnect
// before they hit a silent failure. Safe to run anytime.
function SquareSweepButton() {
  const [status, setStatus] = useState("idle"); // idle | running | done | failed
  const [msg, setMsg] = useState("");

  const run = async () => {
    if (status === "running") return;
    setStatus("running");
    setMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("square-health-sweep", { body: {} });
      if (error) { setStatus("failed"); setMsg(error.message || "transport error"); return; }
      const flagged = data?.flagged ?? 0;
      const checked = data?.checked ?? 0;
      const names = (data?.flagged_businesses || []).map((b) => b.business_name || b.id).join(", ");
      setStatus("done");
      setMsg(flagged > 0 ? `${flagged} of ${checked} need reconnect: ${names}` : `All ${checked} Square connections healthy`);
      setTimeout(() => setStatus("idle"), 12000);
    } catch (e) {
      setStatus("failed");
      setMsg(e?.message || "request failed");
    }
  };

  const bg = status === "running" ? C.stale : status === "done" ? C.rise : status === "failed" ? C.fall : C.forest;
  const label = status === "running" ? "Checking Square..." : status === "done" ? "✓ Square checked" : status === "failed" ? "✗ Failed" : "Check Square health";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
      <button
        onClick={run}
        disabled={status === "running"}
        style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: bg, color: "#fff", cursor: status === "running" ? "wait" : "pointer", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}
        title="Tests every connected Square token and flags any that need reconnecting."
      >
        {label}
      </button>
      {msg && (status === "done" || status === "failed") && (
        <div style={{ fontSize: 10, color: status === "failed" ? C.fall : C.dark, fontWeight: 600, maxWidth: 260, textAlign: "right" }}>
          {msg}
        </div>
      )}
    </div>
  );
}

// ========================================================================
// Table 3: Comms Log Grid
// One row per therapist, one column per outreach type. Checkmark + date
// if that type has been sent. Defensive: wrapped in a try-catch so any
// render error shows a fallback message instead of blanking /founder.
// ========================================================================

const COMMS_OUTREACH_COLUMNS = [
  { key: "welcome",                           label: "Welcome",       group: "auto",   short: "W"   },
  { key: "drip_day2",                         label: "Day 2",         group: "auto",   short: "D2"  },
  { key: "drip_day5",                         label: "Day 5",         group: "auto",   short: "D5"  },
  { key: "drip_day10",                        label: "Day 10",        group: "auto",   short: "D10" },
  { key: "drip_day30",                        label: "Day 30",        group: "auto",   short: "D30" },
  { key: "drip_day60",                        label: "Day 60",        group: "auto",   short: "D60" },
  { key: "practice_pulse",                    label: "Pulse",         group: "auto",   short: "PP"  },
  { key: "founder_outreach_checkin",          label: "Check in",      group: "manual", short: "Ci"  },
  { key: "founder_outreach_reminder",         label: "Reminder",      group: "manual", short: "Rm"  },
  { key: "founder_outreach_testimonial",      label: "Testimonial",   group: "manual", short: "Ts"  },
  { key: "founder_outreach_first_session",    label: "First session", group: "manual", short: "Fs"  },
  { key: "founder_outreach_setup_nudge",      label: "Setup nudge",   group: "manual", short: "Sn"  },
  { key: "founder_outreach_churned",          label: "Churned",       group: "manual", short: "Ch"  },
  { key: "founder_outreach_referral_thankyou",label: "Referral thx",  group: "manual", short: "Rt"  },
  { key: "founder_outreach_activation_nudge", label: "Activation",    group: "manual", short: "An"  },
  { key: "founder_outreach_product_update",   label: "Product update",group: "manual", short: "Pu"  },
];

// Map Table 3 manual column keys to founder-outreach action_type values.
// Auto columns fire on cron and aren't in this map (so they render as
// read-only dots when empty).
const MANUAL_COL_TO_ACTION = {
  founder_outreach_checkin:           "checkin",
  founder_outreach_reminder:          "reminder",
  founder_outreach_testimonial:       "testimonial",
  founder_outreach_first_session:     "first_session",
  founder_outreach_setup_nudge:       "setup_nudge",
  founder_outreach_churned:           "churned",
  founder_outreach_referral_thankyou: "referral_thankyou",
  founder_outreach_activation_nudge:  "activation_nudge",
  founder_outreach_product_update:    "product_update",
};

function commsDaysAgoShort(dateStr) {
  try {
    if (!dateStr) return "";
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (isNaN(days)) return "";
    if (days === 0) return "today";
    if (days === 1) return "1d";
    if (days < 30) return days + "d";
    if (days < 365) return Math.floor(days / 30) + "mo";
    return Math.floor(days / 365) + "y";
  } catch (e) {
    return "";
  }
}

function CommsBackfillButton({ onAfterImport }) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);

  const run = async () => {
    if (status === "running") return;
    if (!window.confirm("Import historical email sends from Resend?\n\nPulls up to 1000 recent sends, matches recipients to therapists, and fills in checkmarks for any sends that aren't already logged. Safe to run multiple times (dedupes by provider_id). Takes about 15 seconds.")) {
      return;
    }
    setStatus("running");
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("resend-backfill", { body: {} });

      // Use alert so we know EXACTLY what came back, no matter what UI does next.
      const samplesStr = data?.diagnostics?.samples_inserted?.length
        ? "\n\nSamples inserted:\n" + data.diagnostics.samples_inserted.map((s) => `  ${s.type} → ${s.to} (${s.subject})`).join("\n")
        : "\n\n(no samples this run, likely all were already logged)";
      const unknownStr = data?.diagnostics?.sample_unknown_subjects?.length
        ? "\n\nUnknown subjects (skipped):\n" + data.diagnostics.sample_unknown_subjects.slice(0, 5).map((s) => "  " + s).join("\n")
        : "";
      const errStr = data?.diagnostics?.insert_errors?.length
        ? "\n\nINSERT ERRORS:\n" + data.diagnostics.insert_errors.join("\n")
        : "";
      const debugMsg = [
        "BACKFILL RESPONSE:",
        "error: " + (error ? JSON.stringify(error) : "none"),
        "data.ok: " + (data ? data.ok : "data is null/undefined"),
        "data.inserted: " + (data ? data.inserted : "n/a"),
        "data.total_fetched: " + (data ? data.total_fetched_from_resend : "n/a"),
        "data.skipped_already_logged: " + (data ? data.skipped_already_logged : "n/a"),
        "data.skipped_no_therapist_match: " + (data ? data.skipped_no_therapist_match : "n/a"),
        "data.skipped_unknown_type: " + (data ? data.skipped_unknown_type : "n/a"),
        "therapists_in_db: " + (data?.diagnostics?.therapists_in_db ?? "n/a"),
        "existing_log_provider_ids: " + (data?.diagnostics?.existing_log_provider_ids ?? "n/a"),
      ].join("\n") + samplesStr + unknownStr + errStr;
      window.alert(debugMsg);

      if (error || !data || !data.ok) {
        setStatus("failed");
        setResult({ error: (error && error.message) || (data && data.error) || "see alert above" });
        return;
      }
      setStatus("done");
      setResult(data);
      setTimeout(() => {
        if (onAfterImport) {
          Promise.resolve(onAfterImport()).catch(() => {});
        }
      }, 800);
      setTimeout(() => setStatus("idle"), 30000);
    } catch (e) {
      window.alert("BACKFILL THREW EXCEPTION:\n" + (e?.message || String(e)) + "\n\nStack:\n" + (e?.stack || "no stack"));
      setStatus("failed");
      setResult({ error: (e && e.message) || "invocation failed" });
    }
  };

  const label = status === "running" ? "Importing..."
    : status === "done" ? ("Imported " + (result?.inserted ?? 0) + " " + ((result?.inserted ?? 0) === 1 ? "send" : "sends"))
    : status === "failed" ? "Import failed"
    : "Import from Resend";

  const bg = status === "running" ? C.stale
    : status === "done" ? C.rise
    : status === "failed" ? C.fall
    : C.actionBlue;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
      <button
        onClick={run}
        disabled={status === "running"}
        style={{
          padding: "5px 12px",
          borderRadius: 6,
          border: "none",
          background: bg,
          color: "#fff",
          cursor: status === "running" ? "wait" : "pointer",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
        title="One-shot import of historical Resend sends into the comms log. Idempotent, safe to re-run."
      >
        {label}
      </button>
      {status === "done" && result && (
        <div style={{ fontSize: 10, color: C.gray, fontStyle: "italic", maxWidth: 420, textAlign: "right", lineHeight: 1.5 }}>
          <div>Fetched {result.total_fetched_from_resend} from Resend across {result.pages_fetched} page(s)</div>
          <div>Inserted {result.inserted}, already logged {result.skipped_already_logged}, no therapist match {result.skipped_no_therapist_match}, unknown subject {result.skipped_unknown_type}</div>
          {result.diagnostics?.sample_unknown_subjects?.length > 0 && (
            <details style={{ marginTop: 4, textAlign: "left", color: C.dark }}>
              <summary style={{ cursor: "pointer", color: C.fall, fontWeight: 600 }}>Unknown subjects ({result.diagnostics.sample_unknown_subjects.length})</summary>
              <ul style={{ margin: "4px 0", paddingLeft: 16 }}>
                {result.diagnostics.sample_unknown_subjects.map((s, i) => <li key={i} style={{ fontSize: 10 }}>{s}</li>)}
              </ul>
            </details>
          )}
          {result.diagnostics?.sample_unmatched_recipients?.length > 0 && (
            <details style={{ marginTop: 4, textAlign: "left", color: C.dark }}>
              <summary style={{ cursor: "pointer", color: C.gold, fontWeight: 600 }}>Unmatched recipients ({result.diagnostics.sample_unmatched_recipients.length})</summary>
              <ul style={{ margin: "4px 0", paddingLeft: 16 }}>
                {result.diagnostics.sample_unmatched_recipients.map((s, i) => <li key={i} style={{ fontSize: 10 }}>{s}</li>)}
              </ul>
            </details>
          )}
          {result.diagnostics?.insert_errors?.length > 0 && (
            <details style={{ marginTop: 4, textAlign: "left", color: C.dark }}>
              <summary style={{ cursor: "pointer", color: C.fall, fontWeight: 600 }}>Insert errors ({result.diagnostics.insert_errors.length})</summary>
              <ul style={{ margin: "4px 0", paddingLeft: 16 }}>
                {result.diagnostics.insert_errors.map((s, i) => <li key={i} style={{ fontSize: 10 }}>{s}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
      {status === "failed" && result?.error && (
        <div style={{ fontSize: 10, color: C.fall, maxWidth: 340, textAlign: "right" }}>{result.error}</div>
      )}
    </div>
  );
}

function CommsLogGrid({ rows, updateFlag, onAfterBackfill, queuedCells, toggleCell, clearQueue, onAfterSend, hideOwnHeader = false }) {
  const [sortBy, setSortBy] = useState("name");
  const [hideInactive, setHideInactive] = useState(false);
  const [renderError, setRenderError] = useState(null);
  // Edit-then-send modal state for Table 3 manual cells. When set, opens the
  // existing SendModal so HK can edit subject + body before firing one email.
  const [editCell, setEditCell] = useState(null); // { therapist, actionKey, actionLabel } | null
  const [editSending, setEditSending] = useState(false);
  const [editError, setEditError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(null);

  // Build per-therapist send summary. Everything defensively guarded.
  const rowsWithSends = useMemo(() => {
    try {
      const autoTypes = ["welcome", "drip_day2", "drip_day5", "drip_day10", "drip_day30", "drip_day60", "practice_pulse"];
      const input = Array.isArray(rows) ? rows : [];
      return input.map(function (t) {
        if (!t || typeof t !== "object") {
          return { id: "unknown-" + Math.random(), sendMap: {}, totalSends: 0 };
        }
        const sendMap = {};
        const history = Array.isArray(t.contact_history) ? t.contact_history : [];
        for (let i = 0; i < history.length; i++) {
          const h = history[i];
          if (!h || typeof h !== "object") continue;
          const hType = typeof h.type === "string" ? h.type : "";
          if (!hType) continue;
          const fullKey = autoTypes.indexOf(hType) !== -1 ? hType : ("founder_outreach_" + hType);
          if (!sendMap[fullKey]) sendMap[fullKey] = { count: 0, mostRecent: null, subject: null };
          sendMap[fullKey].count++;
          const sentAt = h.sent_at;
          if (sentAt) {
            try {
              const newTime = new Date(sentAt).getTime();
              if (!isNaN(newTime)) {
                if (!sendMap[fullKey].mostRecent || newTime > new Date(sendMap[fullKey].mostRecent).getTime()) {
                  sendMap[fullKey].mostRecent = sentAt;
                  sendMap[fullKey].subject = h.subject || null;
                }
              }
            } catch (_e) { /* skip bad date */ }
          }
        }
        let total = 0;
        const keys = Object.keys(sendMap);
        for (let k = 0; k < keys.length; k++) total += sendMap[keys[k]].count;
        return Object.assign({}, t, { sendMap: sendMap, totalSends: total });
      });
    } catch (err) {
      setRenderError(err?.message || "failed to build send summary");
      return [];
    }
  }, [rows]);

  const displayRows = useMemo(() => {
    try {
      let r = rowsWithSends || [];
      if (hideInactive) r = r.filter(function (t) { return (t && t.totalSends > 0); });
      if (sortBy === "total_desc") r = r.slice().sort(function (a, b) { return (b?.totalSends || 0) - (a?.totalSends || 0); });
      else if (sortBy === "total_asc") r = r.slice().sort(function (a, b) { return (a?.totalSends || 0) - (b?.totalSends || 0); });
      else if (sortBy === "recent") r = r.slice().sort(function (a, b) {
        const ax = a?.last_contact_at ? new Date(a.last_contact_at).getTime() : 0;
        const bx = b?.last_contact_at ? new Date(b.last_contact_at).getTime() : 0;
        return bx - ax;
      });
      else if (sortBy === "name") r = r.slice().sort(function (a, b) {
        return (a?.business_name || a?.email || "").localeCompare(b?.business_name || b?.email || "");
      });
      return r;
    } catch (err) {
      setRenderError(err?.message || "failed to sort/filter");
      return [];
    }
  }, [rowsWithSends, sortBy, hideInactive]);

  // Batch-send queue derived from parent queuedCells Set. One entry per
  // cell queued for send. Each maps to exactly one founder-outreach call.
  const batchItems = useMemo(function () {
    if (!queuedCells || queuedCells.size === 0) return [];
    const byId = {};
    (rowsWithSends || []).forEach(function (r) { if (r && r.id) byId[r.id] = r; });
    const items = [];
    queuedCells.forEach(function (k) {
      const idx = k.indexOf(":");
      if (idx < 0) return;
      const tid = k.slice(0, idx);
      const colKey = k.slice(idx + 1);
      const actionType = MANUAL_COL_TO_ACTION[colKey];
      const t = byId[tid];
      if (!t || !actionType) return;
      const already = t.sendMap && t.sendMap[colKey] && t.sendMap[colKey].count > 0;
      if (already) return;
      const colInfo = COMMS_OUTREACH_COLUMNS.find(function (c) { return c.key === colKey; });
      items.push({
        cellKey: k,
        therapistId: tid,
        therapistName: t.business_name || t.full_name || t.email || "(unknown)",
        actionType: actionType,
        colLabel: colInfo ? colInfo.label : colKey,
      });
    });
    return items;
  }, [queuedCells, rowsWithSends]);

  // Aggregate: total rows in contact_history across all visible therapists
  const totalHistoryRows = (rowsWithSends || []).reduce(function(sum, t) {
    return sum + (Array.isArray(t?.contact_history) ? t.contact_history.length : 0);
  }, 0);

  // Count therapists with at least one send
  const therapistsWithSends = (rowsWithSends || []).filter(function(t) {
    return Array.isArray(t?.contact_history) && t.contact_history.length > 0;
  }).length;

  // Header area (always rendered so Table 3 shows up even if body errors)
  const header = (
    <div style={{ marginTop: hideOwnHeader ? 0 : 36 }}>
      {/* Fixed diagnostic banner at top of Table 3. Survives scroll-to-top. */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: totalHistoryRows === 0 ? "#FEF3F2" : "#F0FDF4",
        border: "2px solid " + (totalHistoryRows === 0 ? C.fall : C.rise),
        padding: "10px 14px",
        marginBottom: 12,
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 700,
        color: totalHistoryRows === 0 ? C.fall : C.forest,
      }}>
        DIAGNOSTIC: {totalHistoryRows} total comms across {rowsWithSends?.length ?? 0} visible therapists · {therapistsWithSends} therapist(s) have at least one send
      </div>
      {!hideOwnHeader && (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.sage }}>
          Table 3
        </div>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, color: C.dark, margin: "4px 0 0" }}>
          Comms Log
        </h2>
        <p style={{ fontSize: 12, color: C.gray, margin: "4px 0 0" }}>
          Every email sent to each therapist. Auto sends (Welcome, Drip, Pulse) and manual founder outreach side by side. Hover any cell to see subject and date.
        </p>
      </div>
      )}
    </div>
  );

  // If either memo failed, render a clear fallback so /founder stays usable
  if (renderError) {
    return (
      <>
        {header}
        <div style={{ padding: 16, background: "#FEF3F2", border: "1px solid " + C.fall, borderRadius: 8, fontSize: 12, color: C.fall }}>
          Table 3 couldn't render: {renderError}. The rest of /founder is unaffected. Screenshot this message for HK to fix.
        </div>
      </>
    );
  }

  const firstManualIndex = COMMS_OUTREACH_COLUMNS.findIndex(function (c) { return c.group === "manual"; });
  const mint = "#E8F0EA";
  const navyBg = "#E4E8EF";
  const navyText = "#31466B";

  async function runBatch() {
    if (sending || batchItems.length === 0) return;
    const n = batchItems.length;
    const byType = {};
    batchItems.forEach(function (it) { byType[it.colLabel] = (byType[it.colLabel] || 0) + 1; });
    const breakdown = Object.keys(byType).map(function (k) { return k + " (" + byType[k] + ")"; }).join(", ");
    if (!window.confirm("Send " + n + " email" + (n === 1 ? "" : "s") + " now?\n\nBreakdown: " + breakdown + "\n\nFires immediately. Cannot be undone.")) return;

    setSending(true);
    setSendProgress({ done: 0, total: n, results: [] });
    const results = [];
    for (const it of batchItems) {
      try {
        const r = await supabase.functions.invoke("founder-outreach", {
          body: { therapist_id: it.therapistId, action_type: it.actionType },
        });
        if (r.error) {
          results.push({ ...it, status: "failed", error: r.error.message || "transport" });
        } else if (!r.data || !r.data.ok) {
          results.push({ ...it, status: "failed", error: ((r.data && r.data.step) || "?") + ": " + ((r.data && r.data.error) || "send failed") });
        } else {
          results.push({ ...it, status: "sent" });
        }
      } catch (e) {
        results.push({ ...it, status: "failed", error: (e && e.message) || "exception" });
      }
      setSendProgress({ done: results.length, total: n, results: results.slice() });
    }
    setSending(false);
    if (onAfterSend) { try { await onAfterSend(); } catch (_e) { /* non-blocking */ } }
    if (clearQueue) clearQueue();
  }

  const sentCount = sendProgress ? sendProgress.results.filter(function (r) { return r.status === "sent"; }).length : 0;
  const failedCount = sendProgress ? sendProgress.results.filter(function (r) { return r.status === "failed"; }).length : 0;

  return (
    <>
      {header}

      {(batchItems.length > 0 || sending || sendProgress) && (
        <div style={{
          position: "sticky",
          top: 52,
          zIndex: 11,
          background: "#fff",
          border: "2px solid " + C.forest,
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 12,
          boxShadow: "0 4px 16px rgba(42, 87, 65, 0.18)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontFamily: "system-ui" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.forest }}>Batch send</div>
            <div style={{ fontSize: 13, color: C.dark, fontWeight: 600 }}>{batchItems.length} cell{batchItems.length === 1 ? "" : "s"} queued</div>
            <button onClick={runBatch} disabled={sending || batchItems.length === 0} style={{
              padding: "7px 16px",
              background: (sending || batchItems.length === 0) ? C.light : C.forest,
              color: "#fff", border: "none", borderRadius: 6,
              cursor: (sending || batchItems.length === 0) ? "default" : "pointer",
              fontSize: 13, fontWeight: 700,
            }}>
              {sending ? ("Sending " + ((sendProgress && sendProgress.done) || 0) + "/" + ((sendProgress && sendProgress.total) || batchItems.length) + "...") : ("Send " + batchItems.length)}
            </button>
            <button onClick={function () { if (clearQueue) clearQueue(); setSendProgress(null); }} disabled={sending} style={{
              padding: "7px 12px", background: "transparent", color: C.gray,
              border: "1px solid " + C.light, borderRadius: 6,
              cursor: sending ? "default" : "pointer", fontSize: 12,
            }}>Clear</button>
            {sendProgress && (
              <div style={{ marginLeft: "auto", fontSize: 12, color: C.gray }}>
                {sentCount > 0 && <span style={{ color: C.rise, fontWeight: 700, marginRight: 8 }}>{"\u2713"} {sentCount} sent</span>}
                {failedCount > 0 && <span style={{ color: C.fall, fontWeight: 700 }}>{"\u2717"} {failedCount} failed</span>}
              </div>
            )}
          </div>
          {sendProgress && sendProgress.results.length > 0 && (
            <div style={{ marginTop: 10, maxHeight: 140, overflowY: "auto", borderTop: "1px solid " + C.light, paddingTop: 8, fontFamily: "system-ui" }}>
              {sendProgress.results.map(function (r, i) {
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 0", fontSize: 12 }}>
                    <span style={{ width: 16, textAlign: "center", color: r.status === "sent" ? C.rise : C.fall }}>{r.status === "sent" ? "\u2713" : "\u2717"}</span>
                    <span style={{ color: C.dark, fontWeight: 600 }}>{r.therapistName}</span>
                    <span style={{ color: C.gray }}>{"\u00b7"} {r.colLabel}</span>
                    {r.error && <span style={{ color: C.fall }}>{"\u00b7"} {r.error}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {(batchItems.length === 0 && !sending && !sendProgress) && (
        <div style={{
          background: "#FEF9E7",
          border: "2px solid " + C.gold,
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 12,
          fontSize: 12,
          color: "#78350F",
          fontFamily: "system-ui",
          lineHeight: 1.6,
        }}>
          <strong style={{ fontWeight: 700 }}>Batch send:</strong> click any
          {" "}<span style={{ display: "inline-flex", width: 20, height: 20, borderRadius: 3, border: "2px solid " + C.forest, background: "#fff", color: C.forest, alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, lineHeight: 1, verticalAlign: "middle", margin: "0 3px" }}>+</span>{" "}
          cell in the manual columns (Check in through Activation) to queue it. A Send button will appear here once you have queued one or more cells. Sent cells turn into permanent checkmarks.
        </div>
      )}
      <div style={{ marginBottom: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: C.gray, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={hideInactive} onChange={function (e) { setHideInactive(e.target.checked); }} />
          Hide therapists with no sends
        </label>
        <div style={{ fontSize: 12, color: C.gray }}>Sort:</div>
        <select value={sortBy} onChange={function (e) { setSortBy(e.target.value); }} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 4, border: "1px solid " + C.light, background: "#fff" }}>
          <option value="total_desc">Most emails first</option>
          <option value="total_asc">Fewest emails first</option>
          <option value="recent">Most recent contact</option>
          <option value="name">Alphabetical</option>
        </select>
        <div style={{ fontSize: 11, color: C.gray, marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span>Showing {displayRows.length} therapist{displayRows.length === 1 ? "" : "s"}</span>
          <CommsBackfillButton onAfterImport={onAfterBackfill} />
        </div>
      </div>

      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh", border: "1px solid " + C.light, borderRadius: 8, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Georgia, serif", fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.softCream }}>
              <th style={{ textAlign: "left", padding: "10px 10px", borderBottom: "1.5px solid " + C.dark, position: "sticky", top: 0, left: 0, background: C.softCream, zIndex: 4, minWidth: 260 }}>
                Therapist
              </th>
              {COMMS_OUTREACH_COLUMNS.map(function (col, i) {
                return (
                  <th key={col.key} title={col.label} style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 3,
                    textAlign: "center",
                    padding: "8px 4px",
                    borderBottom: "1.5px solid " + C.dark,
                    borderLeft: i === firstManualIndex ? ("2px solid " + C.dark) : ("1px solid " + C.light),
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    color: col.group === "auto" ? C.forest : navyText,
                    textTransform: "uppercase",
                    width: 54,
                    whiteSpace: "nowrap",
                    background: C.softCream,
                  }}>
                    {col.short}
                    <div style={{ fontSize: 9, fontWeight: 400, color: C.gray, textTransform: "none", letterSpacing: 0, marginTop: 2 }}>
                      {col.label}
                    </div>
                  </th>
                );
              })}
              <th style={{ position: "sticky", top: 0, zIndex: 3, textAlign: "center", padding: "8px 10px", borderBottom: "1.5px solid " + C.dark, borderLeft: "2px solid " + C.dark, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: C.dark, textTransform: "uppercase", width: 60, background: C.softCream }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={COMMS_OUTREACH_COLUMNS.length + 2} style={{ padding: 32, textAlign: "center", color: C.gray, fontSize: 12, fontStyle: "italic" }}>
                  {hideInactive
                    ? "No therapists have been emailed yet. Uncheck \"Hide therapists with no sends\" to show all rows."
                    : "No rows to display."}
                </td>
              </tr>
            ) : displayRows.map(function (t, idx) {
              if (!t) return null;
              const zebra = idx % 2 === 1 ? "#FBFAF5" : "#fff";
              return (
                <tr key={t.id || Math.random()} style={{ borderBottom: "1px solid " + C.light, background: zebra }}>
                  <td style={{ padding: "8px 10px", position: "sticky", left: 0, background: zebra, zIndex: 1, borderRight: "1px solid " + C.light }}>
                    <div style={{ fontWeight: 700, color: C.dark, fontSize: 13 }}>
                      {t.business_name || t.full_name || "(no name)"}
                      <FlagBadge flag={t.admin_flag} isDummy={t.is_dummy} unsubscribed={t.email_unsubscribed} />
                    </div>
                    <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{t.email || ""}</div>
                    {t.phone && (
                      <div style={{ fontSize: 11, color: C.sage, marginTop: 2 }}>
                        <a href={"tel:" + (t.phone || "").replace(/\D/g, "")} style={{ color: C.sage, textDecoration: "none" }}>
                          {formatUSPhone(t.phone)}
                        </a>
                      </div>
                    )}
                    <FlagMenu flag={t.admin_flag} onChange={function(f) { if (updateFlag) updateFlag(t.id, f); }} />
                    {t.last_contact_at && (
                      <div style={{ fontSize: 10, color: C.gray, marginTop: 4, fontStyle: "italic" }}>
                        last contact: {commsDaysAgoShort(t.last_contact_at)}
                      </div>
                    )}
                  </td>
                  {COMMS_OUTREACH_COLUMNS.map(function (col, i) {
                    const send = t.sendMap && t.sendMap[col.key];
                    const hasSend = send && send.count > 0;
                    const cellBg = col.group === "auto" ? mint : navyBg;
                    const cellText = col.group === "auto" ? C.forest : navyText;
                    const isManual = col.group === "manual";
                    const cellKey = t.id + ":" + col.key;
                    const isQueued = queuedCells ? queuedCells.has(cellKey) : false;
                    const isClickable = isManual && !hasSend && MANUAL_COL_TO_ACTION[col.key];
                    return (
                      <td key={col.key}
                        onClick={isClickable ? function () {
                          // Open edit-then-send modal so HK can tweak subject + body
                          // before firing one email. Mirrors Table 1 ActionCell pattern.
                          const actionKey = MANUAL_COL_TO_ACTION[col.key];
                          if (!actionKey) return;
                          setEditCell({ therapist: t, actionKey: actionKey, actionLabel: col.label });
                          setEditError("");
                        } : undefined}
                        style={{
                          textAlign: "center",
                          padding: "6px 4px",
                          borderLeft: i === firstManualIndex ? ("2px solid " + C.dark) : ("1px solid " + C.light),
                          verticalAlign: "middle",
                          cursor: isClickable ? "pointer" : "default",
                          background: isQueued ? "#FEF9E7" : undefined,
                        }}>
                        {hasSend ? (
                          <div title={col.label + ": " + send.count + "x, last " + commsDaysAgoShort(send.mostRecent) + (send.subject ? (", " + send.subject) : "")}
                            style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                            <div style={{ width: 20, height: 20, borderRadius: 4, background: cellBg, color: cellText, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
                              {"\u2713"}
                            </div>
                            <div style={{ fontSize: 9, color: C.gray, lineHeight: 1.2 }}>
                              {commsDaysAgoShort(send.mostRecent)}
                              {send.count > 1 && <span style={{ color: C.fall, fontWeight: 700 }}> x{send.count}</span>}
                            </div>
                          </div>
                        ) : isQueued ? (
                          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                            <div style={{ width: 22, height: 22, borderRadius: 4, background: "#FEF3C7", color: "#92400E", border: "2px solid " + C.gold, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>
                              {"\u2713"}
                            </div>
                            <div style={{ fontSize: 9, color: "#92400E", lineHeight: 1.2, fontWeight: 700 }}>queued</div>
                          </div>
                        ) : isClickable ? (
                          <div title={"Click to edit and send " + col.label + " to " + (t.business_name || t.email || "this therapist")}
                            style={{ width: 22, height: 22, borderRadius: 4, border: "2px solid " + C.forest, background: "#fff", color: C.forest, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, lineHeight: 1, margin: "0 auto" }}>+</div>
                        ) : (
                          <div style={{ fontSize: 11, color: "#D5D0C1" }}>.</div>
                        )}
                      </td>
                    );
                  })}
                  <td style={{
                    textAlign: "center",
                    padding: "8px 10px",
                    borderLeft: "2px solid " + C.dark,
                    fontWeight: 800,
                    fontSize: 14,
                    color: t.totalSends > 6 ? C.fall : t.totalSends > 3 ? C.gold : C.forest,
                  }}>
                    {t.totalSends || 0}
                    {/* Debug: show raw contact_history count if it differs from totalSends. If you see "(raw: N)" below a 0,
                        that means rows exist in DB but key reconstruction failed. */}
                    {Array.isArray(t.contact_history) && t.contact_history.length > 0 && t.contact_history.length !== t.totalSends && (
                      <div style={{ fontSize: 9, color: C.fall, fontStyle: "italic", fontWeight: 400 }}>
                        raw: {t.contact_history.length}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 16, fontSize: 11, color: C.gray, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <span style={{ display: "inline-block", width: 10, height: 10, background: mint, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }}></span>
          Auto send (Welcome, Drip, Pulse)
        </div>
        <div>
          <span style={{ display: "inline-block", width: 10, height: 10, background: navyBg, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }}></span>
          Manual send (Founder outreach)
        </div>
        <div><span style={{ color: C.fall, fontWeight: 700 }}>xN</span> = sent N times</div>
        <div><span style={{ color: C.gold, fontWeight: 700 }}>Total 4-6</span> = watch</div>
        <div><span style={{ color: C.fall, fontWeight: 700 }}>Total 7+</span> = likely too many</div>
      </div>

      {editCell && (() => {
        const action = buildActionFor(editCell.actionKey, editCell.therapist);
        if (!action) return null;
        return (
          <SendModal
            t={editCell.therapist}
            action={action}
            sending={editSending}
            errorMsg={editError}
            onClose={() => { setEditCell(null); setEditError(""); }}
            onSend={async ({ subject, body }) => {
              if (editSending) return;
              setEditSending(true);
              setEditError("");
              try {
                const r = await supabase.functions.invoke("founder-outreach", {
                  body: {
                    therapist_id: editCell.therapist.id,
                    action_type: editCell.actionKey,
                    custom_subject: subject,
                    custom_body: body,
                  },
                });
                if (r.error) {
                  setEditError(`transport: ${r.error.message || "unknown"}`);
                } else if (!r.data?.ok) {
                  setEditError(`${r.data?.step || "?"}: ${r.data?.error || "Send failed"}`);
                } else {
                  setEditCell(null);
                  if (onAfterSend) { try { await onAfterSend(); } catch (_e) { /* non-blocking */ } }
                }
              } catch (e) {
                setEditError(e?.message || "Send failed");
              } finally {
                setEditSending(false);
              }
            }}
          />
        );
      })()}
    </>
  );
}
