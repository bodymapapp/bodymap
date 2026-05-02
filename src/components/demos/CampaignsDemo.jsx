// src/components/demos/CampaignsDemo.jsx
//
// Demo for the Relationships ribbon on the home page. Carousel partner
// to AutomationHub. Shows the 8-category Campaign starter as a
// magic moment: tap a category, watch the message write itself
// word-by-word, send button activates.
//
// Animation pattern follows PatternDemo: useFadeIn + staggered transitions.
// The "typing" animation uses a setInterval that reveals one word at a
// time when a category is selected.

import React, { useState, useEffect, useRef } from "react";

const C = {
  forest: "#2A5741", sage: "#6B9E80", beige: "#F5F0E8",
  gold: "#C9A84C", white: "#FFFFFF", dark: "#0D1F17",
  gray: "#6B7280", lightGray: "#F3F4F6", border: "#E5E7EB",
};

function useFadeIn(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setVisible(true); }),
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

// 8 categories pulled from /campaigns. Each has emoji, label, and a
// representative AI-drafted message. The body uses {firstName} and
// {focusArea} as merge tokens which are replaced with sample values
// for the preview.
const CATEGORIES = [
  {
    key: "lapsed",
    emoji: "🌿",
    label: "Reactivate lapsed",
    subject: "Missing you, Sarah",
    body: "Hi Sarah, it's been a while since your last neck-and-shoulders session. Just wanted to check in. If life's been busy, I get it. Whenever you're ready to come back, I've got you. — Joy",
    audience: "12 lapsed clients",
  },
  {
    key: "birthday",
    emoji: "🎉",
    label: "Birthday wishes",
    subject: "Happy birthday, Sarah",
    body: "Hi Sarah, happy birthday from me. Treat yourself this month: 15% off any session through July. No pressure, just a small thank-you for being part of the practice. — Joy",
    audience: "3 birthdays this week",
  },
  {
    key: "mothersday",
    emoji: "💐",
    label: "Mother's Day special",
    subject: "Mother's Day gift idea",
    body: "Hi Sarah, Mother's Day is around the corner. Gift cards work beautifully for the moms in your life and they're sent the same day. Tap below if you'd like one. — Joy",
    audience: "47 active clients",
  },
  {
    key: "vacation",
    emoji: "🏖️",
    label: "Vacation closure",
    subject: "Quick heads-up on dates",
    body: "Hi Sarah, just a heads-up that I'll be away July 18 through July 24. Last availability is the 17th. Booking is still open for everything before and after. — Joy",
    audience: "47 active clients",
  },
  {
    key: "newservice",
    emoji: "✨",
    label: "New service launch",
    subject: "Something new in the room",
    body: "Hi Sarah, I just added 90-minute deep-tissue sessions to the menu. If you've been wanting more time on lower back work, this might be the right fit. — Joy",
    audience: "47 active clients",
  },
  {
    key: "offer",
    emoji: "🎁",
    label: "Special offer",
    subject: "A small thank-you",
    body: "Hi Sarah, just wanted to say thanks for being one of my most loyal clients. Use SAVED25 for 25% off your next booking, anytime in the next two weeks. — Joy",
    audience: "Top 12 clients",
  },
  {
    key: "holiday",
    emoji: "🗓️",
    label: "Holiday hours",
    subject: "Holiday hours update",
    body: "Hi Sarah, quick note on holiday hours. I'll be closed July 4 and back to normal on July 5. Booking link below if you'd like to grab a spot before or after. — Joy",
    audience: "47 active clients",
  },
  {
    key: "weather",
    emoji: "❄️",
    label: "Weather closure",
    subject: "Closed today due to weather",
    body: "Hi Sarah, today's session is off due to weather. I've already moved you to the same time next week. Stay warm and safe out there. — Joy",
    audience: "5 sessions today",
  },
];

function CampaignsDemo() {
  const [ref, visible] = useFadeIn();
  const [selected, setSelected] = useState(0);
  const [typedWords, setTypedWords] = useState(0);
  const intervalRef = useRef(null);

  const cat = CATEGORIES[selected];
  const words = cat.body.split(" ");

  // Reset and start typing whenever selection changes (or first becomes visible)
  useEffect(() => {
    if (!visible) return;
    setTypedWords(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTypedWords((n) => {
        if (n >= words.length) {
          clearInterval(intervalRef.current);
          return n;
        }
        return n + 1;
      });
    }, 50);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [selected, visible, words.length]);

  const isComplete = typedWords >= words.length;
  const partial = words.slice(0, typedWords).join(" ");

  return (
    <div ref={ref} style={{ background:"#fff", borderRadius:20, padding:24, boxShadow:"0 12px 48px rgba(0,0,0,0.14)", maxWidth:440, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.dark }}>📣 Campaigns</div>
        <div style={{ background:"#FBF4DC", color:C.gold, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>One-tap drafts</div>
      </div>
      <div style={{ fontSize:12, color:C.gray, marginBottom:16 }}>Pick a topic. The platform drafts in your voice. You review and send.</div>

      {/* Category pills - 8 total in 2 rows */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:6, marginBottom:18 }}>
        {CATEGORIES.map((c, i) => {
          const isActive = selected === i;
          return (
            <button
              key={c.key}
              onClick={() => setSelected(i)}
              style={{
                display:"flex", flexDirection:"column", alignItems:"center", gap:3,
                padding:"8px 4px",
                borderRadius:10,
                border:`1.5px solid ${isActive ? C.forest : C.border}`,
                background: isActive ? C.forest : "#F9FAFB",
                color: isActive ? "#fff" : C.dark,
                cursor:"pointer",
                transition:"all 0.2s",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(6px)",
                transitionDelay: `${i * 0.04}s`,
                transitionProperty: "opacity, transform, background, border-color, color",
                transitionDuration: "0.4s, 0.4s, 0.2s, 0.2s, 0.2s",
              }}
            >
              <span style={{ fontSize:18 }}>{c.emoji}</span>
              <span style={{ fontSize:9, fontWeight:600, lineHeight:1.2, textAlign:"center" }}>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* Audience line + drafting indicator */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <div style={{ fontSize:11, color:C.gray }}>
          Sending to: <strong style={{ color:C.dark }}>{cat.audience}</strong>
        </div>
        {!isComplete && (
          <div style={{ fontSize:10, color:C.sage, fontWeight:700, display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%", background:C.sage, animation:"campaignPulse 1s infinite" }}/>
            Drafting...
          </div>
        )}
      </div>

      {/* Drafted message preview - typed word by word */}
      <div style={{ background:"#F9FAFB", border:`1.5px solid ${C.border}`, borderRadius:12, padding:"12px 14px", marginBottom:12, minHeight:120 }}>
        <div style={{ fontSize:10, color:C.gray, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Subject</div>
        <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:10 }}>{cat.subject}</div>
        <div style={{ fontSize:12, color:C.dark, lineHeight:1.55 }}>
          {partial}
          {!isComplete && <span style={{ display:"inline-block", width:6, height:14, background:C.forest, marginLeft:2, verticalAlign:"middle", animation:"campaignBlink 0.7s infinite" }}/>}
        </div>
      </div>

      {/* Action buttons - send glows when typing complete */}
      <div style={{ display:"flex", gap:8 }}>
        <button style={{ flex:1, background:"#fff", color:C.dark, border:`1.5px solid ${C.border}`, borderRadius:8, padding:"9px 12px", fontSize:12, fontWeight:600, cursor:"pointer" }}>
          ✏️ Edit
        </button>
        <button
          style={{
            flex:2,
            background: isComplete ? C.forest : C.lightGray,
            color: isComplete ? "#fff" : C.gray,
            border:"none",
            borderRadius:8,
            padding:"9px 12px",
            fontSize:12,
            fontWeight:700,
            cursor: isComplete ? "pointer" : "default",
            boxShadow: isComplete ? "0 4px 14px rgba(42,87,65,0.28)" : "none",
            transition:"all 0.4s",
          }}
        >
          {isComplete ? `📤 Send to ${cat.audience.split(" ")[0]} recipients` : "Drafting..."}
        </button>
      </div>

      <div style={{ marginTop:14, background:"linear-gradient(135deg, #F0FDF4, #DCFCE7)", border:"1px solid #86EFAC", borderRadius:10, padding:"10px 14px", fontSize:11, color:"#1A3A28", lineHeight:1.5 }}>
        ✨ <strong>Each recipient sees their own first name</strong>, last visit, and last focus area. One message, made personal at scale.
      </div>

      {/* Inline keyframes for cursor blink and pulse */}
      <style>{`
        @keyframes campaignBlink {
          0%, 50% { opacity: 1; }
          50.01%, 100% { opacity: 0; }
        }
        @keyframes campaignPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default CampaignsDemo;
