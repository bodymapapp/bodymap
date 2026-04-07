import React, { useState, useEffect } from 'react';
import { db, supabase } from '../lib/supabase';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#E8E4DC' };

const SEGMENTS = [
  { id:'lapsed',   label:'Lapsed clients',    desc:'Haven\'t visited in X days' },
  { id:'due',      label:'Due for a visit',   desc:'Past their usual booking interval' },
  { id:'onetimer', label:'Never rebooked',    desc:'Came once, never returned' },
  { id:'frequent', label:'Your regulars',     desc:'4+ visits' },
  { id:'all',      label:'All clients',       desc:'Everyone with at least one visit' },
  { id:'custom',   label:'Custom filter',     desc:'You define the conditions' },
];

const TEMPLATES = [
  { id:'opening',  label:'You have an opening', text:'Hi {name}, I have an opening this week and thought of you. Would love to see you — grab a spot here: {link}' },
  { id:'checkin',  label:'Gentle check-in',     text:'Hi {name}, just checking in! It\'s been a while since your last visit. How are you feeling? I\'d love to help: {link}' },
  { id:'selfcare', label:'Self-care reminder',  text:'Hi {name}, a gentle reminder that taking care of yourself matters. I have some availability if you\'d like to book: {link}' },
  { id:'custom',   label:'Write my own',         text:'' },
];

const CONDITION_FIELDS = [
  { id:'days_since', label:'Days since last visit' },
  { id:'total_sessions', label:'Total sessions' },
  { id:'avg_interval', label:'Avg days between visits' },
];
const OPERATORS = [
  { id:'gt', label:'more than' },
  { id:'lt', label:'less than' },
  { id:'eq', label:'exactly' },
];

export default function Outreach({ therapist, lapsedDays = 60 }) {
  const twilioReady = !!therapist?.twilio_phone_number;
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState('lapsed');
  const [template, setTemplate] = useState('opening');
  const [message, setMessage] = useState(TEMPLATES[0].text);
  const [channel, setChannel] = useState('email'); // 'email' | 'sms'
  const [testMode, setTestMode] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);
  const [customLapsed, setCustomLapsed] = useState(lapsedDays);
  const [conditions, setConditions] = useState([{ field:'days_since', op:'gt', value:60 }]);

  useEffect(() => { load(); }, [therapist.id]);

  async function load() {
    setLoading(true);
    try { setClients(await db.getTherapistClients(therapist.id) || []); }
    catch(e) {}
    setLoading(false);
  }

  function avgInterval(client) {
    const sessions = (client.sessions || []).sort((a,b) => new Date(a.created_at)-new Date(b.created_at));
    if (sessions.length < 2) return null;
    let total = 0;
    for (let i=1;i<sessions.length;i++) total += (new Date(sessions[i].created_at)-new Date(sessions[i-1].created_at))/86400000;
    return Math.round(total/(sessions.length-1));
  }

  function getClientValue(client, field) {
    if (field === 'days_since') return client.days_since_visit;
    if (field === 'total_sessions') return client.total_sessions;
    if (field === 'avg_interval') return avgInterval(client);
    return null;
  }

  function applyOp(val, op, target) {
    if (val === null || val === undefined) return false;
    if (op === 'gt') return val > target;
    if (op === 'lt') return val < target;
    if (op === 'eq') return val === target;
    return false;
  }

  function getSegment() {
    switch(segment) {
      case 'lapsed':   return clients.filter(c => c.days_since_visit !== null && c.days_since_visit >= customLapsed);
      case 'due':      return clients.filter(c => { const avg=avgInterval(c); return avg && c.days_since_visit && c.days_since_visit >= avg*1.2; });
      case 'onetimer': return clients.filter(c => c.total_sessions === 1);
      case 'frequent': return clients.filter(c => c.total_sessions >= 4);
      case 'all':      return clients.filter(c => c.total_sessions >= 1);
      case 'custom':   return clients.filter(c => conditions.every(cond => applyOp(getClientValue(c, cond.field), cond.op, Number(cond.value))));
      default:         return [];
    }
  }

  const segmentClients = getSegment();
  const bookingLink = `https://mybodymap.app/book/${therapist.custom_url}`;

  function buildMessage(client) {
    const firstName = client.name?.split(' ')[0] || 'there';
    return message.replace(/{name}/gi, firstName).replace(/{link}/gi, bookingLink);
  }

  async function sendAll() {
    if (!message.trim()) return;
    setSending(true); setSent(null);

    const targets = testMode
      ? [{ name:'Test Client', email: testEmail, phone: testPhone, id:'test' }]
      : segmentClients;

    const results = { success:0, failed:0, skipped:0 };

    for (const client of targets) {
      const msg = testMode
        ? message.replace(/{name}/gi, 'Sarah').replace(/{link}/gi, bookingLink)
        : buildMessage(client);

      if (channel === 'email') {
        const email = client.email;
        if (!email) { results.skipped++; continue; }

        const firstName = client.name?.split(' ')[0] || 'there';
        const therapistName = therapist.business_name || therapist.full_name;
        const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:system-ui,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:32px 16px;">
  <div style="text-align:center;margin-bottom:20px;">
    <span style="font-size:28px;">🌿</span>
    <h1 style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#2A5741;margin:6px 0 0;">${therapistName}</h1>
  </div>
  <div style="background:#fff;border-radius:16px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.07);">
    <p style="font-size:16px;color:#1A1A2E;line-height:1.7;margin:0 0 20px;">${msg}</p>
    <a href="${bookingLink}" style="display:block;background:#2A5741;color:#fff;text-decoration:none;border-radius:10px;padding:13px 20px;text-align:center;font-size:15px;font-weight:700;">Book a Session →</a>
  </div>
  <p style="font-size:11px;color:#9CA3AF;text-align:center;margin:20px 0 0;">Sent via BodyMap · <a href="https://mybodymap.app" style="color:#9CA3AF;">mybodymap.app</a></p>
</div></body></html>`;

        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
        const res = await fetch(`${supabaseUrl}/functions/v1/send-outreach`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${anonKey}`, 'apikey': anonKey },
          body: JSON.stringify({
            from:`${therapistName} <outreach@mybodymap.app>`,
            to: email,
            subject:`A note from ${therapistName}`,
            html: emailHtml,
            reply_to: therapist.email || undefined,
          }),
        });
        if (res.ok) results.success++; else results.failed++;

      } else {
        // SMS via edge function
        const phone = client.phone;
        if (!phone) { results.skipped++; continue; }

        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
        const res = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${anonKey}`, 'apikey': anonKey },
          body: JSON.stringify({
            to: phone,
            message: msg,
            account_sid: therapist.twilio_account_sid,
            auth_token: therapist.twilio_auth_token,
            from_number: therapist.twilio_phone_number,
          }),
        });
        if (res.ok) results.success++; else results.failed++;
      }

      await new Promise(r => setTimeout(r, 150));
    }

    setSent(results);
    setSending(false);
  }

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:C.dark, margin:'0 0 4px' }}>Smart Outreach</h2>
        <p style={{ fontSize:13, color:C.gray, margin:0 }}>Send a personal message to a group of clients in one shot. Each one is addressed by name.</p>
      </div>

      {/* Channel toggle */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {[{id:'email',label:'📧 Email'},{id:'sms',label:'💬 Text (SMS)'}].map(ch => (
          <button key={ch.id} onClick={() => setChannel(ch.id)}
            style={{ flex:1, padding:'10px', borderRadius:10, border:`1.5px solid ${channel===ch.id?C.forest:C.light}`, background:channel===ch.id?C.forest:'transparent', color:channel===ch.id?'#fff':C.gray, fontSize:14, fontWeight:700, cursor:'pointer' }}>
            {ch.label}
          </button>
        ))}
      </div>

      {channel === 'sms' && (
        <div style={{ background:C.beige, border:`1.5px solid ${C.light}`, borderRadius:10, padding:'14px 16px', marginBottom:16, fontSize:13, color:C.gray, lineHeight:1.6 }}>
          <div style={{ fontWeight:700, color:C.dark, marginBottom:6 }}>📱 How SMS works in BodyMap</div>
          Your clients will receive texts from a dedicated phone number assigned to your practice — not your personal number.
          When setting up, pick a number with your local area code so it feels familiar.
          <div style={{ marginTop:8, padding:'8px 12px', background:C.white, borderRadius:8, fontSize:12, color:C.forest, fontWeight:600 }}>
            💡 Tip: Save your BodyMap number in your own phone as "My Practice SMS" so you recognize it if clients reply.
          </div>
        </div>
      )}

      {/* Step 1 - Segment */}
      <div style={{ background:C.white, borderRadius:14, padding:20, border:`1.5px solid ${C.light}`, marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>Step 1 — Who to reach</div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {SEGMENTS.map(seg => (
            <button key={seg.id} onClick={() => setSegment(seg.id)}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:10, border:`1.5px solid ${segment===seg.id?C.forest:C.light}`, background:segment===seg.id?'#F0FDF4':C.white, cursor:'pointer', textAlign:'left' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:segment===seg.id?C.forest:C.dark }}>{seg.label}</div>
                <div style={{ fontSize:11, color:C.gray }}>{seg.desc}</div>
              </div>
              {segment === seg.id && !loading && (
                <div style={{ fontSize:13, fontWeight:700, color:C.forest, flexShrink:0 }}>{segmentClients.length} clients</div>
              )}
            </button>
          ))}
        </div>

        {segment === 'lapsed' && (
          <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:13, color:C.gray }}>Lapsed after</span>
            <input type="number" value={customLapsed} min={7} max={365} onChange={e => setCustomLapsed(parseInt(e.target.value)||60)}
              style={{ width:60, padding:'6px 8px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:14, fontWeight:700, color:C.forest, outline:'none', textAlign:'center' }} />
            <span style={{ fontSize:13, color:C.gray }}>days without a visit</span>
          </div>
        )}

        {segment === 'custom' && (
          <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:8 }}>
            {conditions.map((cond, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <select value={cond.field} onChange={e => setConditions(cs => cs.map((c,j) => j===i?{...c,field:e.target.value}:c))}
                  style={{ padding:'7px 10px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:13, outline:'none', background:'#fff' }}>
                  {CONDITION_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <select value={cond.op} onChange={e => setConditions(cs => cs.map((c,j) => j===i?{...c,op:e.target.value}:c))}
                  style={{ padding:'7px 10px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:13, outline:'none', background:'#fff' }}>
                  {OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <input type="number" value={cond.value} onChange={e => setConditions(cs => cs.map((c,j) => j===i?{...c,value:e.target.value}:c))}
                  style={{ width:70, padding:'7px 8px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:13, outline:'none', textAlign:'center' }} />
                {conditions.length > 1 && (
                  <button onClick={() => setConditions(cs => cs.filter((_,j) => j!==i))}
                    style={{ background:'transparent', border:'none', color:'#EF4444', cursor:'pointer', fontSize:16 }}>×</button>
                )}
              </div>
            ))}
            <button onClick={() => setConditions(cs => [...cs, {field:'days_since',op:'gt',value:30}])}
              style={{ alignSelf:'flex-start', background:'transparent', border:`1.5px dashed ${C.light}`, borderRadius:8, padding:'5px 14px', fontSize:12, fontWeight:600, color:C.sage, cursor:'pointer' }}>
              + Add condition
            </button>
          </div>
        )}
      </div>

      {/* Step 2 - Message */}
      <div style={{ background:C.white, borderRadius:14, padding:20, border:`1.5px solid ${C.light}`, marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>Step 2 — Your message</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => { setTemplate(t.id); if(t.text) setMessage(t.text); }}
              style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${template===t.id?C.forest:C.light}`, background:template===t.id?C.forest:'transparent', color:template===t.id?'#fff':C.gray, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>
        <textarea value={message} onChange={e => { setMessage(e.target.value); setTemplate('custom'); }}
          rows={channel==='sms'?3:4}
          placeholder={`Write your message... Use {name} for the client's first name and {link} for your booking link.${channel==='sms'?' Keep it under 160 characters for a single text.':''}`}
          style={{ width:'100%', padding:'12px', border:`1.5px solid ${C.light}`, borderRadius:10, fontSize:14, fontFamily:'system-ui', resize:'vertical', boxSizing:'border-box', outline:'none', lineHeight:1.6 }} />
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
          <span style={{ fontSize:11, color:C.gray }}><strong>{'{name}'}</strong> → first name &nbsp;·&nbsp; <strong>{'{link}'}</strong> → booking link</span>
          {channel==='sms' && <span style={{ fontSize:11, color:message.length>160?'#EF4444':C.gray }}>{message.length}/160</span>}
        </div>
      </div>

      {/* Step 3 - Send */}
      <div style={{ background:C.white, borderRadius:14, padding:20, border:`1.5px solid ${C.light}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em' }}>Step 3 — Review & send</div>
          <button onClick={() => setTestMode(t => !t)}
            style={{ fontSize:12, fontWeight:600, padding:'5px 12px', borderRadius:20, border:`1.5px solid ${testMode?C.forest:C.light}`, background:testMode?'#F0FDF4':'transparent', color:testMode?C.forest:C.gray, cursor:'pointer' }}>
            {testMode ? '🧪 Test mode ON' : '🧪 Test mode'}
          </button>
        </div>

        {testMode && (
          <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.forest, marginBottom:8 }}>Test mode — sends only to you, not to clients</div>
            {channel === 'email' ? (
              <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                placeholder="Your email address" style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:14, boxSizing:'border-box', outline:'none' }} />
            ) : (
              <input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)}
                placeholder="Your phone number" style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:14, boxSizing:'border-box', outline:'none' }} />
            )}
          </div>
        )}

        {!testMode && (
          <>
            {segmentClients.length === 0 ? (
              <div style={{ textAlign:'center', padding:'20px 0', color:C.gray, fontSize:13 }}>No clients match this filter yet.</div>
            ) : (
              <div style={{ background:C.beige, borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:6 }}>
                  {segmentClients.length} client{segmentClients.length!==1?'s':''} will receive this message
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {segmentClients.slice(0,15).map(c => (
                    <span key={c.id} style={{ fontSize:11, background:C.white, border:`1px solid ${C.light}`, borderRadius:20, padding:'3px 10px', color:C.dark }}>
                      {c.name?.split(' ')[0]}
                    </span>
                  ))}
                  {segmentClients.length > 15 && <span style={{ fontSize:11, color:C.gray }}>+{segmentClients.length-15} more</span>}
                </div>
              </div>
            )}
          </>
        )}

        {/* Preview */}
        {message && (
          <div style={{ background:'#F9FAFB', borderRadius:10, padding:'12px 14px', marginBottom:14, border:`1px solid ${C.light}` }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.gray, marginBottom:6 }}>PREVIEW — as a client sees it:</div>
            <div style={{ fontSize:14, color:C.dark, lineHeight:1.7 }}>
              {message.replace(/{name}/gi, 'Sarah').replace(/{link}/gi, bookingLink)}
            </div>
          </div>
        )}

        {sent && (
          <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#16A34A' }}>
              ✅ {testMode ? 'Test sent!' : `Sent! ${sent.success} delivered`}
              {sent.skipped > 0 ? `, ${sent.skipped} skipped (no ${channel==='sms'?'phone':'email'})` : ''}
              {sent.failed > 0 ? `, ${sent.failed} failed` : ''}
            </div>
          </div>
        )}

        <button onClick={sendAll}
          disabled={sending || !message.trim() || (!testMode && segmentClients.length===0) || (testMode && channel==='email' && !testEmail) || (testMode && channel==='sms' && !testPhone) || (channel==='sms')}
          style={{ width:'100%', background:sending?C.sage:C.forest, color:'#fff', border:'none', borderRadius:10, padding:'13px', fontSize:15, fontWeight:700, cursor:(sending||(channel==='sms'&&!twilioReady))?'not-allowed':'pointer', opacity:(channel==='sms'&&!twilioReady)?0.5:1 }}>
          {channel==='sms' && !twilioReady ? 'Connect your SMS number in Settings →' :
           sending ? `Sending…` :
           testMode ? `Send test ${channel === 'email' ? 'email' : 'text'} to me` :
           `Send to ${segmentClients.length} client${segmentClients.length!==1?'s':''} →`}
        </button>
        {!testMode && channel==='email' && <p style={{ fontSize:11, color:C.gray, textAlign:'center', marginTop:8 }}>Each client gets a personal email. Clients without an email address are skipped.</p>}
      </div>
    </div>
  );
}
