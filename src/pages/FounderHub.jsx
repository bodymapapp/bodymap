// src/pages/FounderHub.jsx
//
// The founder operating system. HK's single pane of glass for
// MyBodyMap. Protected by FounderRoute so only HK's account
// can access.
//
// Ten sections per HK direction (May 7, 2026):
//   1. Marketing for therapists (live, docs/MARKETING_THERAPISTS.md)
//   2. Marketing internal (live, docs/MARKETING_INTERNAL.md)
//   3. Billing strategy (live, docs/BILLING_STRATEGY.md)
//   4. Block plan (live, BLOCK_PLAN.md)
//   5. Taxonomy (live, CONTRIBUTING.md)
//   6. Client dashboard (live, link out to /dashboard)
//   7. Email + SMS editor (live, link out to dashboard editor)
//   8. Other documentation (live, docs/OTHER_NOTES.md)
//   9. Founder Runbook (live, docs/FOUNDER_RUNBOOK.md)
//  10. Ask Anything chat (future, Session 3)
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

// Section definitions in HK's original 1-10 numbering.
const SECTIONS = [
  {
    id: "marketing-therapists",
    number: 1,
    title: "Marketing for Therapists",
    subtitle: "Voice, positioning, and the case for switching. What therapists hear from us.",
    status: "live",
    type: "markdown",
    path: "docs/MARKETING_THERAPISTS.md",
  },
  {
    id: "marketing-internal",
    number: 2,
    title: "Marketing Internal",
    subtitle: "How we think about market segments, channels, and growth metrics.",
    status: "live",
    type: "markdown",
    path: "docs/MARKETING_INTERNAL.md",
  },
  {
    id: "billing-strategy",
    number: 3,
    title: "Billing Strategy",
    subtitle: "Payment processors, capability matrix, competitive analysis, liability.",
    status: "live",
    type: "markdown",
    path: "docs/BILLING_STRATEGY.md",
  },
  {
    id: "block-plan",
    number: 4,
    title: "Block Plan",
    subtitle: "Active fires, deferred work, ideas not yet shipped.",
    status: "live",
    type: "markdown",
    path: "BLOCK_PLAN.md",
  },
  {
    id: "taxonomy",
    number: 5,
    title: "Taxonomy",
    subtitle: "The seven product categories and the rules for adding to them.",
    status: "live",
    type: "markdown",
    path: "CONTRIBUTING.md",
  },
  {
    id: "client-dashboard",
    number: 6,
    title: "Client Dashboard",
    subtitle: "The therapist dashboard you already use. Link below.",
    status: "live",
    type: "external",
    link: "/dashboard",
    linkLabel: "Open dashboard",
    body: "The therapist dashboard. Where you spend most of your time when actively using MyBodyMap. Lives at /dashboard, opens in this tab.",
  },
  {
    id: "email-sms",
    number: 7,
    title: "Email and SMS Editor",
    subtitle: "Broadcast templates, founder messages, automated communication.",
    status: "live",
    type: "external",
    link: "/dashboard?section=communication",
    linkLabel: "Open editor in dashboard",
    body: "Broadcast templates and the automated message editor live inside the main therapist dashboard. The editor is coupled to therapist state (which client list to send to, which automation to attach a template to) so we link out rather than embed. Voice rules and template patterns are documented in Marketing for Therapists (section 1) and the email-voice-guide.md file in repo.",
  },
  {
    id: "other-docs",
    number: 8,
    title: "Other Documentation",
    subtitle: "Catch-all for anything that does not fit the other nine sections.",
    status: "live",
    type: "markdown",
    path: "docs/OTHER_NOTES.md",
  },
  {
    id: "runbook",
    number: 9,
    title: "Founder Runbook",
    subtitle: "If Claude is unavailable tomorrow, this is the handoff for a human team.",
    status: "live",
    type: "markdown",
    path: "docs/FOUNDER_RUNBOOK.md",
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
        all live here. Documents update at the end of each working session and refresh on next page load.
      </p>
    </div>
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
      padding: "24px 28px",
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
        marginBottom: 24,
        lineHeight: 1.5,
      }}>
        {section.subtitle}
      </div>

      {section.type === "markdown" && (
        <MarkdownContent path={section.path} />
      )}

      {section.type === "external" && (
        <ExternalContent
          link={section.link}
          linkLabel={section.linkLabel}
          body={section.body}
        />
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

function ExternalContent({ link, linkLabel, body }) {
  return (
    <div style={{
      background: C.cream,
      border: `1px dashed ${C.border}`,
      borderRadius: 10,
      padding: 22,
    }}>
      <div style={{
        fontSize: 14,
        color: C.ink,
        marginBottom: 16,
        lineHeight: 1.7,
      }}>
        {body}
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
        {linkLabel} →
      </Link>
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
