// src/components/demos/AutomationHub.jsx
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

// Fade in when scrolled into view. Mirrors the pattern in PatternDemo.
function useFadeIn(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setVisible(true); }),
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function AutomationHub() {
  const [active, setActive] = useState(0);
  const [ref, visible] = useFadeIn();
  const flows = [
    {
      icon:"🍂",
      title:"Lapsed Client Re-engagement",
      trigger:"Client hasn't booked in 30 days",
      steps:[
        { icon:"🔍", label:"MyBodyMap detects", desc:"Automatically flags clients whose visit interval has broken" },
        { icon:"🤖", label:"AI drafts message", desc:"Personalized SMS using their name, last focus area, and session history" },
        { icon:"✋", label:"You approve", desc:"One tap to review and send - or edit before sending" },
        { icon:"📱", label:"Client receives", desc:"Personal message arrives. They tap the intake link. They book." },
      ],
      result:"avg 67% of lapsed clients re-book within 48 hours"
    },
    {
      icon:"📋",
      title:"Pre-Session Intelligence",
      trigger:"Client appointment is in under 24 hours",
      steps:[
        { icon:"📅", label:"Session detected", desc:"MyBodyMap sees an upcoming appointment from your schedule" },
        { icon:"⚡", label:"Brief auto-assembled", desc:"All session history, body maps, patterns, and preferences compiled" },
        { icon:"🧠", label:"AI adds insight", desc:"Pattern trends and pressure changes highlighted for the therapist" },
        { icon:"📲", label:"Ready on your phone", desc:"Open the pre-session brief in one tap before you walk in" },
      ],
      result:"walk in knowing everything. zero prep time."
    },
    {
      icon:"💌",
      title:"Post-Session Client Summary",
      trigger:"Therapist marks session complete",
      steps:[
        { icon:"✅", label:"Session marked done", desc:"Therapist taps Mark Complete in the dashboard" },
        { icon:"📄", label:"Brief auto-generated", desc:"Today's body map + pattern history + therapist notes compiled" },
        { icon:"📤", label:"Sent to client", desc:"Client receives their personal body story after every session" },
        { icon:"❤️", label:"Client shares", desc:"Clients share briefs with friends - word-of-mouth built in" },
      ],
      result:"clients who receive briefs are 3x more likely to rebook"
    },
    {
      icon:"🌟",
      title:"New Client First Impression",
      trigger:"New client books for the first time",
      steps:[
        { icon:"🔗", label:"Intake link sent", desc:"Your mybodymap.app/name link automatically goes to new clients" },
        { icon:"🗺️", label:"Client maps their body", desc:"30 seconds on their phone - focus, avoid, pressure, preferences" },
        { icon:"🧾", label:"Brief ready before arrival", desc:"You open their profile before the session. Already prepared." },
        { icon:"🤝", label:"Instant trust built", desc:"Clients feel remembered from session one. Retention starts here." },
      ],
      result:"first-session retention improves by 40% with pre-session intake"
    },
  ];

  const flow = flows[active];

  return (
    <div ref={ref}>
      <div style={{ display:"flex", gap:8, marginBottom:28, flexWrap:"wrap" }}>
        {flows.map((f,i)=>(
          <button key={i} onClick={()=>setActive(i)} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 18px", borderRadius:50, border:`1.5px solid ${active===i?C.forest:C.border}`, background:active===i?C.forest:"#fff", color:active===i?"#fff":C.dark, fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.2s" }}>
            <span>{f.icon}</span> {f.title.split(" ").slice(0,2).join(" ")}
          </button>
        ))}
      </div>

      <div style={{ background:"#fff", borderRadius:20, padding:"24px 20px", boxShadow:"0 8px 40px rgba(0,0,0,0.08)", border:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
          <div style={{ fontSize:32 }}>{flow.icon}</div>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:C.dark, fontFamily:"Georgia, serif", lineHeight:1.2 }}>{flow.title}</div>
            <div style={{ fontSize:12, color:C.gray }}>Triggers when: <strong>{flow.trigger}</strong></div>
          </div>
        </div>
        <div style={{ height:2, background:`linear-gradient(90deg, ${C.forest}, ${C.sage}, transparent)`, borderRadius:99, marginBottom:24 }}/>

        {/* Workflow row: horizontal scroll-snap on narrow screens, fits naturally on wide */}
        <div style={{ display:"flex", gap:0, overflowX:"auto", scrollSnapType:"x mandatory", paddingBottom:8, position:"relative" }}>
          {/* Connecting line behind circles (animated draw left-to-right) */}
          <div style={{ position:"absolute", top:28, left:"7%", right:"7%", height:2, background:C.border, borderRadius:99, zIndex:0 }}>
            <div style={{ height:"100%", width:visible?"100%":"0%", background:`linear-gradient(90deg, ${C.forest}, ${C.sage})`, borderRadius:99, transition:"width 1.4s ease 0.4s" }}/>
          </div>
          {flow.steps.map((step,i)=>(
            <div key={`${active}-${i}`} style={{ flex:1, minWidth:130, scrollSnapAlign:"start", display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", padding:"0 8px", position:"relative", zIndex:1 }}>
              <div style={{ width:56, height:56, borderRadius:"50%", background:C.forest, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, marginBottom:12, boxShadow:"0 4px 16px rgba(42,87,65,0.3)", transform:visible?"scale(1)":"scale(0)", opacity:visible?1:0, transition:`transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.2+i*0.15}s, opacity 0.3s ease ${0.2+i*0.15}s` }}>
                {step.icon}
              </div>
              <div style={{ fontSize:12, fontWeight:700, color:C.dark, marginBottom:4, opacity:visible?1:0, transition:`opacity 0.4s ease ${0.5+i*0.15}s` }}>{step.label}</div>
              <div style={{ fontSize:11, color:C.gray, lineHeight:1.4, opacity:visible?1:0, transition:`opacity 0.4s ease ${0.6+i*0.15}s` }}>{step.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop:24, background:"linear-gradient(135deg, #F0FDF4, #DCFCE7)", borderRadius:12, padding:"14px 20px", display:"flex", alignItems:"center", gap:12, opacity:visible?1:0, transform:visible?"translateY(0)":"translateY(10px)", transition:"opacity 0.6s ease 1.0s, transform 0.6s ease 1.0s" }}>
          <div style={{ fontSize:20 }}>📊</div>
          <div style={{ fontSize:14, fontWeight:600, color:C.forest }}>Result: {flow.result}</div>
        </div>
      </div>
    </div>
  );
}

// ── GROWTH ENGINE ─────────────────────────────────────────────────────────────

export default AutomationHub;
