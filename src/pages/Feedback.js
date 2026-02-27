// src/pages/Feedback.js
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

const C = { green: "#2A5741", sage: "#6B9E80", bg: "#F0EAD9", beige: "#F5F0E8", text: "#1A1A2E", textLight: "#6B7280", white: "#FFFFFF" };

const DIMS = [
  { key: "pressure_rating", icon: "💆", question: "How was the pressure?",
    options: [{ v: "too_light", label: "Too Light", e: "🪶" }, { v: "perfect", label: "Just Right", e: "✅" }, { v: "too_deep", label: "Too Deep", e: "😬" }] },
  { key: "focus_rating", icon: "🎯", question: "Did we focus on the right areas?",
    options: [{ v: "missed", label: "Missed Some", e: "😕" }, { v: "perfect", label: "Perfect", e: "🙌" }, { v: "over", label: "Over-focused", e: "😅" }] },
  { key: "overall_rating", icon: "⭐", question: "How was your overall experience?",
    options: [1,2,3,4,5].map(n => ({ v: n, label: n + " star" + (n>1?"s":""), e: "⭐".repeat(n) })) },
  { key: "communication_rating", icon: "💬", question: "Did your therapist address your needs?",
    options: [{ v: "yes", label: "Absolutely", e: "😊" }, { v: "mostly", label: "Mostly", e: "🙂" }, { v: "no", label: "Not Really", e: "😐" }] },
  { key: "return_likelihood", icon: "🔄", question: "Would you book again?",
    options: [{ v: "definitely", label: "Definitely!", e: "💚" }, { v: "maybe", label: "Maybe", e: "🤔" }, { v: "unlikely", label: "Unlikely", e: "😔" }] },
];

export default function Feedback() {
  const { customUrl, sessionId } = useParams();
  const [therapist, setTherapist] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState({});
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const { data: t } = await supabase.from("therapists").select("*").eq("custom_url", customUrl).maybeSingle();
      if (!t) { setLoading(false); return; }
      setTherapist(t);
      // Try feedback_code first, fall back to id
      let sessionData = null;
      const { data: byCode } = await supabase.from("sessions").select("*").eq("feedback_code", sessionId).maybeSingle();
      if (byCode) { sessionData = byCode; }
      else {
        const { data: byId } = await supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle();
        sessionData = byId;
      }
      setSession(sessionData);
      const realSessionId = sessionData?.id || sessionId;
      const { data: existing } = await supabase.from("feedback").select("id").eq("session_id", realSessionId).maybeSingle();
      if (existing) setAlreadySubmitted(true);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleSubmit() {
    if (Object.keys(ratings).length < DIMS.length) { alert("Please answer all questions."); return; }
    setSubmitting(true);
    try {
      await supabase.from("feedback").insert([{ session_id: session.id, therapist_id: therapist.id, ...ratings, client_comment: comment || null }]);
      setSubmitted(true);
    } catch(e) { console.error(e); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}><div style={{ textAlign:"center" }}><div style={{ fontSize:40 }}>🌿</div><p style={{ color:C.textLight }}>Loading...</p></div></div>;
  if (!therapist || !session) return <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}><div style={{ textAlign:"center" }}><div style={{ fontSize:40 }}>❌</div><p style={{ fontFamily:"Georgia, serif", color:C.text }}>Feedback link not found.</p></div></div>;
  if (alreadySubmitted || submitted) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.white, borderRadius:20, padding:"40px 32px", textAlign:"center", maxWidth:400, width:"100%" }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🙏</div>
        <h2 style={{ fontFamily:"Georgia, serif", fontSize:24, color:C.green, marginBottom:8 }}>Thank you!</h2>
        <p style={{ color:C.textLight, fontSize:14, lineHeight:1.6 }}>{alreadySubmitted ? "You have already submitted feedback for this session." : "Your feedback helps " + (therapist.business_name || "your therapist") + " improve every session."}</p>
      </div>
    </div>
  );

  const allAnswered = Object.keys(ratings).length === DIMS.length;
  return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <div style={{ background:"linear-gradient(155deg,#2A5741,#1E4230)", padding:"28px 20px 24px", textAlign:"center" }}>
        <div style={{ fontSize:28, marginBottom:4 }}>🌿</div>
        <h1 style={{ fontFamily:"Georgia, serif", fontSize:26, fontWeight:600, color:"#fff", margin:0 }}>{therapist.business_name || "BodyMap"}</h1>
        <p style={{ fontSize:13, color:"rgba(255,255,255,0.75)", marginTop:4 }}>Session Feedback</p>
      </div>
      <div style={{ padding:"20px 16px 40px", maxWidth:500, margin:"0 auto" }}>
        <p style={{ fontFamily:"Georgia, serif", fontSize:15, color:C.text, textAlign:"center", marginBottom:24 }}>How was your session? Your honest feedback helps us improve.</p>
        {DIMS.map(dim => (
          <div key={dim.key} style={{ background:C.white, borderRadius:16, padding:"18px 16px", marginBottom:12, border: ratings[dim.key]!==undefined ? "1.5px solid #6B9E80" : "1.5px solid #E8E4DC" }}>
            <p style={{ fontFamily:"Georgia, serif", fontSize:14, fontWeight:700, color:C.text, margin:"0 0 12px 0" }}>{dim.icon} {dim.question}</p>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {dim.options.map(opt => (
                <button key={opt.v} onClick={() => setRatings(r => ({ ...r, [dim.key]: opt.v }))}
                  style={{ flex:1, minWidth:80, padding:"10px 8px", borderRadius:12, cursor:"pointer",
                    border: ratings[dim.key]===opt.v ? "2px solid #2A5741" : "1.5px solid #E8E4DC",
                    background: ratings[dim.key]===opt.v ? "#E8F5EE" : C.beige,
                    fontSize:12, fontWeight:600, color: ratings[dim.key]===opt.v ? C.green : C.textLight }}>
                  <div style={{ fontSize: dim.key==="overall_rating" ? 14 : 20, marginBottom:4 }}>{opt.e}</div>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div style={{ background:C.white, borderRadius:16, padding:"18px 16px", marginBottom:20, border:"1.5px solid #E8E4DC" }}>
          <p style={{ fontFamily:"Georgia, serif", fontSize:14, fontWeight:700, color:C.text, margin:"0 0 10px 0" }}>✏️ Anything else? (optional)</p>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Special requests for next time, things you loved..."
            style={{ width:"100%", minHeight:80, padding:"10px 12px", borderRadius:10, border:"1.5px solid #E8E4DC", fontSize:13, color:C.text, background:C.beige, resize:"vertical", boxSizing:"border-box" }} />
        </div>
        <button onClick={handleSubmit} disabled={!allAnswered || submitting}
          style={{ width:"100%", padding:16, borderRadius:50, border:"none", background: allAnswered ? C.green : "#C8BFB0", color:"#fff", fontFamily:"Georgia, serif", fontSize:16, fontWeight:700, cursor: allAnswered ? "pointer" : "not-allowed" }}>
          {submitting ? "Submitting..." : "Submit Feedback ✓"}
        </button>
        <p style={{ textAlign:"center", fontSize:11, color:C.textLight, marginTop:10 }}>🔒 Only shared with your therapist</p>
      </div>
    </div>
  );
}
