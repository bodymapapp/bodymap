// src/components/demos/DateOverrideDemo.jsx
//
// Home demo for the Find & Book ribbon. Shows that an ENTIRE week can be
// set differently, using the same day-bar graphic as the Working hours
// editor. (HK Jun 5 2026)
//
// Motion: the top week is your fixed "usual" week. The bottom week starts
// matching it, then on a loop the bars GLIDE to new times and two days
// close, becoming a different week, then reset. The animation is the point,
// so the viewer sees a whole week being changed, not two static grids.

import React, { useEffect, useState } from "react";

const C = {
  forest:"#2A5741", cream:"#FCF8EE", border:"#E5D5C8", line:"#ECE9E1",
  ink:"#3D4A42", gray:"#7A8478", sageStroke:"#A9C99A", sageText:"#3A5C30",
  mutedText:"#C2BFB6", amber:"#B26B17", amberBg:"#FBF4DA", amberStroke:"#F0DCA6",
};

const MIN = 360, MAX = 1260, SPAN = MAX - MIN; // 6:00 AM to 9:00 PM
const pct = (m) => ((m - MIN) / SPAN) * 100;
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

// [startMin, endMin] or null for closed. Mon..Sun.
const WEEK_USUAL = [[540,1020],[540,1020],[540,1020],[540,1020],[540,1020],null,null];
const WEEK_DIFF  = [[600,840],null,[720,1080],[540,780],null,[540,720],null];

function DayRow({ slot, animate }){
  const open = !!slot;
  // Bars are always mounted so left/width/opacity can transition. When a
  // day closes, the bar collapses to zero width and fades; the "off"
  // label fades in behind it.
  const left = open ? pct(slot[0]) : pct(540);
  const width = open ? (pct(slot[1]) - pct(slot[0])) : 0;
  return (
    <div style={{ position:"relative", flex:1, height:18, background:"#fff", border:"1px solid "+C.line, borderRadius:6, overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9.5, fontWeight:700, color:C.mutedText, letterSpacing:"0.04em", opacity: open ? 0 : 1, transition: animate ? "opacity .35s ease" : "none" }}>off</div>
      <div style={{
        position:"absolute", top:2, bottom:2, left:left+"%", width:width+"%",
        background:"linear-gradient(135deg,#E0EFE6,#C6E2D1)", border:"1.5px solid "+C.sageStroke, borderRadius:5,
        opacity: open ? 1 : 0,
        transition: animate ? "left .6s ease, width .6s ease, opacity .4s ease" : "none",
      }} />
    </div>
  );
}

function WeekGrid({ title, tag, tagGlow, week, animate }){
  return (
    <div style={{ background:"#FAF8F2", border:"1px solid "+C.line, borderRadius:12, padding:"12px 12px 10px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
        <div style={{ fontSize:12.5, fontWeight:800, color:C.ink }}>{title}</div>
        <div style={{ fontSize:10, fontWeight:700, color: tagGlow ? C.amber : C.gray, background: tagGlow ? C.amberBg : "#EFEBE1", border:"1px solid "+(tagGlow ? C.amberStroke : C.border), borderRadius:999, padding:"2px 8px", transition:"all .4s ease" }}>{tag}</div>
      </div>
      {week.map(function(slot, i){
        return (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
            <div style={{ width:14, flexShrink:0, fontSize:10.5, fontWeight:700, color: slot ? C.ink : C.mutedText, textAlign:"center", transition:"color .4s" }}>{DAYS[i]}</div>
            <DayRow slot={slot} animate={animate} />
          </div>
        );
      })}
    </div>
  );
}

export default function DateOverrideDemo(){
  const [morphed, setMorphed] = useState(false);
  useEffect(function(){
    // Start on mount, unconditionally. (A scroll-into-view gate can fail to
    // fire inside the Home carousel, leaving the bars static.) Hold a little
    // longer on the "different" state than on the reset.
    var t;
    function tick(){ setMorphed(function(m){ var n = !m; t = setTimeout(tick, n ? 2600 : 1900); return n; }); }
    t = setTimeout(tick, 1200);
    return function(){ clearTimeout(t); };
  }, []);

  const bottomWeek = morphed ? WEEK_DIFF : WEEK_USUAL;

  return (
    <div style={{
      background:"#fff", borderRadius:20, padding:22,
      boxShadow:"0 12px 48px rgba(140,74,63,0.14)",
      maxWidth:460, width:"100%", boxSizing:"border-box", margin:"0 auto",
      border:"1.5px solid rgba(252,232,224,0.6)", fontFamily:"system-ui,-apple-system,sans-serif",
    }}>
      <div style={{ fontSize:16, fontWeight:700, color:C.ink, marginBottom:4 }}>📅 Set any week differently</div>
      <div style={{ fontSize:12.5, color:C.gray, marginBottom:14, lineHeight:1.5 }}>
        Your usual week repeats on its own. When a week does not look like the others, change that whole week.
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:C.mutedText, fontWeight:700, padding:"0 2px 4px 22px" }}>
        <span>6a</span><span>12p</span><span>9p</span>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <WeekGrid title="Week of Jun 9" tag="your usual" tagGlow={false} week={WEEK_USUAL} animate={false} />
        <WeekGrid title="Week of Jun 16" tag={morphed ? "changed for this week" : "same as usual"} tagGlow={morphed} week={bottomWeek} animate={true} />
      </div>

      <div style={{ marginTop:14, padding:"10px 12px", background:C.cream, border:"1px solid "+C.border, borderRadius:10, fontSize:12, color:C.ink, lineHeight:1.55, textAlign:"center" }}>
        Change one week without touching the rest. Clients only ever see when you are truly open.
      </div>
    </div>
  );
}
