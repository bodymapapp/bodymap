// src/components/Nav.js
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import BMLogo from "./BMLogo";

const C = { sage: "#6B9E80", forest: "#2A5741", gray: "#6B7280", gold: "#C9A84C", white: "#FFFFFF" };

export default function Nav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: "/", label: "Home" },
    { to: "/features", label: "Features" },
    { to: "/why-bodymap", label: "Why MyBodyMap" },
    { to: "/comparison", label: "Comparison" },
    { to: "/pricing", label: "Pricing" },
    { to: "/playbooks", label: "Playbooks" },
    { to: "/help", label: "Help" },
  ];

  const isActive = (to) => location.pathname === to || (to === "/" && location.pathname === "/");

  function goHome(e) {
    e.preventDefault();
    navigate("/");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 10);
    setMenuOpen(false);
  }

  function handleNavClick(l, e) {
    setMenuOpen(false);
    if (l.anchor) {
      e.preventDefault();
      if (location.pathname !== "/") {
        navigate("/");
        setTimeout(() => {
          const el = document.getElementById("features");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 150);
      } else {
        const el = document.getElementById("features");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }
    }
  }

  return (
    <nav style={{
      background: C.white,
      borderBottom: "1px solid #e5e7eb",
      // Respect iOS safe-area-inset-top so the nav content (logo +
      // hamburger) does not slide behind the system status bar
      // (LTE indicator, battery, time). iPhone X+ has a non-trivial
      // notch / Dynamic Island that can be 30-50px tall in Safari.
      // The fallback is the previous 16px so non-notched browsers
      // are unchanged.
      padding: "max(16px, env(safe-area-inset-top, 16px)) 0 16px 0",
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
    }}>
      <style>{`
        @media (max-width: 768px) {
          .bm-desktop-nav { display: none !important; }
          .bm-desktop-auth { display: none !important; }
          .bm-hamburger { display: flex !important; }
        }
        @media (min-width: 769px) {
          .bm-hamburger { display: none !important; }
          .bm-mobile-menu { display: none !important; }
        }
      `}</style>

      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        // Side padding also respects safe area for landscape orientation
        // where the notch sits on the left side.
        padding: "0 max(24px, env(safe-area-inset-left, 24px)) 0 max(24px, env(safe-area-inset-right, 24px))",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        {/* Logo - always goes to top of home */}
        <a href="/" onClick={goHome} style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <BMLogo size={44} variant="dark" showWordmark={true} showTagline={true} />
        </a>

        {/* Desktop links */}
        <div className="bm-desktop-nav" style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          {links.map(l => l.anchor
            ? <a key={l.to} href={l.to} onClick={(e) => handleNavClick(l, e)} style={{ color: C.gray, textDecoration: "none", fontWeight: "500", fontSize: "15px" }}>{l.label}</a>
            : <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)} style={{ color: isActive(l.to) ? C.forest : C.gray, textDecoration: "none", fontWeight: isActive(l.to) ? "700" : "500", fontSize: "15px", display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {l.label}
                {l.badge === 'new' && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: '#fff',
                    background: C.gold,
                    padding: '2px 6px',
                    borderRadius: 3,
                    textTransform: 'uppercase',
                  }}>New</span>
                )}
              </Link>
          )}
        </div>

        {/* Desktop auth */}
        <div className="bm-desktop-auth" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link to="/login" style={{ color: C.gray, textDecoration: "none", fontWeight: "500", fontSize: "15px" }}>Log In</Link>
          <Link to="/signup" style={{ background: C.sage, color: C.white, padding: "10px 20px", borderRadius: "8px", textDecoration: "none", fontWeight: "600", fontSize: "15px" }}>Get Started</Link>
        </div>

        {/* Hamburger */}
        <button className="bm-hamburger" onClick={() => setMenuOpen(v => !v)} style={{ display: "none", flexDirection: "column", gap: "5px", background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
          <span style={{ display: "block", width: "24px", height: "2px", background: menuOpen ? C.forest : C.gray, transition: "all 0.2s", transform: menuOpen ? "rotate(45deg) translate(5px, 5px)" : "none" }}/>
          <span style={{ display: "block", width: "24px", height: "2px", background: C.gray, transition: "all 0.2s", opacity: menuOpen ? 0 : 1 }}/>
          <span style={{ display: "block", width: "24px", height: "2px", background: menuOpen ? C.forest : C.gray, transition: "all 0.2s", transform: menuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none" }}/>
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div className="bm-mobile-menu" style={{ background: C.white, borderTop: "1px solid #e5e7eb", padding: "16px 24px", display: "flex", flexDirection: "column", gap: "0" }}>
          {links.map(l => l.anchor
            ? <a key={l.to} href={l.to} onClick={(e) => handleNavClick(l, e)} style={{ color: C.gray, textDecoration: "none", fontWeight: "500", fontSize: "16px", padding: "14px 0", borderBottom: "1px solid #f3f4f6" }}>{l.label}</a>
            : <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)} style={{ color: isActive(l.to) ? C.forest : C.gray, textDecoration: "none", fontWeight: isActive(l.to) ? "700" : "500", fontSize: "16px", padding: "14px 0", borderBottom: "1px solid #f3f4f6", display: 'flex', alignItems: 'center', gap: 8 }}>
                {l.label}
                {l.badge === 'new' && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: '#fff',
                    background: C.gold,
                    padding: '2px 6px',
                    borderRadius: 3,
                    textTransform: 'uppercase',
                  }}>New</span>
                )}
              </Link>
          )}
          <div style={{ display: "flex", gap: "12px", paddingTop: "16px" }}>
            <Link to="/login" onClick={() => setMenuOpen(false)} style={{ flex: 1, textAlign: "center", color: C.forest, textDecoration: "none", fontWeight: "600", fontSize: "15px", padding: "12px", border: `2px solid ${C.forest}`, borderRadius: "8px" }}>Log In</Link>
            <Link to="/signup" onClick={() => setMenuOpen(false)} style={{ flex: 1, textAlign: "center", background: C.sage, color: C.white, padding: "12px", borderRadius: "8px", textDecoration: "none", fontWeight: "600", fontSize: "15px" }}>Get Started</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
