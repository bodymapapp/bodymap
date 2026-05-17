import React, { useState, useEffect } from 'react';
import { db, supabase } from '../lib/supabase';
import QuickSendBlocks from './QuickSendBlocks';
import CloseButton from './CloseButton';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#E8E4DC' };

const SEGMENTS = [
  { id:'lapsed',     label:'Lapsed clients',   desc:'Haven\'t visited in X days' },
  { id:'due',        label:'Due for a visit',  desc:'Past their usual booking interval' },
  { id:'onetimer',   label:'Never rebooked',   desc:'Came once, never returned' },
  { id:'frequent',   label:'Your regulars',    desc:'4+ visits' },
  { id:'no_history', label:'Newly imported',   desc:'No bookings yet, recently added to your list' },
  { id:'all',        label:'All clients',      desc:'Everyone with email or phone' },
  { id:'custom',     label:'Custom filter',    desc:'You define the conditions' },
];

// Tokens that can be inserted into the message body and resolved per
// recipient at send time. {name} and {link} are kept for backward
// compatibility with messages saved before this upgrade.
const TOKENS = [
  { id:'first_name',  label:'First name',     hint:'Sarah' },
  { id:'last_name',   label:'Last name',      hint:'Lee' },
  { id:'business',    label:'Business',       hint:'your business name' },
  { id:'therapist',   label:'You',            hint:'your name' },
  { id:'last_visit',  label:'Last visit',     hint:'Mar 12' },
  { id:'last_service',label:'Last service',   hint:'Deep Tissue' },
  { id:'link',        label:'Booking link',   hint:'mybodymap.app/book/...' },
];

// Platform campaign starters. Each is one tap — Claude drafts the email/SMS
// body in the therapist's voice. Subject is also drafted for email
// channel. Therapist can edit before sending.
const AI_STARTERS = [
  { id:'mothers_day',     label:"Mother's Day special",        emoji:'💐', prompt:"a Mother's Day special offer (e.g. discount, gift card, treat-yourself promo) running this May" },
  { id:'vacation',        label:'Vacation closure',            emoji:'🏖️', prompt:"announcing you'll be on vacation and closed for a stretch of dates, asking clients to book ahead" },
  { id:'new_service',     label:'New service launch',          emoji:'✨', prompt:"announcing a new service you've added to your menu, with an intro discount for existing clients" },
  { id:'special_offer',   label:'Special offer / promo',       emoji:'🎁', prompt:"a limited-time special offer or seasonal discount to drive bookings this month" },
  { id:'holiday_hours',   label:'Holiday hours',               emoji:'🗓️', prompt:"sharing your holiday schedule and any modified hours so clients can plan ahead" },
  { id:'weather_closure', label:'Weather closure',             emoji:'❄️', prompt:"a same-day weather closure notice (snow, ice, storm) and offering to reschedule affected appointments" },
  { id:'anniversary',     label:'Anniversary / milestone',     emoji:'🎉', prompt:"celebrating a practice milestone (e.g. one year in business, hundredth client) with thanks to your clients" },
  { id:'lapsed_react',    label:'Reactivate lapsed clients',   emoji:'🌿', prompt:"a warm we-miss-you message to clients who haven't visited in a while, gently inviting them back without pressure" },
];

const TEMPLATES = [
  { id:'opening',  label:'You have an opening', text:'Hi {name}, I have an opening this week and thought of you. Would love to see you, grab a spot here: {link}' },
  { id:'checkin',  label:'Gentle check-in',     text:'Hi {name}, just checking in! It\'s been a while since your last visit. How are you feeling? I\'d love to help: {link}' },
  { id:'selfcare', label:'Self-care reminder',  text:'Hi {name}, a gentle reminder that taking care of yourself matters. I have some availability if you\'d like to book: {link}' },
  { id:'wemoved',  label:'We moved (new system)', text:'Hi {name}, quick note. I have moved my booking and intake to a calmer setup that works better for both of us. Same me, same studio, just an easier way to book and stay in touch. Your previous bookings and history are with me, nothing is lost. The new link is below. If anything feels off or you have questions, reply to this email and I will help you through it. With care, {therapist}.\n\n{link}' },
  { id:'custom',   label:'Write my own',        text:'' },
];

const CONDITION_FIELDS = [
  { id:'days_since',     label:'Days since last visit' },
  { id:'total_sessions', label:'Total sessions' },
  { id:'avg_interval',   label:'Avg days between visits' },
];
const OPERATORS = [
  { id:'gt', label:'more than' },
  { id:'lt', label:'less than' },
  { id:'eq', label:'exactly' },
];

export default function Outreach({ therapist: therapistProp, lapsedDays = 60 }) {
  // Read URL query params for deep-link defaults (e.g. /dashboard/outreach?template=wemoved&segment=all)
  const initialQuery = (() => {
    if (typeof window === 'undefined') return {};
    const params = new URLSearchParams(window.location.search);
    return {
      template: params.get('template'),
      segment: params.get('segment'),
    };
  })();

  const initialTemplate = TEMPLATES.find(t => t.id === initialQuery.template) || TEMPLATES[0];

  const [therapist, setTherapist] = useState(therapistProp);
  const [clients, setClients]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [segment, setSegment]     = useState(initialQuery.segment || 'lapsed');
  const [template, setTemplate]   = useState(initialTemplate.id);
  const [message, setMessage]     = useState(initialTemplate.text);
  const [channel, setChannel]     = useState('email');
  const [testMode, setTestMode]   = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [sending, setSending]     = useState(false);
  const [sent, setSent]           = useState(null);
  const [customLapsed, setCustomLapsed] = useState(lapsedDays);
  const [conditions, setConditions]     = useState([{ field:'days_since', op:'gt', value:60 }]);
  // New: campaign subject (email only), Platform starter modal state, send log
  const [subject, setSubject]           = useState('');
  const [aiStarterOpen, setAiStarterOpen] = useState(false);
  const [aiStarterCategory, setAiStarterCategory] = useState(null);
  const [aiStarterContext, setAiStarterContext] = useState('');
  const [aiDrafting, setAiDrafting]     = useState(false);
  const [aiError, setAiError]           = useState(null);
  const [recentSends, setRecentSends]   = useState([]);
  const messageRef = React.useRef(null);

  const twilioReady  = !!therapist?.twilio_phone_number;
  const bookingLink  = `https://mybodymap.app/book/${therapist?.custom_url || ''}`;
  const therapistName = therapist?.business_name || therapist?.full_name || 'Your therapist';

  useEffect(() => {
    loadClients();
    // Re-fetch therapist to get latest Twilio credentials
    supabase.from('therapists').select('*').eq('id', therapistProp.id).single()
      .then(({ data }) => { if (data) setTherapist(data); });
  }, [therapistProp.id]);

  async function loadClients() {
    setLoading(true);
    try { setClients(await db.getTherapistClients(therapistProp.id) || []); }
    catch(e) { console.error(e); }
    setLoading(false);
  }

  function avgInterval(client) {
    const sessions = (client.sessions || []).sort((a,b) => new Date(a.created_at)-new Date(b.created_at));
    if (sessions.length < 2) return null;
    let total = 0;
    for (let i=1;i<sessions.length;i++) total += (new Date(sessions[i].created_at)-new Date(sessions[i-1].created_at))/86400000;
    return Math.round(total/(sessions.length-1));
  }

  function getClientValue(c, field) {
    if (field === 'days_since')     return c.days_since_visit;
    if (field === 'total_sessions') return c.total_sessions;
    if (field === 'avg_interval')   return avgInterval(c);
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
    // Always exclude unsubscribed clients from segment counts so the
    // count the therapist sees matches what'll actually receive.
    // Also exclude clients with no way to reach them at all (no email
    // and no phone) since a campaign send to them would just fail.
    const eligible = clients.filter(c =>
      !c.outreach_unsubscribed && (c.email || c.phone)
    );
    switch(segment) {
      case 'lapsed':     return eligible.filter(c => c.days_since_visit !== null && c.days_since_visit >= customLapsed);
      case 'due':        return eligible.filter(c => { const avg=avgInterval(c); return avg && c.days_since_visit && c.days_since_visit >= avg*1.2; });
      case 'onetimer':   return eligible.filter(c => c.total_sessions === 1);
      case 'frequent':   return eligible.filter(c => c.total_sessions >= 4);
      // 'no_history' specifically covers imported clients with no
      // bookings yet. Common after a CSV migration. HK May 14 2026:
      // Candice imported from GlossGenius and her clients did not
      // come with visit history columns, so they were invisible to
      // every prior segment.
      case 'no_history': return eligible.filter(c => (c.total_sessions || 0) === 0);
      // 'all' now means every reachable client, regardless of session
      // count. Was previously 'everyone with at least one visit'
      // which silently excluded imported clients. Therapists expect
      // 'all' to mean all.
      case 'all':        return eligible;
      case 'custom':     return eligible.filter(c => conditions.every(cond => applyOp(getClientValue(c, cond.field), cond.op, Number(cond.value))));
      default:           return [];
    }
  }

  const segmentClients = getSegment();

  // Resolve all {tokens} for a specific client. Backward compatible:
  // {name} keeps working alongside the new {first_name} for messages
  // saved before this upgrade.
  function buildMessage(client, raw = message) {
    const fullName = client.name || '';
    const parts = fullName.split(' ');
    const firstName = parts[0] || 'there';
    const lastName = parts.slice(1).join(' ') || '';
    const lastVisit = client.last_session_date
      ? new Date(client.last_session_date).toLocaleDateString('en-US', { month:'short', day:'numeric' })
      : '';
    const lastService = client.last_service_name || '';
    return raw
      .replace(/\{name\}/gi, firstName)
      .replace(/\{first_name\}/gi, firstName)
      .replace(/\{last_name\}/gi, lastName)
      .replace(/\{business\}/gi, therapist?.business_name || therapist?.full_name || '')
      .replace(/\{therapist\}/gi, (therapist?.full_name || '').split(' ')[0] || '')
      .replace(/\{last_visit\}/gi, lastVisit)
      .replace(/\{last_service\}/gi, lastService)
      .replace(/\{link\}/gi, bookingLink);
  }

  function buildSubject(client, raw = subject) {
    if (!raw) return '';
    return buildMessage(client, raw);
  }

  // Insert token at cursor position in message textarea.
  function insertToken(tokenId) {
    const ta = messageRef.current;
    const placeholder = `{${tokenId}}`;
    if (!ta) {
      setMessage(m => m + ' ' + placeholder);
      return;
    }
    const start = ta.selectionStart || message.length;
    const end = ta.selectionEnd || message.length;
    const next = message.slice(0, start) + placeholder + message.slice(end);
    setMessage(next);
    setTemplate('custom');
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + placeholder.length;
      try { ta.setSelectionRange(pos, pos); } catch {}
    });
  }

  // Ask Claude to draft a campaign body (and subject if email) for the
  // selected starter category. The therapist can then edit freely.
  async function generateAiDraft(category, contextNote) {
    setAiDrafting(true);
    setAiError(null);
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const anonKey     = process.env.REACT_APP_SUPABASE_ANON_KEY;

    const toneLines = [
      "Voice: warm, plain, feminine. Like a 70-year-old grandmother massage therapist talking to a regular client.",
      "No em dashes anywhere. Use commas or periods.",
      "Reading level: about 10th grade. No jargon. No 'synergy' or 'leverage'.",
      "Sign-off: just the therapist's first name on its own line.",
      "Do not include a subject line greeting like 'Dear' or 'Hello there.' Just open warmly.",
    ].join("\n");

    const tokenLines = [
      "You may use these placeholder tokens which will be substituted per recipient:",
      "{first_name}  - the client's first name",
      "{business}    - the therapist's business name",
      "{therapist}   - the therapist's first name",
      "{last_visit}  - date of their last visit (e.g. 'Mar 12')",
      "{link}        - the therapist's booking link",
      "Use {first_name} naturally, e.g. 'Hi {first_name},'",
    ].join("\n");

    const businessName = therapist?.business_name || therapist?.full_name || 'this practice';
    const therapistFirst = (therapist?.full_name || '').split(' ')[0] || 'the therapist';

    const userMsg = [
      `Draft a ${channel === 'email' ? 'campaign email' : 'campaign SMS'} for ${businessName}, a massage therapy practice.`,
      `Topic: ${category.prompt}`,
      contextNote ? `Specific details from the therapist: ${contextNote}` : '',
      "",
      tokenLines,
      "",
      toneLines,
      "",
      channel === 'email'
        ? "Return JSON: { \"subject\": \"...\", \"body\": \"...\" }. The body should be 4-7 short paragraphs. End with the therapist's first name as sign-off. No HTML, just plain text with line breaks."
        : `Return JSON: { "body": "..." }. Body must be under 160 characters total including the {link} placeholder. SMS is short and warm.`,
      "Output JSON only, no commentary.",
    ].filter(Boolean).join("\n");

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/bodymap-ai`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${anonKey}`, 'apikey':anonKey },
        body: JSON.stringify({
          mode: 'public',
          context: '',
          messages: [{ role: 'user', content: userMsg }],
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '';
      const cleaned = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.body) setMessage(parsed.body);
      if (parsed.subject && channel === 'email') setSubject(parsed.subject);
      setTemplate('custom');
      setAiStarterOpen(false);
      setAiStarterCategory(null);
      setAiStarterContext('');
    } catch (err) {
      console.error('Platform draft failed:', err);
      setAiError('Could not generate draft. Try again or write your own.');
    }
    setAiDrafting(false);
  }

  async function loadRecentSends() {
    if (!therapistProp?.id) return;
    const { data } = await supabase
      .from('outreach_sends')
      .select('id, channel, segment_label, subject, message, recipient_count, success_count, skipped_count, failed_count, ai_starter_id, test_mode, created_at')
      .eq('therapist_id', therapistProp.id)
      .order('created_at', { ascending: false })
      .limit(15);
    setRecentSends(data || []);
  }

  useEffect(() => { loadRecentSends(); }, [therapistProp?.id]);

  async function sendAll() {
    if (!message.trim()) return;
    setSending(true); setSent(null);

    const targets = testMode
      ? [{ name:'Sarah Test', email:testEmail, phone:testPhone, id:'test' }]
      : segmentClients;

    const results = { success:0, failed:0, skipped:0 };
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const anonKey     = process.env.REACT_APP_SUPABASE_ANON_KEY;

    // Build text-to-html conversion: respect line breaks, escape HTML.
    const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    const textToHtml = (s) => escapeHtml(s).replace(/\n/g, '<br>');

    for (const client of targets) {
      // Skip clients who unsubscribed from this therapist's outreach.
      if (!testMode && client.outreach_unsubscribed) {
        results.skipped++;
        continue;
      }

      const msg = testMode
        ? buildMessage({ name:'Sarah Test', last_session_date:new Date().toISOString(), last_service_name:'Swedish Massage' })
        : buildMessage(client);
      const subj = testMode
        ? buildSubject({ name:'Sarah Test', last_session_date:new Date().toISOString(), last_service_name:'Swedish Massage' })
        : buildSubject(client);

      try {
        if (channel === 'email') {
          const email = client.email;
          if (!email) { results.skipped++; continue; }

          const finalSubject = subj.trim() || `A note from ${therapistName}`;
          const messageHtml = textToHtml(msg);
          const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:system-ui,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:32px 16px;">
  <div style="text-align:center;margin-bottom:20px;">
    <span style="font-size:28px;">🌿</span>
    <h1 style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#2A5741;margin:6px 0 0;">${escapeHtml(therapistName)}</h1>
  </div>
  <div style="background:#fff;border-radius:16px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.07);">
    <div style="font-size:16px;color:#1A1A2E;line-height:1.7;margin:0 0 20px;">${messageHtml}</div>
    <a href="${bookingLink}" style="display:block;background:#2A5741;color:#fff;text-decoration:none;border-radius:10px;padding:13px 20px;text-align:center;font-size:15px;font-weight:700;">Book a Service →</a>
  </div>
  <p style="font-size:11px;color:#9CA3AF;text-align:center;margin:20px 0 6px;">Sent by ${escapeHtml(therapistName)} via MyBodyMap</p>
  <p style="font-size:11px;color:#9CA3AF;text-align:center;margin:0;">Don't want these? <a href="{unsubscribe_url}" style="color:#9CA3AF;text-decoration:underline;">Unsubscribe</a></p>
</div></body></html>`;

          const payload = {
            from: `${therapistName} <outreach@mybodymap.app>`,
            to: email,
            subject: finalSubject,
            html: emailHtml,
            reply_to: therapist?.email,
          };
          // Only include unsubscribe-token IDs for real sends, not test mode
          // (no real client to unsubscribe).
          if (!testMode && client.id && therapistProp?.id) {
            payload.client_id = client.id;
            payload.therapist_id = therapistProp.id;
          } else {
            // Test mode: just remove the placeholder so it doesn't show literally.
            payload.html = payload.html.replace('{unsubscribe_url}', '#');
          }

          const res = await fetch(`${supabaseUrl}/functions/v1/send-outreach`, {
            method:'POST',
            headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${anonKey}`, 'apikey':anonKey },
            body: JSON.stringify(payload),
          });
          if (res.ok) results.success++; else results.failed++;

        } else {
          // SMS
          const phone = client.phone;
          if (!phone) { results.skipped++; continue; }

          // Append STOP instructions for TCPA compliance on first send.
          // Twilio auto-handles STOP keyword but the disclosure is required.
          const smsBody = msg.length > 140 ? msg : `${msg}\n\nReply STOP to opt out.`;

          const res = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
            method:'POST',
            headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${anonKey}`, 'apikey':anonKey },
            body: JSON.stringify({ to:phone, message:smsBody, account_sid:therapist?.twilio_account_sid, auth_token:therapist?.twilio_auth_token, from_number:therapist?.twilio_phone_number }),
          });
          if (res.ok) results.success++; else results.failed++;
        }
      } catch(e) { results.failed++; }

      await new Promise(r => setTimeout(r, 150));
    }

    setSent(results);
    setSending(false);

    // Log to outreach_sends history (skip test sends).
    if (!testMode && therapistProp?.id) {
      try {
        const segmentLabel = SEGMENTS.find(s => s.id === segment)?.label || segment;
        await supabase.from('outreach_sends').insert({
          therapist_id: therapistProp.id,
          channel,
          segment,
          segment_label: segmentLabel,
          subject: channel === 'email' ? (subject || `A note from ${therapistName}`) : null,
          message,
          recipient_count: targets.length,
          success_count: results.success,
          skipped_count: results.skipped,
          failed_count: results.failed,
          ai_starter_id: aiStarterCategory?.id || null,
          test_mode: false,
        });
        loadRecentSends();
      } catch (e) {
        console.warn('outreach_sends log failed (non-fatal):', e);
      }
    }
  }

  const canSend = !sending && message.trim() &&
    (testMode
      ? (channel === 'email' ? !!testEmail : !!testPhone && twilioReady)
      : segmentClients.length > 0 && (channel === 'email' || twilioReady));

  return (
    <div style={{ paddingBottom: window.innerWidth < 768 ? 120 : 0 }}>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:C.dark, margin:'0 0 4px' }}>Smart Outreach</h2>
        <p style={{ fontSize:13, color:C.gray, margin:0 }}>Send a personal message to a group of clients in one shot. Each one is addressed by name.</p>
      </div>

      {/* Quick-send blocks at the top.
          HK direction May 9 2026: 5 preconfigured blocks for the
          most common outreach moments (welcome new clients, miss
          you, ready when you are, package balance, special this
          month). 2-click flow: tap block, modal opens, send.
          Below this, the existing 'advanced' segment + filter +
          template builder remains for therapists who need it. */}
      <QuickSendBlocks therapist={therapist} />

      {/* Divider between quick-send and advanced */}
      <div style={{ display:'flex', alignItems:'center', gap:12, margin:'8px 0 18px' }}>
        <div style={{ flex:1, height:1, background:C.light }} />
        <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em' }}>
          Or build a custom campaign
        </div>
        <div style={{ flex:1, height:1, background:C.light }} />
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
          <div style={{ fontWeight:700, color:C.dark, marginBottom:4 }}>📱 How SMS works</div>
          Your clients receive texts from your dedicated practice number {therapist?.twilio_phone_number ? `(${therapist.twilio_phone_number})` : ''}. It is not your personal number, it is a number assigned to your practice via Twilio.
          {!twilioReady && <div style={{ marginTop:8, color:'#92400E', fontWeight:600 }}>⚠️ Set up your SMS number in Settings to enable this.</div>}
        </div>
      )}

      {/* Step 1 */}
      <div style={{ background:C.white, borderRadius:14, padding:20, border:`1.5px solid ${C.light}`, marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>Step 1, Who to reach</div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {SEGMENTS.map(seg => (
            <button key={seg.id} onClick={() => setSegment(seg.id)}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:10, border:`1.5px solid ${segment===seg.id?C.forest:C.light}`, background:segment===seg.id?'#F0FDF4':C.white, cursor:'pointer', textAlign:'left' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:segment===seg.id?C.forest:C.dark }}>{seg.label}</div>
                <div style={{ fontSize:11, color:C.gray }}>{seg.desc}</div>
              </div>
              {segment === seg.id && !loading && (
                <span style={{ fontSize:13, fontWeight:700, color:C.forest }}>{segmentClients.length} clients</span>
              )}
            </button>
          ))}
        </div>

        {segment === 'lapsed' && (
          <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:13, color:C.gray }}>Lapsed after</span>
            <input type="number" value={customLapsed} min={7} max={365} onChange={e => setCustomLapsed(parseInt(e.target.value)||60)}
              style={{ width:60, padding:'6px 8px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:14, fontWeight:700, color:C.forest, outline:'none', textAlign:'center' }} />
            <span style={{ fontSize:13, color:C.gray }}>days</span>
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
                    aria-label="Remove this condition"
                    style={{ background:'transparent', border:'1px solid transparent', color:'#EF4444', cursor:'pointer', fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:999, transition:'all 0.15s' }}
                    onMouseEnter={(e)=>{e.currentTarget.style.background='#FEF2F2';e.currentTarget.style.borderColor='#FCA5A5';}}
                    onMouseLeave={(e)=>{e.currentTarget.style.background='transparent';e.currentTarget.style.borderColor='transparent';}}>Remove</button>
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

      {/* Step 2 */}
      <div style={{ background:C.white, borderRadius:14, padding:20, border:`1.5px solid ${C.light}`, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em' }}>Step 2, Your message</div>
          <button onClick={() => setAiStarterOpen(true)}
            style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:700, color:'#fff', background:C.forest, border:'none', borderRadius:20, padding:'6px 14px', cursor:'pointer' }}>
            ✨ Platform starter
          </button>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => { setTemplate(t.id); if(t.text) setMessage(t.text); }}
              style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${template===t.id?C.forest:C.light}`, background:template===t.id?C.forest:'transparent', color:template===t.id?'#fff':C.gray, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>

        {channel === 'email' && (
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>Subject</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder={`A note from ${therapistName}`}
              style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:14, fontFamily:'system-ui', boxSizing:'border-box', outline:'none' }} />
          </div>
        )}

        <textarea ref={messageRef} value={message} onChange={e => { setMessage(e.target.value); setTemplate('custom'); }} rows={channel==='sms'?3:6}
          placeholder={`Write your message... Tap a token below to insert it.`}
          style={{ width:'100%', padding:'12px', border:`1.5px solid ${C.light}`, borderRadius:10, fontSize:14, fontFamily:'system-ui', resize:'vertical', boxSizing:'border-box', outline:'none', lineHeight:1.6 }} />

        {/* Token chips: tap to insert at cursor */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
          <span style={{ fontSize:10, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.06em', alignSelf:'center', marginRight:4 }}>Insert</span>
          {TOKENS.map(tok => (
            <button key={tok.id} type="button" onClick={() => insertToken(tok.id)}
              title={`Insert {${tok.id}} — example: ${tok.hint}`}
              style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 9px', borderRadius:8, border:`1px solid ${C.light}`, background:'#FAF7EE', color:C.forest, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'ui-monospace, monospace' }}>
              {`{${tok.id}}`}
            </button>
          ))}
        </div>

        {channel==='sms' && (
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:6 }}>
            <span style={{ fontSize:11, color:message.length>160?'#EF4444':C.gray }}>{message.length}/160 (longer = 2 segments)</span>
          </div>
        )}
      </div>

      {/* Platform starter modal */}
      {aiStarterOpen && (
        <div onClick={() => !aiDrafting && setAiStarterOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:18, padding:24, maxWidth:520, width:'100%', maxHeight:'90vh', overflow:'auto', boxShadow:'0 12px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
              <div>
                <h3 style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:C.dark, margin:'0 0 4px' }}>✨ Campaign starter</h3>
                <p style={{ fontSize:13, color:C.gray, margin:0, lineHeight:1.5 }}>Pick a topic. The platform will draft an email{channel==='email'?' (subject + body)':' message'} in your voice. You can edit before sending.</p>
              </div>
              <CloseButton onClick={() => setAiStarterOpen(false)} label="Cancel" disabled={aiDrafting} />
            </div>

            {!aiStarterCategory ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:6 }}>
                {AI_STARTERS.map(s => (
                  <button key={s.id} onClick={() => setAiStarterCategory(s)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', border:`1.5px solid ${C.light}`, borderRadius:12, background:'#fff', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FAF7EE'; e.currentTarget.style.borderColor = C.forest; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = C.light; }}>
                    <span style={{ fontSize:22 }}>{s.emoji}</span>
                    <span style={{ fontSize:14, fontWeight:600, color:C.dark }}>{s.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ marginTop:6 }}>
                <div style={{ background:'#FAF7EE', border:`1.5px solid ${C.light}`, borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.dark, marginBottom:2 }}>{aiStarterCategory.emoji} {aiStarterCategory.label}</div>
                </div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Anything specific to mention? (Optional)</label>
                <textarea value={aiStarterContext} onChange={e => setAiStarterContext(e.target.value)} rows={3}
                  placeholder="e.g. dates I'll be closed, the discount amount, the new service name…"
                  style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:13, fontFamily:'system-ui', resize:'vertical', boxSizing:'border-box', outline:'none' }} />
                {aiError && (
                  <div style={{ marginTop:10, padding:'10px 12px', background:'#FEF2F2', border:'1.5px solid #FECACA', borderRadius:8, fontSize:13, color:'#991B1B' }}>{aiError}</div>
                )}
                <div style={{ display:'flex', gap:8, marginTop:14 }}>
                  <button onClick={() => { setAiStarterCategory(null); setAiError(null); }} disabled={aiDrafting}
                    style={{ flex:1, padding:'11px', borderRadius:10, border:`1.5px solid ${C.light}`, background:'#fff', color:C.gray, fontSize:13, fontWeight:600, cursor:aiDrafting?'wait':'pointer' }}>
                    ← Back
                  </button>
                  <button onClick={() => generateAiDraft(aiStarterCategory, aiStarterContext)} disabled={aiDrafting}
                    style={{ flex:2, padding:'11px', borderRadius:10, border:'none', background:aiDrafting?C.sage:C.forest, color:'#fff', fontSize:13, fontWeight:700, cursor:aiDrafting?'wait':'pointer' }}>
                    {aiDrafting ? 'Drafting...' : 'Draft this for me'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3 */}
      <div style={{ background:C.white, borderRadius:14, padding:20, border:`1.5px solid ${C.light}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em' }}>Step 3, Review & send</div>
          <button onClick={() => setTestMode(t => !t)}
            style={{ fontSize:12, fontWeight:600, padding:'5px 12px', borderRadius:20, border:`1.5px solid ${testMode?C.forest:C.light}`, background:testMode?'#F0FDF4':'transparent', color:testMode?C.forest:C.gray, cursor:'pointer' }}>
            {testMode ? '🧪 Test mode ON' : '🧪 Test mode'}
          </button>
        </div>

        {testMode && (
          <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.forest, marginBottom:8 }}>Sends only to you, not to any clients</div>
            {channel === 'email'
              ? <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="Your email address"
                  style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:14, boxSizing:'border-box', outline:'none' }} />
              : <input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="Your phone number e.g. +15139099004"
                  style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C.light}`, borderRadius:8, fontSize:14, boxSizing:'border-box', outline:'none' }} />
            }
          </div>
        )}

        {!testMode && segmentClients.length > 0 && (
          <div style={{ background:C.beige, borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:6 }}>
              {segmentClients.length} client{segmentClients.length!==1?'s':''} will receive this
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {segmentClients.slice(0,15).map(c => (
                <span key={c.id} style={{ fontSize:11, background:C.white, border:`1px solid ${C.light}`, borderRadius:20, padding:'3px 10px' }}>
                  {c.name?.split(' ')[0]}
                </span>
              ))}
              {segmentClients.length > 15 && <span style={{ fontSize:11, color:C.gray }}>+{segmentClients.length-15} more</span>}
            </div>
          </div>
        )}

        {!testMode && segmentClients.length === 0 && !loading && (
          <div style={{ textAlign:'center', padding:'16px 0', color:C.gray, fontSize:13, marginBottom:12 }}>No clients match this filter.</div>
        )}

        {/* Preview */}
        {message.trim() && (() => {
          const sample = {
            name: segmentClients[0]?.name || 'Sarah Lee',
            last_session_date: segmentClients[0]?.last_session_date || new Date(Date.now() - 21*86400000).toISOString(),
            last_service_name: segmentClients[0]?.last_service_name || 'Swedish Massage',
          };
          const previewSubject = channel === 'email' ? buildSubject(sample) : '';
          const previewBody = buildMessage(sample, message);
          return (
            <div style={{ background:'#F9FAFB', borderRadius:10, padding:'12px 14px', marginBottom:14, border:`1px solid ${C.light}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.gray, marginBottom:6 }}>PREVIEW, as {sample.name.split(' ')[0]} would see it:</div>
              {channel === 'email' && previewSubject && (
                <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:6, paddingBottom:6, borderBottom:`1px solid ${C.light}` }}>{previewSubject}</div>
              )}
              <div style={{ fontSize:14, color:C.dark, lineHeight:1.7, wordBreak:'break-word', whiteSpace:'pre-wrap' }}>
                {previewBody}
              </div>
            </div>
          );
        })()}

        {sent && (
          <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#16A34A' }}>
              ✅ {testMode ? 'Test sent!' : `Sent! ${sent.success} delivered`}
              {sent.skipped > 0 ? `, ${sent.skipped} skipped (no ${channel==='sms'?'phone':'email'})` : ''}
              {sent.failed > 0 ? `, ${sent.failed} failed` : ''}
            </div>
          </div>
        )}

        <button onClick={sendAll} disabled={!canSend}
          style={{ width:'100%', background:!canSend?C.sage:C.forest, color:'#fff', border:'none', borderRadius:10, padding:'13px', fontSize:15, fontWeight:700, cursor:canSend?'pointer':'not-allowed', opacity:canSend?1:0.7 }}>
          {sending ? 'Sending…' :
           !twilioReady && channel==='sms' ? 'Set up SMS in Settings first' :
           testMode ? `Send test ${channel === 'email' ? 'email' : 'text'} to me` :
           `Send to ${segmentClients.length} client${segmentClients.length!==1?'s':''} →`}
        </button>
        {!testMode && <p style={{ fontSize:11, color:C.gray, textAlign:'center', marginTop:8 }}>Clients without a {channel==='sms'?'phone number':'email address'} are automatically skipped. Unsubscribed clients are skipped too.</p>}
      </div>

      {/* Recent campaigns history */}
      {recentSends.length > 0 && (
        <div style={{ background:C.white, borderRadius:14, padding:20, border:`1.5px solid ${C.light}`, marginTop:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>Recent campaigns</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {recentSends.map(s => {
              const when = new Date(s.created_at);
              const dateStr = when.toLocaleDateString('en-US', { month:'short', day:'numeric' });
              const timeStr = when.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
              const ageDays = Math.floor((Date.now() - when.getTime()) / 86400000);
              const relStr = ageDays === 0 ? 'Today' : ageDays === 1 ? 'Yesterday' : `${dateStr}`;
              return (
                <div key={s.id} style={{ padding:'10px 12px', background:'#FAFAF6', border:`1px solid ${C.light}`, borderRadius:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:3 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:C.dark }}>
                      {relStr} {ageDays === 0 ? `at ${timeStr}` : ''}
                    </span>
                    <span style={{ fontSize:10, fontWeight:700, color:C.forest, background:'#F0FDF4', border:`1px solid ${C.light}`, padding:'1px 7px', borderRadius:10, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                      {s.channel}
                    </span>
                    <span style={{ fontSize:11, color:C.gray }}>· {s.segment_label || s.segment}</span>
                    <span style={{ fontSize:11, fontWeight:600, color:C.gray, marginLeft:'auto' }}>
                      {s.success_count}/{s.recipient_count} delivered
                      {s.skipped_count > 0 ? `, ${s.skipped_count} skipped` : ''}
                      {s.failed_count > 0 ? `, ${s.failed_count} failed` : ''}
                    </span>
                  </div>
                  {s.subject && (
                    <div style={{ fontSize:13, fontWeight:600, color:C.dark, marginBottom:2 }}>{s.subject}</div>
                  )}
                  <div style={{ fontSize:12, color:C.gray, lineHeight:1.5, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                    {s.message}
                  </div>
                  <button onClick={() => {
                    setMessage(s.message);
                    if (s.subject) setSubject(s.subject);
                    setChannel(s.channel);
                    setTemplate('custom');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                    style={{ fontSize:11, fontWeight:600, color:C.forest, background:'transparent', border:'none', padding:'4px 0 0', cursor:'pointer' }}>
                    Use again ↑
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
