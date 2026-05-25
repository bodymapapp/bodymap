// src/components/HelpWidget.jsx
//
// Floating help widget that lives bottom-right on public marketing
// pages. Two actions: "Search help" (opens /help) and "Email us"
// (mailto with pre-filled context).
//
// Per HK direction:
//   - Mounted on Home, Features, Pricing only
//   - NOT on Dashboard (therapists have PracticeIQ there)
//   - NOT on auth pages (signup, login - distraction-free)
//   - NOT on Founder Hub (internal)
//
// Per CUSTOMER_CHAT_RESEARCH.md decision:
//   - Email-first, not AI chat
//   - Joy persona owns the relationship at this stage
//   - Stage 2 (AI escalation) deferred until 500+ therapists or
//     30+ emails/week
//
// To turn this on globally, add it to a route in App.js or wrap
// individual pages. Currently each page that wants the widget
// imports it explicitly. Default is OFF until HK confirms.

import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const C = {
  forest: "#2A5741",
  sage:   "#9DAA85",
  ink:    "#1F3A2C",
  gray:   "#6B7280",
  cream:  "#FAF6EE",
  border: "#E5D5C8",
  white:  "#FFFFFF",
};

export default function HelpWidget() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Close panel on route change (so widget state is fresh per page)
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Build pre-filled mailto with current page context
  const buildMailto = () => {
    const subject = encodeURIComponent("Question about MyBodyMap");
    const pageContext = typeof window !== "undefined" ? window.location.href : "";
    const body = encodeURIComponent(
      `Hi MyBodyMap team,\n\n[Your question here]\n\n` +
      `---\n` +
      `Sent from: ${pageContext}\n`
    );
    return `mailto:hello@mybodymap.app?subject=${subject}&body=${body}`;
  };

  const handleSearchHelp = () => {
    setOpen(false);
    navigate("/help");
  };

  return (
    <>
      {open && (
        <Panel
          onSearchHelp={handleSearchHelp}
          mailto={buildMailto()}
          onClose={() => setOpen(false)}
        />
      )}
      <FloatingButton open={open} onClick={() => setOpen(!open)} />
    </>
  );
}

function FloatingButton({ open, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={open ? "Close help" : "Open help"}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        background: C.forest,
        color: C.white,
        border: "none",
        boxShadow: "0 6px 20px rgba(28, 43, 34, 0.25)",
        cursor: "pointer",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        transition: "transform 0.18s, background 0.18s",
        transform: open ? "rotate(45deg)" : "rotate(0deg)",
      }}
      onMouseEnter={(e) => {
        if (!open) e.target.style.transform = "scale(1.05)";
      }}
      onMouseLeave={(e) => {
        if (!open) e.target.style.transform = "scale(1)";
      }}
    >
      {open ? "✕" : "?"}
    </button>
  );
}

function Panel({ onSearchHelp, mailto, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 96,
        right: 24,
        width: 320,
        maxWidth: "calc(100vw - 48px)",
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        boxShadow: "0 12px 40px rgba(28, 43, 34, 0.18)",
        zIndex: 9998,
        overflow: "hidden",
        animation: "helpwidget-rise 0.22s ease-out",
      }}
    >
      <style>{`
        @keyframes helpwidget-rise {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{
        padding: "18px 20px 14px",
        background: C.cream,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.sage,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 4,
        }}>
          Need help?
        </div>
        <div style={{
          fontFamily: "Georgia, serif",
          fontSize: 18,
          fontWeight: 700,
          color: C.forest,
          lineHeight: 1.3,
        }}>
          Two ways we can help.
        </div>
      </div>

      <div style={{ padding: 14 }}>
        <ActionButton
          icon="🔍"
          title="Search help articles"
          subtitle="Browse our help center"
          onClick={onSearchHelp}
        />
        <a
          href={mailto}
          onClick={onClose}
          style={{ textDecoration: "none", display: "block" }}
        >
          <ActionButton
            icon="✉"
            title="Email us"
            subtitle="Personal reply within 24 hours"
            asLink
          />
        </a>
      </div>

      <div style={{
        padding: "12px 20px 16px",
        borderTop: `1px solid ${C.border}`,
        fontSize: 11,
        color: C.gray,
        lineHeight: 1.5,
        textAlign: "center",
      }}>
        We read every email and reply personally. Usually within 24 hours during business days.
      </div>
    </div>
  );
}

function ActionButton({ icon, title, subtitle, onClick, asLink }) {
  const Component = asLink ? "div" : "button";
  return (
    <Component
      onClick={onClick}
      style={{
        width: "100%",
        background: "transparent",
        border: `1.5px solid ${C.border}`,
        borderRadius: 12,
        padding: "12px 14px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 8,
        textAlign: "left",
        transition: "border-color 0.15s, background 0.15s",
        fontFamily: "system-ui",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = C.forest;
        e.currentTarget.style.background = C.cream;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: C.cream,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: C.ink,
          marginBottom: 2,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 11,
          color: C.gray,
          lineHeight: 1.4,
        }}>
          {subtitle}
        </div>
      </div>
      <div style={{
        color: C.gray,
        fontSize: 14,
        flexShrink: 0,
      }}>
        →
      </div>
    </Component>
  );
}
