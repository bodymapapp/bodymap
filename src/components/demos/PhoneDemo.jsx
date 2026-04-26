// src/components/demos/PhoneDemo.jsx
//
// PhoneDemo — visual mockup of MyBodyMap on a phone home screen.
// Shows the icon installed alongside other apps + a stack of incoming
// product notifications. Tap the toggle to switch between "home screen"
// and "lock screen with notifications."

import React, { useState } from "react";

const C = {
  forest: "#2A5741", sage: "#6B9E80", beige: "#F5F0E8",
  gold: "#C9A84C", white: "#FFFFFF", dark: "#0D1F17",
  gray: "#6B7280", lightGray: "#F3F4F6", border: "#E5E7EB",
};

// "Home screen" tile grid: a few iOS-style stand-in app tiles plus MyBodyMap.
const APPS = [
  { name: "Phone",     bg: "linear-gradient(135deg,#34C759,#28A746)", icon: "📞" },
  { name: "Messages",  bg: "linear-gradient(135deg,#5AC8FA,#0A84FF)", icon: "💬" },
  { name: "Mail",      bg: "linear-gradient(135deg,#0A84FF,#0066CC)", icon: "✉️" },
  { name: "Calendar",  bg: "#fff", icon: "📅" },
  { name: "Notes",     bg: "linear-gradient(135deg,#FFE066,#FFC700)", icon: "📓" },
  { name: "Maps",      bg: "linear-gradient(135deg,#9DD9F3,#5AC8FA)", icon: "🗺️" },
  { name: "Camera",    bg: "linear-gradient(135deg,#3A3A3C,#1C1C1E)", icon: "📷" },
  { name: "Photos",    bg: "linear-gradient(135deg,#FF6B9D,#FF2D55)", icon: "🌸" },
  // MyBodyMap — featured tile with the brand color and leaf
  { name: "MyBodyMap", bg: `linear-gradient(135deg,${C.forest},#1E3F2E)`, icon: "🌿", featured: true },
  { name: "Stripe",    bg: "linear-gradient(135deg,#635BFF,#5046E4)", icon: "$" },
  { name: "Cal.com",   bg: "#000", icon: "📆" },
  { name: "Settings",  bg: "linear-gradient(135deg,#8E8E93,#636366)", icon: "⚙️" },
];

const NOTIFICATIONS = [
  {
    time: "now",
    title: "Sarah confirmed her 9:00 AM",
    body: "Body map filled in. Right shoulder flagged again.",
    color: C.forest,
  },
  {
    time: "2m ago",
    title: "Pre-session brief ready",
    body: "Maria L., 12 PM. Lower back focus, deep pressure.",
    color: C.sage,
  },
  {
    time: "1h ago",
    title: "Jennifer paid her deposit",
    body: "$30 captured for tomorrow's 90-min session.",
    color: C.gold,
  },
  {
    time: "this morning",
    title: "Practice Pulse · Friday",
    body: "5 sessions today. 1 lapsed client to nudge. Revenue on pace.",
    color: C.forest,
  },
];

function PhoneDemo() {
  const [view, setView] = useState("home"); // "home" or "notifications"

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0" }}>
      {/* View toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "#fff", padding: 4, borderRadius: 999, border: `1px solid ${C.border}` }}>
        <button
          onClick={() => setView("home")}
          style={{
            background: view === "home" ? C.forest : "transparent",
            color: view === "home" ? "#fff" : C.gray,
            border: "none",
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "system-ui",
          }}
        >
          Home screen
        </button>
        <button
          onClick={() => setView("notifications")}
          style={{
            background: view === "notifications" ? C.forest : "transparent",
            color: view === "notifications" ? "#fff" : C.gray,
            border: "none",
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "system-ui",
          }}
        >
          Notifications
        </button>
      </div>

      {/* Phone frame */}
      <div style={{
        width: 260,
        height: 520,
        background: "#000",
        borderRadius: 36,
        padding: 8,
        boxShadow: "0 20px 50px rgba(28,43,34,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        position: "relative",
      }}>
        <div style={{
          width: "100%",
          height: "100%",
          background: view === "home"
            ? "linear-gradient(180deg, #F4D5B8 0%, #E8B492 50%, #C8A4C8 100%)"
            : "linear-gradient(180deg, #1A1F2E 0%, #2D3548 100%)",
          borderRadius: 28,
          overflow: "hidden",
          position: "relative",
        }}>
          {/* Notch */}
          <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 80, height: 18, background: "#000", borderRadius: 12, zIndex: 2 }} />

          {/* Status bar */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 22px 4px", color: "#fff", fontSize: 11, fontWeight: 600, fontFamily: "system-ui", zIndex: 1, position: "relative" }}>
            <span>9:41</span>
            <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span>·ıll</span>
              <span>📶</span>
              <span>🔋</span>
            </span>
          </div>

          {view === "home" ? (
            /* Home screen tile grid */
            <div style={{ padding: "30px 16px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
                {APPS.map((app, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 11,
                      background: app.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      color: "#fff",
                      fontWeight: 700,
                      boxShadow: app.featured
                        ? "0 0 0 2px rgba(255,255,255,0.95), 0 8px 20px rgba(28,43,34,0.4)"
                        : "0 1px 3px rgba(0,0,0,0.15)",
                      position: "relative",
                    }}>
                      {app.icon}
                    </div>
                    <div style={{
                      fontSize: 9,
                      color: "#fff",
                      textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                      fontFamily: "system-ui",
                      fontWeight: app.featured ? 700 : 500,
                    }}>
                      {app.name}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom dock */}
              <div style={{ position: "absolute", bottom: 18, left: 16, right: 16, background: "rgba(255,255,255,0.25)", backdropFilter: "blur(20px)", borderRadius: 18, padding: 8, display: "flex", justifyContent: "space-around" }}>
                {["📞", "🌐", "💬", "🎵"].map((icon, i) => (
                  <div key={i} style={{ width: 38, height: 38, borderRadius: 9, background: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icon}</div>
                ))}
              </div>
            </div>
          ) : (
            /* Notifications view */
            <div style={{ padding: "40px 12px 16px" }}>
              <div style={{ textAlign: "center", color: "#fff", marginBottom: 16 }}>
                <div style={{ fontSize: 40, fontFamily: "system-ui", fontWeight: 200, lineHeight: 1 }}>9:41</div>
                <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85, marginTop: 4 }}>Friday, April 25</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {NOTIFICATIONS.map((n, i) => (
                  <div key={i} style={{
                    background: "rgba(255,255,255,0.92)",
                    backdropFilter: "blur(20px)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontFamily: "system-ui",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, background: n.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9 }}>🌿</div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: C.gray, textTransform: "uppercase", letterSpacing: 0.4 }}>MyBodyMap</span>
                      <span style={{ fontSize: 10, color: C.gray, marginLeft: "auto" }}>{n.time}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.dark, marginBottom: 1 }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.35 }}>{n.body}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Caption below phone */}
      <div style={{ marginTop: 14, fontSize: 11, color: C.gray, textAlign: "center", fontFamily: "Georgia,serif", fontStyle: "italic", maxWidth: 240 }}>
        Installs to home screen. No app store. Updates instantly.
      </div>
    </div>
  );
}

export default PhoneDemo;
