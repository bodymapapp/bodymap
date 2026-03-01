// src/pages/PreSessionBrief.js
import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

const AREA_COORDS = {
  "f-head":[85,28],"f-neck":[85,52],"f-l-shldr":[58,72],"f-r-shldr":[112,72],
  "f-l-chest":[68,95],"f-r-chest":[102,95],"f-abdomen":[85,125],
  "f-l-arm-u":[45,100],"f-r-arm-u":[125,100],"f-l-forearm":[42,130],"f-r-forearm":[128,130],
  "f-l-hand":[40,155],"f-r-hand":[130,155],"f-l-hip":[68,155],"f-r-hip":[102,155],
  "f-l-thigh":[68,185],"f-r-thigh":[102,185],"f-l-knee":[68,220],"f-r-knee":[102,220],
  "f-l-calf":[68,248],"f-r-calf":[102,248],"f-l-foot":[68,285],"f-r-foot":[102,285],
  "b-head":[85,28],"b-neck":[85,52],"b-l-shldr":[58,72],"b-r-shldr":[112,72],
  "b-upper-bk":[85,88],"b-mid-bk":[85,112],"b-lower-bk":[85,136],
  "b-l-arm-u":[45,100],"b-r-arm-u":[125,100],"b-l-forearm":[42,130],"b-r-forearm":[128,130],
  "b-l-hand":[40,155],"b-r-hand":[130,155],"b-l-glute":[68,162],"b-r-glute":[102,162],
  "b-l-hamstr":[68,192],"b-r-hamstr":[102,192],"b-l-knee":[68,220],"b-r-knee":[102,220],
  "b-l-calf":[68,248],"b-r-calf":[102,248],"b-l-foot":[68,285],"b-r-foot":[102,285]
};

const AREA_LABELS = {
  "f-head":"Head","f-neck":"Neck","f-l-shldr":"L Shoulder","f-r-shldr":"R Shoulder",
  "f-l-chest":"L Chest","f-r-chest":"R Chest","f-abdomen":"Abdomen",
  "f-l-arm-u":"L Upper Arm","f-r-arm-u":"R Upper Arm","f-l-forearm":"L Forearm",
  "f-r-forearm":"R Forearm","f-l-hand":"L Hand","f-r-hand":"R Hand",
  "f-l-hip":"L Hip","f-r-hip":"R Hip","f-l-thigh":"L Thigh","f-r-thigh":"R Thigh",
  "f-l-knee":"L Knee","f-r-knee":"R Knee","f-l-calf":"L Calf","f-r-calf":"R Calf",
  "f-l-foot":"L Foot","f-r-foot":"R Foot","b-head":"Back of Head","b-neck":"Back of Neck",
  "b-l-shldr":"L Shoulder Blade","b-r-shldr":"R Shoulder Blade","b-upper-bk":"Upper Back",
  "b-mid-bk":"Mid Back","b-lower-bk":"Lower Back","b-l-arm-u":"L Upper Arm",
  "b-r-arm-u":"R Upper Arm","b-l-forearm":"L Forearm","b-r-forearm":"R Forearm",
  "b-l-hand":"L Hand","b-r-hand":"R Hand","b-l-glute":"L Glute","b-r-glute":"R Glute",
  "b-l-hamstr":"L Hamstring","b-r-hamstr":"R Hamstring","b-l-knee":"L Knee",
  "b-r-knee":"R Knee","b-l-calf":"L Calf","b-r-calf":"R Calf",
  "b-l-foot":"L Foot","b-r-foot":"R Foot"
};

function an(k) { return AREA_LABELS[k] || k; }

function BodySVG({ focusAreas=[], avoidAreas=[], heatmapFocus={}, heatmapAvoid={}, showHeatmap=false }) {
  return (
    <svg width="130" height="250" viewBox="0 0 170 310">
      <ellipse cx="85" cy="28" rx="20" ry="24" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <rect x="77" y="50" width="16" height="14" rx="3" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <path d="M57 64 Q47 70 44 90 L40 155 Q40 162 48 162 L122 162 Q130 162 130 155 L126 90 Q123 70 113 64 Z" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <path d="M57 66 Q42 74 38 115 Q36 128 40 138 Q46 141 50 138 Q54 112 60 85 Z" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <path d="M113 66 Q128 74 132 115 Q134 128 130 138 Q124 141 120 138 Q116 112 110 85 Z" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <path d="M60 162 Q56 195 54 232 Q52 260 56 278 Q62 284 70 282 Q76 278 76 260 L78 162 Z" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      <path d="M110 162 Q114 195 116 232 Q118 260 114 278 Q108 284 100 282 Q94 278 94 260 L92 162 Z" fill="#EDE8DF" stroke="#C8BFB0" strokeWidth="1.5"/>
      {showHeatmap && Object.entries(heatmapFocus).map(([area,{opacity,count}]) => {
        const c=AREA_COORDS[area]; if(!c) return null;
        const r=8+opacity*10;
        return <g key={"hf-"+area}>
          <circle cx={c[0]} cy={c[1]} r={r+8} fill={`rgba(107,158,128,${(opacity*0.2).toFixed(2)})`} stroke="none"/>
          <circle cx={c[0]} cy={c[1]} r={r} fill={`rgba(107,158,128,${(opacity*0.55).toFixed(2)})`} stroke="#6B9E80" strokeWidth={opacity>0.6?"2.5":"1.5"}/>
          <circle cx={c[0]} cy={c[1]} r="5" fill={`rgba(42,87,65,${Math.min(opacity+0.2,1).toFixed(2)})`}/>
          <circle cx={c[0]+r-1} cy={c[1]-r+1} r="7" fill="#2A5741" stroke="white" strokeWidth="1.5"/>
          <text x={c[0]+r-1} y={c[1]-r+5} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="system-ui">{count}</text>
        </g>;
      })}
      {showHeatmap && Object.entries(heatmapAvoid).map(([area,{opacity,count}]) => {
        if(heatmapFocus[area]) return null;
        const c=AREA_COORDS[area]; if(!c) return null;
        const r=8+opacity*10;
        return <g key={"ha-"+area}>
          <circle cx={c[0]} cy={c[1]} r={r+8} fill={`rgba(239,68,68,${(opacity*0.15).toFixed(2)})`} stroke="none"/>
          <circle cx={c[0]} cy={c[1]} r={r} fill={`rgba(239,68,68,${(opacity*0.4).toFixed(2)})`} stroke="#EF4444" strokeWidth={opacity>0.6?"2.5":"1.5"}/>
          <circle cx={c[0]} cy={c[1]} r="5" fill={`rgba(185,28,28,${Math.min(opacity+0.2,1).toFixed(2)})`}/>
          <circle cx={c[0]+r-1} cy={c[1]-r+1} r="7" fill="#991B1B" stroke="white" strokeWidth="1.5"/>
          <text x={c[0]+r-1} y={c[1]-r+5} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="system-ui">{count}</text>
        </g>;
      })}
      {!showHeatmap && focusAreas.map((area,i) => {
        const c=AREA_COORDS[area]; if(!c) return null;
        return <g key={"f"+i}><circle cx={c[0]} cy={c[1]} r="12" fill="rgba(107,158,128,0.25)" stroke="#6B9E80" strokeWidth="2"/><circle cx={c[0]} cy={c[1]} r="5" fill="#6B9E80"/></g>;
      })}
      {!showHeatmap && avoidAreas.map((area,i) => {
        const c=AREA_COORDS[area]; if(!c) return null;
        return <g key={"a"+i}><circle cx={c[0]} cy={c[1]} r="12" fill="rgba(239,68,68,0.2)" stroke="#EF4444" strokeWidth="2"/><circle cx={c[0]} cy={c[1]} r="5" fill="#EF4444"/></g>;
      })}
    </svg>
  );
}

export default function PreSessionBrief() {
  const { sessionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle();
      if (!session) { setLoading(false); return; }
      const { data: client } = await supabase.from("clients").select("name,phone").eq("id", session.client_id).maybeSingle();
      const { data: therapist } = await supabase.from("therapists").select("name,business_name,custom_url,phone").eq("id", session.therapist_id).maybeSingle();
      const { data: history } = await supabase.from("sessions").select("*").eq("client_id", session.client_id).order("created_at",{ascending:false}).limit(10);
      setData({ session, client, therapist, history: history || [] });
      setLoading(false);
    }
    load();
  }, [sessionId]);

  const heatmapData = useMemo(() => {
    if (!data) return { frontFocus:{}, frontAvoid:{}, backFocus:{}, backAvoid:{}, count:0 };
    const past = data.history.filter(s => s.id !== data.session.id).slice(0,5);
    const n = past.length;
    if (n===0) return { frontFocus:{}, frontAvoid:{}, backFocus:{}, backAvoid:{}, count:0 };
    const ff={},fa={},bf={},ba={};
    past.forEach(s => {
      (s.front_focus||[]).forEach(a => { ff[a]=(ff[a]||0)+1; });
      (s.front_avoid||[]).forEach(a => { fa[a]=(fa[a]||0)+1; });
      (s.back_focus||[]).forEach(a => { bf[a]=(bf[a]||0)+1; });
      (s.back_avoid||[]).forEach(a => { ba[a]=(ba[a]||0)+1; });
    });
    const toEntry = c => ({ count:c, total:n, opacity:parseFloat(Math.min(0.3+(c/n)*0.7,1.0).toFixed(2)) });
    return {
      frontFocus: Object.fromEntries(Object.entries(ff).map(([k,v])=>[k,toEntry(v)])),
      frontAvoid: Object.fromEntries(Object.entries(fa).map(([k,v])=>[k,toEntry(v)])),
      backFocus:  Object.fromEntries(Object.entries(bf).map(([k,v])=>[k,toEntry(v)])),
      backAvoid:  Object.fromEntries(Object.entries(ba).map(([k,v])=>[k,toEntry(v)])),
      count: n
    };
  }, [data]);

  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",fontFamily:"Georgia,serif",color:"#6B7280"}}>Loading brief...</div>;
  if (!data) return <div style={{padding:40,fontFamily:"Georgia,serif"}}>Session not found.</div>;

  const { session, client, therapist } = data;
  const sessionDate = new Date(session.created_at).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const focusAreas = [...(session.front_focus||[]),...(session.back_focus||[])];
  const avoidAreas = [...(session.front_avoid||[]),...(session.back_avoid||[])];
  const hasHeatmap = heatmapData.count > 0;
  const medFlag = session.med_flag && session.med_flag !== "none" && session.med_flag !== "" && session.med_flag !== "no";
  const medNote = session.med_note || "";
  const prefs = [
    session.pressure && { label:"Pressure", val:`Level ${session.pressure}/5` },
    session.goal && { label:"Goal", val:session.goal },
    session.table_temp && { label:"Table Temp", val:session.table_temp },
    session.room_temp && { label:"Room Temp", val:session.room_temp },
    session.music && { label:"Music", val:session.music },
    session.lighting && { label:"Lighting", val:session.lighting },
    session.conversation && { label:"Conversation", val:session.conversation },
    session.draping && { label:"Draping", val:session.draping },
  ].filter(Boolean);
  const therapistName = therapist?.business_name || therapist?.name || "Your Practice";
  const intakeUrl = therapist?.custom_url ? `${window.location.origin}/${therapist.custom_url}` : null;
  const therapistPhone = therapist?.phone || null;

  return (
    <div style={{fontFamily:"system-ui,sans-serif",background:"white",minHeight:"100vh",color:"#1A1A2E"}}>
      <style>{"@media print{.no-print{display:none!important}body{margin:0}@page{size:A4;margin:12mm}}*{box-sizing:border-box}"}</style>
      <div className="no-print" style={{background:"#2A5741",padding:"12px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{color:"white",fontWeight:"700",fontSize:"15px"}}>🌿 Pre-Session Brief — {client?.name}</span>
        <button onClick={() => window.print()} style={{background:"white",color:"#2A5741",border:"none",padding:"8px 20px",borderRadius:"8px",fontWeight:"700",fontSize:"14px",cursor:"pointer"}}>🖨️ Save as PDF / Print</button>
      </div>
      <div style={{maxWidth:"740px",margin:"0 auto",padding:"24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",borderBottom:"2px solid #2A5741",paddingBottom:"12px",marginBottom:"16px"}}>
          <div>
            <div style={{fontSize:"22px",fontWeight:"700",fontFamily:"Georgia,serif"}}>{client?.name}</div>
            <div style={{fontSize:"13px",color:"#6B7280",marginTop:"2px"}}>{sessionDate}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:"13px",fontWeight:"700",color:"#2A5741"}}>🌿 Pre-Session Brief</div>
            <div style={{fontSize:"11px",color:"#1A1A2E",fontWeight:"600"}}>{therapistName}</div>
            {therapistPhone && <div style={{fontSize:"11px",color:"#6B7280"}}>{therapistPhone}</div>}
            {intakeUrl && <div style={{fontSize:"10px",color:"#9CA3AF"}}>{intakeUrl}</div>}
          </div>
        </div>
        {medFlag && (
          <div style={{background:"#FEF2F2",border:"2px solid #EF4444",borderRadius:"8px",padding:"10px 16px",marginBottom:"14px",display:"flex",gap:"10px",alignItems:"flex-start"}}>
            <span style={{fontSize:"18px"}}>🚨</span>
            <div>
              <div style={{fontSize:"11px",fontWeight:"800",color:"#991B1B",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:"2px"}}>Medical Flag — Review Before Session</div>
              <div style={{fontSize:"13px",fontWeight:"600",color:"#7F1D1D"}}>{medNote || "Medical condition flagged — ask client for details"}</div>
            </div>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",marginBottom:"14px"}}>
          <div style={{border:"1px solid #E8E4DC",borderRadius:"10px",padding:"14px"}}>
            <div style={{fontSize:"11px",fontWeight:"700",color:"#6B7280",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"10px"}}>Today's Body Map</div>
            <div style={{display:"flex",justifyContent:"space-around"}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:"10px",color:"#9CA3AF",marginBottom:"4px",textTransform:"uppercase"}}>Front</div><BodySVG focusAreas={session.front_focus||[]} avoidAreas={session.front_avoid||[]} /></div>
              <div style={{textAlign:"center"}}><div style={{fontSize:"10px",color:"#9CA3AF",marginBottom:"4px",textTransform:"uppercase"}}>Back</div><BodySVG focusAreas={session.back_focus||[]} avoidAreas={session.back_avoid||[]} /></div>
            </div>
            <div style={{display:"flex",gap:"12px",marginTop:"8px",justifyContent:"center"}}>
              <span style={{fontSize:"10px",color:"#2A5741"}}>🟢 Focus</span>
              <span style={{fontSize:"10px",color:"#991B1B"}}>🔴 Avoid</span>
            </div>
          </div>
          {hasHeatmap ? (
            <div style={{border:"1px solid #E8E4DC",borderRadius:"10px",padding:"14px"}}>
              <div style={{fontSize:"11px",fontWeight:"700",color:"#6B7280",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"4px"}}>Pattern History</div>
              <div style={{fontSize:"10px",color:"#6B9E80",marginBottom:"8px"}}>Last {heatmapData.count} sessions · badge = times marked</div>
              <div style={{display:"flex",justifyContent:"space-around"}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:"10px",color:"#9CA3AF",marginBottom:"4px",textTransform:"uppercase"}}>Front</div><BodySVG heatmapFocus={heatmapData.frontFocus} heatmapAvoid={heatmapData.frontAvoid} showHeatmap={true} /></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:"10px",color:"#9CA3AF",marginBottom:"4px",textTransform:"uppercase"}}>Back</div><BodySVG heatmapFocus={heatmapData.backFocus} heatmapAvoid={heatmapData.backAvoid} showHeatmap={true} /></div>
              </div>
            </div>
          ) : (
            <div style={{border:"1px solid #E8E4DC",borderRadius:"10px",padding:"14px",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{textAlign:"center",color:"#9CA3AF"}}><div style={{fontSize:"24px",marginBottom:"8px"}}>📊</div><div style={{fontSize:"11px"}}>Pattern history available after 2+ sessions</div></div>
            </div>
          )}
        </div>
        {(focusAreas.length > 0 || avoidAreas.length > 0) && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px"}}>
            {focusAreas.length > 0 && <div style={{border:"1px solid #E8E4DC",borderRadius:"8px",padding:"12px"}}><div style={{fontSize:"10px",fontWeight:"700",color:"#2A5741",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>🟢 Focus Areas</div><div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>{focusAreas.map((a,i)=><span key={i} style={{background:"rgba(107,158,128,0.15)",color:"#2A5741",padding:"3px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:"600"}}>{an(a)}</span>)}</div></div>}
            {avoidAreas.length > 0 && <div style={{border:"1px solid #E8E4DC",borderRadius:"8px",padding:"12px"}}><div style={{fontSize:"10px",fontWeight:"700",color:"#991B1B",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>🔴 Avoid Areas</div><div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>{avoidAreas.map((a,i)=><span key={i} style={{background:"rgba(239,68,68,0.1)",color:"#991B1B",padding:"3px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:"600"}}>{an(a)}</span>)}</div></div>}
          </div>
        )}
        {prefs.length > 0 && (
          <div style={{border:"1px solid #E8E4DC",borderRadius:"8px",padding:"12px",marginBottom:"14px"}}>
            <div style={{fontSize:"10px",fontWeight:"700",color:"#6B7280",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"8px"}}>Client Preferences</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"6px"}}>
              {prefs.map((p,i)=><div key={i} style={{background:"#F5F0E8",borderRadius:"6px",padding:"6px 10px"}}><div style={{fontSize:"9px",color:"#9CA3AF",textTransform:"uppercase",marginBottom:"2px"}}>{p.label}</div><div style={{fontSize:"12px",fontWeight:"700",color:"#1A1A2E",textTransform:"capitalize"}}>{p.val}</div></div>)}
            </div>
          </div>
        )}
        {session.therapist_notes && (
          <div style={{border:"1px solid #E8E4DC",borderRadius:"8px",padding:"12px",marginBottom:"14px"}}>
            <div style={{fontSize:"10px",fontWeight:"700",color:"#6B7280",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"6px"}}>Your Notes</div>
            <div style={{fontSize:"12px",color:"#374151",lineHeight:"1.6"}}>{session.therapist_notes}</div>
          </div>
        )}
        <div style={{borderTop:"1px solid #E8E4DC",paddingTop:"8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:"10px",color:"#9CA3AF"}}>🌿 BodyMap — mybodymap.app</span>
          <span style={{fontSize:"10px",color:"#9CA3AF"}}>{therapistName}{therapistPhone ? " · " + therapistPhone : ""}{intakeUrl ? " · " + intakeUrl : ""} · Confidential</span>
        </div>
      </div>
    </div>
  );
}
