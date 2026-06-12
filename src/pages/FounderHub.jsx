// src/pages/FounderHub.jsx
//
// The founder operating system. HK's single pane of glass for
// MyBodyMap. Protected by FounderRoute so only HK's account
// can access.
//
// REVISED STRUCTURE (May 7, 2026, post-feedback):
//
//   1. Therapist Marketing Playbook (live, MARKETING_THERAPIST_PLAYBOOK.md)
//      Seven strategies therapists use to market themselves to their
//      own clients. NEW. This is what we share WITH therapists.
//
//   2. MyBodyMap Marketing (live, MARKETING_MYBODYMAP.md)
//      Combined doc: strategy + voice + competitive positioning.
//      Replaces the earlier MARKETING_INTERNAL.md and
//      MARKETING_THERAPISTS.md which have been merged.
//
//   3. Billing Strategy (live, BILLING_STRATEGY.md)
//   4. Block Plan (live, BLOCK_PLAN.md)
//   5. Taxonomy (live, FEATURES_TAXONOMY.md)
//   6. Client Dashboard (live, embedded via iframe)
//   7. Email and SMS Editor (live, embedded via iframe to dashboard)
//   8. Other Documentation (live, OTHER_NOTES.md)
//   9. Founder Runbook (live, FOUNDER_RUNBOOK.md)
//  10. Ask Anything chat (future, Session 3)
//
// PLUS: a "Download all docs" button that exports the entire founder
// corpus as a single concatenated markdown file. Backup mechanism so
// HK can keep a copy in Google Drive, Dropbox, or anywhere offline.
//
// LIVE-DOCUMENT MODEL:
//   At end of each working session, Claude updates relevant
//   markdown documents in /docs reflecting that day's decisions.
//   Founder Hub fetches them from GitHub raw on each page load.
//   No build redeploy needed for content updates.

import React, { useState } from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import MarkdownView from "../components/founder/MarkdownView";
import useGithubMarkdown from "../components/founder/useGithubMarkdown";
import { StripeDebugEmbedded } from "./StripeDebug";
import { RefundReconcileEmbedded } from "./RefundReconcile";
import { FounderIncomeStatementEmbedded } from "./FounderIncomeStatement";
import { AgentBoardEmbedded } from "../components/founder/AgentBoard";

const C = {
  forest: "#2A5741",
  sage:   "#9DAA85",
  ink:    "#1F3A2C",
  gray:   "#6B7280",
  cream:  "#FAF6EE",
  border: "#E5D5C8",
  green:  "#16A34A",
  greenBg:"#DCFCE7",
  amber:  "#D97706",
  amberBg:"#FEF3C7",
  paper:  "#FBFAF6",
};

// Section definitions. Order is the revised 1-10 numbering per HK
// feedback May 7 2026. Each section is either markdown rendered from
// a repo path, an iframe embed, or a future placeholder.
const SECTIONS = [
  {
    id: "agent-board",
    number: "★",
    title: "Agent Board",
    subtitle: "Your command board for the five agents. Add tasks, reorder, mark done, and drill in. The control surface for the whole system.",
    status: "live",
    type: "component",
    component: "agent-board",
  },
  {
    id: "therapist-playbook",
    number: 1,
    title: "Therapist Marketing Playbook",
    subtitle: "Seven strategies therapists use to market themselves to their clients, plus other income sources.",
    status: "live",
    type: "markdown",
    path: "docs/5_reference/MARKETING_THERAPIST_PLAYBOOK.md",
    backupKey: "01-therapist-playbook",
  },
  {
    id: "marketing-mybodymap",
    number: 2,
    title: "MyBodyMap Marketing",
    subtitle: "How we market ourselves. Strategy, voice, competitive positioning, all in one place.",
    status: "live",
    type: "markdown",
    path: "docs/5_reference/MARKETING_MYBODYMAP.md",
    backupKey: "02-marketing-mybodymap",
  },
  {
    id: "billing-strategy",
    number: 3,
    title: "Billing Strategy",
    subtitle: "Payment processors, capability matrix, competitive analysis, liability.",
    status: "live",
    type: "markdown",
    path: "docs/5_reference/BILLING_STRATEGY.md",
    backupKey: "03-billing-strategy",
  },
  {
    id: "billing-rules-matrix",
    number: 3.1,
    title: "Billing & Cancellation Rules Matrix",
    subtitle: "Every cancellation, no-show, reschedule combination and what should happen. Open questions for HK at the bottom. Read before any new rule executes.",
    status: "live",
    type: "html",
    path: "public/docs/BILLING_RULES.html",
    backupKey: "03b-billing-rules",
  },
  {
    id: "notification-map",
    number: 3.2,
    title: "Notification Map",
    subtitle: "Single source of truth for every notification MyBodyMap sends. C-series (client), T-series (therapist), E-series (exceptions). With retention math.",
    status: "live",
    type: "markdown",
    path: "docs/5_reference/NOTIFICATION_MAP.md",
    backupKey: "03c-notification-map",
  },
  {
    id: "client-lifetime-journey",
    number: 3.25,
    title: "Client Lifetime Journey",
    subtitle: "Visual timeline. Every notification plotted from first contact through return-or-goodbye, with the retention math at the end. The strategic companion to the Notification Map.",
    status: "live",
    type: "html",
    path: "public/docs/CLIENT_LIFETIME_JOURNEY.html",
    backupKey: "03e-client-lifetime-journey",
  },
  {
    id: "design-principles",
    number: 3.3,
    title: "Design Principles",
    subtitle: "Rules that exist because we broke them. Seven principles, each with an incident log. Read before adding any new section or template.",
    status: "live",
    type: "markdown",
    path: "docs/1_constitution/DESIGN_PRINCIPLES.md",
    backupKey: "03d-design-principles",
  },
  {
    id: "risk-register",
    number: 3.4,
    title: "Risk Register",
    subtitle: "Known risks: broken or scale-fragile spots not yet fixed. Each entry has a trigger, fix estimate, and status. Append-only, closed risks stay for paper trail.",
    status: "live",
    type: "markdown",
    path: "docs/2_state/RISK_REGISTER.md",
    backupKey: "03f-risk-register",
  },
  {
    id: "future-code-cleanup",
    number: 3.5,
    title: "Future Code Cleanup",
    subtitle: "Deferred refactors and tech debt. Not live bugs: each works today, but the code shape makes a future mistake more likely. Fixed on purpose, later. Append-only, done items keep their commit.",
    status: "live",
    type: "markdown",
    path: "docs/2_state/FUTURE_CODE_CLEANUP.md",
    backupKey: "03g-future-code-cleanup",
  },
  {
    id: "pending-tests",
    number: 3.6,
    title: "Pending Tests",
    subtitle: "Tests we still owe before we fully trust a change. Append-only: done tests keep their date and result, so we know what is actually verified versus assumed.",
    status: "live",
    type: "markdown",
    path: "docs/2_state/PENDING_TESTS.md",
    backupKey: "03h-pending-tests",
  },
  {
    id: "block-plan",
    number: 4,
    title: "Block Plan",
    subtitle: "Active fires, deferred work, ideas not yet shipped.",
    status: "live",
    type: "markdown",
    path: "docs/2_state/BLOCK_PLAN.md",
    backupKey: "04-block-plan",
  },
  {
    id: "taxonomy",
    number: 5,
    title: "Taxonomy",
    subtitle: "Seven product categories, their sub-features, and core differentiation flags.",
    status: "live",
    type: "markdown",
    path: "docs/1_constitution/FEATURES_TAXONOMY.md",
    backupKey: "05-taxonomy",
  },
  {
    id: "competitive-watchlist",
    number: 5.1,
    title: "Competitive Features Watchlist",
    subtitle: "Every feature meaningful competitors offer (Vagaro, MassageBook, Acuity, Cal.com, Calendly, GlossGenius, Mindbody, ClinicSense). What we have, what we are missing, what we intentionally are not building. Read before deciding what to build next.",
    status: "live",
    type: "markdown",
    path: "docs/5_reference/COMPETITIVE_FEATURES_WATCHLIST.md",
    backupKey: "05a-competitive-watchlist",
  },
  {
    id: "founder-dashboard",
    number: 6,
    title: "Founder Dashboard",
    subtitle: "Therapists table, Activation Checklist, Comms Log, mass SMS broadcast tool. Live admin view.",
    status: "live",
    type: "iframe",
    iframeSrc: "/admin",
  },
  {
    id: "email-sms",
    number: 7,
    title: "Email and SMS Review",
    subtitle: "Every email and text the platform sends. Preview, leave feedback, track what needs rewriting.",
    status: "live",
    type: "iframe",
    iframeSrc: "/admin/emails",
  },
  {
    id: "stripe-debug",
    number: 8,
    title: "Stripe Debug",
    subtitle: "Live diagnostics for your Stripe Connect Express account. List every platform account, attach the right one to your therapist row, resume onboarding, or force-set the connected flag. Founder-only escape hatch when a therapist's payments break.",
    status: "live",
    type: "component",
    component: "stripe-debug",
  },
  {
    id: "income-statement",
    number: 9,
    title: "Income Statement",
    subtitle: "Living view of every recurring cost and revenue line: Vercel, Supabase, Resend, Anthropic, Twilio, domain, insurance (queued), legal (queued). Inline-edit any cell to confirm or correct. Claude appends new line items as it learns about them in chats.",
    status: "live",
    type: "component",
    component: "income-statement",
  },
  {
    id: "refund-reconcile",
    number: 10,
    title: "Refund Reconcile",
    subtitle: "Catch refunds issued outside the platform. Picks a therapist, scans their succeeded payments, asks Stripe whether each was refunded, flips matching rows. Idempotent. Use after Stripe Dashboard refunds before the webhook caught them, or anytime the Smart Billing hero drifts from Stripe Dashboard reality.",
    status: "live",
    type: "component",
    component: "refund-reconcile",
  },
  {
    id: "other-docs",
    number: 11,
    title: "Other Documentation",
    subtitle: "Catch-all for anything that does not fit the other ten sections.",
    status: "live",
    type: "markdown",
    path: "docs/5_reference/OTHER_NOTES.md",
    backupKey: "08-other-notes",
  },
  {
    id: "runbook",
    number: 12,
    title: "Founder Runbook",
    subtitle: "If Claude is unavailable tomorrow, this is the handoff for a human team.",
    status: "live",
    type: "markdown",
    path: "docs/2_state/FOUNDER_RUNBOOK.md",
    backupKey: "09-founder-runbook",
  },
  {
    id: "chat",
    number: 13,
    title: "Ask Anything",
    subtitle: "Future: chat interface that uses all the documents above as the corpus.",
    status: "future",
    type: "future",
  },
];

// All paths included in the "Download all docs" backup. Section paths
// plus any additional research artifacts that live outside the 10
// sections (e.g. CUSTOMER_CHAT_RESEARCH which lives under section 8
// Other Documentation as a linked artifact).
const ADDITIONAL_RESEARCH_PATHS = [
  {
    key: "10-customer-chat-research",
    path: "docs/5_reference/CUSTOMER_CHAT_RESEARCH.md",
    title: "Customer Chat Research",
  },
];

const BACKUP_PATHS = [
  ...SECTIONS
    .filter((s) => s.type === "markdown")
    .map((s) => ({ key: s.backupKey, path: s.path, title: s.title })),
  ...ADDITIONAL_RESEARCH_PATHS,
];

export default function FounderHub() {
  const [activeSection, setActiveSection] = useState("agent-board");
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const currentSection = SECTIONS.find((s) => s.id === activeSection);
  const boardFull = activeSection === "agent-board" && !sectionsOpen;

  return (
    <>
      <Nav />
      <Link
        to="/dashboard"
        aria-label="Back to the app"
        style={{
          position: "fixed",
          left: 16,
          bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
          zIndex: 900,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: C.forest,
          color: "#fff",
          textDecoration: "none",
          borderRadius: 999,
          padding: "11px 16px",
          fontSize: 14,
          fontWeight: 700,
          boxShadow: "0 6px 20px rgba(20,40,30,.28)",
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{"\u2190"}</span>
        Back to app
      </Link>
      <div style={{
        minHeight: "100vh",
        background: C.paper,
        paddingTop: 80,
      }}>
        <div style={{
          maxWidth: boardFull ? 1800 : 1280,
          margin: "0 auto",
          padding: "32px 24px 80px",
        }}>
          <Header />
          <Link
            to="/founder/stocktake"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              background: "#2E4636",
              border: "1px solid #2E4636",
              borderRadius: 12,
              padding: "14px 18px",
              marginBottom: 24,
              textDecoration: "none",
              color: "#fff",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.02em", marginBottom: 2 }}>
                Open the live Stock-take
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.85)", lineHeight: 1.5 }}>
                Everything remaining by priority and by ribbon, plus the growth, money, and exit read. Headline numbers pulled live.
              </div>
            </div>
            <span style={{ background: "rgba(255,255,255,.18)", color: "#fff", padding: "8px 14px", borderRadius: 18, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
              Open →
            </span>
          </Link>
          {boardFull ? (
            <div>
              <button
                onClick={() => setSectionsOpen(true)}
                style={{
                  background: "#fff",
                  border: `1px solid ${C.border}`,
                  borderRadius: 9,
                  padding: "7px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.forest,
                  cursor: "pointer",
                  marginBottom: 14,
                }}
              >
                All sections
              </button>
              <SectionContent section={currentSection} />
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "minmax(280px, 320px) 1fr",
              gap: 24,
              alignItems: "start",
            }}>
              <SectionList
                sections={SECTIONS}
                activeSection={activeSection}
                onSelect={(id) => { setActiveSection(id); setSectionsOpen(false); }}
              />
              <SectionContent section={currentSection} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Header() {
  return (
    <div style={{
      marginBottom: 28,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      gap: 24,
      flexWrap: "wrap",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.sage,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          marginBottom: 6,
        }}>
          Founder Hub · Internal
        </div>
        <h1 style={{
          fontFamily: "Georgia, serif",
          fontSize: 32,
          fontWeight: 700,
          color: C.forest,
          margin: 0,
          marginBottom: 8,
        }}>
          Everything in one place.
        </h1>
        <p style={{
          fontSize: 14,
          color: C.gray,
          margin: 0,
          maxWidth: 720,
          lineHeight: 1.6,
        }}>
          The founder operating system. Strategy, runbook, taxonomy, marketing, billing,
          and the dashboard all live here. Documents update at the end of each working
          session and refresh on next page load.
        </p>
      </div>
      <BackupButton />
    </div>
  );
}

function BackupButton() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const downloadBackup = async () => {
    setBusy(true);
    setDone(false);
    try {
      // Fetch every markdown document fresh from GitHub
      const fetches = await Promise.all(
        BACKUP_PATHS.map(async (item) => {
          const resp = await fetch(`https://raw.githubusercontent.com/bodymapapp/bodymap/main/${item.path}`);
          if (!resp.ok) throw new Error(`Failed: ${item.path}`);
          const text = await resp.text();
          return { ...item, text };
        })
      );

      // Build a single concatenated markdown file with clear separators
      const parts = [];
      const now = new Date().toISOString().split("T")[0];
      parts.push(`# MyBodyMap Founder Hub Backup`);
      parts.push("");
      parts.push(`**Backup date:** ${now}`);
      parts.push(`**Source:** https://mybodymap.app/founder`);
      parts.push("");
      parts.push("This file is a snapshot of every document in the Founder Hub at the time of download. Section breaks below indicate where each original document begins. The originals live in the bodymap GitHub repo and are the source of truth; this backup is for offline / Drive / Dropbox storage in case the website is unavailable.");
      parts.push("");
      parts.push("---");
      parts.push("");

      for (const item of fetches) {
        parts.push(`<!-- BEGIN: ${item.path} -->`);
        parts.push("");
        parts.push(item.text);
        parts.push("");
        parts.push(`<!-- END: ${item.path} -->`);
        parts.push("");
        parts.push("---");
        parts.push("");
      }

      const blob = new Blob([parts.join("\n")], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mybodymap-founder-backup-${now}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Backup failed:", err);
      alert(`Backup failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={downloadBackup}
      disabled={busy}
      style={{
        background: done ? C.green : (busy ? C.gray : C.forest),
        color: "#fff",
        border: "none",
        borderRadius: 10,
        padding: "10px 18px",
        fontSize: 13,
        fontWeight: 600,
        cursor: busy ? "default" : "pointer",
        whiteSpace: "nowrap",
        transition: "background 0.2s",
      }}
    >
      {busy ? "Building..." : (done ? "Downloaded ✓" : "↓ Download all docs")}
    </button>
  );
}

function SectionList({ sections, activeSection, onSelect }) {
  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: 8,
      position: "sticky",
      top: 96,
      // HK May 16 2026: scroll bubble fix. The left column needs to
      // scroll internally when its content exceeds the viewport
      // height. Without maxHeight + overflowY, the column was
      // position:sticky but the inner content was hidden below the
      // fold and any scroll attempt bubbled to the page, dragging
      // the right column with it. We cap height at viewport minus
      // top offset (96px sticky + ~24px breathing) and let the
      // inner list scroll its own overflow.
      maxHeight: "calc(100vh - 120px)",
      overflowY: "auto",
      overscrollBehavior: "contain",
      boxShadow: "0 4px 16px rgba(28, 43, 34, 0.05)",
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: C.gray,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        padding: "10px 12px 6px",
      }}>
        Sections
      </div>
      {sections.map((s) => (
        <SectionListItem
          key={s.id}
          section={s}
          active={activeSection === s.id}
          onClick={() => onSelect(s.id)}
        />
      ))}
    </div>
  );
}

function SectionListItem({ section, active, onClick }) {
  const statusBadge = {
    live: { label: "LIVE", color: C.green, bg: C.greenBg },
    future: { label: "FUTURE", color: C.gray, bg: "#F3F4F6" },
  }[section.status];

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        background: active ? C.cream : "transparent",
        border: "none",
        borderRadius: 10,
        padding: "12px 14px",
        cursor: "pointer",
        marginBottom: 2,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        transition: "background 0.15s",
      }}
    >
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: active ? C.forest : "#F0EFEC",
        color: active ? "#fff" : C.gray,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Georgia, serif",
        fontSize: 14,
        fontWeight: 700,
        flexShrink: 0,
        marginTop: 1,
      }}>
        {section.number}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 2,
          flexWrap: "wrap",
        }}>
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.ink,
          }}>
            {section.title}
          </span>
          <span style={{
            fontSize: 8,
            fontWeight: 800,
            color: statusBadge.color,
            background: statusBadge.bg,
            padding: "2px 6px",
            borderRadius: 99,
            letterSpacing: 0.5,
          }}>
            {statusBadge.label}
          </span>
        </div>
        <div style={{
          fontSize: 11,
          color: C.gray,
          lineHeight: 1.4,
        }}>
          {section.subtitle}
        </div>
      </div>
    </button>
  );
}

function SectionContent({ section }) {
  if (!section) return null;

  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: section.type === "iframe" ? "16px 16px 0" : "24px 28px",
      minHeight: 600,
      boxShadow: "0 4px 16px rgba(28, 43, 34, 0.05)",
    }}>
      <div style={{
        fontFamily: "Georgia, serif",
        fontSize: 24,
        fontWeight: 700,
        color: C.forest,
        marginBottom: 4,
      }}>
        {section.title}
      </div>
      <div style={{
        fontSize: 13,
        color: C.gray,
        marginBottom: section.type === "iframe" ? 14 : 24,
        lineHeight: 1.5,
      }}>
        {section.subtitle}
      </div>

      {/* HK May 19 2026: link the interactive Compliance Dashboard
          from the Notification Map section so the strategic doc and
          the live 28x7 matrix sit side by side. The dashboard lives
          at /founder/notifications with end-to-end fire validation
          per channel. */}
      {section.id === "notification-map" && (
        <Link
          to="/founder/notifications"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: "#F0F6EE",
            border: "1px solid #B7D1AB",
            borderRadius: 12,
            padding: "14px 18px",
            marginBottom: 24,
            textDecoration: "none",
            color: C.forest,
            transition: "background 0.15s ease, transform 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#E5F0E0")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#F0F6EE")}
        >
          <div>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.forest,
              marginBottom: 2,
              letterSpacing: "0.02em",
            }}>
              Open the live Compliance Dashboard
            </div>
            <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.5 }}>
              28 touchpoints × 7 channels matrix, auto-fire validation, sender + destination card. The runtime view of this map.
            </div>
          </div>
          <span style={{
            background: C.forest,
            color: "#fff",
            padding: "8px 14px",
            borderRadius: 18,
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}>
            Open →
          </span>
        </Link>
      )}

      {section.type === "markdown" && (
        <MarkdownContent path={section.path} />
      )}

      {section.type === "html" && (
        <HtmlDocContent path={section.path} />
      )}

      {section.type === "iframe" && (
        <IframeContent src={section.iframeSrc} />
      )}

      {section.type === "component" && section.component === "stripe-debug" && (
        <StripeDebugEmbedded />
      )}

      {section.type === "component" && section.component === "income-statement" && (
        <FounderIncomeStatementEmbedded />
      )}

      {section.type === "component" && section.component === "refund-reconcile" && (
        <RefundReconcileEmbedded />
      )}

      {section.type === "component" && section.component === "agent-board" && (
        <AgentBoardEmbedded />
      )}

      {section.type === "future" && (
        <FutureChatContent />
      )}
    </div>
  );
}

function MarkdownContent({ path }) {
  const { content, loading, error } = useGithubMarkdown(path);

  if (loading) {
    return (
      <div style={{
        padding: 40,
        textAlign: "center",
        color: C.gray,
        fontSize: 13,
      }}>
        Loading from GitHub...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: C.amberBg,
        border: "1px solid #FCD34D",
        borderRadius: 10,
        padding: 16,
        fontSize: 12,
        color: "#78350F",
        lineHeight: 1.6,
      }}>
        Could not load document: {error}.
        {" "}
        <a
          href={`https://github.com/bodymapapp/bodymap/blob/main/${path}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: C.forest, fontWeight: 600 }}
        >
          View on GitHub
        </a>.
      </div>
    );
  }

  return (
    <div>
      <SourceHeader path={path} />
      <MarkdownView source={content} />
    </div>
  );
}

function SourceHeader({ path }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      background: C.greenBg,
      border: "1px solid #86EFAC",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 12,
      color: "#14532D",
      marginBottom: 22,
      flexWrap: "wrap",
    }}>
      <div>
        Live document. Fetched from <code style={{
          background: "#fff",
          padding: "1px 6px",
          borderRadius: 4,
          fontSize: 11,
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
        }}>{path}</code> on page load.
      </div>
      <a
        href={`https://github.com/bodymapapp/bodymap/blob/main/${path}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: C.forest,
          fontWeight: 600,
          textDecoration: "underline",
          textUnderlineOffset: 2,
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        Edit on GitHub
      </a>
    </div>
  );
}

// Iframe-embedded section. Used for the client dashboard and email/SMS
// editor so HK stays inside the Founder Hub URL. The iframe loads the
// real /dashboard route in isolation; auth state is shared via cookies.
//
// The 'allow' attribute permits clipboard + payment APIs the dashboard
// uses (e.g. copy booking link, Stripe Connect flow). Sandbox is NOT
// applied because the iframe is same-origin and we trust our own dashboard.
function IframeContent({ src }) {
  return (
    <div style={{
      borderRadius: 10,
      overflow: "hidden",
      border: `1px solid ${C.border}`,
      background: "#fff",
    }}>
      <iframe
        title="Embedded dashboard"
        src={src}
        style={{
          width: "100%",
          height: "calc(100vh - 240px)",
          minHeight: 600,
          border: "none",
          display: "block",
        }}
        allow="clipboard-read; clipboard-write; payment"
      />
    </div>
  );
}

// HTML documents are too dense to render inside a sub-iframe with
// the Founder Hub chrome around them. HK May 16 2026: 'Very hard
// to read. Standalone did not work which is needed given the
// depth here.' So instead of an embed: a hero card with a
// prominent 'Open in new tab' button.
//
// The 'Standalone did not work' part: the previous build linked
// to raw.githubusercontent.com, which serves HTML as text/plain.
// The browser showed the source code, not the rendered doc. Fix:
// the HTML file now lives at public/docs/{file}.html so Vercel
// serves it with Content-Type: text/html, and the link targets
// the live site path (e.g. /docs/BILLING_RULES.html).
//
// Tradeoff: anything in public/ is technically accessible to
// anyone who guesses the URL. The doc itself is labeled internal;
// it's not linked from any public surface, not in sitemap.xml,
// not in robots. If HK wants stronger gating later, we can build
// an authenticated /api/founder-doc proxy.
function HtmlDocContent({ path }) {
  // Strip 'public/' prefix to get the live URL on the deployed site.
  // E.g. 'public/docs/BILLING_RULES.html' → '/docs/BILLING_RULES.html'
  const liveUrl = path.startsWith("public/")
    ? "/" + path.slice("public/".length)
    : "/" + path;
  const filename = path.split("/").pop();

  return (
    <div style={{
      background: `linear-gradient(180deg, ${C.cream} 0%, #FBFAF4 100%)`,
      border: `1.5px solid ${C.sageBorder || "#A8C8B0"}`,
      borderRadius: 14,
      padding: "36px 32px",
      textAlign: "center",
      boxShadow: "0 6px 18px rgba(74, 107, 84, 0.10)",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700,
        color: C.sage,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        marginBottom: 12,
      }}>
        ★ Standalone HTML document
      </div>
      <h3 style={{
        fontFamily: "Georgia, serif",
        fontWeight: 400,
        fontSize: 22,
        color: C.forest,
        margin: "0 0 14px",
      }}>
        This document is best read in its own tab.
      </h3>
      <p style={{
        fontSize: 14,
        color: C.gray,
        lineHeight: 1.65,
        maxWidth: 520,
        margin: "0 auto 24px",
      }}>
        It uses its own typography, table layouts, and anchor navigation that
        do not survive being embedded inside another page. Open the standalone
        version below to read it properly.
      </p>
      <a
        href={liveUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          background: C.forest,
          color: "#fff",
          padding: "14px 28px",
          borderRadius: 10,
          fontSize: 15,
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: "0 4px 14px rgba(42, 87, 65, 0.22)",
          marginBottom: 14,
        }}
      >
        <span>Open {filename}</span>
        <span aria-hidden="true">↗</span>
      </a>
      <div style={{
        fontSize: 12,
        color: C.gray,
        fontStyle: "italic",
        fontFamily: "Georgia, serif",
        marginTop: 8,
      }}>
        Tip: bookmark the URL after it opens. You can come back without going
        through Founder Hub.
      </div>
      <div style={{
        marginTop: 28,
        padding: "14px 18px",
        background: "#fff",
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        fontSize: 12,
        color: C.gray,
        textAlign: "left",
        maxWidth: 520,
        margin: "28px auto 0",
      }}>
        <div style={{ fontWeight: 700, color: C.forest, marginBottom: 6 }}>
          Direct URLs
        </div>
        <div style={{ fontFamily: "SF Mono, Consolas, monospace", fontSize: 11.5, lineHeight: 1.8 }}>
          <div>Live: <a href={liveUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.forest }}>{liveUrl}</a></div>
          <div>Source: <a href={`https://github.com/bodymapapp/bodymap/blob/main/${path}`} target="_blank" rel="noopener noreferrer" style={{ color: C.forest }}>github.com/.../{filename}</a></div>
        </div>
      </div>
    </div>
  );
}

function FutureChatContent() {
  return (
    <div style={{
      background: "#F3F4F6",
      border: "1px dashed #D1D5DB",
      borderRadius: 10,
      padding: 22,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
      <div style={{
        fontSize: 14,
        color: C.ink,
        marginBottom: 6,
        fontWeight: 600,
      }}>
        Ask Anything · Future feature
      </div>
      <div style={{
        fontSize: 12,
        color: C.gray,
        lineHeight: 1.7,
        maxWidth: 480,
        margin: "0 auto",
      }}>
        A chat interface that uses all the documents in this Founder Hub as its corpus
        of knowledge. Ask about strategy, billing, taxonomy, anything documented, and get
        an answer grounded in the actual source documents. Scoped as Session 3 of the
        Founder Hub build.
      </div>
    </div>
  );
}
