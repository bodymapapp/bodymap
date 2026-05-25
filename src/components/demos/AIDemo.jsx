// src/components/demos/AIDemo.jsx
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

const SUPABASE_URL = "https://rmnqfrljoknmellbnpiy.supabase.co";

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
    { role:"assistant", content:"Hi! I'm PracticeIQ. In the dashboard, I have access to your actual client data - names, body maps, session history, revenue, and patterns.\n\nHere I'm running on a sample practice. Try the suggested questions to see exactly what I can do with real data. 🌿" }
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
      setMessages(p => [...p, { role:"assistant", content:data.content?.[0]?.text||"Try one of the suggested questions to see PracticeIQ at its best." }]);
    } catch {
      setMessages(p => [...p, { role:"assistant", content:"Try one of the suggested questions below to see PracticeIQ in action." }]);
    }
    setLoading(false);
  };

  const PROMPTS = SCRIPTED.map(s=>s.q);

  return (
    <div style={{ background:"#fff", borderRadius:20, overflow:"hidden", boxShadow:"0 12px 48px rgba(0,0,0,0.14)", maxWidth:520, margin:"0 auto" }}>
      <div style={{ background:`linear-gradient(135deg, ${C.forest}, #1A3A28)`, padding:"14px 20px", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🌿</div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"#fff" }}>PracticeIQ</div>
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

export default AIDemo;
