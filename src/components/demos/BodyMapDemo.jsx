// src/components/demos/BodyMapDemo.jsx
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

function BodyMapDemo() {
  const [focus, setFocus] = useState(["neck", "upper-back"]);
  const [avoid, setAvoid] = useState(["knees"]);
  const [mode, setMode] = useState("focus");
  const [view, setView] = useState("front");

  const frontAreas = [
    { id:"head", label:"Head", x:"44%", y:"3%" },
    { id:"neck", label:"Neck", x:"44%", y:"12%" },
    { id:"l-shoulder", label:"L Shoulder", x:"26%", y:"19%" },
    { id:"r-shoulder", label:"R Shoulder", x:"60%", y:"19%" },
    { id:"chest", label:"Chest", x:"44%", y:"27%" },
    { id:"abdomen", label:"Abdomen", x:"44%", y:"40%" },
    { id:"l-arm", label:"L Arm", x:"20%", y:"35%" },
    { id:"r-arm", label:"R Arm", x:"68%", y:"35%" },
    { id:"hips", label:"Hips", x:"44%", y:"54%" },
    { id:"l-thigh", label:"L Thigh", x:"34%", y:"65%" },
    { id:"r-thigh", label:"R Thigh", x:"54%", y:"65%" },
    { id:"knees", label:"Knees", x:"44%", y:"75%" },
    { id:"l-calf", label:"L Calf", x:"34%", y:"85%" },
    { id:"r-calf", label:"R Calf", x:"54%", y:"85%" },
  ];
  const backAreas = [
    { id:"b-head", label:"Head", x:"44%", y:"3%" },
    { id:"b-neck", label:"Neck", x:"44%", y:"12%" },
    { id:"b-l-shoulder", label:"L Shoulder", x:"26%", y:"19%" },
    { id:"b-r-shoulder", label:"R Shoulder", x:"60%", y:"19%" },
    { id:"upper-back", label:"Upper Back", x:"44%", y:"26%" },
    { id:"mid-back", label:"Mid Back", x:"44%", y:"38%" },
    { id:"lower-back", label:"Lower Back", x:"44%", y:"48%" },
    { id:"glutes", label:"Glutes", x:"44%", y:"57%" },
    { id:"l-hamstring", label:"L Hamstring", x:"34%", y:"68%" },
    { id:"r-hamstring", label:"R Hamstring", x:"54%", y:"68%" },
    { id:"l-calf", label:"L Calf", x:"34%", y:"82%" },
    { id:"r-calf", label:"R Calf", x:"54%", y:"82%" },
  ];
  const areas = view === "front" ? frontAreas : backAreas;

  const toggle = (id) => {
    if (mode === "focus") {
      setFocus(p => p.includes(id) ? p.filter(x=>x!==id) : [...p.filter(x=>x!==id), id]);
      setAvoid(p => p.filter(x=>x!==id));
    } else {
      setAvoid(p => p.includes(id) ? p.filter(x=>x!==id) : [...p.filter(x=>x!==id), id]);
      setFocus(p => p.filter(x=>x!==id));
    }
  };

  return (
    <div style={{ background:"#fff", borderRadius:20, padding:20, boxShadow:"0 12px 48px rgba(0,0,0,0.14)", maxWidth:340, margin:"0 auto" }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:12, textAlign:"center", letterSpacing:"-0.01em" }}>
        Interactive Body Map
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:10 }}>
        {["front","back"].map(v => (
          <button key={v} onClick={()=>setView(v)} style={{ flex:1, padding:"7px 0", borderRadius:8, border:`1.5px solid ${view===v?C.forest:C.border}`, background:view===v?C.forest:"transparent", color:view===v?"#fff":C.gray, fontSize:12, fontWeight:600, cursor:"pointer" }}>
            {v==="front"?"👤 Front":"🔄 Back"}
          </button>
        ))}
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:12 }}>
        <button onClick={()=>setMode("focus")} style={{ flex:1, padding:"7px 0", borderRadius:8, border:`1.5px solid ${mode==="focus"?"#16A34A":C.border}`, background:mode==="focus"?"#DCFCE7":"transparent", color:mode==="focus"?"#16A34A":C.gray, fontSize:12, fontWeight:600, cursor:"pointer" }}>🎯 Focus</button>
        <button onClick={()=>setMode("avoid")} style={{ flex:1, padding:"7px 0", borderRadius:8, border:`1.5px solid ${mode==="avoid"?"#DC2626":C.border}`, background:mode==="avoid"?"#FEE2E2":"transparent", color:mode==="avoid"?"#DC2626":C.gray, fontSize:12, fontWeight:600, cursor:"pointer" }}>⚠️ Avoid</button>
      </div>
      <div style={{ position:"relative", height:320, background:"#F8FAF9", borderRadius:14, marginBottom:12, overflow:"hidden" }}>
        <svg viewBox="0 0 100 350" style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.12 }}>
          <ellipse cx="50" cy="20" rx="11" ry="13" fill={C.sage}/>
          <rect x="42" y="32" width="16" height="8" rx="4" fill={C.sage}/>
          <rect x="30" y="40" width="40" height="60" rx="10" fill={C.sage}/>
          <rect x="16" y="42" width="14" height="52" rx="7" fill={C.sage}/>
          <rect x="70" y="42" width="14" height="52" rx="7" fill={C.sage}/>
          <rect x="33" y="100" width="34" height="70" rx="6" fill={C.sage}/>
          <rect x="33" y="170" width="14" height="80" rx="8" fill={C.sage}/>
          <rect x="53" y="170" width="14" height="80" rx="8" fill={C.sage}/>
          <rect x="33" y="250" width="13" height="55" rx="7" fill={C.sage}/>
          <rect x="54" y="250" width="13" height="55" rx="7" fill={C.sage}/>
        </svg>
        {areas.map(a => {
          const isFocus = focus.includes(a.id);
          const isAvoid = avoid.includes(a.id);
          return (
            <button key={a.id} onClick={()=>toggle(a.id)} style={{
              position:"absolute", left:`calc(${a.x} - 30px)`, top:a.y,
              width:60, padding:"3px 2px", borderRadius:6, fontSize:9, fontWeight:700,
              cursor:"pointer", transition:"all 0.15s", textAlign:"center", lineHeight:1.3,
              background: isFocus?"#DCFCE7":isAvoid?"#FEE2E2":"rgba(255,255,255,0.85)",
              border:`1.5px solid ${isFocus?"#16A34A":isAvoid?"#DC2626":"#E5E7EB"}`,
              color: isFocus?"#16A34A":isAvoid?"#DC2626":"#6B7280", zIndex:10,
              transform: (isFocus||isAvoid)?"scale(1.05)":"scale(1)",
            }}>
              {a.label}
            </button>
          );
        })}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, minHeight:24 }}>
        {focus.length>0 && <div style={{ fontSize:11, color:"#16A34A", fontWeight:600 }}>🎯 {focus.join(", ")}</div>}
        {avoid.length>0 && <div style={{ fontSize:11, color:"#DC2626", fontWeight:600 }}>⚠️ Avoid: {avoid.join(", ")}</div>}
      </div>
    </div>
  );
}

// ── PATTERN DEMO ──────────────────────────────────────────────────────────────

export default BodyMapDemo;
