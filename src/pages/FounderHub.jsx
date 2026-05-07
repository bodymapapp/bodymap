// src/pages/FounderHub.jsx
//
// The founder operating system. HK's single pane of glass for
// MyBodyMap. Protected by FounderRoute so only HK's account
// can access.
//
// Ten sections per HK direction (May 7, 2026):
//   1. Marketing doc, for therapists  (LIVE, fetched from repo)
//   2. Marketing doc, internal  (LIVE, fetched from repo)
//   3. Billing strategy + competitive/market analysis  (LIVE, fetched from repo)
//   4. Block plan  (LIVE, fetched from repo)
//   5. Taxonomy summary + detail  (LIVE, fetched from repo)
//   6. Client dashboard  (LIVE, link to /dashboard)
//   7. Email + SMS edits  (LIVE, link to Dashboard editor)
//   8. Catch-all placeholder  (LIVE, repo doc index)
//   9. Founder Runbook  (LIVE, fetched from repo)
//  10. Ask Anything chat  (LIVE, calls founder-chat edge function)
//
// LIVE-DOCUMENT MODEL: documents are fetched fresh from GitHub raw
// on every section open. HK updates docs at end of each session;
// next page load picks up the latest state. No nightly automation.

import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
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

const SECTIONS = [
  {
    id: "runbook",
    number: 9,
    title: "Founder Runbook",
    subtitle: "If Claude is unavailable tomorrow, this is the handoff document for a human team.",
    status: "live",
    githubPath: "docs/FOUNDER_RUNBOOK.md",
    priority: "critical",
  },
  {
    id: "block-plan",
    number: 4,
    title: "Block Plan",
    subtitle: "Active fires, deferred work, ideas not yet shipped.",
    status: "live",
    githubPath: "BLOCK_PLAN.md",
    priority: "high",
  },
  {
    id: "taxonomy",
    number: 5,
    title: "Taxonomy",
    subtitle: "The seven categories, rules for adding, design principles.",
    status: "live",
    githubPath: "CONTRIBUTING.md",
    priority: "high",
  },
  {
    id: "billing-strategy",
    number: 3,
    title: "Billing Strategy",
    subtitle: "Payment processors, capability matrix, competitive analysis, liability.",
    status: "live",
    githubPath: "docs/BILLING_STRATEGY.md",
    priority: "high",
  },
  {
    id: "marketing-therapists",
    number: 1,
    title: "Marketing for Therapists",
    subtitle: "Voice, positioning, messaging, value props the therapists hear.",
    status: "live",
    githubPath: "docs/MARKETING_THERAPISTS.md",
    priority: "medium",
  },
  {
    id: "marketing-internal",
    number: 2,
    title: "Marketing Internal",
    subtitle: "How we (MyBodyMap team) think about market segments, channels, growth.",
    status: "live",
    githubPath: "docs/MARKETING_INTERNAL.md",
    priority: "medium",
  },
  {
    id: "email-sms",
    number: 7,
    title: "Email + SMS Editor",
    subtitle: "Broadcast templates, founder messages, automated communication.",
    status: "live",
    renderType: "email-sms-link",
    priority: "medium",
  },
  {
    id: "client-dashboard",
    number: 6,
    title: "Client Dashboard",
    subtitle: "The therapist dashboard you already use. Link below.",
    status: "live",
    externalLink: "/dashboard",
    priority: "low",
  },
  {
    id: "placeholder",
    number: 8,
    title: "Other Documentation",
    subtitle: "Index of all documentation in the repository.",
    status: "live",
    renderType: "doc-index",
    priority: "low",
  },
  {
    id: "chat",
    number: 10,
    title: "Ask Anything",
    subtitle: "Chat with all founder documents as the knowledge base.",
    status: "live",
    renderType: "chat",
    priority: "high",
  },
];

const GITHUB_RAW = "https://raw.githubusercontent.com/bodymapapp/bodymap/main";

export default function FounderHub() {
  const [activeSection, setActiveSection] = useState("runbook");
  const [docCache, setDocCache] = useState({});

  useEffect(() => {
    const section = SECTIONS.find((s) => s.id === activeSection);
    if (!section?.githubPath) return;
    if (docCache[activeSection]) return;

    setDocCache((prev) => ({ ...prev, [activeSection]: { loading: true } }));
    fetch(`${GITHUB_RAW}/${section.githubPath}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((content) => {
        setDocCache((prev) => ({ ...prev, [activeSection]: { content, loading: false } }));
      })
      .catch((err) => {
        setDocCache((prev) => ({ ...prev, [activeSection]: { error: err.message, loading: false } }));
      });
  }, [activeSection, docCache]);

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
              docCacheEntry={docCache[activeSection]}
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
        Founder Hub, Internal
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
        The founder operating system. Strategy, runbook, taxonomy, marketing, billing, and a chat interface
        that answers questions using all of it as the knowledge corpus. Documents are updated at the end of
        each working session.
      </p>
    </div>
  );
}

function SectionList({ sections, activeSection, onSelect }) {
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
      maxHeight: "calc(100vh - 120px)",
      overflowY: "auto",
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
          <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{section.title}</span>
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
        <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.4 }}>
          {section.subtitle}
        </div>
      </div>
    </button>
  );
}

function SectionContent({ section, docCacheEntry }) {
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
      <div style={{ fontSize: 13, color: C.gray, marginBottom: 24, lineHeight: 1.5 }}>
        {section.subtitle}
      </div>

      {section.githubPath && (
        <MarkdownDocViewer githubPath={section.githubPath} cacheEntry={docCacheEntry} />
      )}
      {section.renderType === "email-sms-link" && <EmailSmsLink />}
      {section.renderType === "doc-index" && <DocIndex />}
      {section.renderType === "chat" && <ChatInterface />}
      {section.externalLink && <ExternalLinkContent link={section.externalLink} />}
    </div>
  );
}

function MarkdownDocViewer({ githubPath, cacheEntry }) {
  if (!cacheEntry || cacheEntry.loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: C.gray, fontSize: 13 }}>
        Loading from GitHub...
      </div>
    );
  }
  if (cacheEntry.error) {
    return (
      <div style={{
        background: C.amberBg,
        border: "1px solid #FCD34D",
        borderRadius: 10,
        padding: 16,
        fontSize: 12,
        color: "#78350F",
      }}>
        Could not load: {cacheEntry.error}. View directly on{" "}
        <a href={`https://github.com/bodymapapp/bodymap/blob/main/${githubPath}`}
           target="_blank" rel="noopener noreferrer"
           style={{ color: C.forest, fontWeight: 600 }}>
          GitHub
        </a>.
      </div>
    );
  }

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
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
      }}>
        <span>Live document. Last fetched from GitHub on page load.</span>
        <a
          href={`https://github.com/bodymapapp/bodymap/blob/main/${githubPath}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: C.forest, fontWeight: 600, textDecoration: "underline" }}
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
        {cacheEntry.content}
      </pre>
    </div>
  );
}

function EmailSmsLink() {
  return (
    <div style={{
      background: C.cream,
      border: `1px dashed ${C.border}`,
      borderRadius: 10,
      padding: 22,
    }}>
      <div style={{ fontSize: 14, color: C.ink, marginBottom: 12, lineHeight: 1.6 }}>
        The Email and SMS broadcast editor lives inside the main therapist Dashboard. You can
        compose Joy-voice broadcasts, schedule sends, view drafts, and edit templates there.
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 16, lineHeight: 1.6 }}>
        The voice guide for what tone and structure to use is in <code style={inlineCodeStyle}>docs/email-voice-guide.md</code>.
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link to="/dashboard" style={primaryLinkStyle}>Open Dashboard →</Link>
        <a
          href="https://github.com/bodymapapp/bodymap/blob/main/docs/email-voice-guide.md"
          target="_blank"
          rel="noopener noreferrer"
          style={secondaryLinkStyle}
        >
          View voice guide
        </a>
      </div>
    </div>
  );
}

function DocIndex() {
  const docs = [
    { path: "docs/FOUNDER_RUNBOOK.md", title: "Founder Runbook", description: "Comprehensive operational handoff document." },
    { path: "BLOCK_PLAN.md", title: "Block Plan", description: "Active fires, deferred work, future ideas." },
    { path: "CONTRIBUTING.md", title: "Taxonomy + Design Principles", description: "Seven-category taxonomy rules and the five design principles." },
    { path: "ENVIRONMENT.md", title: "Environment Variables", description: "Canonical secrets list." },
    { path: "docs/BILLING_STRATEGY.md", title: "Billing Strategy", description: "Payment processors, capability matrix, competitive analysis, liability." },
    { path: "docs/MARKETING_THERAPISTS.md", title: "Marketing for Therapists", description: "Voice, positioning, messaging therapists hear." },
    { path: "docs/MARKETING_INTERNAL.md", title: "Marketing Internal", description: "How we think about market segments, channels, growth." },
    { path: "docs/email-voice-guide.md", title: "Email Voice Guide", description: "Joy persona email broadcast structure and rules." },
    { path: "research/competitive-analysis-2026-04.md", title: "Competitive Analysis (Apr 2026)", description: "Full deep dive on direct competitors." },
    { path: "research/noterro-competitive-analysis-2026-04.md", title: "Noterro Deep Dive (Apr 2026)", description: "Specific competitive analysis on Noterro." },
  ];

  return (
    <div>
      <div style={{
        fontSize: 12,
        color: C.gray,
        marginBottom: 16,
        lineHeight: 1.6,
        fontStyle: "italic",
      }}>
        Every documentation file in the repository. Click to view on GitHub. Add new docs here
        as we ship them.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {docs.map((d) => (
          <a
            key={d.path}
            href={`https://github.com/bodymapapp/bodymap/blob/main/${d.path}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              padding: "12px 16px",
              background: C.cream,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              textDecoration: "none",
              transition: "background 0.15s",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
              {d.title}
            </div>
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 4, lineHeight: 1.5 }}>
              {d.description}
            </div>
            <div style={{ fontSize: 11, color: C.sage, fontFamily: "monospace" }}>
              {d.path}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function ChatInterface() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const newMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError("Not authenticated. Please log in again.");
        setLoading(false);
        return;
      }

      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || "";
      const res = await fetch(`${supabaseUrl}/functions/v1/founder-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`HTTP ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.message }]);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const SUGGESTED = [
    "What is our current marketing voice in one sentence?",
    "What are the open risks I should know about?",
    "Why did we decide to skip ACH?",
    "Summarize the seven taxonomy categories.",
  ];

  return (
    <div>
      <div style={{
        background: C.cream,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 18,
        marginBottom: 16,
        fontSize: 12,
        color: C.gray,
        lineHeight: 1.6,
      }}>
        Asks Claude using the runbook, block plan, taxonomy, billing strategy, and both marketing
        documents as the knowledge corpus. Responses cite which document they draw from when
        relevant. Documents are loaded fresh from GitHub on every question.
      </div>

      <div style={{
        background: "#fff",
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        minHeight: 320,
        maxHeight: 520,
        overflowY: "auto",
        padding: messages.length === 0 ? 24 : 16,
        marginBottom: 12,
      }}>
        {messages.length === 0 ? (
          <div>
            <div style={{
              fontSize: 13,
              color: C.gray,
              marginBottom: 16,
              lineHeight: 1.6,
            }}>
              Start a conversation. Try one of these:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  style={{
                    background: C.cream,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 12,
                    color: C.ink,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <ChatMessage key={i} role={m.role} content={m.content} />
          ))
        )}
        {loading && (
          <div style={{ padding: 12, color: C.gray, fontSize: 12, fontStyle: "italic" }}>
            Thinking...
          </div>
        )}
        {error && (
          <div style={{
            background: "#FEE2E2",
            border: "1px solid #FCA5A5",
            borderRadius: 8,
            padding: 10,
            fontSize: 12,
            color: "#991B1B",
            margin: "8px 0",
          }}>
            Error: {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about the founder docs..."
          rows={2}
          style={{
            flex: 1,
            border: `1.5px solid ${C.border}`,
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            fontFamily: "inherit",
            resize: "vertical",
            minHeight: 48,
            outline: "none",
            color: C.ink,
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          style={{
            background: input.trim() && !loading ? C.forest : "#D1D5DB",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "0 22px",
            fontSize: 13,
            fontWeight: 700,
            cursor: input.trim() && !loading ? "pointer" : "default",
            transition: "background 0.15s",
            alignSelf: "stretch",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function ChatMessage({ role, content }) {
  const isUser = role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 12,
    }}>
      <div style={{
        maxWidth: "85%",
        background: isUser ? C.forest : C.cream,
        color: isUser ? "#fff" : C.ink,
        border: isUser ? "none" : `1px solid ${C.border}`,
        borderRadius: 14,
        padding: "10px 14px",
        fontSize: 13,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
      }}>
        {content}
      </div>
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
      <Link to={link} style={primaryLinkStyle}>Open Dashboard →</Link>
    </div>
  );
}

const primaryLinkStyle = {
  display: "inline-block",
  background: "#2A5741",
  color: "#fff",
  padding: "10px 20px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
};

const secondaryLinkStyle = {
  display: "inline-block",
  background: "#fff",
  color: "#2A5741",
  border: "1.5px solid #2A5741",
  padding: "10px 20px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
};

const inlineCodeStyle = {
  background: "#fff",
  border: "1px solid #E5D5C8",
  padding: "2px 6px",
  borderRadius: 4,
  fontSize: 11,
  fontFamily: "monospace",
};
