// src/components/Nav.js
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const C = { sage: "#6B9E80", forest: "#2A5741", gray: "#6B7280", white: "#FFFFFF" };

export default function Nav() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: "/", label: "Home" },
    { to: "/#features", label: "Features", anchor: true },
    { to: "/pricing", label: "Pricing" },
    { to: "/why-bodymap", label: "Why BodyMap" },
    { to: "/contact", label: "Contact" },
  ];

  const isActive = (to) => location.pathname === to;

  return (
    <nav style={{ background: C.white, borderBottom: "1px solid #e5e7eb", padding: "16px 0", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Logo */}
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
          <span style={{ fontSize: "24px" }}>🌿</span>
          <span style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: "700", color: C.forest }}>BodyMap</span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }} className="desktop-nav">
          {links.map(l => l.anchor
            ? <a key={l.to} href={l.to} style={{ color: C.gray, textDecoration: "none", fontWeight: "500", fontSize: "15px" }}>{l.label}</a>
            : <Link key={l.to} to={l.to} style={{ color: isActive(l.to) ? C.forest : C.gray, textDecoration: "none", fontWeight: isActive(l.to) ? "700" : "500", fontSize: "15px" }}>{l.label}</Link>
          )}
        </div>

        {/* Auth buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link to="/login" style={{ color: C.gray, textDecoration: "none", fontWeight: "500", fontSize: "15px" }}>Log In</Link>
          <Link to="/signup" style={{ background: C.sage, color: C.white, padding: "10px 20px", borderRadius: "8px", textDecoration: "none", fontWeight: "600", fontSize: "15px" }}>Get Started</Link>
        </div>
      </div>
    </nav>
  );
}
