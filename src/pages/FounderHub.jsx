// src/pages/FounderHub.jsx
//
// The founder operating system. HK's single pane of glass for
// MyBodyMap. Protected by FounderRoute so only HK's account
// can access.
//
// Ten sections per HK direction (May 7, 2026):
//   1. Marketing doc — for therapists
//   2. Marketing doc — for us internally (MyBodyMap team)
//   3. Billing strategy + competitive/market analysis
//   4. Block plan
//   5. Taxonomy (summary + detail)
//   6. Client dashboard (link out to existing /dashboard)
//   7. Email + SMS edits (currently in /dashboard, will be embedded here)
//   8. Catch-all placeholder for other documentation
//   9. Founder Runbook — operational insurance if Claude unavailable
//  10. RAG chat interface (future)
//
// PHASING (HK approved):
//   Session 1 (today): Founder Hub skeleton + Runbook embedded live
//   Session 2: Wire BLOCK_PLAN, CONTRIBUTING, marketing/billing docs
//   Session 3: RAG chat interface
//
// LIVE-DOCUMENT MODEL (Option B agreed):
//   At end of each working session, Claude updates relevant
//   documents reflecting that day's decisions. HK sees them
//   refreshed on next page load. No nightly automation.

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";

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

// Static section definitions. The 10 sections HK asked for.
const SECTIONS = [
  {
    id: "runbook",
    number: 9,
    title: "Founder Runbook",
    subtitle: "If Claude is unavailable tomorrow, this is the handoff document for a human team.",
    status: "live",
    content: "embedded",
    priority: "critical",
  },
  {
    id: "block-plan",
    number: 4,
    title: "Block Plan",
    subtitle: "Active fires, deferred work, ideas not yet shipped.",
    status: "live",
    content: "github",
    githubPath: "BLOCK_PLAN.md",
    priority: "high",
  },
  {
    id: "taxonomy",
    number: 5,
    title: "Taxonomy",
    subtitle: "The seven product categories and their rules.",
    status: "live",
    content: "github",
    githubPath: "CONTRIBUTING.md",
    priority: "high",
  },
  {
    id: "billing-strategy",
    number: 3,
    title: "Billing Strategy",
    subtitle: "Payment processors, capability matrix, competitive analysis, liability.",
    status: "next-session",
    content: "deferred",
    priority: "high",
  },
  {
    id: "marketing-therapists",
    number: 1,
    title: "Marketing — for Therapists",
    subtitle: "Voice, positioning, messaging, value props the therapists hear.",
    status: "next-session",
    content: "deferred",
    priority: "medium",
  },
  {
    id: "marketing-internal",
    number: 2,
    title: "Marketing — Internal",
    subtitle: "How we (MyBodyMap team) think about market segments, channels, growth.",
    status: "next-session",
    content: "deferred",
    priority: "medium",
  },
  {
    id: "email-sms",
    number: 7,
    title: "Email + SMS Editor",
    subtitle: "Broadcast templates, founder messages, automated communication.",
    status: "next-session",
    content: "embed-from-dashboard",
    priority: "medium",
  },
  {
    id: "client-dashboard",
    number: 6,
    title: "Client Dashboard",
    subtitle: "The therapist dashboard you already use. Link below.",
    status: "live",
    content: "external-link",
    externalLink: "/dashboard",
    priority: "low",
  },
  {
    id: "placeholder",
    number: 8,
    title: "Other Documentation",
    subtitle: "Catch-all for anything that does not fit the other nine.",
    status: "next-session",
    content: "deferred",
    priority: "low",
  },
  {
    id: "chat",
    number: 10,
    title: "Ask Anything (Chat)",
    subtitle: "Future: chat interface that answers questions using all the documents above as the corpus.",
    status: "future",
    content: "future",
    priority: "low",
  },
];

export default function FounderHub() {
  const [activeSection, setActiveSection] = useState("runbook");
  const [runbookContent, setRunbookContent] = useState(null);
  const [runbookLoading, setRunbookLoading] = useState(true);
  const [runbookError, setRunbookError] = useState(null);

  // Fetch the runbook from GitHub raw on mount
  useEffect(() => {
    if (activeSection !== "runbook" || runbookContent !== null) return;
    setRunbookLoading(true);
    fetch("https://raw.githubusercontent.com/bodymapapp/bodymap/main/docs/FOUNDER_RUNBOOK.md")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        setRunbookContent(text);
        setRunbookLoading(false);
      })
      .catch((err) => {
        setRunbookError(err.message);
        setRunbookLoading(false);
      });
  }, [activeSection, runbookContent]);

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
            <SectionContent
              section={currentSection}
              runbookContent={runbookContent}
              runbookLoading={runbookLoading}
              runbookError={runbookError}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function Header() {
  return (
    <div style={{ marginBottom: 28 }}>
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
        The founder operating system. Strategy, runbook, taxonomy, marketing, billing, and the dashboard
        all live here. Documents are updated at the end of each working session.
      </p>
    </div>
  );
}

function SectionList({ sections, activeSection, onSelect }) {
  // Sort by priority (critical → high → medium → low)
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...sections].sort((a, b) => {
    const p = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (p !== 0) return p;
    return a.number - b.number;
  });

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
      {sorted.map((s) => (
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
    "next-session": { label: "SOON", color: C.amber, bg: C.amberBg },
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

function SectionContent({ section, runbookContent, runbookLoading, runbookError }) {
  if (!section) return null;

  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: "24px 28px",
      minHeight: 600,
      boxShadow: "0 4px 16px rgba(28, 43, 34, 0.05)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 4,
      }}>
        <div style={{
          fontFamily: "Georgia, serif",
          fontSize: 24,
          fontWeight: 700,
          color: C.forest,
        }}>
          {section.title}
        </div>
      </div>
      <div style={{
        fontSize: 13,
        color: C.gray,
        marginBottom: 24,
        lineHeight: 1.5,
      }}>
        {section.subtitle}
      </div>

      {/* Runbook — fetched from GitHub and rendered as markdown-ish */}
      {section.id === "runbook" && (
        <RunbookContent
          content={runbookContent}
          loading={runbookLoading}
          error={runbookError}
        />
      )}

      {/* GitHub-sourced docs (block plan, taxonomy) — direct link out */}
      {section.content === "github" && (
        <GithubDocPlaceholder githubPath={section.githubPath} />
      )}

      {/* External link (client dashboard) */}
      {section.content === "external-link" && (
        <ExternalLinkContent link={section.externalLink} />
      )}

      {/* Deferred content */}
      {section.content === "deferred" && (
        <DeferredContent />
      )}

      {/* Future content (chat) */}
      {section.content === "future" && (
        <FutureChatContent />
      )}
    </div>
  );
}

function RunbookContent({ content, loading, error }) {
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: C.gray, fontSize: 13 }}>
        Loading runbook from GitHub...
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
      }}>
        Could not load runbook: {error}. View it directly on{" "}
        <a href="https://github.com/bodymapapp/bodymap/blob/main/docs/FOUNDER_RUNBOOK.md"
           target="_blank" rel="noopener noreferrer"
           style={{ color: C.forest, fontWeight: 600 }}>
          GitHub
        </a>.
      </div>
    );
  }
  if (!content) return null;

  return (
    <div>
      <div style={{
        background: C.greenBg,
        border: "1px solid #86EFAC",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 12,
        color: "#14532D",
        marginBottom: 18,
      }}>
        Live document. Last fetched from GitHub on page load. Rendered in plain markdown view below.
        <a
          href="https://github.com/bodymapapp/bodymap/blob/main/docs/FOUNDER_RUNBOOK.md"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: C.forest, fontWeight: 600, marginLeft: 6, textDecoration: "underline" }}
        >
          Edit on GitHub →
        </a>
      </div>
      <pre style={{
        whiteSpace: "pre-wrap",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: 13,
        lineHeight: 1.7,
        color: C.ink,
        margin: 0,
      }}>
        {content}
      </pre>
    </div>
  );
}

function GithubDocPlaceholder({ githubPath }) {
  return (
    <div style={{
      background: C.cream,
      border: `1px dashed ${C.border}`,
      borderRadius: 10,
      padding: 22,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 14, color: C.ink, marginBottom: 10, lineHeight: 1.6 }}>
        This document lives in the repo at <code style={{
          background: "#fff",
          border: `1px solid ${C.border}`,
          padding: "2px 6px",
          borderRadius: 4,
          fontSize: 12,
        }}>{githubPath}</code>
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 14 }}>
        Live rendering inside Founder Hub coming next session. For now, view on GitHub.
      </div>
      <a
        href={`https://github.com/bodymapapp/bodymap/blob/main/${githubPath}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          background: C.forest,
          color: "#fff",
          padding: "10px 20px",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Open on GitHub →
      </a>
    </div>
  );
}

function ExternalLinkContent({ link }) {
  return (
    <div style={{
      background: C.cream,
      border: `1px dashed ${C.border}`,
      borderRadius: 10,
      padding: 22,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 14, color: C.ink, marginBottom: 14, lineHeight: 1.6 }}>
        The therapist dashboard. Where you spend most of your time when actively using MyBodyMap.
      </div>
      <Link
        to={link}
        style={{
          display: "inline-block",
          background: C.forest,
          color: "#fff",
          padding: "10px 20px",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Open dashboard →
      </Link>
    </div>
  );
}

function DeferredContent() {
  return (
    <div style={{
      background: C.amberBg,
      border: "1px dashed #FCD34D",
      borderRadius: 10,
      padding: 22,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 14, color: "#78350F", marginBottom: 6, fontWeight: 600 }}>
        Coming next session
      </div>
      <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.6 }}>
        Per the agreed phasing, this section is deferred to the next working session.
        The Founder Runbook (section 9) and live GitHub docs (Block Plan, Taxonomy) are
        available now.
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
      <div style={{ fontSize: 14, color: C.ink, marginBottom: 6, fontWeight: 600 }}>
        Ask Anything · Future feature
      </div>
      <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.6, maxWidth: 480, margin: "0 auto" }}>
        A chat interface that uses all the documents in this Founder Hub as its corpus
        of knowledge. Ask about strategy, billing, taxonomy, anything documented, and get
        an answer grounded in the actual source documents. Scoped as a real engineering
        project (~1 day) for a future session.
      </div>
    </div>
  );
}
