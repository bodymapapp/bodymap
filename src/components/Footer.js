// src/components/Footer.js
import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer style={{ background: "#1A2F23", color: "white", padding: "48px 24px 32px" }}>
      <style>{`
        @media (max-width: 768px) {
          .bm-footer-grid { flex-direction: column !important; gap: 24px !important; }
          .bm-footer-bottom { flex-direction: column !important; text-align: center !important; gap: 8px !important; }
        }
      `}</style>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div className="bm-footer-grid" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "32px", marginBottom: "40px" }}>
          <div>
            <Link to="/" onClick={() => window.scrollTo(0,0)} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", textDecoration: "none", color: "white" }}>
              <span style={{ fontSize: "24px" }}>🌿</span>
              <span style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: "700" }}>BodyMap</span>
            </Link>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", maxWidth: "200px", lineHeight: 1.6 }}>Modern intake forms for massage therapists.</p>
          </div>
          <div>
            <p style={{ fontWeight: "700", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px", color: "rgba(255,255,255,0.5)" }}>Product</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <a href="/#features" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: "14px" }}>Features</a>
              <Link to="/pricing" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: "14px" }}>Pricing</Link>
              <Link to="/why-bodymap" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: "14px" }}>Why BodyMap</Link>
            </div>
          </div>
          <div>
            <p style={{ fontWeight: "700", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px", color: "rgba(255,255,255,0.5)" }}>Company</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Link to="/contact" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: "14px" }}>Contact</Link>
              <Link to="/privacy" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: "14px" }}>Privacy Policy</Link>
              <Link to="/terms" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: "14px" }}>Terms of Service</Link>
            </div>
          </div>
          <div>
            <p style={{ fontWeight: "700", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px", color: "rgba(255,255,255,0.5)" }}>Account</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Link to="/login" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: "14px" }}>Log In</Link>
              <Link to="/signup" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: "14px" }}>Sign Up Free</Link>
            </div>
          </div>
        </div>
        <div className="bm-footer-bottom" style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>© 2026 BodyMap. All rights reserved.</p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>Made with 🌿 for massage therapists</p>
        </div>
      </div>
    </footer>
  );
}
