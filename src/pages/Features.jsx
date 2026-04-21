
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
      transform: visible ? "translateY(0)" : "translateY(32px)",
      transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
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
        🤖 <strong>AI Insight:</strong> Sarah has a chronic lower back pattern (9/10 sessions) with escalating pressure preference. Her left shoulder shows worsening trend - worth addressing proactively in next session.
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
    { role:"assistant", content:"Hi! I'm BodyMap AI. In the dashboard, I have access to your actual client data - names, body maps, session history, revenue, and patterns.\n\nHere I'm running on a sample practice. Try the suggested questions to see exactly what I can do with real data. 🌿" }
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
      setMessages(p => [...p, { role:"assistant", content:data.content?.[0]?.text||"Try one of the suggested questions to see BodyMap AI at its best." }]);
    } catch {
      setMessages(p => [...p, { role:"assistant", content:"Try one of the suggested questions below to see BodyMap AI in action." }]);
    }
    setLoading(false);
  };

  const PROMPTS = SCRIPTED.map(s=>s.q);

  return (
    <div style={{ background:"#fff", borderRadius:20, overflow:"hidden", boxShadow:"0 12px 48px rgba(0,0,0,0.14)", maxWidth:520, margin:"0 auto" }}>
      <div style={{ background:`linear-gradient(135deg, ${C.forest}, #1A3A28)`, padding:"14px 20px", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🌿</div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"#fff" }}>BodyMap AI</div>
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
        { icon:"🔍", label:"BodyMap detects", desc:"Automatically flags clients whose visit interval has broken" },
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
        { icon:"📅", label:"Session detected", desc:"BodyMap sees an upcoming appointment from your schedule" },
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
    { icon:"🔮", title:"Churn Prediction", desc:"BodyMap AI detects when a regular client breaks their visit pattern - 7 days before they would have ghosted. You reach out first." },
    { icon:"📈", title:"Pressure Trend Alerts", desc:"When a client's pressure preference escalates (3→5 over 8 sessions), BodyMap flags it. You adjust before they find someone who does deep tissue better." },
    { icon:"💌", title:"Milestone Moments", desc:"10th session, 1-year anniversary, returning after a break - BodyMap identifies these moments and drafts a personalized message. Clients feel seen." },
    { icon:"🎁", title:"Re-engagement Campaigns", desc:"One tap launches a personalized outreach to all lapsed clients - not a mass text, a message that references their specific body history." },
  ];
  const growth = [
    { icon:"🔗", title:"Your Intake Link = Marketing", desc:"mybodymap.app/yourname is your professional identity. Share it on Instagram, your email signature, anywhere. Clients tap it to see how it works - and book." },
    { icon:"📄", title:"Post-Session Briefs Go Viral", desc:"Clients share their body summaries with friends. 'My therapist sent me this after every session.' That's word-of-mouth you can't buy." },
    { icon:"⭐", title:"Review Triggers (coming soon)", desc:"After session 3, BodyMap prompts clients to leave a Google review - timed when satisfaction is highest. Your 5-star count grows automatically." },
    { icon:"👥", title:"Referral Intelligence (coming soon)", desc:"BodyMap identifies your top clients and makes it easy for them to refer friends. Each referral arrives with a completed intake form - warm leads, ready to book." },
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
    { id:"ai",          label:"BodyMap AI",             n:13 },
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
  return (
    <div style={{
      position:"fixed", top:64, left:0, right:0, zIndex:89,
      background:"rgba(255,255,255,0.98)", backdropFilter:"blur(12px)",
      borderBottom:`1px solid ${C.border}`, boxShadow:'0 2px 8px rgba(0,0,0,0.07)',
      transform: visible ? 'translateY(0)' : 'translateY(-100%)',
      transition: 'transform 0.25s ease',
    }}>
      <div style={{ maxWidth:1200, margin:"0 auto", display:"flex", overflowX:"auto", padding:"0 16px", scrollbarWidth:"none", msOverflowStyle:"none" }}>
        {sections.map(s=>(
          <a key={s.id} href={`#${s.id}`} onClick={()=>setActive(s.id)}
            style={{ padding:"10px 12px", fontSize:11, fontWeight:600, color:active===s.id?C.forest:C.gray, borderBottom:active===s.id?`2px solid ${C.forest}`:"2px solid transparent", textDecoration:"none", whiteSpace:"nowrap", transition:"all 0.15s", flexShrink:0, display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ fontSize:10, color:active===s.id?C.sage:"#D1D5DB", minWidth:14 }}>{s.n}</span>
            {s.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

// ── MAIN (new taxonomy-based Features page) ────────────────────────────────
// 7 top-level categories, each a carousel with an overview slide + sub-feature
// slides. Sub-feature IDs (1.1, 2.3 etc.) are hidden from users in carousels
// but visible in the taxonomy reference at page bottom.

// ── Taxonomy source of truth ─────────────────────────────────────────────
// Update this when new features ship. Order determines display order.
// `visual` is a React node or () => node. When null, a default placeholder is rendered.
// `value` is the one-line automation/outcome callout shown next to each sub-feature.
const TAXONOMY = [
  {
    id: '1', name: 'Find & Book',
    tagline: 'How new clients discover you and schedule their first session.',
    color: '#2A5741',
    subs: [
      { id: '1.1', name: 'Your custom booking page', desc: 'A beautiful page at mybodymap.app/yourname that clients can book from in three taps. Services, prices, and availability visible at a glance.', value: 'Replaces your Calendly, Square, or SimplePractice link.' },
      { id: '1.2', name: 'Services catalog', desc: 'Add your massage types, durations, and prices once. Offer couples sessions, add-ons, and session-length options without touching code.', value: 'Live on your booking page the moment you save.' },
      { id: '1.3', name: 'Availability & working hours', desc: 'Set which days and times you work. Clients only see slots when you are actually free. Change hours anytime without breaking existing bookings.', value: 'No double bookings. No off-hour confusion.' },
      { id: '1.4', name: 'Deposits at booking', desc: 'Optional deposit held when a client books. Reduces no-shows dramatically for new clients or long sessions. Full session cost charged on the day.', value: 'No-shows drop to near-zero for deposit-protected slots.' },
      { id: '1.5', name: 'Cal.com sync', desc: 'Plug in your Cal.com account and your schedule lights up with real bookings. Change one, it updates everywhere.', value: 'Keeps your existing Cal setup. Zero rebuild required.' },
      { id: '1.6', name: 'Blocked days & vacations', desc: 'Block off holidays, vacations, sick days, personal days. Clients see them as unavailable automatically.', value: 'Never explain a closure by text again.' },
      { id: '1.7', name: 'Website embed', desc: 'Drop a single snippet onto your Wix, Squarespace, or WordPress site and your booking page lives inside it. Fully branded.', value: 'One booking flow, wherever clients find you.' },
    ],
  },
  {
    id: '2', name: 'Know Your Client',
    tagline: 'Everything between when someone books and when they walk in.',
    color: '#4B8A6A',
    subs: [
      { id: '2.1', name: 'Visual body map intake', desc: 'Clients tap front and back body diagrams to show their focus zones, areas to avoid, and pressure preferences. Takes them 90 seconds, not five minutes.', value: 'Higher completion than any form ever will.' },
      { id: '2.2', name: 'Session preferences', desc: 'Pressure, table temp, room temp, music, lighting, conversation, draping, oil preference. All captured once and remembered forever.', value: 'Your client never has to tell you twice.' },
      { id: '2.3', name: 'Signed waiver, bundled in', desc: 'A legally enforceable treatment waiver auto-signs when your client submits intake. No separate form. No extra clicks. Full audit trail with typed name, timestamp, and agreed text locked in.', value: 'Zero extra steps for clients. ESIGN Act compliant.' },
      { id: '2.4', name: 'Smart pre-fill on return', desc: 'Returning clients see a warm "Welcome back" banner with everything pre-filled. Just confirm anything changed. Done in ten seconds.', value: 'Your regulars feel remembered. Because they are.' },
      { id: '2.5', name: 'Client notes & medical flags', desc: 'Conditions, allergies, medications, and any note you want to remember forever stay attached to the client, not the session.', value: 'Red flags surface on your client card every visit.' },
    ],
  },
  {
    id: '3', name: 'Client Intelligence',
    tagline: 'Pattern recognition across visits that no one else offers.',
    color: '#1A3A28',
    dark: true,
    subs: [
      { id: '3.1', name: 'Longitudinal heatmaps', desc: 'See where a client focuses across every visit as a warm heatmap on a body diagram. Suddenly the pattern is obvious: same shoulder, every time, for six months.', value: 'The only tool that shows this. Full stop.' },
      { id: '3.2', name: 'Full session history per client', desc: 'Every visit, every intake, every note in a single timeline. Scroll back months or years and see how someone has evolved.', value: 'Perfect recall, no notebooks.' },
      { id: '3.3', name: 'BodyMap AI chat', desc: 'Ask questions in plain English: "Which of my regulars haven\'t booked in 30 days?" "What\'s the pattern for Sarah?" Get instant, contextual answers.', value: 'Your client database becomes a conversation.' },
      { id: '3.4', name: 'Pattern detection', desc: 'The platform flags when something is new: a zone that keeps appearing, a pressure preference that\'s shifted, a client who\'s changed.', value: 'You notice what matters, automatically.' },
      { id: '3.5', name: 'Practice Pulse', desc: 'A weekly health report on your whole practice: retention, rebooking rates, top clients, who is drifting. Delivered to your inbox every Monday.', value: 'Run your practice like a pro, five minutes a week.' },
    ],
  },
  {
    id: '4', name: 'Day-of-Session',
    tagline: 'What the platform does during the hour you\'re working.',
    color: '#6B9E80',
    subs: [
      { id: '4.1', name: 'Today\'s schedule', desc: 'Your day at a glance on your phone or desktop. Next appointment, intake status, client context — all one tap away.', value: 'Walk into every session prepared.' },
      { id: '4.2', name: 'Pre-session brief', desc: 'Before each client, see their focus zones, pressure preference, any flags, and what changed since last time. Thirty seconds of prep.', value: 'Your client thinks you memorized them. You just read.' },
      { id: '4.3', name: 'Post-session SOAP notes', desc: 'Structured subjective, objective, assessment, and plan notes captured right after the session. Links to the intake automatically.', value: 'Compliant documentation, zero extra effort.' },
      { id: '4.4', name: 'Quick client lookup', desc: 'Find any client in two taps. See their full history, notes, and pattern instantly. On your phone between sessions.', value: 'Everything, everywhere, no typing.' },
      { id: '4.5', name: 'Mobile-first design', desc: 'Install to your home screen and BodyMap becomes an app. No app store. No slow browser. Fast, offline-friendly, thumb-optimized.', value: 'Built for the phone in your pocket.' },
    ],
  },
  {
    id: '5', name: 'Relationships & Retention',
    tagline: 'Turn first-time clients into regulars. Keep regulars coming back.',
    color: '#C9A84C',
    subs: [
      { id: '5.1', name: 'Automated reminders', desc: 'Text and email reminders fire on their own the day before. No more manually sending "see you tomorrow" at 9pm.', value: 'Hours saved weekly. Fewer no-shows.' },
      { id: '5.2', name: 'Post-session follow-up', desc: 'An automatic thank-you after the session with a gentle rebooking nudge. Warm, not salesy. In your voice.', value: 'Rebooking rates go up without you doing anything.' },
      { id: '5.3', name: 'Lapsed client re-engagement', desc: 'The platform spots clients whose rebooking window has stretched. Surfaces them for a quick personal outreach before they\'re gone.', value: 'Save clients that would quietly disappear.' },
      { id: '5.4', name: 'Loyalty rewards', desc: 'Track free-session earning automatically. Every 10th visit on the house. Clients love it, you don\'t have to remember.', value: 'Built-in loyalty, zero bookkeeping.' },
      { id: '5.5', name: '5-dimension feedback', desc: 'After each session, clients can rate across five clean dimensions: pressure, environment, communication, technique, overall. Feedback you can actually use.', value: 'Know what\'s working. Fix what isn\'t.' },
    ],
  },
  {
    id: '6', name: 'Money & Protection',
    tagline: 'Get paid. Stay protected. Run a real business.',
    color: '#2A5741',
    subs: [
      { id: '6.1', name: 'Billing dashboard', desc: 'See revenue, top clients, and payment status in one place. Export at tax time with one click.', value: 'Your books, without the spreadsheet.' },
      { id: '6.2', name: 'Gift cards', desc: 'Beautiful, warm gift cards clients can purchase and send in 60 seconds. Branded, trackable, redeemable on your booking page.', value: 'Instant holiday revenue. Zero setup.' },
      { id: '6.3', name: 'Legally signed waivers', desc: 'Every client signs a real treatment waiver on intake submit. Immutable record, full audit trail, ESIGN Act compliant. Same legal standing as Rumiform or JotForm — without the monthly fee or extra platform.', value: 'First line of legal defense, always current.' },
      { id: '6.4', name: 'Privacy & security', desc: 'Row-level security on every table, encrypted storage, rate-limited signup, bot protection. Your client data is not sold, not mined, not shared.', value: 'Their trust is your business. We protect it.' },
    ],
  },
  {
    id: '7', name: 'On Your Phone, By Your Side',
    tagline: 'The platform lives with you, quietly, everywhere.',
    color: '#4B8A6A',
    dark: true,
    subs: [
      { id: '7.1', name: 'Install to home screen', desc: 'A guided walkthrough puts BodyMap on your home screen in under a minute. Works on iPhone Safari, iPhone Chrome, and Android. Built for anyone, any tech comfort level.', value: 'Opens in one tap, like a real app.' },
      { id: '7.2', name: 'Push notifications', desc: 'A gentle tap on your phone when a client books, fills an intake, or redeems a gift card. Everything that matters, nothing that doesn\'t.', value: 'Stay in the loop without staring at a dashboard.' },
      { id: '7.3', name: 'Founding Therapist emails', desc: 'Weekly tips, retention playbooks, and real examples from therapists using the platform. Short, useful, opt-out anytime.', value: 'A running masterclass on growing your practice.' },
      { id: '7.4', name: 'Refer and reward', desc: 'Every therapist has a personal referral link. Share it with a colleague, and if they join, you get a shoutout on our Features page and a swag kit.', value: 'The best practices grow the best networks.' },
      { id: '7.5', name: 'Switch in minutes', desc: 'One-click import from Square, MassageBook, Vagaro, GlossGenius, or any CSV. Bring your clients, their history, and their preferences without re-entering a single row.', value: 'No data left behind.' },
    ],
  },
];

// ── Helper: Feature Carousel ─────────────────────────────────────────────
function FeatureCarousel({ category, renderVisual }) {
  const [slide, setSlide] = useState(0);
  // Slides: index 0 = overview; 1..N = sub-features
  const slides = [null, ...category.subs]; // null = overview placeholder
  const total = slides.length;
  const isOverview = slide === 0;
  const sub = !isOverview ? slides[slide] : null;
  const isDark = !!category.dark;

  const next = () => setSlide(s => Math.min(s + 1, total - 1));
  const prev = () => setSlide(s => Math.max(s - 1, 0));

  const textColor = isDark ? '#fff' : C.dark;
  const mutedColor = isDark ? 'rgba(255,255,255,0.75)' : C.muted;
  const chipBg = isDark ? 'rgba(255,255,255,0.08)' : '#F5F0E8';
  const chipActive = isDark ? 'rgba(255,255,255,0.18)' : C.forest;
  const chipActiveText = isDark ? '#fff' : '#fff';
  const dotBg = isDark ? 'rgba(255,255,255,0.25)' : '#E8E4DC';
  const dotActive = isDark ? '#fff' : category.color;
  const bg = isDark
    ? `linear-gradient(160deg, #0D1F17 0%, ${category.color} 100%)`
    : '#FFFFFF';

  return (
    <section
      id={`cat-${category.id}`}
      style={{
        scrollMarginTop: 112,
        padding: '80px 24px',
        background: bg,
        color: textColor,
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Category header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,0.6)' : '#6B9E80', marginBottom: 10 }}>
            Category {category.id}
          </div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(30px, 4.5vw, 46px)', fontWeight: 700, color: textColor, margin: '0 0 10px', lineHeight: 1.15 }}>
            {category.name}
          </h2>
          <p style={{ fontSize: 16, color: mutedColor, lineHeight: 1.6, margin: '0 auto', maxWidth: 560 }}>
            {category.tagline}
          </p>
        </div>

        {/* Carousel body */}
        <div style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAF9',
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E8E4DC',
          borderRadius: 20,
          padding: 'clamp(20px, 3vw, 40px)',
          minHeight: 440,
          position: 'relative',
        }}>
          {isOverview ? (
            // ── Overview slide ──
            <div>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,0.55)' : '#6B9E80', marginBottom: 8 }}>
                  What's inside
                </div>
                <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, margin: 0, color: textColor }}>
                  {category.subs.length} capabilities work together in this area
                </h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {category.subs.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setSlide(i + 1)}
                    style={{
                      textAlign: 'left',
                      background: chipBg,
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E8E4DC'}`,
                      borderRadius: 14,
                      padding: '14px 16px',
                      cursor: 'pointer',
                      color: textColor,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = chipActive + (isDark ? '' : '20')}
                    onMouseLeave={e => e.currentTarget.style.background = chipBg}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, fontFamily: 'Georgia, serif' }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.5 }}>
                      {s.value}
                    </div>
                  </button>
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: 28 }}>
                <button
                  onClick={() => setSlide(1)}
                  style={{
                    background: category.color,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '12px 28px',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  }}
                >
                  Start the tour →
                </button>
              </div>
            </div>
          ) : (
            // ── Sub-feature slide ──
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 28 }}
                 className="bm-feat-slide">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, alignItems: 'center' }}>
                {/* Visual */}
                <div style={{ order: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
                  {renderVisual(sub.id)}
                </div>
                {/* Text */}
                <div style={{ order: 2 }}>
                  <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(24px, 3.4vw, 34px)', fontWeight: 700, margin: '0 0 14px', lineHeight: 1.2, color: textColor }}>
                    {sub.name}
                  </h3>
                  <p style={{ fontSize: 15, lineHeight: 1.75, color: mutedColor, margin: '0 0 20px' }}>
                    {sub.desc}
                  </p>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: isDark ? 'rgba(201,168,76,0.18)' : '#FFFBEB',
                    border: `1.5px solid ${isDark ? 'rgba(201,168,76,0.5)' : '#FDE68A'}`,
                    borderRadius: 10,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: isDark ? '#F5D77A' : '#92400E',
                  }}>
                    <span>✨</span>
                    <span>{sub.value}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Carousel controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <button
            onClick={prev}
            disabled={slide === 0}
            aria-label="Previous"
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
              border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#E8E4DC'}`,
              color: textColor,
              cursor: slide === 0 ? 'not-allowed' : 'pointer',
              opacity: slide === 0 ? 0.4 : 1,
              fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ←
          </button>
          {/* Dots */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                aria-label={`Go to slide ${i}`}
                style={{
                  width: i === slide ? 28 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i === slide ? dotActive : dotBg,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.25s',
                  padding: 0,
                }}
              />
            ))}
          </div>
          <button
            onClick={next}
            disabled={slide === total - 1}
            aria-label="Next"
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
              border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#E8E4DC'}`,
              color: textColor,
              cursor: slide === total - 1 ? 'not-allowed' : 'pointer',
              opacity: slide === total - 1 ? 0.4 : 1,
              fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            →
          </button>
        </div>
        {/* Slide counter */}
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: mutedColor }}>
          {slide === 0 ? 'Overview' : `${slide} of ${total - 1}`}
        </div>
      </div>
    </section>
  );
}

// ── Visual renderer — map sub-feature IDs to existing or new visuals ─────
function VisualForSub({ id }) {
  // Reuse existing heavy visual components where they fit
  if (id === '2.1') return <BodyMapDemo />;
  if (id === '3.1') return <PatternDemo />;
  if (id === '4.1') return <ScheduleDemo />;
  if (id === '6.1') return <BillingDemo />;
  if (id === '3.3') return <AIDemo />;

  // Specific visuals for new/updated features
  if (id === '2.3' || id === '6.3') return <WaiverVisual />;
  if (id === '7.2') return <PushVisual />;
  if (id === '7.3') return <DripVisual />;
  if (id === '7.4') return <ReferralVisual />;
  if (id === '6.4') return <PrivacyVisual />;
  if (id === '6.2') return <GiftCardVisual />;
  if (id === '2.4') return <ReturningVisual />;
  if (id === '4.5' || id === '7.1') return <PhoneVisual />;
  if (id === '7.5') return <SwitchingVisual />;

  // Generic fallback — subtle illustration placeholder
  return <GenericVisual id={id} />;
}

// ── New lightweight SVG visuals ──────────────────────────────────────────

function WaiverVisual() {
  return (
    <div style={{ width: '100%', maxWidth: 340 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 10px 28px rgba(0,0,0,0.12)', border: '1px solid #E8E4DC', fontFamily: 'Georgia, serif' }}>
        <div style={{ fontSize: 11, color: '#6B9E80', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Treatment Waiver</div>
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 14 }}>
          I understand massage therapy is provided for stress reduction and relief from muscular tension. I have completed the intake to the best of my knowledge…
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 10 }}>
          <div style={{ width: 18, height: 18, borderRadius: 4, background: '#2A5741', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</div>
          <div style={{ fontSize: 12, color: '#166534', fontFamily: 'system-ui' }}>
            <div style={{ fontWeight: 700 }}>Agreed & signed</div>
            <div style={{ fontSize: 11, color: '#4B5563' }}>Sarah Mitchell · Apr 21, 2026 · 2:14 PM</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PushVisual() {
  return (
    <div style={{ width: '100%', maxWidth: 320 }}>
      <div style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 100%)', borderRadius: 28, padding: 16, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 4 }}>9:41 AM</div>
        <div style={{ textAlign: 'center', color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 20, fontFamily: 'system-ui' }}>Tuesday, April 21</div>
        <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 16, padding: 12, backdropFilter: 'blur(20px)', animation: 'bmPulseSlow 2.2s ease-in-out infinite' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: 'linear-gradient(135deg, #2A5741, #4B8A6A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>🌿</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1A3A28', fontFamily: 'system-ui' }}>BODYMAP</div>
            <div style={{ marginLeft: 'auto', fontSize: 10, color: '#6B7280' }}>now</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A3A28', fontFamily: 'system-ui', marginBottom: 2 }}>New booking · Sarah 🌿</div>
          <div style={{ fontSize: 12, color: '#4B5563', fontFamily: 'system-ui' }}>Fri Apr 24 at 3:00 PM · Deep Tissue</div>
        </div>
      </div>
      <style>{`@keyframes bmPulseSlow { 0%,100%{transform:translateY(0);opacity:1} 50%{transform:translateY(-4px);opacity:0.92} }`}</style>
    </div>
  );
}

function DripVisual() {
  const emails = [
    { day: 'Day 2', subject: '5 signs a regular is about to ghost you', color: '#FDE68A' },
    { day: 'Day 5', subject: 'Send yourself the body map — 60 seconds', color: '#86EFAC' },
    { day: 'Day 10', subject: 'How Jamie got a 18% rebooking lift', color: '#FECACA' },
  ];
  return (
    <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {emails.map((e, i) => (
        <div key={i} style={{
          background: '#fff',
          borderLeft: `4px solid ${e.color}`,
          borderRadius: '0 12px 12px 0',
          padding: '12px 16px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
          transform: `translateX(${i * 12}px)`,
          opacity: 1 - i * 0.08,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B9E80', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{e.day}</div>
          <div style={{ fontSize: 13, color: '#1A3A28', fontFamily: 'Georgia, serif', fontWeight: 700 }}>{e.subject}</div>
        </div>
      ))}
    </div>
  );
}

function ReferralVisual() {
  return (
    <div style={{ width: '100%', maxWidth: 320 }}>
      <div style={{ background: 'linear-gradient(135deg, #F0FDF4, #FFFBEB)', border: '1.5px solid #86EFAC', borderRadius: 16, padding: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>🌿 Your referral link</div>
        <div style={{ background: '#fff', border: '1.5px solid #E8E4DC', borderRadius: 10, padding: '10px 12px', fontFamily: 'monospace', fontSize: 13, color: '#2A5741', fontWeight: 700, marginBottom: 14, wordBreak: 'break-all' }}>
          mybodymap.app/signup?ref=jamie-r
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 32 }}>🎁</div>
          <div style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.5, fontFamily: 'Georgia, serif' }}>
            <b>3 therapists</b> signed up through you. Swag kit on its way.
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivacyVisual() {
  return (
    <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[
        { icon: '🔒', label: 'Row-level security', desc: 'Every table. Every query.' },
        { icon: '🛡️', label: 'Bot protection', desc: 'Rate limits. Signup guard.' },
        { icon: '💾', label: 'Encrypted storage', desc: 'Never sold. Never mined.' },
        { icon: '✅', label: 'ESIGN Act compliant', desc: 'Legally signed, locked records.' },
      ].map((x, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #E8E4DC', borderRadius: 12, padding: '10px 14px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{x.icon}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A3A28' }}>{x.label}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{x.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GiftCardVisual() {
  return (
    <div style={{ width: '100%', maxWidth: 320 }}>
      <div style={{ background: 'linear-gradient(135deg, #FFF1F5, #FFE4E6)', border: '1px solid #FFB5C0', borderRadius: 16, padding: 22, boxShadow: '0 8px 24px rgba(232,92,121,0.18)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#BE185D', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>🎁 Gift Card</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: '#1A3A28', marginBottom: 4 }}>$120</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, fontStyle: 'italic', color: '#78350F', marginBottom: 14 }}>For my sister — enjoy your day.</div>
        <div style={{ borderTop: '1px dashed #FFB5C0', paddingTop: 12, fontSize: 11, color: '#6B7280', fontFamily: 'system-ui' }}>
          To: Anna · From: Kate · Redeemable at Serenity Studio
        </div>
      </div>
    </div>
  );
}

function ReturningVisual() {
  return (
    <div style={{ width: '100%', maxWidth: 320 }}>
      <div style={{ background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)', border: '1.5px solid #FDE68A', borderRadius: 14, padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ fontSize: 22 }}>🌿</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Welcome back</div>
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A3A28' }}>Hi Sarah, ready for your usual?</div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E8E4DC', borderRadius: 10, padding: 14, fontSize: 12, color: '#4B5563', lineHeight: 1.7 }}>
        <div><span style={{ color: '#6B7280' }}>Focus:</span> <b style={{ color: '#1A3A28' }}>Upper back, shoulders</b></div>
        <div><span style={{ color: '#6B7280' }}>Pressure:</span> <b style={{ color: '#1A3A28' }}>Firm (4/5)</b></div>
        <div><span style={{ color: '#6B7280' }}>Music:</span> <b style={{ color: '#1A3A28' }}>Soft</b></div>
        <div style={{ marginTop: 8, fontStyle: 'italic', color: '#6B9E80' }}>All pre-filled. Tap confirm to submit.</div>
      </div>
    </div>
  );
}

function PhoneVisual() {
  return (
    <div style={{ width: '100%', maxWidth: 200, margin: '0 auto' }}>
      <div style={{ background: '#1F2937', borderRadius: 30, padding: 10, boxShadow: '0 18px 48px rgba(0,0,0,0.3)' }}>
        <div style={{ background: 'linear-gradient(180deg, #F0FDF4 0%, #FFF9F3 100%)', borderRadius: 22, minHeight: 320, padding: 18, position: 'relative' }}>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#374151', marginBottom: 14 }}>9:41</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: 14, background: 'linear-gradient(135deg, #2A5741, #4B8A6A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, boxShadow: '0 6px 20px rgba(42,87,65,0.4)' }}>🌿</div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#1A3A28', fontFamily: 'Georgia, serif' }}>BodyMap</div>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#6B7280', marginTop: 2 }}>On your home screen</div>
        </div>
      </div>
    </div>
  );
}

function SwitchingVisual() {
  const logos = ['Square', 'MassageBook', 'Vagaro', 'GlossGenius'];
  return (
    <div style={{ width: '100%', maxWidth: 340 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {logos.map((l, i) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E8E4DC', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#6B7280', fontWeight: 700 }}>📊</div>
            <div style={{ flex: 1, fontSize: 13, color: '#1A3A28', fontWeight: 600 }}>{l} export</div>
            <div style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>✓ Imported</div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: '#6B9E80', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
        412 clients moved over in 3 minutes.
      </div>
    </div>
  );
}

function GenericVisual({ id }) {
  return (
    <div style={{ width: '100%', maxWidth: 280, minHeight: 220, background: '#F9FAF9', border: '1px dashed #E8E4DC', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 14, padding: 20, textAlign: 'center' }}>
      🌿 Preview coming
    </div>
  );
}

// ── Taxonomy table at page bottom ─────────────────────────────────────────
function TaxonomyTable() {
  return (
    <section style={{ background: '#FFFBEB', padding: '80px 24px', borderTop: '1px solid #FDE68A' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>The full map</div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, color: '#1A3A28', margin: '0 0 10px' }}>Every feature, at a glance</h2>
          <p style={{ fontSize: 15, color: '#78350F', maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
            Seven categories. Every capability mapped. Bookmark this page — it's always up to date.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          {TAXONOMY.map(cat => (
            <div key={cat.id} style={{ background: '#fff', border: '1px solid #FDE68A', borderRadius: 14, padding: 20, boxShadow: '0 4px 14px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700, color: cat.color, lineHeight: 1 }}>{cat.id}</span>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A3A28' }}>{cat.name}</span>
              </div>
              <div style={{ fontSize: 12, color: '#92400E', fontStyle: 'italic', marginBottom: 14, lineHeight: 1.5 }}>{cat.tagline}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cat.subs.map(s => (
                  <a key={s.id} href={`#cat-${cat.id}`} style={{ display: 'flex', alignItems: 'baseline', gap: 10, textDecoration: 'none', padding: '6px 0', borderBottom: '1px dashed #FEF3C7' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#92400E', fontWeight: 700, flexShrink: 0, minWidth: 26 }}>{s.id}</span>
                    <span style={{ fontSize: 13, color: '#1A3A28', fontWeight: 500 }}>{s.name}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Taxonomy-based section nav ───────────────────────────────────────────
function TaxonomyNav() {
  const [active, setActive] = useState('cat-1');
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 280);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-30% 0px -60% 0px' });
    TAXONOMY.forEach(cat => { const el = document.getElementById(`cat-${cat.id}`); if (el) obs.observe(el); });
    return () => { window.removeEventListener('scroll', onScroll); obs.disconnect(); };
  }, []);
  return (
    <div style={{
      position: 'fixed', top: 64, left: 0, right: 0, zIndex: 89,
      background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #E8E4DC', boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
      transform: visible ? 'translateY(0)' : 'translateY(-100%)',
      transition: 'transform 0.25s ease',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', overflowX: 'auto', padding: '0 16px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`.bm-taxnav::-webkit-scrollbar{display:none}`}</style>
        <div className="bm-taxnav" style={{ display: 'flex', gap: 4, padding: '12px 0' }}>
          {TAXONOMY.map(cat => {
            const isActive = active === `cat-${cat.id}`;
            return (
              <a key={cat.id} href={`#cat-${cat.id}`} style={{
                padding: '8px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                background: isActive ? '#2A5741' : 'transparent',
                color: isActive ? '#fff' : '#4B5563',
                transition: 'all 0.2s',
              }}>
                {cat.id}. {cat.name}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────
export default function Features() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: C.dark, paddingTop: 64 }}>
      <Nav />
      <TaxonomyNav />

      {/* HERO */}
      <section style={{ background: `linear-gradient(160deg, #0D1F17 0%, #1A3A28 50%, #2A5741 100%)`, padding: '100px 24px 90px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(107,158,128,0.15) 0%, transparent 70%)' }} />
        <div style={{ maxWidth: 860, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <FadeIn>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(107,158,128,0.15)', border: '1px solid rgba(107,158,128,0.3)', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 28 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6B9E80', display: 'inline-block' }} />
              Built exclusively for massage therapists
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(36px,5.5vw,68px)', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.15, marginBottom: 24, letterSpacing: '-0.02em' }}>
              Everything You Need,<br />
              <span style={{ color: C.gold }}>Across 7 Parts of Your Practice</span>
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p style={{ fontSize: 'clamp(16px,2vw,20px)', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, marginBottom: 40, maxWidth: 640, margin: '0 auto 40px' }}>
              From the moment a client books to the moment they become a regular — everything handled, automated, and in your pocket.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/signup" style={{ background: '#fff', color: C.forest, borderRadius: 10, padding: '14px 32px', fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
                Start free →
              </Link>
              <a href="#cat-1" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '14px 28px', fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
                Explore features
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* 7 category carousels */}
      {TAXONOMY.map(cat => (
        <FeatureCarousel key={cat.id} category={cat} renderVisual={(id) => <VisualForSub id={id} />} />
      ))}

      {/* Full taxonomy table */}
      <TaxonomyTable />

      {/* Final CTA */}
      <section style={{ background: '#2A5741', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, color: '#fff', margin: '0 0 14px' }}>
            Ready to see it running on your practice?
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, margin: '0 0 28px' }}>
            Takes 5 minutes to set up. Free forever for the first 100 therapists.
          </p>
          <Link to="/signup" style={{ background: '#fff', color: '#2A5741', borderRadius: 10, padding: '16px 36px', fontSize: 16, fontWeight: 700, textDecoration: 'none', display: 'inline-block', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
            Start free — 5 minutes →
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
