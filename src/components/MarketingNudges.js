import React, { useState, useEffect } from 'react';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', gray:'#6B7280', light:'#E8E4DC', gold:'#C9A84C' };

// Nudge 1: Activation moment, first intake sent is the "aha" moment
export function ActivationNudge({ sessions, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const key = 'bm_activation_nudge_shown';
    if (sessions === 1 && !localStorage.getItem(key)) {
      setVisible(true);
      localStorage.setItem(key, '1');
    }
  }, [sessions]);

  if (!visible) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #2A5741, #4B8A6A)',
      borderRadius: 16, padding: '20px', marginBottom: 20,
      boxShadow: '0 4px 20px rgba(42,87,65,0.3)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
      <div style={{ position:'absolute', bottom:-30, left:40, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }}/>
      <div style={{ fontSize:28, marginBottom:8 }}>🎉</div>
      <div style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:6, fontFamily:'Georgia,serif' }}>
        First intake sent, this is the moment.
      </div>
      <div style={{ fontSize:13, color:'rgba(255,255,255,0.8)', lineHeight:1.6, marginBottom:16 }}>
        Your client will fill their body map before they arrive. You'll walk in knowing exactly what they need. This is what MyBodyMap is built for.
      </div>
      <button onClick={() => { setVisible(false); onDismiss?.(); }}
        style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
        Got it ✓
      </button>
    </div>
  );
}

// Nudge 2: Lapsed client alert, shows when clients haven't booked in 6+ weeks
export function LapsedClientAlert({ clients, onNavigate }) {
  const [dismissed, setDismissed] = useState(false);

  const lapsedCount = clients?.filter(c => {
    if (!c.last_session_date) return false;
    const weeks = (Date.now() - new Date(c.last_session_date).getTime()) / (1000*60*60*24*7);
    return weeks >= 6;
  }).length || 0;

  const key = `bm_lapsed_dismissed_${new Date().toDateString()}`;

  useEffect(() => {
    if (localStorage.getItem(key)) setDismissed(true);
  }, [key]);

  if (!lapsedCount || dismissed) return null;

  return (
    <div style={{
      background: C.white, border:`1.5px solid #FCD34D`,
      borderRadius: 12, padding: '14px 16px', marginBottom: 16,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ fontSize:22, flexShrink:0 }}>💛</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#92400E' }}>
          {lapsedCount} client{lapsedCount>1?'s':''} haven't booked in 6+ weeks
        </div>
        <div style={{ fontSize:12, color:'#B45309', marginTop:2 }}>
          A quick check-in goes a long way. They miss you.
        </div>
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        <button onClick={() => onNavigate('outreach')}
          style={{ background:'#2A5741', color:'#fff', border:'none', borderRadius:8, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
          Reach out →
        </button>
        <button onClick={() => { setDismissed(true); localStorage.setItem(key,'1'); }}
          style={{ background:'transparent', border:'none', color:C.gray, fontSize:18, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>
          ×
        </button>
      </div>
    </div>
  );
}

// Nudge 3: Empty state prompt, shown when clients tab is empty
export function EmptyClientsNudge({ onNavigate }) {
  return (
    <div style={{ textAlign:'center', padding:'48px 24px' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>🌿</div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'#1F2937', marginBottom:8 }}>
        Your practice starts here
      </div>
      <div style={{ fontSize:14, color:C.gray, maxWidth:280, margin:'0 auto 24px', lineHeight:1.6 }}>
        Add your first client to see how MyBodyMap works. It takes 30 seconds.
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:240, margin:'0 auto' }}>
        <button onClick={() => onNavigate('import')}
          style={{ background:C.forest, color:'#fff', border:'none', borderRadius:12, padding:'13px 20px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          📥 Import my clients
        </button>
        <button onClick={() => onNavigate('add-client')}
          style={{ background:'transparent', color:C.forest, border:`1.5px solid ${C.forest}`, borderRadius:12, padding:'12px 20px', fontSize:14, fontWeight:600, cursor:'pointer' }}>
          + Add one client manually
        </button>
      </div>
    </div>
  );
}

// Nudge 4: Booking link share prompt, shown when no bookings yet
export function BookingLinkNudge({ therapist, bookings }) {
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('bm_booking_nudge_dismissed')) setDismissed(true);
  }, []);

  if (dismissed || (bookings && bookings > 0)) return null;

  // The booking URL is mybodymap.app/<custom_url>, not /book/<custom_url>.
  // Per HK May 14 2026: the same URL handles booking + intake; we don't
  // have separate URLs. Earlier code used /book/<slug> which 404'd in
  // some flows; fixed here.
  const link = `https://mybodymap.app/${therapist?.custom_url || therapist?.id}`;

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.beige}, #FEFCE8)`,
      border:`1.5px solid ${C.gold}`,
      borderRadius:14, padding:'16px', marginBottom:16,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#1F2937' }}>
          🔗 Share your booking link
        </div>
        <button onClick={() => { setDismissed(true); localStorage.setItem('bm_booking_nudge_dismissed','1'); }}
          style={{ background:'transparent', border:'none', color:C.gray, fontSize:16, cursor:'pointer', lineHeight:1 }}>×</button>
      </div>
      <div style={{ fontSize:12, color:C.gray, marginBottom:12, lineHeight:1.5 }}>
        Send this to clients. They book a session and fill intake in one flow. No calls, no texts back and forth.
      </div>
      <div style={{ background:'#fff', borderRadius:8, padding:'8px 12px', fontSize:11, color:'#374151', fontFamily:'monospace', marginBottom:10, wordBreak:'break-all' }}>
        {link}
      </div>
      <button onClick={copyLink}
        style={{ background: copied?'#16A34A':C.forest, color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer', transition:'background 0.2s', width:'100%' }}>
        {copied ? '✓ Copied!' : 'Copy booking link'}
      </button>
    </div>
  );
}
