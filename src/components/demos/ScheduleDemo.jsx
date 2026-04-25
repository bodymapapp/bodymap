// src/components/demos/ScheduleDemo.jsx
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

export default ScheduleDemo;
