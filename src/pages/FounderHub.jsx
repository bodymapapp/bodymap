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
import Nav from "../components/Nav";
import MarkdownView from "../components/founder/MarkdownView";
import useGithubMarkdown from "../components/founder/useGithubMarkdown";

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
    id: "therapist-playbook",
    number: 1,
    title: "Therapist Marketing Playbook",
    subtitle: "Seven strategies therapists use to market themselves to their clients, plus other income sources.",
    status: "live",
    type: "markdown",
    path: "docs/MARKETING_THERAPIST_PLAYBOOK.md",
    backupKey: "01-therapist-playbook",
  },
  {
    id: "marketing-mybodymap",
    number: 2,
    title: "MyBodyMap Marketing",
    subtitle: "How we market ourselves. Strategy, voice, competitive positioning, all in one place.",
    status: "live",
    type: "markdown",
    path: "docs/MARKETING_MYBODYMAP.md",
    backupKey: "02-marketing-mybodymap",
  },
  {
    id: "billing-strategy",
    number: 3,
    title: "Billing Strategy",
    subtitle: "Payment processors, capability matrix, competitive analysis, liability.",
    status: "live",
    type: "markdown",
    path: "docs/BILLING_STRATEGY.md",
    backupKey: "03-billing-strategy",
  },
  {
    id: "block-plan",
    number: 4,
    title: "Block Plan",
    subtitle: "Active fires, deferred work, ideas not yet shipped.",
    status: "live",
    type: "markdown",
    path: "BLOCK_PLAN.md",
    backupKey: "04-block-plan",
  },
  {
    id: "taxonomy",
    number: 5,
    title: "Taxonomy",
    subtitle: "Seven product categories, their sub-features, and core differentiation flags.",
    status: "live",
    type: "markdown",
    path: "FEATURES_TAXONOMY.md",
    backupKey: "05-taxonomy",
  },
  {
    id: "founder-dashboard",
    number: 6,
    title: "Founder Dashboard",
    subtitle: "Therapists table, Activation Checklist, Comms Log, mass SMS broadcast tool. Live admin view.",
    status: "live",
    type: "iframe",
    iframeSrc: "/founder",
  },
  {
    id: "email-sms",
    number: 7,
    title: "Email and SMS Review",
    subtitle: "Every email and text the platform sends. Preview, leave feedback, track what needs rewriting.",
    status: "live",
    type: "iframe",
    iframeSrc: "/founder/emails",
  },
  {
    id: "other-docs",
    number: 8,
    title: "Other Documentation",
    subtitle: "Catch-all for anything that does not fit the other nine sections.",
    status: "live",
    type: "markdown",
    path: "docs/OTHER_NOTES.md",
    backupKey: "08-other-notes",
  },
  {
    id: "runbook",
    number: 9,
    title: "Founder Runbook",
    subtitle: "If Claude is unavailable tomorrow, this is the handoff for a human team.",
    status: "live",
    type: "markdown",
    path: "docs/FOUNDER_RUNBOOK.md",
    backupKey: "09-founder-runbook",
  },
  {
    id: "chat",
    number: 10,
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
    path: "docs/CUSTOMER_CHAT_RESEARCH.md",
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
  const [activeSection, setActiveSection] = useState("runbook");
  const currentSection = SECTIONS.find((s) => s.id === activeSection);

  return (
    <>
      <Nav />
      <div style={{
        minHeight: "100vh",
        background: C.paper,
        paddingTop: 80,
      }}>
        <div style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "32px 24px 80px",
        }}>
          <Header />
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 320px) 1fr",
            gap: 24,
            alignItems: "start",
          }}>
            <SectionList
              sections={SECTIONS}
              activeSection={activeSection}
              onSelect={setActiveSection}
            />
            <SectionContent section={currentSection} />
          </div>
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

      {section.type === "markdown" && (
        <MarkdownContent path={section.path} />
      )}

      {section.type === "iframe" && (
        <IframeContent src={section.iframeSrc} />
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
