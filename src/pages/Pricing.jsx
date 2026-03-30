import Nav from '../components/Nav';
import Footer from '../components/Footer';
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const STRIPE_SILVER = 'https://buy.stripe.com/9B6aEYaN4f9udN6eQ0eQM02';
const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#F3F4F6', border:'#E5E7EB', gold:'#C9A84C' };

export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');

  const SILVER_MONTHLY = promoApplied ? 19 : 24;
  const SILVER_ANNUAL = promoApplied ? 15 : 19;

  function applyPromo() {
    if (promoCode.trim().toUpperCase() === 'BETAONE') { setPromoApplied(true); setPromoError(''); }
    else { setPromoError('Invalid code'); }
  }

  const tiers = [
    {
      name: 'Bronze', emoji: '🥉', highlight: false,
      price: { monthly: 0, annual: 0 },
      tagline: 'Everything to run your practice. Free forever.',
      cta: isAuthenticated ? 'Go to Dashboard' : 'Start Free — No Card',
      ctaAction: () => isAuthenticated ? navigate('/dashboard') : navigate('/signup'),
      features: [
        { text: 'Your own booking page', on: true },
        { text: 'Visual body map intake', on: true },
        { text: 'Schedule — today, weekly, monthly', on: true },
        { text: 'SOAP notes', on: true },
        { text: 'Automated email reminders', on: true },
        { text: 'AI pre/post session briefs', on: true },
        { text: 'Unlimited clients & bookings', on: true },
        { text: 'Session history — last 5 per client', on: true },
        { text: 'Pattern intelligence (first 5 sessions)', on: true },
        { text: 'Business analytics (first 5 sessions)', on: true },
        { text: 'Retention alerts (first 5 sessions)', on: true },
        { text: 'Full intelligence beyond 5 sessions', on: false },
      ],
    },
    {
      name: 'Silver', emoji: '🥈', highlight: true, badge: 'Most Popular',
      price: { monthly: SILVER_MONTHLY, annual: SILVER_ANNUAL },
      tagline: 'Your data works for you. Intelligence that grows your earnings.',
      cta: 'Start 30-Day Free Trial',
      ctaAction: () => window.open(STRIPE_SILVER, '_blank'),
      features: [
        { text: 'Everything in Bronze', on: true },
        { text: 'Full session history — unlimited', on: true },
        { text: 'Pattern intelligence — all sessions', on: true, detail: 'Tension trends tracked across every session forever' },
        { text: 'Business analytics & revenue forecasting', on: true, detail: 'Busiest days, projected income, seasonal trends' },
        { text: 'Retention alerts — all clients', on: true, detail: 'Know when a client is drifting before they leave' },
        { text: 'Longitudinal body map overlays', on: true, detail: 'Visual diff of body patterns over time' },
        { text: 'Revenue gap intelligence', on: true, detail: 'See exactly what dead schedule time costs you' },
        { text: 'Priority support', on: true },
      ],
    },
    {
      name: 'Gold', emoji: '🥇', highlight: false, comingSoon: true,
      price: { monthly: 79, annual: 63 },
      tagline: 'Silver intelligence for your whole practice. Up to 10 therapists.',
      cta: 'Coming Soon',
      ctaAction: null,
      features: [
        { text: 'Everything in Silver', on: true },
        { text: 'Up to 10 therapist profiles', on: true },
        { text: 'Team schedule view', on: true },
        { text: 'Per-therapist analytics', on: true },
        { text: 'Shared client pool', on: true },
        { text: 'Commission tracking', on: true },
        { text: 'Staff access controls', on: true },
        { text: 'Practice-wide reporting', on: true },
      ],
    },
  ];

  return (
    <div style={{ background:C.beige, minHeight:'100vh', fontFamily:'system-ui,sans-serif' }}>
      <Nav />

      <div style={{ textAlign:'center', padding:'72px 24px 48px' }}>
        <div style={{ display:'inline-block', background:'#DCFCE7', color:C.forest, borderRadius:20, padding:'6px 16px', fontSize:13, fontWeight:700, marginBottom:20 }}>
          🥉 Bronze is free forever — no credit card needed
        </div>
        <h1 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(32px,5vw,52px)', fontWeight:700, color:C.dark, margin:'0 0 16px', lineHeight:1.15 }}>
          Simple pricing.<br/>Serious intelligence.
        </h1>
        <p style={{ fontSize:17, color:C.gray, maxWidth:520, margin:'0 0 32px auto', lineHeight:1.7 }}>
          Start free. Upgrade when your data has something to tell you.
        </p>
        <div style={{ display:'inline-flex', background:'#fff', borderRadius:10, padding:4, border:`1px solid ${C.border}`, gap:4 }}>
          {['monthly','annual'].map(c => (
            <button key={c} onClick={() => setBillingCycle(c)}
              style={{ padding:'8px 20px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                background:billingCycle===c?C.forest:'transparent', color:billingCycle===c?'#fff':C.gray, transition:'all 0.15s' }}>
              {c === 'monthly' ? 'Monthly' : 'Annual — save 20%'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 24px 80px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:24, alignItems:'start' }}>
        {tiers.map(tier => (
          <div key={tier.name} style={{ background:tier.highlight?C.forest:C.white, borderRadius:20, padding:32,
            boxShadow:tier.highlight?'0 16px 48px rgba(42,87,65,0.25)':'0 2px 16px rgba(0,0,0,0.06)',
            border:tier.highlight?'none':`1.5px solid ${C.border}`, position:'relative',
            transform:tier.highlight?'scale(1.03)':'none' }}>
            {tier.badge && (
              <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)',
                background:C.gold, color:'#fff', borderRadius:20, padding:'4px 16px', fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>
                {tier.badge}
              </div>
            )}
            <div style={{ fontSize:28, marginBottom:8 }}>{tier.emoji}</div>
            <div style={{ fontSize:22, fontWeight:700, color:tier.highlight?'#fff':C.dark, marginBottom:4 }}>{tier.name}</div>
            <div style={{ fontSize:13, color:tier.highlight?'rgba(255,255,255,0.7)':C.gray, lineHeight:1.5, marginBottom:20 }}>{tier.tagline}</div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:4, marginBottom:4 }}>
              <span style={{ fontSize:44, fontWeight:700, color:tier.highlight?'#fff':C.dark, lineHeight:1, fontFamily:'Georgia,serif' }}>
                ${billingCycle==='annual' ? tier.price.annual : tier.price.monthly}
              </span>
              {tier.price.monthly > 0 && <span style={{ fontSize:14, color:tier.highlight?'rgba(255,255,255,0.6)':C.gray, marginBottom:6 }}>/mo</span>}
            </div>
            {tier.price.monthly === 0
              ? <div style={{ fontSize:13, fontWeight:700, color:tier.highlight?'rgba(255,255,255,0.7)':C.sage, marginBottom:20 }}>Free forever</div>
              : <div style={{ fontSize:12, color:tier.highlight?'rgba(255,255,255,0.55)':C.gray, marginBottom:20 }}>
                  {billingCycle==='annual' ? `billed $${tier.price.annual*12}/year` : 'billed monthly'}
                </div>
            }
            {tier.comingSoon
              ? <div style={{ background:'rgba(0,0,0,0.08)', borderRadius:12, padding:14, textAlign:'center', fontSize:14, fontWeight:600, color:C.gray, marginBottom:24 }}>Coming Soon</div>
              : <button onClick={tier.ctaAction} style={{ width:'100%', padding:14, borderRadius:12, border:'none', cursor:'pointer', fontSize:15, fontWeight:700,
                  background:tier.highlight?'#fff':C.forest, color:tier.highlight?C.forest:'#fff', marginBottom:24, transition:'all 0.15s' }}>
                  {tier.cta}
                </button>
            }
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {tier.features.map(f => (
                <div key={f.text} style={{ display:'flex', alignItems:'flex-start', gap:10, opacity:f.on?1:0.35 }}>
                  <span style={{ fontSize:13, flexShrink:0, color:f.on?(tier.highlight?'#fff':C.forest):'#999' }}>{f.on ? '✓' : '✕'}</span>
                  <div>
                    <div style={{ fontSize:13, color:tier.highlight?(f.on?'#fff':'rgba(255,255,255,0.4)'):(f.on?C.dark:C.gray), fontWeight:f.on?500:400, lineHeight:1.4 }}>{f.text}</div>
                    {f.detail && f.on && <div style={{ fontSize:11, color:tier.highlight?'rgba(255,255,255,0.5)':C.gray, marginTop:1 }}>{f.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign:'center', padding:'0 24px 48px' }}>
        <div style={{ display:'inline-block', background:C.white, borderRadius:14, padding:'20px 28px', border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:10 }}>Have a promo code?</div>
          <div style={{ display:'flex', gap:8 }}>
            <input value={promoCode} onChange={e => { setPromoCode(e.target.value); setPromoError(''); }} placeholder="Enter code"
              style={{ padding:'10px 14px', border:`1.5px solid ${promoApplied?'#16A34A':C.border}`, borderRadius:8, fontSize:14, outline:'none', width:140, fontFamily:'system-ui' }} />
            <button onClick={applyPromo} style={{ padding:'10px 18px', background:C.forest, color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer' }}>Apply</button>
          </div>
          {promoApplied && <div style={{ fontSize:12, color:'#16A34A', marginTop:8, fontWeight:600 }}>✓ BETAONE applied — Silver at $19/month</div>}
          {promoError && <div style={{ fontSize:12, color:'#EF4444', marginTop:8 }}>{promoError}</div>}
        </div>
      </div>

      <div style={{ maxWidth:680, margin:'0 auto', padding:'0 24px 80px' }}>
        <h2 style={{ fontFamily:'Georgia,serif', fontSize:28, fontWeight:700, color:C.dark, textAlign:'center', marginBottom:40 }}>Common questions</h2>
        {[
          { q:'Is Bronze really free forever?', a:'Yes. No credit card, no trial, no hidden limits. Bronze gives you everything to run your practice — booking, intake, schedule, SOAP notes, and reminders. Free forever.' },
          { q:'What does "first 5 sessions" mean for intelligence?', a:'On Bronze, you get a taste of intelligence based on the last 5 sessions per client — pattern alerts, analytics, and retention signals. On Silver, the intelligence goes back through every session you have ever recorded, getting smarter the longer you use it.' },
          { q:'What is the intelligence layer in Silver?', a:"Silver analyzes your client data across all sessions over time — tension patterns, retention risk, revenue trends, schedule gaps — and surfaces insights that help you earn more and keep clients longer. It gets smarter the longer you use BodyMap." },
          { q:'When is Gold launching?', a:'Gold is in development. Early access pricing will be offered to those who sign up before launch.' },
          { q:'Can I switch plans anytime?', a:'Yes. If you downgrade from Silver to Bronze, your historical data is preserved — you just lose access to intelligence beyond 5 sessions until you re-upgrade.' },
        ].map(({ q, a }) => (
          <div key={q} style={{ borderBottom:`1px solid ${C.border}`, padding:'20px 0' }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.dark, marginBottom:8 }}>{q}</div>
            <div style={{ fontSize:14, color:C.gray, lineHeight:1.7 }}>{a}</div>
          </div>
        ))}
      </div>

      <div style={{ background:C.forest, padding:'64px 24px', textAlign:'center' }}>
        <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(26px,4vw,40px)', fontWeight:700, color:'#fff', margin:'0 0 16px' }}>Start free today.</h2>
        <p style={{ fontSize:16, color:'rgba(255,255,255,0.75)', margin:'0 0 28px' }}>No credit card. No setup fee. Your first client in 5 minutes.</p>
        <button onClick={() => navigate('/signup')} style={{ background:'#fff', color:C.forest, border:'none', borderRadius:12, padding:'16px 40px', fontSize:16, fontWeight:700, cursor:'pointer' }}>
          Get Started Free →
        </button>
      </div>

      <Footer />
    </div>
  );
}
