
import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import Footer from "../components/Footer";

const SUPABASE_URL = "https://rmnqfrljoknmellbnpiy.supabase.co";
const C = {
  forest: "#2A5741", sage: "#6B9E80", beige: "#F5F0E8",
  gold: "#C9A84C", white: "#FFFFFF", dark: "#0D1F17",
  gray: "#6B7280", lightGray: "#F3F4F6", border: "#E5E7EB",
};

function useFadeIn(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function FadeIn({ children, delay = 0, style = {} }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(8px)",
      transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      ...style
    }}>
      {children}
    </div>
  );
}

function AnimatedCounter({ target, suffix = "", prefix = "" }) {
  const [count, setCount] = useState(0);
  const [ref, visible] = useFadeIn();
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = Math.ceil(target / 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 20);
    return () => clearInterval(timer);
  }, [visible, target]);
  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// ── BODY MAP DEMO ─────────────────────────────────────────────────────────────
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
function ScheduleDemo() {
  const [view, setView] = useState("daily");
  const [selectedAppt, setSelectedAppt] = useState(0);

  const appts = [
    { time:"9:00 AM", name:"Sarah M.", dur:"60 min", status:"intake-done", focus:"Neck & Shoulders", sessions:7, initials:"SM" },
    { time:"10:30 AM", name:"Jennifer K.", dur:"90 min", status:"pending", focus:"No intake yet", sessions:2, initials:"JK" },
    { time:"12:00 PM", name:"Maria L.", dur:"60 min", status:"complete", focus:"Lower Back", sessions:14, initials:"ML" },
    { time:"2:00 PM", name:"Rachel T.", dur:"60 min", status:"pending", focus:"No intake yet", sessions:1, initials:"RT" },
    { time:"3:30 PM", name:"Amy W.", dur:"90 min", status:"intake-done", focus:"Full Back", sessions:5, initials:"AW" },
  ];

  const STATUS = {
    "intake-done":{ label:"🧭 Intake Done", bg:"#DCFCE7", color:"#16A34A", border:"#16A34A" },
    "pending":    { label:"🔔 Pending",     bg:"#FEF3C7", color:"#D97706", border:"#D97706" },
    "complete":   { label:"✅ Complete",     bg:"#F3F4F6", color:"#6B7280", border:"#6B7280" },
  };

  const weekData = [
    { day:"Mon", sessions:3, revenue:255 },
    { day:"Tue", sessions:5, revenue:425 },
    { day:"Wed", sessions:2, revenue:170 },
    { day:"Thu", sessions:4, revenue:340 },
    { day:"Fri", sessions:5, revenue:425 },
    { day:"Sat", sessions:3, revenue:255 },
    { day:"Sun", sessions:0, revenue:0 },
  ];
  const maxW = Math.max(...weekData.map(d=>d.sessions));

  const insights = [
    { icon:"⭐", label:"Best day", value:"Tuesday & Friday", sub:"5 sessions avg" },
    { icon:"📈", label:"Busiest week", value:"This week", sub:"22 sessions" },
    { icon:"🔔", label:"Intake rate", value:"68%", sub:"clients pre-fill" },
    { icon:"🍂", label:"Re-engage", value:"3 clients", sub:"30+ days lapsed" },
  ];

  return (
    <div style={{ background:"#fff", borderRadius:20, overflow:"hidden", boxShadow:"0 12px 48px rgba(0,0,0,0.14)", maxWidth:480, margin:"0 auto" }}>
      <div style={{ background:C.forest, padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontSize:15, fontWeight:700, color:"#fff" }}>📅 Schedule</div>
        <div style={{ display:"flex", gap:4 }}>
          {["daily","weekly","monthly","insights"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{ background:view===v?"rgba(255,255,255,0.25)":"transparent", color:"#fff", border:"none", borderRadius:6, padding:"4px 10px", fontSize:11, fontWeight:600, cursor:"pointer", opacity:view===v?1:0.7 }}>
              {v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:16, height:460, overflow:"hidden" }}>
        {view==="daily" && (
          <>
            <div style={{ display:"flex", gap:6, marginBottom:14 }}>
              {["Today 5","Tmrw 2","Wed 3","Thu 1","Fri 4"].map((d,i)=>(
                <button key={i} style={{ flex:1, background:i===0?C.forest:"#F9FAFB", color:i===0?"#fff":C.gray, border:`1.5px solid ${i===0?C.forest:C.border}`, borderRadius:8, padding:"6px 2px", fontSize:10, fontWeight:600, cursor:"pointer" }}>
                  {d.split(" ").map((t,j)=><div key={j}>{t}</div>)}
                </button>
              ))}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {appts.map((a,i) => {
                const sc = STATUS[a.status];
                const isSel = selectedAppt===i;
                return (
                  <div key={i}>
                    <div onClick={()=>setSelectedAppt(isSel?-1:i)} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", borderRadius:10, background:"#F9FAFB", border:`1.5px solid ${isSel?C.forest:C.border}`, cursor:"pointer", borderLeft:`3px solid ${sc.border}` }}>
                      <div style={{ minWidth:58, fontSize:11, fontWeight:700, color:C.dark }}>{a.time}</div>
                      <div style={{ width:28, height:28, borderRadius:"50%", background:C.forest, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, flexShrink:0 }}>{a.initials}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:C.dark }}>{a.name}</div>
                        <div style={{ fontSize:10, color:C.gray }}>{a.dur} · {a.focus}</div>
                      </div>
                      <div style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:"2px 8px", fontSize:9, fontWeight:700, whiteSpace:"nowrap" }}>{sc.label}</div>
                    </div>
                    {isSel && (
                      <div style={{ background:"#F0FDF4", border:"1.5px solid #86EFAC", borderTop:"none", borderRadius:"0 0 10px 10px", padding:"10px 12px" }}>
                        <div style={{ fontSize:11, color:C.dark, marginBottom:8 }}><strong>{a.sessions} sessions</strong> · {a.focus}</div>
                        <div style={{ display:"flex", gap:6 }}>
                          {a.status==="pending"&&<button style={{ background:C.sage, color:"#fff", border:"none", borderRadius:6, padding:"5px 10px", fontSize:10, fontWeight:600, cursor:"pointer" }}>💬 Send Intake</button>}
                          {a.status==="intake-done"&&<button style={{ background:C.forest, color:"#fff", border:"none", borderRadius:6, padding:"5px 10px", fontSize:10, fontWeight:600, cursor:"pointer" }}>📋 View Brief</button>}
                          {a.status==="complete"&&<><button style={{ background:C.forest, color:"#fff", border:"none", borderRadius:6, padding:"5px 10px", fontSize:10, fontWeight:600, cursor:"pointer" }}>📋 Pre-Brief</button><button style={{ background:C.sage, color:"#fff", border:"none", borderRadius:6, padding:"5px 10px", fontSize:10, fontWeight:600, cursor:"pointer" }}>📄 Post-Brief</button></>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {view==="weekly" && (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.dark }}>This Week · 22 sessions</div>
              <div style={{ fontSize:10, color:C.gray }}>Sessions per day</div>
            </div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:100, marginBottom:8 }}>
              {weekData.map((d,i)=>(
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center" }}>
                  <div style={{ fontSize:10, color:C.gray, marginBottom:4 }}>{d.sessions}</div>
                  <div style={{ width:"100%", background:i===4?C.forest:C.sage, borderRadius:"4px 4px 0 0", height:`${(d.sessions/maxW)*75}px`, opacity:d.sessions===0?0.2:1 }}/>
                  <div style={{ fontSize:10, color:i===4?C.forest:"#9CA3AF", fontWeight:i===4?700:400, marginTop:4 }}>{d.day}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[{l:"Expected",v:"$1,870"},{l:"Collected",v:"$1,615"},{l:"Intake rate",v:"68%"},{l:"Avg/session",v:"$85"}].map(s=>(
                <div key={s.l} style={{ background:"#F9FAFB", borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:16, fontWeight:700, color:C.forest, fontFamily:"Georgia, serif" }}>{s.v}</div>
                  <div style={{ fontSize:11, color:C.gray }}>{s.l}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {view==="monthly" && (
          <>
            <div style={{ fontSize:12, fontWeight:700, color:C.dark, marginBottom:12 }}>March 2026</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:4 }}>
              {["M","T","W","T","F","S","S"].map((d,i)=><div key={i} style={{ textAlign:"center", fontSize:9, color:C.gray, fontWeight:700 }}>{d}</div>)}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:8 }}>
              {[null,null,null,null,null,1,2,...Array.from({length:29},(_,i)=>i+3)].map((d,i)=>{
                if(!d) return <div key={i}/>;
                const hasSessions = [3,4,5,10,11,12,17,18,19,24,25,26].includes(d);
                const isToday = d===15;
                return (
                  <div key={i} style={{ padding:"4px 2px", borderRadius:4, minHeight:28, background:isToday?C.forest:hasSessions?"#F0FDF4":"#F9FAFB", border:`1px solid ${isToday?C.forest:hasSessions?"#86EFAC":"#E5E7EB"}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                    <div style={{ fontSize:9, fontWeight:isToday?700:400, color:isToday?"#fff":C.dark }}>{d}</div>
                    {hasSessions&&!isToday&&<div style={{ width:4, height:4, borderRadius:"50%", background:C.sage }}/>}
                  </div>
                );
              })}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[{l:"Monthly sessions",v:"68"},{l:"Collected",v:"$5,440"},{l:"New clients",v:"4"},{l:"Retention",v:"94%"}].map(s=>(
                <div key={s.l} style={{ background:"#F9FAFB", borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:18, fontWeight:700, color:C.forest, fontFamily:"Georgia, serif" }}>{s.v}</div>
                  <div style={{ fontSize:11, color:C.gray }}>{s.l}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {view==="insights" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {insights.map((ins,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"#F9FAFB", borderRadius:10, border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:22 }}>{ins.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:C.gray, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>{ins.label}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.dark }}>{ins.value}</div>
                  <div style={{ fontSize:11, color:C.gray }}>{ins.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── BILLING DEMO ──────────────────────────────────────────────────────────────
function BillingDemo() {
  const [view, setView] = useState("daily");
  const today = [
    { name:"Sarah M.", time:"9:00 AM", expected:85, actual:85, status:"paid" },
    { name:"Jennifer K.", time:"10:30 AM", expected:110, actual:null, status:"pending" },
    { name:"Maria L.", time:"12:00 PM", expected:85, actual:85, status:"paid" },
    { name:"Rachel T.", time:"2:00 PM", expected:85, actual:null, status:"pending" },
    { name:"Amy W.", time:"3:30 PM", expected:110, actual:110, status:"paid" },
  ];
  const STATUS = { paid:{ bg:"#DCFCE7", color:"#16A34A", label:"✅ Paid" }, pending:{ bg:"#FEF3C7", color:"#D97706", label:"⏳ Pending" } };
  const months = ["J","F","M","A","M","J","J","A","S","O","N","D"];
  const monthData = [3200,3800,4100,3600,4400,4900,5100,5400,4800,5600,5900,6200];
  const maxM = Math.max(...monthData);
  const topClients = [
    { name:"Sarah M.", revenue:595, sessions:7 },
    { name:"Monica G.", revenue:595, sessions:7 },
    { name:"Amy W.", revenue:440, sessions:4 },
    { name:"Maria L.", revenue:425, sessions:5 },
  ];

  return (
    <div style={{ background:"#fff", borderRadius:20, overflow:"hidden", boxShadow:"0 12px 48px rgba(0,0,0,0.14)", maxWidth:480, margin:"0 auto" }}>
      <div style={{ background:"#1A3A28", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontSize:15, fontWeight:700, color:"#fff" }}>💰 Billing</div>
        <div style={{ display:"flex", gap:4 }}>
          {["daily","weekly","yearly","insights"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{ background:view===v?"rgba(255,255,255,0.25)":"transparent", color:"#fff", border:"none", borderRadius:6, padding:"4px 10px", fontSize:11, fontWeight:600, cursor:"pointer", opacity:view===v?1:0.7 }}>
              {v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding:16, height:460, overflow:"hidden" }}>
        {view==="daily" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
              <div style={{ background:"#F0FDF4", borderRadius:10, padding:"12px 14px" }}>
                <div style={{ fontSize:20, fontWeight:700, color:C.forest, fontFamily:"Georgia,serif" }}>$280</div>
                <div style={{ fontSize:11, color:C.gray }}>Collected today</div>
              </div>
              <div style={{ background:"#FEF3C7", borderRadius:10, padding:"12px 14px" }}>
                <div style={{ fontSize:20, fontWeight:700, color:"#D97706", fontFamily:"Georgia,serif" }}>$195</div>
                <div style={{ fontSize:11, color:C.gray }}>Pending today</div>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {today.map((s,i)=>{
                const sc = STATUS[s.status];
                return (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", background:"#F9FAFB", borderRadius:10 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:C.forest, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700 }}>{s.name.split(" ").map(w=>w[0]).join("")}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:C.dark }}>{s.name}</div>
                      <div style={{ fontSize:10, color:C.gray }}>{s.time}</div>
                    </div>
                    <div style={{ textAlign:"right", minWidth:60 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:C.dark }}>{s.actual?`$${s.actual}`:"-"}</div>
                      <div style={{ fontSize:9, color:C.gray }}>of ${s.expected}</div>
                    </div>
                    <div style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:"2px 8px", fontSize:9, fontWeight:700 }}>{sc.label}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {view==="weekly" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
              {[{l:"Expected",v:"$1,870"},{l:"Collected",v:"$1,615"},{l:"Rate",v:"86%"}].map(s=>(
                <div key={s.l} style={{ background:"#F9FAFB", borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:16, fontWeight:700, color:C.forest, fontFamily:"Georgia,serif" }}>{s.v}</div>
                  <div style={{ fontSize:10, color:C.gray }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:C.dark, marginBottom:10 }}>Expected vs. Collected by Day</div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:80 }}>
              {[{d:"Mon",e:255,a:255},{d:"Tue",e:425,a:380},{d:"Wed",e:170,a:170},{d:"Thu",e:340,a:300},{d:"Fri",e:425,a:425},{d:"Sat",e:255,a:85},{d:"Sun",e:0,a:0}].map((d,i)=>(
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center" }}>
                  <div style={{ width:"100%", display:"flex", alignItems:"flex-end", gap:1, height:65 }}>
                    <div style={{ flex:1, background:"#E5E7EB", borderRadius:"2px 2px 0 0", height:`${(d.e/425)*65}px` }}/>
                    <div style={{ flex:1, background:C.forest, borderRadius:"2px 2px 0 0", height:`${(d.a/425)*65}px` }}/>
                  </div>
                  <div style={{ fontSize:9, color:C.gray, marginTop:3 }}>{d.d}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:12, marginTop:8, marginBottom:14, fontSize:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ width:10,height:10,background:"#E5E7EB",borderRadius:2 }}/><span style={{ color:C.gray }}>Expected</span></div>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ width:10,height:10,background:C.forest,borderRadius:2 }}/><span style={{ color:C.gray }}>Collected</span></div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[{l:"Sessions this week",v:"22",color:C.forest},{l:"Pending intake",v:"7",color:"#D97706"},{l:"Avg/session",v:"$85",color:C.sage},{l:"Collection rate",v:"86%",color:"#16A34A"}].map(s=>(
                <div key={s.l} style={{ background:"#F9FAFB", borderRadius:8, padding:"10px 12px", border:"1px solid #E5E7EB" }}>
                  <div style={{ fontSize:16, fontWeight:700, color:s.color, fontFamily:"Georgia,serif" }}>{s.v}</div>
                  <div style={{ fontSize:10, color:C.gray }}>{s.l}</div>
                </div>
              ))}
            </div>
          </>
        )}
        {view==="yearly" && (
          <>
            <div style={{ fontSize:12, fontWeight:700, color:C.dark, marginBottom:12 }}>2026 Annual Revenue</div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:90, marginBottom:8 }}>
              {monthData.map((v,i)=>(
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center" }}>
                  <div style={{ width:"100%", background:i===2?C.gold:C.forest, borderRadius:"3px 3px 0 0", height:`${(v/maxM)*80}px`, opacity:i>2?0.4:1 }}/>
                  <div style={{ fontSize:8, color:i===2?C.forest:"#9CA3AF", fontWeight:i===2?700:400, marginTop:3 }}>{months[i]}</div>
                </div>
              ))}
            </div>
            <div style={{ background:"#F0FDF4", borderRadius:10, padding:"10px 14px", fontSize:12, color:C.forest, marginBottom:12 }}>
              <strong>Q1 2026:</strong> $11,100 collected · On track for $60K annual
            </div>
            <div style={{ display:"flex", gap:12, marginBottom:12, fontSize:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ width:10,height:10,background:"#E5E7EB",borderRadius:2 }}/><span style={{ color:C.gray }}>Expected (projected)</span></div>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ width:10,height:10,background:C.forest,borderRadius:2 }}/><span style={{ color:C.gray }}>Collected</span></div>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ width:10,height:10,background:C.gold,borderRadius:2 }}/><span style={{ color:C.gray }}>Current month</span></div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[{l:"Annual pace",v:"$60K"},{l:"Best month",v:"Dec"},{l:"Growth",v:"+8%/mo"}].map(s=>(
                <div key={s.l} style={{ background:"#F9FAFB", borderRadius:8, padding:"10px 12px", border:"1px solid #E5E7EB" }}>
                  <div style={{ fontSize:15, fontWeight:700, color:C.forest, fontFamily:"Georgia,serif" }}>{s.v}</div>
                  <div style={{ fontSize:10, color:C.gray }}>{s.l}</div>
                </div>
              ))}
            </div>
          </>
        )}
        {view==="insights" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
              {[{l:"30-Day Revenue",v:"$5,440",sub:"+18% vs prior month",color:C.forest},{l:"Collection Rate",v:"89%",sub:"industry avg: 82%",color:"#16A34A"},{l:"Avg Session Value",v:"$91",sub:"up from $85",color:C.sage},{l:"Outstanding",v:"$170",sub:"2 sessions",color:"#DC2626"}].map(s=>(
                <div key={s.l} style={{ background:"#F9FAFB", borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:16, fontWeight:700, color:s.color, fontFamily:"Georgia,serif" }}>{s.v}</div>
                  <div style={{ fontSize:11, fontWeight:600, color:C.dark }}>{s.l}</div>
                  <div style={{ fontSize:10, color:C.gray }}>{s.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:C.dark, marginBottom:8 }}>⭐ Top Clients by Revenue</div>
            {topClients.map((c,i)=>(
              <div key={i} style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:C.dark }}>{c.name}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:C.forest }}>${c.revenue}</span>
                </div>
                <div style={{ background:"#E5E7EB", borderRadius:99, height:5 }}>
                  <div style={{ width:`${(c.revenue/595)*100}%`, background:C.forest, borderRadius:99, height:5 }}/>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── AI DEMO ───────────────────────────────────────────────────────────────────
function AIDemo() {
  const SCRIPTED = [
    {
      q: "Which clients need re-engagement?",
      a: "Based on your practice data:\n\n🍂 Sarah M. - 17 days since last visit (usually weekly)\n🍂 Dana P. - 21 days (monthly pattern broken)\n🍂 Monica G. - 21 days (8-month regular, this is unusual)\n\nMonica is your highest churn risk - her pattern break is significant. Want me to draft an SMS for her?"
    },
    {
      q: "Draft an SMS for Monica",
      a: "Here's a personalized message based on Monica's history:\n\n---\nHi Monica! It's been a few weeks - I noticed your lower back and shoulders are probably overdue. You've been such a consistent client and I'd love to get you back in. Ready to book? [intake link]\n---\n\nI referenced her consistent focus areas (lower back, full body) from 11 sessions. Copy it above or ask me to adjust the tone."
    },
    {
      q: "How is my revenue trending?",
      a: "Your last 30 days: $5,440 collected across 64 sessions - up 18% from the prior period.\n\nCollection rate: 89% (industry avg is 82%) ✅\nAvg session value: $91 (up from $85) ✅\nOutstanding: $170 across 2 sessions\n\nTop revenue driver: Sarah M. and Monica G. at $595 each. Your Tuesday/Friday slots are your highest-earning days."
    },
    {
      q: "What patterns does Sarah have?",
      a: "Sarah M. - 7 sessions:\n\n🎯 Neck: 7/7 sessions (100%)\n🎯 Left Shoulder: 6/7 (worsening trend ↑)\n🎯 Upper Back: 5/7\n⚠️ Knees: always avoid\n\nPressure: escalating from 3→5 over 7 sessions\n\n💡 Her left shoulder is trending worse - worth addressing directly next session. Her pressure tolerance has grown significantly."
    }
  ];

  const [messages, setMessages] = useState([
    { role:"assistant", content:"Hi! I'm MyBodyMap Platform. In the dashboard, I have access to your actual client data - names, body maps, session history, revenue, and patterns.\n\nHere I'm running on a sample practice. Try the suggested questions to see exactly what I can do with real data. 🌿" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  const send = async (text) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput("");
    const userMsg = { role:"user", content:q };
    setMessages(p => [...p, userMsg]);
    setLoading(true);

    const scripted = SCRIPTED.find(s => s.q.toLowerCase() === q.toLowerCase());
    if (scripted) {
      await new Promise(r => setTimeout(r, 900));
      setMessages(p => [...p, { role:"assistant", content:scripted.a }]);
      setLoading(false);
      return;
    }

    try {
      const updated = [...messages, userMsg];
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bodymap-ai`, {
        method:"POST",
        headers:{ "Content-Type":"application/json", "Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbnFmcmxqb2tubWVsbGJucGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4NTQ0MDAsImV4cCI6MjAyNTQzMDQwMH0.mock" },
        body:JSON.stringify({ messages:updated.map(m=>({role:m.role,content:m.content})), context:"", mode:"public" })
      });
      const data = await res.json();
      setMessages(p => [...p, { role:"assistant", content:data.content?.[0]?.text||"Try one of the suggested questions to see MyBodyMap Platform at its best." }]);
    } catch {
      setMessages(p => [...p, { role:"assistant", content:"Try one of the suggested questions below to see MyBodyMap Platform in action." }]);
    }
    setLoading(false);
  };

  const PROMPTS = SCRIPTED.map(s=>s.q);

  return (
    <div style={{ background:"#fff", borderRadius:20, overflow:"hidden", boxShadow:"0 12px 48px rgba(0,0,0,0.14)", maxWidth:520, margin:"0 auto" }}>
      <div style={{ background:`linear-gradient(135deg, ${C.forest}, #1A3A28)`, padding:"14px 20px", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🌿</div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"#fff" }}>MyBodyMap Platform</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)" }}>Powered by your real practice data</div>
        </div>
        <div style={{ marginLeft:"auto", background:"rgba(255,255,255,0.15)", borderRadius:20, padding:"3px 10px", fontSize:10, color:"#fff", fontWeight:700 }}>● Live Demo</div>
      </div>

      <div style={{ height:280, overflowY:"auto", padding:16, display:"flex", flexDirection:"column", gap:10 }}>
        {messages.map((m,i)=>(
          <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
            {m.role==="assistant"&&<div style={{ width:24, height:24, borderRadius:"50%", background:C.forest, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, flexShrink:0, marginRight:8, marginTop:2 }}>🌿</div>}
            <div style={{ maxWidth:"80%", background:m.role==="user"?C.forest:"#F9FAFB", color:m.role==="user"?"#fff":"#1F2937", borderRadius:m.role==="user"?"16px 16px 4px 16px":"4px 16px 16px 16px", padding:"10px 14px", fontSize:12, lineHeight:1.55, whiteSpace:"pre-wrap" }}>
              {m.content.includes("---") ? (
                m.content.split(/(---[\s\S]*?---)/g).map((part,j) => {
                  if(part.startsWith("---")&&part.endsWith("---")) {
                    const sms = part.replace(/^---\n?/,"").replace(/\n?---$/,"").trim();
                    return <div key={j} style={{ background:"#F0FDF4", border:"1.5px solid #86EFAC", borderRadius:8, padding:"10px 12px", margin:"8px 0" }}>
                      <div style={{ fontSize:10, fontWeight:700, color:"#16A34A", marginBottom:6 }}>💬 SMS DRAFT - Click to copy</div>
                      <div style={{ fontSize:12, color:"#1F2937", marginBottom:8 }}>{sms}</div>
                      <button onClick={()=>navigator.clipboard.writeText(sms)} style={{ background:"#16A34A", color:"#fff", border:"none", borderRadius:5, padding:"4px 10px", fontSize:10, fontWeight:600, cursor:"pointer" }}>📋 Copy</button>
                    </div>;
                  }
                  return part ? <span key={j}>{part}</span> : null;
                })
              ) : m.content}
            </div>
          </div>
        ))}
        {loading&&<div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:24, height:24, borderRadius:"50%", background:C.forest, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11 }}>🌿</div>
          <div style={{ background:"#F9FAFB", borderRadius:"4px 16px 16px 16px", padding:"10px 14px", display:"flex", gap:4 }}>
            {[0,1,2].map(i=><div key={i} style={{ width:6, height:6, borderRadius:"50%", background:C.sage, animation:"bounce 1.2s infinite", animationDelay:`${i*0.2}s` }}/>)}
            <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
          </div>
        </div>}
        <div ref={bottomRef}/>
      </div>

      <div style={{ padding:"8px 16px", borderTop:`1px solid ${C.border}`, display:"flex", flexWrap:"wrap", gap:5 }}>
        {PROMPTS.map((p,i)=>(
          <button key={i} onClick={()=>send(p)} style={{ background:"#F3F4F6", border:"none", borderRadius:20, padding:"5px 12px", fontSize:11, color:C.gray, cursor:"pointer" }}>{p}</button>
        ))}
      </div>
      <div style={{ padding:"10px 16px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask anything..." style={{ flex:1, border:`1.5px solid ${C.border}`, borderRadius:10, padding:"8px 14px", fontSize:12, outline:"none", fontFamily:"system-ui" }}/>
        <button onClick={()=>send()} disabled={!input.trim()||loading} style={{ background:input.trim()&&!loading?C.forest:"#E5E7EB", color:input.trim()&&!loading?"#fff":"#9CA3AF", border:"none", borderRadius:10, padding:"8px 14px", fontSize:13, fontWeight:600, cursor:input.trim()&&!loading?"pointer":"not-allowed" }}>↑</button>
      </div>
    </div>
  );
}

// ── AUTOMATION HUB ────────────────────────────────────────────────────────────
function AutomationHub() {
  const [active, setActive] = useState(0);
  const flows = [
    {
      icon:"🍂",
      title:"Lapsed Client Re-engagement",
      trigger:"Client hasn't booked in 30 days",
      steps:[
        { icon:"🔍", label:"MyBodyMap detects", desc:"Automatically flags clients whose visit interval has broken" },
        { icon:"🤖", label:"Platform drafts message", desc:"Personalized SMS using their name, last focus area, and session history" },
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
        { icon:"🧠", label:"Platform adds insight", desc:"Pattern trends and pressure changes highlighted for the therapist" },
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
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:28, flexWrap:"wrap" }}>
        {flows.map((f,i)=>(
          <button key={i} onClick={()=>setActive(i)} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 18px", borderRadius:50, border:`1.5px solid ${active===i?C.forest:C.border}`, background:active===i?C.forest:"#fff", color:active===i?"#fff":C.dark, fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.2s" }}>
            <span>{f.icon}</span> {f.title.split(" ").slice(0,2).join(" ")}
          </button>
        ))}
      </div>

      <div style={{ background:"#fff", borderRadius:20, padding:32, boxShadow:"0 8px 40px rgba(0,0,0,0.08)", border:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
          <div style={{ fontSize:32 }}>{flow.icon}</div>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:C.dark, fontFamily:"Georgia, serif" }}>{flow.title}</div>
            <div style={{ fontSize:13, color:C.gray }}>Triggers when: <strong>{flow.trigger}</strong></div>
          </div>
        </div>
        <div style={{ height:2, background:`linear-gradient(90deg, ${C.forest}, ${C.sage}, transparent)`, borderRadius:99, marginBottom:28 }}/>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:0, position:"relative" }}>
          <div style={{ position:"absolute", top:28, left:"12.5%", right:"12.5%", height:2, background:`linear-gradient(90deg, ${C.forest}, ${C.sage})`, borderRadius:99, zIndex:0 }}/>
          {flow.steps.map((step,i)=>(
            <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", padding:"0 8px", position:"relative", zIndex:1 }}>
              <div style={{ width:56, height:56, borderRadius:"50%", background:C.forest, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, marginBottom:12, boxShadow:"0 4px 16px rgba(42,87,65,0.3)" }}>
                {step.icon}
              </div>
              <div style={{ fontSize:12, fontWeight:700, color:C.dark, marginBottom:4 }}>{step.label}</div>
              <div style={{ fontSize:11, color:C.gray, lineHeight:1.4 }}>{step.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop:28, background:"linear-gradient(135deg, #F0FDF4, #DCFCE7)", borderRadius:12, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:20 }}>📊</div>
          <div style={{ fontSize:14, fontWeight:600, color:C.forest }}>Result: {flow.result}</div>
        </div>
      </div>
    </div>
  );
}

// ── GROWTH ENGINE ─────────────────────────────────────────────────────────────
function GrowthEngine() {
  const retention = [
    { icon:"🔮", title:"Churn Prediction", desc:"MyBodyMap Platform detects when a regular client breaks their visit pattern - 7 days before they would have ghosted. You reach out first." },
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
function SectionNav() {
  const [active, setActive] = useState("pattern");
  const [visible, setVisible] = useState(false);
  const navRef = useRef(null);
  const sections = [
    { id:"bodymap",     label:"Body Map",               n:1  },
    { id:"pattern",     label:"Pattern Intelligence",   n:2  },
    { id:"booking",     label:"Online Booking",         n:3  },
    { id:"deposits",    label:"Deposits",               n:4  },
    { id:"intake",      label:"Client Intake",          n:5  },
    { id:"returning",   label:"Returning Clients",      n:6  },
    { id:"schedule",    label:"Schedule",               n:7  },
    { id:"reminders",   label:"Reminders",              n:8  },
    { id:"outreach",    label:"Smart Outreach",         n:9  },
    { id:"postsession", label:"Post-Session",           n:10 },
    { id:"billing",     label:"Billing",                n:11 },
    { id:"gifts",       label:"Gift Cards",             n:12 },
    { id:"ai",          label:"MyBodyMap Platform",             n:13 },
    { id:"mobile",      label:"On Your Phone",          n:14 },
    { id:"automation",  label:"Automation",             n:15 },
    { id:"growth",      label:"Growth Engine",          n:16 },
    { id:"portability", label:"Switching",              n:17 },
  ];
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 280);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if(e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin:"-30% 0px -60% 0px" });
    sections.forEach(s => { const el=document.getElementById(s.id); if(el) obs.observe(el); });
    return () => { window.removeEventListener('scroll', onScroll); obs.disconnect(); };
  }, []);

  // Minimal scroll handler. First principles:
  //   1. Target: the section's top edge lands exactly at the bottom of
  //      the fixed nav stack. Section's own 16px padding-top on mobile
  //      then provides breathing room above content — no extra buffer
  //      needed in JS.
  //   2. Measurement: read both main nav AND this section nav from the
  //      DOM. Use the larger .bottom as the fixed-stack bottom. This
  //      self-adapts to any device, font loading state, or safe-area-inset.
  //   3. Scroll: instant, not smooth. Smooth scrolling on iOS Safari
  //      has historically been unreliable AND makes timing harder to
  //      reason about. Instant snap is deterministic.
  const handleClick = (sectionId) => {
    setActive(sectionId);
    const el = document.getElementById(sectionId);
    if (!el) return;

    const mainNav = document.querySelector('nav');
    const sectionNav = navRef.current;
    const mainBottom = mainNav ? mainNav.getBoundingClientRect().bottom : 0;
    const secBottom = sectionNav ? sectionNav.getBoundingClientRect().bottom : 0;
    const navBottom = Math.max(mainBottom, secBottom, 64);

    const elTop = el.getBoundingClientRect().top + window.scrollY;
    const targetY = Math.max(0, elTop - navBottom);

    window.scrollTo({ top: targetY, behavior: 'smooth' });

    // Center the active pill in the horizontal scroller
    if (sectionNav) {
      const scroller = sectionNav.querySelector('div[style*="overflow"]');
      const activeBtn = sectionNav.querySelector(`button[data-id="${sectionId}"]`);
      if (scroller && activeBtn) {
        const scRect = scroller.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        const center = (btnRect.left - scRect.left) + scroller.scrollLeft + btnRect.width / 2;
        scroller.scrollTo({ left: Math.max(0, center - scRect.width / 2), behavior: 'smooth' });
      }
    }

    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', `#${sectionId}`);
    }
  };

  return (
    <div ref={navRef} style={{
      position:"fixed", top:64, left:0, right:0, zIndex:89,
      background:"rgba(255,255,255,0.98)", backdropFilter:"blur(12px)",
      borderBottom:`1px solid ${C.border}`, boxShadow:'0 2px 8px rgba(0,0,0,0.07)',
      transform: visible ? 'translateY(0)' : 'translateY(-100%)',
      transition: 'transform 0.25s ease',
    }}>
      <div style={{ maxWidth:1200, margin:"0 auto", display:"flex", overflowX:"auto", padding:"0 20px", scrollbarWidth:"none", msOverflowStyle:"none" }}>
        <style>{`.bm-secnav-scroll::-webkit-scrollbar{display:none}`}</style>
        <div className="bm-secnav-scroll" style={{ display:"flex", gap:2, padding:"14px 0" }}>
          {sections.map(s=>(
            <button key={s.id} type="button" data-id={s.id} onClick={()=>handleClick(s.id)}
              style={{
                padding:"8px 14px",
                fontSize:13,
                fontWeight:600,
                color:active===s.id?"#fff":C.gray,
                background: active===s.id ? C.forest : 'transparent',
                borderRadius:20,
                border:"none",
                cursor:"pointer",
                whiteSpace:"nowrap",
                transition:"all 0.18s",
                flexShrink:0,
                display:"flex",
                alignItems:"center",
                gap:7,
                fontFamily:"inherit",
              }}>
              <span style={{
                fontSize:10,
                fontWeight:700,
                color: active===s.id ? 'rgba(255,255,255,0.7)' : '#C7C7CC',
                minWidth:12,
              }}>{s.n}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Features() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div style={{ fontFamily:"system-ui, -apple-system, sans-serif", color:C.dark, paddingTop:64 }}>
      <Nav />
      <SectionNav />

      {/* HERO */}
      <section style={{ background:`linear-gradient(160deg, #0D1F17 0%, #1A3A28 50%, #2A5741 100%)`, padding:"100px 24px 90px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 50% 0%, rgba(107,158,128,0.15) 0%, transparent 70%)" }}/>
        <div style={{ maxWidth:860, margin:"0 auto", position:"relative", zIndex:1 }}>
          <FadeIn>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(107,158,128,0.15)", border:"1px solid rgba(107,158,128,0.3)", borderRadius:20, padding:"6px 16px", fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.8)", marginBottom:28 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"#6B9E80", display:"inline-block" }}/>
              Built exclusively for massage therapists
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(36px,5.5vw,64px)", fontWeight:700, color:"#FFFFFF", lineHeight:1.15, marginBottom:20, letterSpacing:"-0.02em" }}>
              The platform that turns<br/>
              <span style={{ color:C.gold }}>first-timers into regulars.</span>
            </h1>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p style={{ fontFamily:"Georgia, serif", fontStyle:"italic", fontSize:"clamp(18px,2.4vw,26px)", color:"rgba(255,255,255,0.85)", lineHeight:1.5, marginBottom:36, maxWidth:720, margin:"0 auto 36px" }}>
              Reminders, intake, follow-ups, all automatic.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p style={{ fontSize:"clamp(15px,1.8vw,18px)", color:"rgba(255,255,255,0.65)", lineHeight:1.65, marginBottom:44, maxWidth:580, margin:"0 auto 44px" }}>
              Visual body maps, pattern intelligence, and the memory your practice deserves. Built for the therapist who refuses to lose a client to being forgotten.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap", marginBottom:20 }}>
              <Link to="/signup" style={{ background:C.gold, color:"#fff", padding:"16px 36px", borderRadius:50, fontSize:16, fontWeight:700, textDecoration:"none", fontFamily:"Georgia, serif", boxShadow:"0 8px 24px rgba(201,168,76,0.4)" }}>
                Start Free - No Card Needed →
              </Link>
              <Link to="/pricing" style={{ background:"rgba(255,255,255,0.08)", color:"#fff", padding:"16px 36px", borderRadius:50, fontSize:16, fontWeight:600, textDecoration:"none", border:"1.5px solid rgba(255,255,255,0.2)" }}>
                View Pricing
              </Link>
            </div>
            <div style={{ textAlign:'center', marginBottom:52 }}>
              <Link to="/atlas" style={{
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
                fontSize: 14,
                color: 'rgba(255,255,255,0.65)',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.25)',
                paddingBottom: 2,
              }}>
                Or see every feature in one view, The Atlas →
              </Link>
            </div>
          </FadeIn>
          <FadeIn delay={0.4}>
            <div style={{ display:"flex", gap:48, justifyContent:"center", flexWrap:"wrap" }}>
              {[
                { label:"Patterns detected", value:12847, suffix:"+" },
                { label:"Client retention rate", value:94, suffix:"%" },
                { label:"Back office hours saved/mo", value:12, suffix:"hrs" },
              ].map((s,i)=>(
                <div key={i} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:"clamp(28px,3vw,42px)", fontWeight:700, color:"#fff", fontFamily:"Georgia, serif" }}>
                    <AnimatedCounter target={s.value} suffix={s.suffix} prefix={s.prefix||""}/>
                  </div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginTop:4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* THE OPPORTUNITY */}
      <section style={{ background:"#fff", padding:"80px 24px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:56 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>The Opportunity</div>
              <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(28px,3.5vw,48px)", fontWeight:700, color:C.dark, lineHeight:1.2, marginBottom:20 }}>
                What Makes a Complete Therapist?
              </h2>
              <p style={{ fontSize:17, color:C.gray, maxWidth:680, margin:"0 auto", lineHeight:1.75 }}>
                One who brings both exceptional technique <em>and</em> the technology to deliver an unforgettable experience. A client who feels their therapist remembers everything shared over two years. Who receives a perfectly-timed reminder to take care of themselves. Whose therapist walks in already knowing, so 99% of their energy goes to the work, not the back office. That therapist is you. MyBodyMap makes it possible.
              </p>
            </div>
          </FadeIn>
          <div className="bm-features-3col" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24 }}>
            {[
              { before:"Do you have any injuries?", after:"Medical flags surface automatically. You walk in already knowing.", icon:"🏥" },
              { before:"What pressure do you prefer?", after:"Saved from session 1. Carried forward forever. Never asked again.", icon:"💆" },
              { before:"Where should I focus today?", after:"Body map from last session opens on your phone. You walk in knowing.", icon:"🗺️" },
            ].map((item,i)=>(
              <FadeIn key={i} delay={i*0.1}>
                <div style={{ borderRadius:16, overflow:"hidden", border:`1px solid ${C.border}`, boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
                  <div style={{ background:"#FEF2F2", padding:"20px 24px", borderBottom:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#DC2626", textTransform:"uppercase", marginBottom:8 }}>Without MyBodyMap</div>
                    <div style={{ fontSize:15, color:"#DC2626", fontStyle:"italic" }}>"{item.before}"</div>
                  </div>
                  <div style={{ background:"#F0FDF4", padding:"20px 24px" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#16A34A", textTransform:"uppercase", marginBottom:8 }}>With MyBodyMap</div>
                    <div style={{ fontSize:15, color:"#1F2937", fontWeight:600 }}>{item.after}</div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* BODY MAP, Section 1, The Core Moat */}
      <section id="bodymap" style={{ scrollMarginTop:"112px", background:`linear-gradient(160deg,#0D1F17 0%,#1B3A28 60%,#2A5741 100%)`, padding:"100px 24px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:60 }}>
              <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(201,168,76,0.15)", border:"1px solid rgba(201,168,76,0.35)", borderRadius:20, padding:"6px 18px", fontSize:12, fontWeight:700, color:C.gold, letterSpacing:"0.08em", marginBottom:20 }}>
                ✦ NO COMPETITOR HAS THIS
              </div>
              <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(32px,4.5vw,58px)", fontWeight:700, color:"#fff", lineHeight:1.12, marginBottom:20 }}>
                The Visual Body Map
              </h2>
              <p style={{ fontSize:18, color:"rgba(255,255,255,0.65)", maxWidth:600, margin:"0 auto", lineHeight:1.7 }}>
                Every client maps their body before they arrive. Focus zones, avoid areas, pressure, medical flags, all captured visually, not verbally. Nothing else in the market does this.
              </p>
            </div>
          </FadeIn>
          <div className="bm-feat-2col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:72, alignItems:"center" }}>
            <FadeIn delay={0.1}>
              <div>
                <BodyMapDemo />
                <div style={{ textAlign:"center", marginTop:12, fontSize:12, color:"rgba(255,255,255,0.35)" }}>
                  ↑ Live demo, tap zones, switch front/back
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div>
                <div style={{ display:"flex", flexDirection:"column", gap:22, marginBottom:32 }}>
                  {[
                    { icon:"🖐️", title:"Tap-to-select, not type-to-explain", desc:"Clients tap exactly where they want work and what to avoid on a front/back body diagram. No forms. No free-text. Precise, visual, instant." },
                    { icon:"🔄", title:"Carries forward every session", desc:"After session 1, every future intake is pre-filled. Clients confirm or update in one tap. You never ask the same question twice." },
                    { icon:"🚨", title:"Medical flags surface automatically", desc:"Injuries, contraindications, and sensitivities are flagged before you walk in, not discovered mid-session." },
                    { icon:"📲", title:"Sent automatically after booking", desc:"The body map link fires the moment a booking is confirmed. No chasing. No paper. It's in your dashboard before the client arrives." },
                  ].map((f,i) => (
                    <div key={i} style={{ display:"flex", gap:16 }}>
                      <div style={{ width:42, height:42, borderRadius:11, background:"rgba(107,158,128,0.18)", border:"1px solid rgba(107,158,128,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
                        {f.icon}
                      </div>
                      <div>
                        <div style={{ fontSize:15, fontWeight:700, color:"#fff", marginBottom:5 }}>{f.title}</div>
                        <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.6 }}>{f.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:32 }}>
                  <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"14px 16px" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Bronze · Free</div>
                    <div style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.8)", lineHeight:1.5 }}>Full body map intake every session</div>
                  </div>
                  <div style={{ background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.3)", borderRadius:12, padding:"14px 16px" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Silver · $19/mo</div>
                    <div style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.8)", lineHeight:1.5 }}>+ Pattern intelligence across all sessions</div>
                  </div>
                </div>
                <Link to="/signup" style={{ display:"inline-block", background:C.gold, color:"#fff", padding:"14px 32px", borderRadius:50, fontSize:15, fontWeight:700, textDecoration:"none", fontFamily:"Georgia, serif" }}>
                  Start with the Body Map →
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* PATTERN INTELLIGENCE */}
      <section id="pattern" style={{ scrollMarginTop:"112px", background:`linear-gradient(180deg, #0D1F17 0%, #1A3A28 100%)`, padding:"100px 24px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:60 }}>
              <div style={{ display:"inline-block", background:"rgba(201,168,76,0.15)", border:"1px solid rgba(201,168,76,0.3)", borderRadius:20, padding:"5px 16px", fontSize:12, fontWeight:700, color:C.gold, letterSpacing:"0.08em", marginBottom:16 }}>
                EXCLUSIVE TO BODYMAP - NO COMPETITOR HAS THIS
              </div>
              <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(32px,4vw,56px)", fontWeight:700, color:"#fff", lineHeight:1.15, marginBottom:20 }}>
                Pattern Intelligence
              </h2>
              <p style={{ fontSize:18, color:"rgba(255,255,255,0.65)", maxWidth:620, margin:"0 auto" }}>
                After a few sessions, MyBodyMap reveals what this client always needs - patterns memory alone would miss. This is the intelligence layer that makes you irreplaceable.
              </p>
              <div style={{ display:"inline-flex", gap:12, marginTop:28, flexWrap:"wrap", justifyContent:"center" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:24, padding:"8px 18px" }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:"#9CA3AF", display:"inline-block" }}/>
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)", fontWeight:600 }}>Bronze: last 5 sessions</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(201,168,76,0.12)", border:"1px solid rgba(201,168,76,0.35)", borderRadius:24, padding:"8px 18px" }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:C.gold, display:"inline-block" }}/>
                  <span style={{ fontSize:12, color:C.gold, fontWeight:700 }}>Silver: unlimited session history</span>
                </div>
              </div>
            </div>
          </FadeIn>
          <div className="bm-feat-2col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:80, alignItems:"center" }}>
            <FadeIn delay={0.1}>
              <PatternDemo />
            </FadeIn>
            <FadeIn delay={0.2}>
              <div>
                <div style={{ display:"flex", flexDirection:"column", gap:20, marginBottom:32 }}>
                  {[
                    { icon:"📍", title:"Body Area Frequency", desc:"Track exactly which areas clients focus on across every session. Lower back 9 of 10 visits isn't a preference - it's a chronic condition. Treat it accordingly." },
                    { icon:"📈", title:"Pressure Trend Tracking", desc:"When a client's pressure tolerance escalates from 3 to 5 over 8 sessions, MyBodyMap shows you the trend. You adapt before they have to ask." },
                    { icon:"⚠️", title:"Avoid Area Memory", desc:"A client avoided their knees every single session. Do you remember that after 6 months? MyBodyMap does. Permanently." },
                    { icon:"🤖", title:"Pattern Summary", desc:"After each session, MyBodyMap Platform summarizes what's changing in this client's body - in plain language, without you asking." },
                  ].map((f,i)=>(
                    <div key={i} style={{ display:"flex", gap:14 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:"rgba(107,158,128,0.15)", border:"1px solid rgba(107,158,128,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{f.icon}</div>
                      <div>
                        <div style={{ fontSize:15, fontWeight:700, color:"#fff", marginBottom:4 }}>{f.title}</div>
                        <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.55 }}>{f.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:14, padding:"18px 22px", marginBottom:28 }}>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", marginBottom:8 }}>From a real therapist</div>
                  <div style={{ fontSize:15, color:"rgba(255,255,255,0.85)", fontStyle:"italic", lineHeight:1.6 }}>"Pattern intelligence is what makes MyBodyMap irreplaceable. After 6 sessions, it knows my client better than I do."</div>
                </div>
                <Link to="/signup" style={{ display:"inline-block", background:C.gold, color:"#fff", padding:"14px 28px", borderRadius:50, fontSize:15, fontWeight:700, textDecoration:"none", fontFamily:"Georgia, serif" }}>
                  Unlock Pattern Intelligence →
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>
      {/* ONLINE BOOKING */}
      <section id="booking" style={{ scrollMarginTop:"112px", padding:"80px 24px", background:"#fff" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:48 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Online Booking</div>
              <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(28px,4vw,44px)", fontWeight:700, color:C.dark, lineHeight:1.15, marginBottom:16 }}>
                Book in 2 Taps.<br/>No Account. No App.
              </h2>
              <p style={{ fontSize:16, color:C.gray, maxWidth:600, margin:"0 auto", lineHeight:1.7 }}>
                One link. Clients pick a service, choose a time, confirm. Smart recommendations fill gaps in your day automatically.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:20 }}>
              {[
                { icon:"🔗", title:"One shareable link", desc:"Share mybodymap.app/book/yourname anywhere. Instagram, text, email." },
                { icon:"⚡", title:"Smart gap filling", desc:"Recommended slots fill holes in your day. No more 9 AM and 3 PM with nothing in between." },
                { icon:"📋", title:"Intake flows immediately", desc:"After booking, clients fill their body map in the same session. Zero extra steps." },
                { icon:"📧", title:"Auto confirmations", desc:"Clients get a confirmation instantly. No manual follow-up needed." },
              ].map(({icon,title,desc}) => (
                <div key={title} style={{ background:C.beige, borderRadius:16, padding:24 }}>
                  <div style={{ fontSize:28, marginBottom:12 }}>{icon}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.dark, marginBottom:8 }}>{title}</div>
                  <div style={{ fontSize:13, color:C.gray, lineHeight:1.7 }}>{desc}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>


      {/* INTAKE */}

      {/* AUTOMATED REMINDERS */}
      {/* DEPOSITS */}
      <section id="deposits" style={{ scrollMarginTop:"112px", padding:"80px 24px", background:"#fff" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:48 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>New Client Deposits</div>
              <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(28px,4vw,44px)", fontWeight:700, color:C.dark, lineHeight:1.15, marginBottom:16 }}>
                Protect Your Time.<br/>No-shows cost you.
              </h2>
              <p style={{ fontSize:16, color:C.gray, maxWidth:600, margin:"0 auto", lineHeight:1.7 }}>
                Require first-time clients to pay a deposit when booking. Repeat clients are never charged. One setting. Zero friction for loyal clients.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:20 }}>
              {[
                { icon:"💳", title:"Automatic deposit collection", desc:"Set your deposit percentage in Settings. MyBodyMap handles collection automatically at booking time." },
                { icon:"🔁", title:"Repeat clients pay nothing extra", desc:"Clients who have booked before are never asked for a deposit. Loyalty is rewarded automatically." },
                { icon:"⚙️", title:"You control the percentage", desc:"Set any percentage from 5% to 100%. Recommended 20-50%. For an $85 session, 20% is a $17 hold." },
                { icon:"📊", title:"Deposit status on your schedule", desc:"See instantly which new clients have paid their deposit and which are still pending." },
              ].map(({icon,title,desc}) => (
                <div key={title} style={{ background:C.beige, borderRadius:16, padding:24 }}>
                  <div style={{ fontSize:28, marginBottom:12 }}>{icon}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.dark, marginBottom:8 }}>{title}</div>
                  <div style={{ fontSize:13, color:C.gray, lineHeight:1.7 }}>{desc}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      <section id="reminders" style={{ scrollMarginTop:"112px", padding:"80px 24px", background:C.beige }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:48 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Automated Reminders</div>
              <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(28px,4vw,44px)", fontWeight:700, color:C.dark, lineHeight:1.15, marginBottom:16 }}>
                Never Chase a Client Again.
              </h2>
              <p style={{ fontSize:16, color:C.gray, maxWidth:600, margin:"0 auto", lineHeight:1.7 }}>
                MyBodyMap sends every client a reminder 24 hours before their session - with their intake form link included. Automatic. Every day.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:20 }}>
              {[
                { icon:"📧", title:"24h automatic email", desc:"Sent from your domain every morning. Branded and personal - not generic spam." },
                { icon:"📋", title:"Intake link included", desc:"Every reminder links directly to the client body map. More completions, better sessions." },
                { icon:"✅", title:"Delivery status visible", desc:"See which clients got their reminder and who still needs intake. No guessing." },
                { icon:"🔄", title:"Zero configuration", desc:"Set up once. Runs every day automatically. Nothing to remember." },
              ].map(({icon,title,desc}) => (
                <div key={title} style={{ background:"#fff", borderRadius:16, padding:24 }}>
                  <div style={{ fontSize:28, marginBottom:12 }}>{icon}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.dark, marginBottom:8 }}>{title}</div>
                  <div style={{ fontSize:13, color:C.gray, lineHeight:1.7 }}>{desc}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* CLIENT INTAKE */}
      <section id="intake" style={{ scrollMarginTop:"112px", padding:"80px 24px", background:"#fff" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:56 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Client Intake</div>
              <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(28px,4vw,44px)", fontWeight:700, color:C.dark, lineHeight:1.15, marginBottom:16 }}>
                She tells you where it hurts. Before she arrives.
              </h2>
              <p style={{ fontSize:16, color:C.gray, maxWidth:600, margin:"0 auto", lineHeight:1.7 }}>
                A visual body map sent automatically after every booking. Clients tap exactly where they need work and what to avoid. Preferences saved permanently, never asked again.
              </p>
            </div>
          </FadeIn>
          <div className="bm-feat-2col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:72, alignItems:"center" }}>
            <FadeIn delay={0.1}>
              <div>
                <BodyMapDemo />
                <div style={{ textAlign:"center", marginTop:10, fontSize:12, color:C.gray }}>↑ Try it, tap zones, switch front/back, toggle focus/avoid</div>
              </div>
            </FadeIn>
            <FadeIn delay={0.15}>
              <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
                {[
                  { icon:"🗺️", title:"Visual body map", desc:"Front and back body diagram. Clients tap focus areas and avoid zones. Immediately visible in your dashboard before the session." },
                  { icon:"🔁", title:"Carried forward forever", desc:"Preferences from session 1 pre-fill every future intake. Returning clients confirm in one tap. New info layers on top." },
                  { icon:"🚨", title:"Medical flags surface automatically", desc:"Injuries, conditions, and contraindications are flagged immediately. You see them before you walk in." },
                  { icon:"📲", title:"Sent automatically after booking", desc:"The intake link fires the moment a booking is confirmed. No chasing. No paper. No verbal check-ins on the table." },
                ].map(({icon,title,desc}) => (
                  <div key={title} style={{ display:"flex", gap:14 }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:C.beige, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:C.dark, marginBottom:4 }}>{title}</div>
                      <div style={{ fontSize:13, color:C.gray, lineHeight:1.65 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* RETURNING CLIENT PRE-FILL */}
      <section id="returning" style={{ scrollMarginTop:"112px", padding:"80px 24px", background:`linear-gradient(160deg, #0D1F17 0%, #1A3A28 100%)` }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:56 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Returning Clients</div>
              <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(28px,4vw,44px)", fontWeight:700, color:"#fff", lineHeight:1.15, marginBottom:16 }}>
                After Session One,<br/>They Never Start From Scratch.
              </h2>
              <p style={{ fontSize:16, color:"rgba(255,255,255,0.65)", maxWidth:620, margin:"0 auto", lineHeight:1.7 }}>
                MyBodyMap remembers every client's preferences, zones, pressure, music, lighting, what to avoid. When they book again, their intake arrives pre-filled. One tap to confirm. Done in 10 seconds.
              </p>
            </div>
          </FadeIn>

          <div className="bm-feat-2col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:72, alignItems:"center" }}>
            {/* Phone mockup of welcome back banner */}
            <FadeIn delay={0.1}>
              <div style={{ display:"flex", justifyContent:"center" }}>
                <div style={{ width:300, background:"#F0EAD9", borderRadius:32, overflow:"hidden", boxShadow:"0 32px 80px rgba(0,0,0,0.5)", border:"8px solid #1A1A2E" }}>
                  {/* Welcome back banner */}
                  <div style={{ background:"#FDF6E8", borderBottom:"1.5px solid #D4B070", padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
                    <div>
                      <div style={{ fontFamily:"system-ui", fontSize:13, fontWeight:800, color:"#B87840" }}>✦ Welcome back, Sarah!</div>
                      <div style={{ fontFamily:"system-ui", fontSize:11, color:"#7A9485", marginTop:2 }}>Tap to pre-fill your preferences</div>
                    </div>
                    <div style={{ background:"#B87840", color:"#fff", borderRadius:20, padding:"7px 13px", fontFamily:"system-ui", fontSize:11, fontWeight:800, whiteSpace:"nowrap", flexShrink:0 }}>
                      Use Last Session
                    </div>
                  </div>
                  {/* Body map preview */}
                  <div style={{ padding:"16px 18px" }}>
                    <div style={{ fontFamily:"Georgia, serif", fontSize:18, fontWeight:700, color:"#1A3A28", marginBottom:4 }}>Front of Body</div>
                    <div style={{ fontFamily:"system-ui", fontSize:11, color:"#6B7280", marginBottom:12 }}>Your zones from last session, pre-filled</div>
                    {/* Simplified body zones */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:10 }}>
                      {[
                        {label:"Neck",color:"#2A5741",text:"#fff"},
                        {label:"L. Shoulder",color:"#2A5741",text:"#fff"},
                        {label:"R. Shoulder",color:"#2A5741",text:"#fff"},
                        {label:"Chest",color:"#4A7A5C",text:"#fff"},
                        {label:"Abdomen",color:"#4A7A5C",text:"#fff"},
                        {label:"Arms",color:"#E5E7EB",text:"#9CA3AF"},
                        {label:"L. Knee",color:"#DC2626",text:"#fff"},
                        {label:"R. Knee",color:"#DC2626",text:"#fff"},
                        {label:"Feet",color:"#E5E7EB",text:"#9CA3AF"},
                      ].map(z => (
                        <div key={z.label} style={{ background:z.color, borderRadius:8, padding:"7px 4px", textAlign:"center", fontFamily:"system-ui", fontSize:9, fontWeight:700, color:z.text }}>
                          {z.label}
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:10, fontFamily:"system-ui", fontSize:10, color:"#6B7280" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ width:10, height:10, borderRadius:3, background:"#2A5741" }}/> Focus</div>
                      <div style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ width:10, height:10, borderRadius:3, background:"#DC2626" }}/> Avoid</div>
                      <div style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ width:10, height:10, borderRadius:3, background:"#E5E7EB" }}/> Neutral</div>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.15}>
              <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
                {[
                  { icon:"🧠", title:"Remembers everything", desc:"Zones, pressure level, music preference, lighting, draping, medical flags, all stored from session one and carried forward automatically." },
                  { icon:"⚡", title:"10-second intake for returning clients", desc:"The welcome back banner appears the moment they open the link. One tap and they are done. No re-entering anything they already told you." },
                  { icon:"📈", title:"Every session adds a layer", desc:"If something changes, a new injury, a different pressure preference, they update just that field. Everything else stays. The record gets richer over time." },
                  { icon:"🔒", title:"No competitor has this", desc:"Vagaro, MassageBook, and Acuity send a blank intake every time. MyBodyMap is the only platform that treats returning clients as the individuals they are." },
                ].map(({icon,title,desc}) => (
                  <div key={title} style={{ display:"flex", gap:14 }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:"rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"#fff", marginBottom:4 }}>{title}</div>
                      <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.65 }}>{desc}</div>
                    </div>
                  </div>
                ))}
                <a href={`/bodymapdemopractice?name=Sarah+Mitchell&email=sarah.demo@bodymap.test`}
                  style={{ display:"inline-flex", alignItems:"center", gap:8, background:C.sage, color:"#fff", padding:"13px 24px", borderRadius:12, textDecoration:"none", fontFamily:"system-ui", fontSize:14, fontWeight:700, width:"fit-content", marginTop:8 }}>
                  See it live, open Sarah's intake →
                </a>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* SCHEDULE */}
      <section id="schedule" style={{ scrollMarginTop:"112px", padding:"100px 24px", background:C.beige }}>
        <div className="bm-feat-2col" style={{ maxWidth:1100, margin:"0 auto", display:"grid", gridTemplateColumns:"1fr 1fr", gap:80, alignItems:"center" }}>
          <FadeIn>
            <div>
              <ScheduleDemo />
              <div style={{ textAlign:"center", marginTop:10, fontSize:12, color:C.gray }}>↑ Click tabs and appointments to explore</div>
            </div>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Schedule</div>
              <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(28px,3vw,44px)", fontWeight:700, color:C.dark, lineHeight:1.2, marginBottom:20 }}>
                Your Entire Day.<br/>Every Client's Status.<br/>One Screen.
              </h2>
              <p style={{ fontSize:16, color:C.gray, lineHeight:1.7, marginBottom:32 }}>
                Daily, weekly, and monthly views show you exactly who's ready, who needs an intake link, and who to follow up with. Click any appointment - their body map history, focus areas, and session count appear instantly.
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:32 }}>
                {["Daily, weekly, monthly, and insights views","One-tap SMS to send intake links to pending clients","Slide-out client profile with full body map history","Action hub: send intake, open brief, view profile - all from schedule","Cal.com integration coming for automatic sync"].map((f,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, fontSize:15, color:C.dark }}>
                    <div style={{ width:20, height:20, borderRadius:"50%", background:"#DCFCE7", color:"#16A34A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0, marginTop:1 }}>✓</div>
                    {f}
                  </div>
                ))}
              </div>
              <Link to="/signup" style={{ display:"inline-block", background:C.forest, color:"#fff", padding:"14px 28px", borderRadius:50, fontSize:15, fontWeight:600, textDecoration:"none" }}>
                Get Started Free →
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* SMART OUTREACH */}
      <section id="outreach" style={{ scrollMarginTop:"112px", padding:"80px 24px", background:"#fff" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:56 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Smart Outreach</div>
              <h2 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(28px,4vw,42px)", fontWeight:700, color:C.dark, margin:"0 0 20px", lineHeight:1.2 }}>
                Fill your calendar without the awkward follow-up
              </h2>
              <p style={{ fontSize:18, color:C.textLight, maxWidth:600, margin:"0 auto", lineHeight:1.7 }}>
                Send a personal message to your lapsed clients, your regulars, or anyone past their usual visit interval, in one tap. Each client gets their own message with their name. You set it and forget it.
              </p>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:32 }}>
              {[
                { icon:"🍂", title:"Smart segments", desc:"Lapsed clients. Due for a visit. Never rebooked. Your regulars. Or build your own filter with custom conditions." },
                { icon:"💬", title:"Email and SMS", desc:"Send by email or text. Each message is personalized with the client's first name and your direct booking link." },
                { icon:"🧪", title:"Test before you send", desc:"Preview exactly what a client will see and send a test to yourself before it goes to anyone on your list." },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{ background:C.beige, borderRadius:16, padding:28 }}>
                  <div style={{ fontSize:32, marginBottom:16 }}>{icon}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:C.dark, marginBottom:8 }}>{title}</div>
                  <div style={{ fontSize:15, color:C.textLight, lineHeight:1.7 }}>{desc}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* POST-SESSION BRIEF */}
      <section id="postsession" style={{ scrollMarginTop:"112px", padding:"80px 24px", background:C.beige }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:56 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Post-Session Brief</div>
              <h2 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(28px,4vw,42px)", fontWeight:700, color:C.dark, margin:"0 0 20px", lineHeight:1.2 }}>
                The session doesn't end when the client leaves
              </h2>
              <p style={{ fontSize:18, color:C.textLight, maxWidth:600, margin:"0 auto", lineHeight:1.7 }}>
                The moment you mark a session complete, your client receives a beautifully formatted summary, your personal message, session notes, a self-care tip, and a direct link to book their next visit.
              </p>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:32 }}>
              {[
                { icon:"✉️", title:"Automatic delivery", desc:"Fires the instant you mark a session complete. No extra steps. Your client hears from you while the session is still fresh." },
                { icon:"📋", title:"Your words, their inbox", desc:"Write a personal message in the Session Record, stretches to try, what improved, what to focus on next time. It goes straight to them." },
                { icon:"📅", title:"Book next session button", desc:"Every brief includes a direct link to book their next appointment. The best time to rebook is right after a great session." },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{ background:C.white, borderRadius:16, padding:28 }}>
                  <div style={{ fontSize:32, marginBottom:16 }}>{icon}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:C.dark, marginBottom:8 }}>{title}</div>
                  <div style={{ fontSize:15, color:C.textLight, lineHeight:1.7 }}>{desc}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* BILLING */}
      <section id="billing" style={{ scrollMarginTop:"112px", padding:"80px 24px", background:"#fff" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:48 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Billing</div>
              <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(28px,4vw,44px)", fontWeight:700, color:C.dark, lineHeight:1.15, marginBottom:16 }}>
                Know Exactly Where Your<br/>Revenue Stands. Always.
              </h2>
              <p style={{ fontSize:16, color:C.gray, maxWidth:600, margin:"0 auto", lineHeight:1.7 }}>
                See expected vs collected revenue at a glance. Daily, weekly, and monthly views. Know which clients owe, which sessions are complete, and what's coming.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:20 }}>
              {[
                { icon:"📈", title:"Expected vs collected", desc:"See your projected revenue from upcoming bookings and your collected revenue from completed sessions, side by side." },
                { icon:"📅", title:"Daily, weekly, monthly views", desc:"Switch between views to see today's earnings, this week's performance, or the full month at a glance." },
                { icon:"💳", title:"Deposit tracking", desc:"Deposits are automatically counted toward expected revenue. See which clients have paid and which are pending." },
                { icon:"🔔", title:"Session rate drives everything", desc:"Set your hourly rate once in Settings. Every revenue projection across every view updates automatically." },
              ].map(({icon,title,desc}) => (
                <div key={title} style={{ background:C.beige, borderRadius:16, padding:24 }}>
                  <div style={{ fontSize:28, marginBottom:12 }}>{icon}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.dark, marginBottom:8 }}>{title}</div>
                  <div style={{ fontSize:13, color:C.gray, lineHeight:1.7 }}>{desc}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* GIFT CARDS */}
      <section id="gifts" style={{ scrollMarginTop:"112px", padding:"90px 24px", background:"linear-gradient(135deg, #FFF1F5 0%, #FFE4E6 40%, #FFF9F3 100%)", position:"relative", overflow:"hidden" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", position:"relative", zIndex:2 }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:52 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#E85C79", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>♡ Gift Cards</div>
              <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(28px,4vw,44px)", fontWeight:700, color:C.dark, lineHeight:1.15, marginBottom:16 }}>
                Give the gift of <em style={{ color:"#E85C79", fontStyle:"italic" }}>feeling good.</em>
              </h2>
              <p style={{ fontSize:16, color:C.gray, maxWidth:620, margin:"0 auto", lineHeight:1.7 }}>
                For the mother who gives everything. The friend in a hard season. The partner who deserves to be cared for. Gift cards travel where flowers can't, and they bring clients back through your door.
              </p>
            </div>
          </FadeIn>
          {/* Demo video showing the gift card creation flow. Autoplays muted
              and loops so it acts like an animated illustration rather than
              a video the user has to play. playsInline lets it autoplay on
              iOS without going fullscreen. */}
          <FadeIn delay={0.05}>
            <div style={{ maxWidth:680, margin:"0 auto 40px", borderRadius:20, overflow:"hidden", boxShadow:"0 12px 40px rgba(232,92,121,0.18)", border:"1.5px solid rgba(251,207,232,0.6)", background:"#fff" }}>
              <video
                src="/videos/gift-cards.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                style={{ display:"block", width:"100%", height:"auto" }}
              />
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:20 }}>
              {[
                { icon:"🌸", title:"Beautiful by default", desc:"Every card comes with a rose-and-cream design, botanical flourishes, and space for a personal note. Nothing feels transactional." },
                { icon:"💌", title:"Live preview as you create", desc:"See the gift card build in real time as you fill in the recipient, amount, and message. What you see is what they'll receive." },
                { icon:"🎁", title:"One-tap preset amounts", desc:"$65, $85, $120, $150, $200, or any custom amount. Clients and purchasers can redeem at booking or in-person with a unique code." },
                { icon:"💝", title:"Mother's Day to Christmas", desc:"Gift card sales spike around holidays. MyBodyMap makes it as easy as texting your booking link, and each redemption brings a new client." },
              ].map(({icon,title,desc}) => (
                <div key={title} style={{ background:"rgba(255,255,255,0.75)", backdropFilter:"blur(6px)", borderRadius:16, padding:24, border:"1.5px solid rgba(251,207,232,0.6)" }}>
                  <div style={{ fontSize:28, marginBottom:12 }}>{icon}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.dark, marginBottom:8, fontFamily:"Georgia, serif" }}>{title}</div>
                  <div style={{ fontSize:13, color:C.gray, lineHeight:1.7 }}>{desc}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* AI */}
      <section id="ai" style={{ scrollMarginTop:"112px", padding:"100px 24px", background:`linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 50%, #F0FDF4 100%)` }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:60 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>MyBodyMap Platform</div>
              <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(30px,4vw,52px)", fontWeight:700, color:C.dark, lineHeight:1.15, marginBottom:20 }}>
                A Platform That Knows Your Clients.<br/>Not Just Massage in General.
              </h2>
              <p style={{ fontSize:17, color:C.gray, maxWidth:620, margin:"0 auto" }}>
                GlossGenius has an AI. Mindbody has AI predictions. But neither knows that Sarah's left shoulder has been worsening for 7 sessions, or that Monica just broke her 8-month monthly pattern. The MyBodyMap Platform does.
              </p>
            </div>
          </FadeIn>
          <div className="bm-feat-2col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:60, alignItems:"start" }}>
            <FadeIn delay={0.1}>
              <div>
                <AIDemo />
                <div style={{ textAlign:"center", marginTop:10, fontSize:12, color:C.gray }}>↑ Try the suggested questions to see real-data responses</div>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div>
                <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:24 }}>
                  {[
                    { q:"Which clients need re-engagement?", a:"Flags lapsed clients by name, with days since last visit and pattern context", tag:"Retention" },
                    { q:"Draft an SMS for Monica", a:"Writes a personalized message using her body history, not a generic template", tag:"Automation" },
                    { q:"How is my revenue trending?", a:"Compares 30-day collected vs expected, highlights your best clients", tag:"Billing" },
                    { q:"What patterns does Sarah have?", a:"Surfaces her body area frequency, pressure trend, and Platform insight in seconds", tag:"Patterns" },
                  ].map(({q,a,tag})=>(
                    <div key={q} style={{ background:"#fff", borderRadius:14, padding:"16px 20px", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", border:`1px solid ${C.border}` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                        <div style={{ background:"#DCFCE7", color:"#16A34A", borderRadius:20, padding:"2px 10px", fontSize:10, fontWeight:700 }}>{tag}</div>
                      </div>
                      <div style={{ fontSize:14, fontWeight:700, color:C.dark, marginBottom:4 }}>"{q}"</div>
                      <div style={{ fontSize:13, color:C.gray }}>{a}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background:"#FEF3C7", borderRadius:12, padding:"14px 18px", fontSize:13, color:"#92400E", lineHeight:1.5 }}>
                  💡 The demo uses sample data. When you're logged in, MyBodyMap Platform has access to your real clients, sessions, body maps, and revenue - and answers from that context, not generic knowledge.
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* MOBILE · PWA · PUSH */}
      <section id="mobile" style={{ scrollMarginTop:"112px", padding:"100px 24px", background:"linear-gradient(160deg, #0D1F17 0%, #1B3A28 60%, #2A5741 100%)", position:"relative", overflow:"hidden" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", position:"relative", zIndex:2 }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:56 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#86EFAC", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>On Your Phone</div>
              <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(30px,4vw,52px)", fontWeight:700, color:"#fff", lineHeight:1.15, marginBottom:20 }}>
                Your Practice,<br/>In Your Pocket.
              </h2>
              <p style={{ fontSize:17, color:"rgba(255,255,255,0.75)", maxWidth:620, margin:"0 auto", lineHeight:1.7 }}>
                Install MyBodyMap to your home screen in two taps. No app store. No download. Just a tap on the Safari share button and you're in. Then when a client books, replies, or goes quiet, a gentle tap on your phone tells you.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:20 }}>
              {[
                { icon:"📲", title:"Install to home screen", desc:"Tap Share in Safari, then Add to Home Screen. MyBodyMap opens like any native app, full screen, no browser bar." },
                { icon:"🔔", title:"Push notifications", desc:"Know the moment a client books, a gift card is redeemed, or a lapsed client replies. No need to check email or refresh." },
                { icon:"🌿", title:"Built for thumbs", desc:"Every screen rebuilt for one-handed use. Bottom nav, large tap targets, sliding panels. Runs smoothly on iPhone SE and up." },
                { icon:"⚡", title:"Works when Wi-Fi doesn't", desc:"Session notes, schedule, and client profiles load instantly from cache. Come back online and everything syncs." },
              ].map(({icon,title,desc}) => (
                <div key={title} style={{ background:"rgba(255,255,255,0.06)", backdropFilter:"blur(8px)", borderRadius:16, padding:24, border:"1px solid rgba(134,239,172,0.2)" }}>
                  <div style={{ fontSize:28, marginBottom:12 }}>{icon}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#fff", marginBottom:8, fontFamily:"Georgia, serif" }}>{title}</div>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.7)", lineHeight:1.7 }}>{desc}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* AUTOMATION */}
      <section id="automation" style={{ scrollMarginTop:"112px", padding:"100px 24px", background:C.beige }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:56 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Automation Hub</div>
              <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(30px,4vw,52px)", fontWeight:700, color:C.dark, lineHeight:1.15, marginBottom:20 }}>
                Set It Once.<br/>MyBodyMap Runs Your Practice.
              </h2>
              <p style={{ fontSize:17, color:C.gray, maxWidth:620, margin:"0 auto" }}>
                Don't send that re-engagement text. Don't assemble that pre-session brief. Don't remember to follow up. MyBodyMap detects, drafts, and acts - you approve in one tap.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <AutomationHub />
          </FadeIn>
        </div>
      </section>

      {/* GROWTH */}
      <section id="growth" style={{ scrollMarginTop:"112px", padding:"100px 24px", background:"#fff" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:56 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Growth Engine</div>
              <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(30px,4vw,52px)", fontWeight:700, color:C.dark, lineHeight:1.15, marginBottom:20 }}>
                Retain Every Client.<br/>Attract New Ones.
              </h2>
              <p style={{ fontSize:17, color:C.gray, maxWidth:620, margin:"0 auto" }}>
                Other tools help you manage clients. MyBodyMap helps you grow. Built-in retention intelligence catches churn before it happens. Natural referral loops bring new clients in without advertising.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <GrowthEngine />
          </FadeIn>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section style={{ background:C.beige, padding:"60px 24px" }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <FadeIn>
            <div className="bm-features-3col" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24 }}>
              {[
                { stat:"$0/mo", desc:"Free during beta on Bronze. No credit card." },
                { stat:"30 sec", desc:"Time for a client to complete their intake. No app, no login." },
                { stat:"0", desc:"Competitors with visual body pattern tracking over time." },
              ].map((s,i)=>(
                <div key={i} style={{ background:"#fff", borderRadius:16, padding:"28px 24px", textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
                  <div style={{ fontFamily:"Georgia, serif", fontSize:42, fontWeight:700, color:C.forest, marginBottom:8 }}>{s.stat}</div>
                  <div style={{ fontSize:14, color:C.gray, lineHeight:1.5 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ background:`linear-gradient(160deg, #0D1F17 0%, #1A3A28 50%, #2A5741 100%)`, padding:"100px 24px", textAlign:"center" }}>
        <div style={{ maxWidth:700, margin:"0 auto" }}>
          <FadeIn>
            <h2 style={{ fontFamily:"Georgia, serif", fontSize:"clamp(32px,4.5vw,56px)", fontWeight:700, color:"#fff", lineHeight:1.15, marginBottom:20 }}>
              Every massage therapist<br/>remembers every client,<br/>every time.
            </h2>
            <p style={{ fontSize:18, color:"rgba(255,255,255,0.65)", marginBottom:44 }}>
              Free during beta on Bronze. Every tool you need to retain clients and grow your practice.
            </p>
            <div style={{ display:"flex", gap:16, justifyContent:"center", flexWrap:"wrap", marginBottom:24 }}>
              <Link to="/signup" style={{ background:C.gold, color:"#fff", padding:"18px 44px", borderRadius:50, fontSize:18, fontWeight:700, textDecoration:"none", fontFamily:"Georgia, serif", boxShadow:"0 8px 32px rgba(201,168,76,0.4)" }}>
                Start Free - No Card Needed →
              </Link>
              <Link to="/pricing" style={{ background:"rgba(255,255,255,0.08)", color:"#fff", padding:"18px 44px", borderRadius:50, fontSize:18, fontWeight:600, textDecoration:"none", border:"1.5px solid rgba(255,255,255,0.2)" }}>
                View Pricing
              </Link>
            </div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.35)" }}>No credit card · Setup in 30 seconds · Cancel anytime</div>
          </FadeIn>
        </div>
      </section>

      {/* PORTABILITY */}
      <section id="portability" style={{ scrollMarginTop:"112px", padding:"80px 24px", background:"#fff" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ textAlign:"center", marginBottom:56 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Switching is Easy</div>
              <h2 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(28px,4vw,42px)", fontWeight:700, color:C.dark, margin:"0 0 20px", lineHeight:1.2 }}>
                Bring your entire client history with you
              </h2>
              <p style={{ fontSize:18, color:C.textLight, maxWidth:620, margin:"0 auto", lineHeight:1.7 }}>
                Already using MassageBook, Vagaro, GlossGenius, or Mindbody? Import your full client list in under 5 minutes. Your history, your patterns, your relationships, all carry over.
              </p>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:24, marginBottom:40 }}>
              {[
                { icon:"📋", title:"Client list import", desc:"Upload a CSV from any platform. Names, emails, phones, notes, all mapped automatically. Duplicates are detected and merged." },
                { icon:"📅", title:"Appointment history", desc:"Import past sessions so lapsed detection and pattern intelligence work from day one, not after months of building new data." },
                { icon:"📆", title:"Upcoming bookings", desc:"Import your upcoming appointment schedule so your calendar isn't empty on day one. Clients are notified via your new MyBodyMap link." },
                { icon:"🔗", title:"Supported platforms", desc:"MassageBook, Vagaro, GlossGenius, Mindbody, Square, or any CSV file. If it exports a spreadsheet, MyBodyMap can import it." },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{ background:C.beige, borderRadius:16, padding:28 }}>
                  <div style={{ fontSize:32, marginBottom:14 }}>{icon}</div>
                  <div style={{ fontSize:17, fontWeight:700, color:C.dark, marginBottom:8 }}>{title}</div>
                  <div style={{ fontSize:14, color:C.textLight, lineHeight:1.7 }}>{desc}</div>
                </div>
              ))}
            </div>
            <div style={{ background:C.forest, borderRadius:16, padding:"28px 32px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:700, color:"#fff", marginBottom:4 }}>Ready to make the switch?</div>
                <div style={{ fontSize:14, color:"rgba(255,255,255,0.7)" }}>Takes 5 minutes. We walk you through every step inside the app.</div>
              </div>
              <Link to="/signup" style={{ background:"#fff", color:C.forest, borderRadius:10, padding:"12px 24px", fontSize:14, fontWeight:700, textDecoration:"none", whiteSpace:"nowrap" }}>
                Start Free, Import Today →
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
}
