import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { db } from '../lib/supabase';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#E8E4DC', danger:'#EF4444' };

const SEGMENTS = [
  { id:'lapsed',    icon:'🍂', label:'Lapsed clients',         desc:'Haven\'t visited in a while' },
  { id:'due',       icon:'📅', label:'Due for a visit',        desc:'Regular clients past their usual interval' },
  { id:'onetimer',  icon:'🌱', label:'Never rebooked',         desc:'Came once, never returned' },
  { id:'frequent',  icon:'⭐', label:'Your regulars',          desc:'Visited 4+ times' },
  { id:'all',       icon:'📋', label:'All active clients',     desc:'Everyone with at least one visit' },
];

const TEMPLATES = [
  { id:'opening',   label:'You have an opening',  text:'Hi {name}, I have an opening this week and thought of you. Would love to see you — grab a spot here: {link}' },
  { id:'checkin',   label:'Gentle check-in',      text:'Hi {name}, just checking in! It\'s been a while since your last visit. How are you feeling? I\'d love to help you get back on track: {link}' },
  { id:'selfcare',  label:'Self-care reminder',   text:'Hi {name}, a gentle reminder that taking care of yourself matters. I have some availability coming up if you\'d like to book: {link}' },
  { id:'custom',    label:'Write my own',          text:'' },
];

export default function Outreach({ therapist, lapsedDays = 60 }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState('lapsed');
  const [template, setTemplate] = useState('opening');
  const [message, setMessage] = useState(TEMPLATES[0].text);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);
  const [preview, setPreview] = useState(false);
  const [customLapsed, setCustomLapsed] = useState(lapsedDays);

  useEffect(() => { load(); }, [therapist.id]);

  async function load() {
    setLoading(true);
    try {
      const data = await db.getTherapistClients(therapist.id);
      setClients(data || []);
    } catch(e) {}
    setLoading(false);
  }

  // Compute avg interval between sessions for a client
  function avgInterval(client) {
    const sessions = (client.sessions || []).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    if (sessions.length < 2) return null;
    let total = 0;
    for (let i = 1; i < sessions.length; i++) {
      total += (new Date(sessions[i].created_at) - new Date(sessions[i-1].created_at)) / 86400000;
    }
    return Math.round(total / (sessions.length - 1));
  }

  function getSegment() {
    switch(segment) {
      case 'lapsed':
        return clients.filter(c => c.days_since_visit !== null && c.days_since_visit >= customLapsed);
      case 'due':
        return clients.filter(c => {
          const avg = avgInterval(c);
          if (!avg || !c.days_since_visit) return false;
          return c.days_since_visit >= avg * 1.2; // 20% past their usual interval
        });
      case 'onetimer':
        return clients.filter(c => c.total_sessions === 1);
      case 'frequent':
        return clients.filter(c => c.total_sessions >= 4);
      case 'all':
        return clients.filter(c => c.total_sessions >= 1);
      default:
        return [];
    }
  }

  const segmentClients = getSegment();
  const bookingLink = `https://mybodymap.app/book/${therapist.custom_url}`;

  function buildMessage(client) {
    const firstName = client.name?.split(' ')[0] || 'there';
    return message
      .replace(/{name}/gi, firstName)
      .replace(/{link}/gi, bookingLink);
  }

  async function sendAll() {
    if (!segmentClients.length) return;
    if (!message.trim()) return;
    setSending(true);
    setSent(null);

    const results = { success: 0, failed: 0, skipped: 0 };

    for (const client of segmentClients) {
      if (!client.email) { results.skipped++; continue; }

      const personalizedMsg = buildMessage(client);
      const firstName = client.name?.split(' ')[0] || 'there';

      const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:system-ui,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:32px 16px;">
  <div style="text-align:center;margin-bottom:20px;">
    <span style="font-size:28px;">🌿</span>
    <h1 style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#2A5741;margin:6px 0 0;">${therapist.business_name || therapist.full_name}</h1>
  </div>
  <div style="background:#fff;border-radius:16px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.07);">
    <p style="font-size:16px;color:#1A1A2E;line-height:1.7;margin:0 0 20px;">${personalizedMsg.replace(bookingLink, `<a href="${bookingLink}" style="color:#2A5741;font-weight:700;">Book here →</a>`)}</p>
    <a href="${bookingLink}" style="display:block;background:#2A5741;color:#fff;text-decoration:none;border-radius:10px;padding:13px 20px;text-align:center;font-size:15px;font-weight:700;">
      Book a Session →
    </a>
  </div>
  <p style="font-size:11px;color:#9CA3AF;text-align:center;margin:20px 0 0;">Sent via BodyMap · mybodymap.app</p>
</div>
</body></html>`;

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.REACT_APP_RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${therapist.business_name || therapist.full_name} <outreach@mybodymap.app>`,
            to: [client.email],
            subject: `A quick note from ${therapist.business_name || therapist.full_name}`,
            html: emailHtml,
          }),
        });
        if (res.ok) results.success++;
        else results.failed++;
      } catch(e) { results.failed++; }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 120));
    }

    setSent(results);
    setSending(false);
  }

  const segInfo = SEGMENTS.find(s => s.id === segment);

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:C.dark, margin:'0 0 4px' }}>Smart Outreach</h2>
        <p style={{ fontSize:13, color:C.gray, margin:0 }}>Send a personal email to a group of clients in one shot. Each one gets their own message with their name.</p>
      </div>

      {/* Step 1 — Pick segment */}
      <div style={{ background:C.white, borderRadius:14, padding:20, border:`1.5px solid ${C.light}`, marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>Step 1 — Who to reach</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {SEGMENTS.map(seg => (
            <button key={seg.id} onClick={() => setSegment(seg.id)}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, border:`1.5px solid ${segment===seg.id?C.forest:C.light}`, background:segment===seg.id?'#F0FDF4':C.white, cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}>
              <span style={{ fontSize:20, flexShrink:0 }}>{seg.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:segment===seg.id?C.forest:C.dark }}>{seg.label}</div>
                <div style={{ fontSize:12, color:C.gray }}>{seg.desc}</div>
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:segment===seg.id?C.forest:C.gray, flexShrink:0 }}>
                {loading ? '…' : getSegment().length === 0 && segment !== seg.id ? '' : segment === seg.id ? `${segmentClients.length} clients` : ''}
              </div>
            </button>
          ))}
        </div>

        {segment === 'lapsed' && (
          <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:13, color:C.gray }}>Lapsed after</span>
            <input type="number" value={customLapsed} min={7} max={365}
              onChange={e => setCustomLapsed(parseInt(e.target.value)||60)}
              style={{ width:60, padding:'6px 8px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:14, fontWeight:700, color:C.forest, outline:'none', textAlign:'center' }} />
            <span style={{ fontSize:13, color:C.gray }}>days without a visit</span>
          </div>
        )}
      </div>

      {/* Step 2 — Message */}
      <div style={{ background:C.white, borderRadius:14, padding:20, border:`1.5px solid ${C.light}`, marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>Step 2 — Your message</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => { setTemplate(t.id); if (t.text) setMessage(t.text); }}
              style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${template===t.id?C.forest:C.light}`, background:template===t.id?C.forest:'transparent', color:template===t.id?'#fff':C.gray, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>
        <textarea value={message} onChange={e => { setMessage(e.target.value); setTemplate('custom'); }}
          rows={4} placeholder="Write your message... Use {name} for the client's first name and {link} for your booking link."
          style={{ width:'100%', padding:'12px', border:`1.5px solid ${C.light}`, borderRadius:10, fontSize:14, fontFamily:'system-ui', resize:'vertical', boxSizing:'border-box', outline:'none', lineHeight:1.6 }} />
        <div style={{ fontSize:11, color:C.gray, marginTop:6 }}>
          Use <strong>{'{name}'}</strong> → client's first name &nbsp;·&nbsp; <strong>{'{link}'}</strong> → your booking link
        </div>
      </div>

      {/* Step 3 — Preview & Send */}
      <div style={{ background:C.white, borderRadius:14, padding:20, border:`1.5px solid ${C.light}` }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>Step 3 — Review & send</div>

        {segmentClients.length === 0 ? (
          <div style={{ textAlign:'center', padding:'20px 0', color:C.gray, fontSize:13 }}>
            No clients match this filter yet.
          </div>
        ) : (
          <>
            <div style={{ background:C.beige, borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:6 }}>
                {segmentClients.length} client{segmentClients.length !== 1 ? 's' : ''} will receive this message
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {segmentClients.slice(0,12).map(c => (
                  <span key={c.id} style={{ fontSize:11, background:C.white, border:`1px solid ${C.light}`, borderRadius:20, padding:'3px 10px', color:C.dark }}>
                    {c.name?.split(' ')[0]}
                  </span>
                ))}
                {segmentClients.length > 12 && <span style={{ fontSize:11, color:C.gray }}>+{segmentClients.length - 12} more</span>}
              </div>
            </div>

            {/* Preview one message */}
            {segmentClients[0] && (
              <div style={{ background:'#F9FAFB', borderRadius:10, padding:'12px 14px', marginBottom:14, border:`1px solid ${C.light}` }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.gray, marginBottom:6 }}>PREVIEW — as {segmentClients[0].name?.split(' ')[0]} will see it:</div>
                <div style={{ fontSize:14, color:C.dark, lineHeight:1.7 }}>{buildMessage(segmentClients[0])}</div>
              </div>
            )}

            {sent && (
              <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#16A34A' }}>
                  ✅ Sent! {sent.success} delivered{sent.skipped > 0 ? `, ${sent.skipped} skipped (no email on file)` : ''}{sent.failed > 0 ? `, ${sent.failed} failed` : ''}
                </div>
              </div>
            )}

            <button onClick={sendAll} disabled={sending || !message.trim() || segmentClients.length === 0}
              style={{ width:'100%', background:sending?C.sage:C.forest, color:'#fff', border:'none', borderRadius:10, padding:'13px', fontSize:15, fontWeight:700, cursor:sending?'wait':'pointer' }}>
              {sending ? `Sending… (${segmentClients.length} emails)` : `Send to ${segmentClients.length} client${segmentClients.length !== 1 ? 's' : ''} →`}
            </button>
            <p style={{ fontSize:11, color:C.gray, textAlign:'center', marginTop:8 }}>Each client gets a personal email from you. Clients without an email address are skipped.</p>
          </>
        )}
      </div>
    </div>
  );
}
