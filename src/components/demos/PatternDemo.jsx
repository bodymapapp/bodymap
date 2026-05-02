// src/components/demos/PatternDemo.jsx
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

// Local helper: fade in when scrolled into view (extracted from legacy
// Features.jsx). Used by PatternDemo to animate its initial reveal.
function useFadeIn(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setVisible(true); });
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function PatternDemo() {
  const patterns = [
    { area:"Lower Back", count:9, total:10, trend:"↑", note:"Chronic" },
    { area:"Neck", count:8, total:10, trend:"→", note:"Consistent" },
    { area:"Left Shoulder", count:7, total:10, trend:"↑", note:"Worsening" },
    { area:"Upper Back", count:5, total:10, trend:"→", note:"Stable" },
    { area:"Hips", count:4, total:10, trend:"↓", note:"Improving" },
  ];
  const avoids = [
    { area:"Knees", count:10, total:10 },
    { area:"Abdomen", count:7, total:10 },
  ];
  const pressureData = [3, 3, 4, 4, 4, 4, 5, 5, 5, 5];
  const [ref, visible] = useFadeIn();

  return (
    <div ref={ref} style={{ background:"#fff", borderRadius:20, padding:24, boxShadow:"0 12px 48px rgba(0,0,0,0.14)", maxWidth:440, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.dark }}>📊 Sarah M. - Pattern Intelligence</div>
        <div style={{ background:"#DCFCE7", color:"#16A34A", borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>10 sessions</div>
      </div>
      <div style={{ fontSize:12, color:C.gray, marginBottom:20 }}>Patterns detected across 10 sessions · Member since Aug 2025</div>

      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#16A34A", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>🎯 Recurring Focus Areas</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {patterns.map((p,i) => (
            <div key={p.area}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, alignItems:"center" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:C.dark }}>{p.area}</span>
                  <span style={{ fontSize:10, color:p.trend==="↑"?"#DC2626":p.trend==="↓"?"#16A34A":"#D97706", fontWeight:700 }}>{p.trend}</span>
                  <span style={{ background:p.note==="Chronic"?"#FEE2E2":p.note==="Worsening"?"#FEF3C7":"#F3F4F6", color:p.note==="Chronic"?"#DC2626":p.note==="Worsening"?"#D97706":"#6B7280", fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:4 }}>{p.note}</span>
                </div>
                <span style={{ fontSize:12, color:C.gray }}>{p.count}/{p.total}</span>
              </div>
              <div style={{ background:"#E5E7EB", borderRadius:99, height:8 }}>
                <div style={{ width:visible?`${(p.count/p.total)*100}%`:"0%", background:`hsl(${150-(i*20)},50%,${35+i*5}%)`, borderRadius:99, height:8, transition:`width ${0.8+i*0.1}s ease ${i*0.1}s` }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#DC2626", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>⚠️ Always Avoid</div>
        {avoids.map((a,i) => (
          <div key={a.area} style={{ marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:13, fontWeight:600, color:C.dark }}>{a.area}</span>
              <span style={{ fontSize:12, color:"#DC2626", fontWeight:700 }}>{a.count}/{a.total} sessions</span>
            </div>
            <div style={{ background:"#FEE2E2", borderRadius:99, height:8 }}>
              <div style={{ width:visible?`${(a.count/a.total)*100}%`:"0%", background:"#DC2626", borderRadius:99, height:8, transition:`width ${0.8+i*0.15}s ease ${0.5+i*0.1}s` }}/>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.forest, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>📈 Pressure Trend (10 sessions)</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:50 }}>
          {pressureData.map((p,i) => (
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
              <div style={{ width:"100%", background:i>=7?C.forest:C.sage, borderRadius:"3px 3px 0 0", height:visible?`${(p/5)*44}px`:"0px", transition:`height 0.6s ease ${i*0.07}s` }}/>
              <div style={{ fontSize:8, color:C.gray }}>{p}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:11, color:C.forest, fontWeight:600, marginTop:6 }}>↑ Pressure escalating: 3 → 5 over 10 sessions</div>
      </div>

      <div style={{ background:"linear-gradient(135deg, #F0FDF4, #DCFCE7)", border:"1px solid #86EFAC", borderRadius:10, padding:"12px 16px", fontSize:12, color:"#1A3A28", lineHeight:1.5 }}>
        🤖 <strong>Platform Insight:</strong> Sarah has a chronic lower back pattern (9/10 sessions) with escalating pressure preference. Her left shoulder shows worsening trend - worth addressing proactively in next session.
      </div>
    </div>
  );
}

// ── SCHEDULE DEMO ─────────────────────────────────────────────────────────────

export default PatternDemo;
