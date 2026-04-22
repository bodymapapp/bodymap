import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function FounderDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchStats = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const h24 = new Date(now.getTime() - 24*60*60*1000).toISOString();
      const d7  = new Date(now.getTime() - 7*24*60*60*1000).toISOString();

      const [
        { count: signups_24h },
        { count: signups_7d },
        { count: signups_30d },
        { count: total_signups },
        { count: bronze_users },
        { count: silver_users },
        { count: sessions_24h },
        { count: sessions_7d },
        { count: clients_7d },
        { count: active_7d },
        { data: recent_signups },
      ] = await Promise.all([
        supabase.from("therapists").select("*",{count:"exact",head:true}).gte("created_at",h24),
        supabase.from("therapists").select("*",{count:"exact",head:true}).gte("created_at",d7),
        supabase.from("therapists").select("*",{count:"exact",head:true}).gte("created_at",new Date(now.getTime()-30*24*60*60*1000).toISOString()),
        supabase.from("therapists").select("*",{count:"exact",head:true}),
        supabase.from("therapists").select("*",{count:"exact",head:true}).eq("tier","bronze"),
        supabase.from("therapists").select("*",{count:"exact",head:true}).eq("tier","silver"),
        supabase.from("sessions").select("*",{count:"exact",head:true}).gte("created_at",h24),
        supabase.from("sessions").select("*",{count:"exact",head:true}).gte("created_at",d7),
        supabase.from("clients").select("*",{count:"exact",head:true}).gte("created_at",d7),
        supabase.from("therapists").select("*",{count:"exact",head:true}).gte("last_sign_in_at",d7),
        supabase.from("therapists").select("email,created_at,tier").order("created_at",{ascending:false}).limit(15),
      ]);

      setStats({ signups_24h:signups_24h??0, signups_7d:signups_7d??0, signups_30d:signups_30d??0, total_signups:total_signups??0, bronze_users:bronze_users??0, silver_users:silver_users??0, sessions_24h:sessions_24h??0, sessions_7d:sessions_7d??0, clients_7d:clients_7d??0, active_7d:active_7d??0, recent_signups:recent_signups??[] });
      setLastUpdated(new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}));
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(()=>{ fetchStats(); },[]);

  const fmt = d => new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  const s = stats;

  const card = (val, label, sub) => (
    <div style={{background:"#fff",border:"1px solid #e8e5e0",borderRadius:10,padding:"14px 16px"}}>
      <div style={{fontSize:28,fontWeight:600,color:"#1a3a2a"}}>{val}</div>
      <div style={{fontSize:12,color:"#555",marginTop:2}}>{label}</div>
      {sub && <div style={{fontSize:11,color:"#bbb"}}>{sub}</div>}
    </div>
  );

  const sectionLabel = label => (
    <p style={{fontSize:11,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:"#aaa",margin:"24px 0 10px"}}>{label}</p>
  );

  if (loading) return <div style={{padding:48,textAlign:"center",color:"#888"}}>Loading...</div>;
  if (!s) return null;

  const convRate = s.total_signups>0 ? Math.round((s.silver_users/s.total_signups)*100) : 0;
  const retentionRate = s.signups_30d>0 ? Math.round((s.active_7d/s.signups_30d)*100) : 0;
  const sessionsPerUser = s.active_7d>0 ? (s.sessions_7d/s.active_7d).toFixed(1) : "0";

  return (
    <div style={{padding:24,maxWidth:860,margin:"0 auto",fontFamily:"inherit"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div>
          <h2 style={{margin:0,fontSize:20,fontWeight:600,color:"#1a3a2a"}}>Founder Dashboard</h2>
          <p style={{margin:"4px 0 0",fontSize:13,color:"#999"}}>Updated {lastUpdated}</p>
        </div>
        <button onClick={fetchStats} style={{padding:"8px 16px",borderRadius:8,border:"1px solid #ddd",background:"transparent",cursor:"pointer",fontSize:13,color:"#555"}}>Refresh</button>
      </div>

      {sectionLabel("Signups")}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {card(s.signups_24h,"Last 24h")}
        {card(s.signups_7d,"Last 7 days")}
        {card(s.signups_30d,"Last 30 days")}
        {card(s.total_signups,"All time")}
      </div>

      {sectionLabel("Tiers & Activity")}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {card(s.bronze_users,"Bronze users","Free tier")}
        {card(s.silver_users,"Silver users","Paid tier")}
        {card(s.active_7d,"Active last 7d","Logged in")}
        {card(s.sessions_24h,"Sessions today","Records created")}
        {card(s.sessions_7d,"Sessions (7d)","Records created")}
        {card(s.clients_7d,"Clients added (7d)","New clients")}
      </div>

      {sectionLabel("Conversion Health")}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {card(`${convRate}%`,"Bronze to Silver",`${s.bronze_users} bronze, ${s.silver_users} silver`)}
        {card(`${retentionRate}%`,"7d retention","vs 30d signups")}
        {card(sessionsPerUser,"Sessions / active user","Last 7 days")}
      </div>

      {sectionLabel("Recent Signups")}
      <div style={{background:"#fff",border:"1px solid #e8e5e0",borderRadius:10,overflow:"hidden"}}>
        {s.recent_signups.length===0
          ? <div style={{padding:24,textAlign:"center",color:"#bbb",fontSize:14}}>No signups yet</div>
          : <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:"#f9f8f5"}}>
                  <th style={{padding:"10px 16px",textAlign:"left",fontWeight:600,color:"#888",fontSize:12}}>Email</th>
                  <th style={{padding:"10px 16px",textAlign:"left",fontWeight:600,color:"#888",fontSize:12}}>Signed up</th>
                  <th style={{padding:"10px 16px",textAlign:"left",fontWeight:600,color:"#888",fontSize:12}}>Tier</th>
                </tr>
              </thead>
              <tbody>
                {s.recent_signups.map((u,i)=>(
                  <tr key={i} style={{borderTop:"1px solid #f0ede8"}}>
                    <td style={{padding:"10px 16px",color:"#222"}}>{u.email}</td>
                    <td style={{padding:"10px 16px",color:"#888"}}>{fmt(u.created_at)}</td>
                    <td style={{padding:"10px 16px"}}>
                      <span style={{background:u.tier==="silver"?"#e8f5ee":"#f5f0e8",color:u.tier==="silver"?"#1a5c38":"#7a5c1a",border:`1px solid ${u.tier==="silver"?"#b2d8c0":"#d8c8a0"}`,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:600}}>{u.tier||"bronze"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
      <p style={{fontSize:11,color:"#ccc",textAlign:"center",marginTop:16}}>Founder-only view. Not visible to therapists.</p>
    </div>
  );
}
