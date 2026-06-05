// src/components/demos/DateOverrideDemo.jsx
//
// Home demo for the Find & Book ribbon. Shows date-specific hours the way
// HK asked for after two unclear tries: two labeled weeks shown together,
// using the same day-bar graphic as the Working hours editor, so it is
// obvious that an ENTIRE week can be set differently from another week.
//
//   Week of Jun 9  = your usual week (Mon-Fri 9 to 5)
//   Week of Jun 16 = a different week (short days, a couple off)
//
// Both weeks are always visible (clarity over motion); the "different"
// week gets a gentle looping highlight so the card still feels alive.
// (HK Jun 5 2026)

import React, { useEffect, useRef, useState } from "react";

const C = {
  forest:"#2A5741", cream:"#FCF8EE", border:"#E5D5C8", line:"#ECE9E1",
  ink:"#3D4A42", gray:"#7A8478", sageStroke:"#A9C99A", sageText:"#3A5C30",
  mutedText:"#C2BFB6",
};

const MIN = 360, MAX = 1260, SPAN = MAX - MIN; // 6:00 AM to 9:00 PM
const pct = (m) => ((m - MIN) / SPAN) * 100;
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Each day: [startMin, endMin] or null for closed. Mon..Sun.
const WEEK_USUAL = [[540,1020],[540,1020],[540,1020],[540,1020],[540,1020],null,null];
const WEEK_DIFF  = [[600,840],null,[720,1080],[540,780],null,[540,720],null];

function WeekGrid({ title, tag, days, glow }) {
  return (
    <div style={{ background:"#FAF8F2", border:"1px solid "+C.line, borderRadius:12, padding:"12px 12px 10px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
        <div style={{ fontSize:12.5, fontWeight:800, color:C.ink }}>{title}</div>
        <div style={{ fontSize:10, fontWeight:700, color: glow ? "#B26B17" : C.gray, background: glow ? "#FBF4DA" : "#EFEBE1", border:"1px solid "+(glow ? "#F0DCA6" : C.border), borderRadius:999, padding:"2px 8px" }}>{tag}</div>
      </div>
      {days.map(function(d, i){
        const off = !d;
        return (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
            <div style={{ width:14, flexShrink:0, fontSize:10.5, fontWeight:700, color: off ? C.mutedText : C.ink, textAlign:"center" }}>{DAYS[i]}</div>
            <div style={{ position:"relative", flex:1, height:18, background:"#fff", border:"1px solid "+C.line, borderRadius:6 }}>
              {off ? (
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9.5, fontWeight:700, color:C.mutedText, letterSpacing:"0.04em" }}>off</div>
              ) : (
                <div style={{ position:"absolute", top:2, bottom:2, left:pct(d[0])+"%", width:(pct(d[1])-pct(d[0]))+"%", background: glow ? "linear-gradient(135deg,#DCEFE2,#BFE0CB)" : "linear-gradient(135deg,#E4F1E8,#CFE7D7)", border:"1.5px solid "+C.sageStroke, borderRadius:5, transition:"all .5s ease", boxShadow: glow ? "0 0 0 2px rgba(169,201,154,0.30)" : "none" }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function useFadeIn(){
  const ref = useRef(null);
  const [v, setV] = useState(false);
  useEffect(function(){
    const el = ref.current; if (!el) return;
    const o = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) setV(true); }); }, { threshold:0.1 });
    o.observe(el); return function(){ o.disconnect(); };
  }, []);
  return [ref, v];
}

export default function DateOverrideDemo(){
  const [ref, visible] = useFadeIn();
  const [pulse, setPulse] = useState(false);
  useEffect(function(){
    if (!visible) return;
    const id = setInterval(function(){ setPulse(function(p){ return !p; }); }, 2200);
    return function(){ clearInterval(id); };
  }, [visible]);

  return (
    <div ref={ref} style={{
      background:"#fff", borderRadius:20, padding:22,
      boxShadow:"0 12px 48px rgba(140,74,63,0.14)",
      maxWidth:460, width:"100%", boxSizing:"border-box", margin:"0 auto",
      border:"1.5px solid rgba(252,232,224,0.6)", fontFamily:"system-ui,-apple-system,sans-serif",
    }}>
      <div style={{ fontSize:16, fontWeight:700, color:C.ink, marginBottom:4 }}>📅 Set any week differently</div>
      <div style={{ fontSize:12.5, color:C.gray, marginBottom:14, lineHeight:1.5 }}>
        Your usual week repeats on its own. When a week does not look like the others, set that whole week on its own.
      </div>

      {/* time scale */}
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:C.mutedText, fontWeight:700, padding:"0 2px 4px 22px" }}>
        <span>6a</span><span>12p</span><span>9p</span>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <WeekGrid title="Week of Jun 9" tag="your usual" days={WEEK_USUAL} glow={false} />
        <div style={{ opacity: visible && pulse ? 1 : 0.92, transition:"opacity .5s" }}>
          <WeekGrid title="Week of Jun 16" tag="this week is different" days={WEEK_DIFF} glow={true} />
        </div>
      </div>

      <div style={{ marginTop:14, padding:"10px 12px", background:C.cream, border:"1px solid "+C.border, borderRadius:10, fontSize:12, color:C.ink, lineHeight:1.55, textAlign:"center" }}>
        Same days, different hours. Clients booking each week only ever see when you are truly open.
      </div>
    </div>
  );
}
