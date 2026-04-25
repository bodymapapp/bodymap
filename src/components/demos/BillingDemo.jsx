// src/components/demos/BillingDemo.jsx
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

export default BillingDemo;
