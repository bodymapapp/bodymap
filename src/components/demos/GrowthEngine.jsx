// src/components/demos/GrowthEngine.jsx
// Extracted from the legacy Features.jsx for reuse on Home (product tour) and
// inside FeaturesV2 modals.
//
// Palette inlined locally to keep demos self-contained.

import React, { useState, useEffect, useRef } from "react";

const C = {
  forest: "#2A5741", sage: "#6B9E80", beige: "#F5F0E8",
  gold: "#C9A84C", white: "#FFFFFF", dark: "#0D1F17",
  gray: "#6B7280", lightGray: "#F3F4F6", border: "#E5E7EB",
};

function GrowthEngine() {
  const retention = [
    { icon:"🔮", title:"Churn Prediction", desc:"MyBodyMap AI detects when a regular client breaks their visit pattern - 7 days before they would have ghosted. You reach out first." },
    { icon:"📈", title:"Pressure Trend Alerts", desc:"When a client's pressure preference escalates (3→5 over 8 sessions), MyBodyMap flags it. You adjust before they find someone who does deep tissue better." },
    { icon:"💌", title:"Milestone Moments", desc:"10th session, 1-year anniversary, returning after a break - MyBodyMap identifies these moments and drafts a personalized message. Clients feel seen." },
    { icon:"🎁", title:"Re-engagement Campaigns", desc:"One tap launches a personalized outreach to all lapsed clients - not a mass text, a message that references their specific body history." },
  ];
  const growth = [
    { icon:"🔗", title:"Your Intake Link = Marketing", desc:"mybodymap.app/yourname is your professional identity. Share it on Instagram, your email signature, anywhere. Clients tap it to see how it works - and book." },
    { icon:"📄", title:"Post-Session Briefs Go Viral", desc:"Clients share their body summaries with friends. 'My therapist sent me this after every session.' That's word-of-mouth you can't buy." },
    { icon:"⭐", title:"Review Triggers (coming soon)", desc:"After session 3, MyBodyMap prompts clients to leave a Google review - timed when satisfaction is highest. Your 5-star count grows automatically." },
    { icon:"👥", title:"Referral Intelligence (coming soon)", desc:"MyBodyMap identifies your top clients and makes it easy for them to refer friends. Each referral arrives with a completed intake form - warm leads, ready to book." },
  ];

  return (
    <div>
      <div className="bm-features-testimonials" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:48 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
            <div style={{ width:4, height:28, background:C.forest, borderRadius:99 }}/>
            <h3 style={{ fontFamily:"Georgia, serif", fontSize:22, fontWeight:700, color:C.dark, margin:0 }}>Keep Every Client</h3>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {retention.map((r,i)=>(
              <div key={i} style={{ display:"flex", gap:14, padding:"16px 20px", background:"#fff", borderRadius:14, border:`1px solid ${C.border}`, boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize:28, flexShrink:0 }}>{r.icon}</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.dark, marginBottom:4 }}>{r.title}</div>
                  <div style={{ fontSize:13, color:C.gray, lineHeight:1.5 }}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
            <div style={{ width:4, height:28, background:C.gold, borderRadius:99 }}/>
            <h3 style={{ fontFamily:"Georgia, serif", fontSize:22, fontWeight:700, color:C.dark, margin:0 }}>Attract New Ones</h3>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {growth.map((g,i)=>(
              <div key={i} style={{ display:"flex", gap:14, padding:"16px 20px", background:"#fff", borderRadius:14, border:`1px solid ${C.border}`, boxShadow:"0 2px 8px rgba(0,0,0,0.05)", opacity:g.title.includes("coming")?0.75:1, height:"100%", boxSizing:"border-box" }}>
                <div style={{ fontSize:28, flexShrink:0 }}>{g.icon}</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.dark, marginBottom:4 }}>{g.title}</div>
                  <div style={{ fontSize:13, color:C.gray, lineHeight:1.5 }}>{g.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SECTION NAV ───────────────────────────────────────────────────────────────

export default GrowthEngine;
