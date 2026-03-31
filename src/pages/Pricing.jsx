import Nav from '../components/Nav';
import Footer from '../components/Footer';
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const STRIPE_SILVER = 'https://buy.stripe.com/5kQbJ23kC0eAfVe9vGeQM03';
const STRIPE_SILVER_ANNUAL = 'https://buy.stripe.com/8x214obR89Pa4cw8rCeQM04';
const STRIPE_GOLD   = 'REPLACE_WITH_NEW_STRIPE_LINK_49';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#F3F4F6', border:'#E5E7EB', gold:'#C9A84C' };
const AUTO = { color:'#6B9E80', fontWeight:700 };

const A = (text) => text; // marker for automated features

export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('monthly');

  const tiers = [
    {
      name: 'Bronze', emoji: '🥉', highlight: false,
      price: { monthly: 0, annual: 0 },
      tagline: 'Automate your practice. Retain every client. Free forever.',
      cta: isAuthenticated ? 'Go to Dashboard' : 'Start Free - No Card',
      ctaAction: () => isAuthenticated ? navigate('/dashboard') : navigate('/signup'),
      features: [
        { text: 'Unlimited clients & bookings', on: true },
        { text: 'Automated booking page', on: true, auto: true, detail: 'Clients book themselves, 24/7' },
        { text: 'Automated body map intake', on: true, auto: true, detail: 'Sent before every session, zero effort' },
        { text: 'Automated email reminders', on: true, auto: true, detail: '24h notice to every client, automatically' },
        { text: 'Automated AI pre-session brief', on: true, auto: true, detail: 'Client history ready before you walk in' },
        { text: 'Automated AI post-session brief', on: true, auto: true, detail: 'Session notes drafted for you after' },
        { text: 'BodyMap AI - chat with your client data', on: true },
        { text: 'Visual body map - front & back', on: true, detail: 'Focus zones, avoid areas, medical flags' },
        { text: 'SOAP notes', on: true },
        { text: 'Schedule - today, weekly, monthly', on: true },
        { text: 'Billing dashboard & Stripe payments', on: true },
        { text: 'Automated pain pattern intelligence', on: true, auto: true, detail: 'First 5 sessions per client' },
        { text: 'Automated retention alerts', on: true, auto: true, detail: 'First 5 sessions per client' },
        { text: 'Business & billing performance snapshot', on: true, detail: 'First 5 sessions per client' },
        { text: 'Full intelligence beyond 5 sessions', on: false },
      ],
    },
    {
      name: 'Silver', emoji: '🥈', highlight: true, badge: 'Most Popular',
      price: { monthly: 19, annual: 15 },
      tagline: 'Your entire client history, working for you. Intelligence that compounds over time.',
      cta: 'Start 7-Day Free Trial',
      ctaAction: () => window.open(billingCycle === 'annual' ? STRIPE_SILVER_ANNUAL : STRIPE_SILVER, '_blank'),
      features: [
        { text: 'Everything in Bronze - fully automated', on: true },
        { text: 'Full session history - unlimited, forever', on: true },
        { text: 'Automated pattern intelligence', on: true, auto: true, detail: 'All sessions, all clients, compounds over time' },
        { text: 'Automated retention alerts', on: true, auto: true, detail: 'Catches drifting clients before they leave' },
        { text: 'Automated revenue forecasting', on: true, auto: true, detail: 'Projected income based on booking pace' },
        { text: 'Longitudinal body map overlays', on: true, detail: 'Visual tension diff across all sessions' },
        { text: 'Revenue gap intelligence', on: true, detail: 'See exactly what empty slots cost you' },
        { text: 'Business & billing analytics', on: true, detail: 'Busiest days, top services, revenue trends' },
        { text: 'BodyMap AI with full history context', on: true, detail: 'Smarter answers, deeper insights' },
        { text: 'Priority support', on: true },
      ],
    },
    {
      name: 'Gold', emoji: '🥇', highlight: false, comingSoon: true,
      price: { monthly: 49, annual: 39 },
      tagline: 'Everything in Silver, now for your whole team.',
      cta: 'Coming Soon',
      ctaAction: null,
      features: [
        { text: 'Everything in Silver - automated', on: true },
        { text: 'Up to 10 therapist profiles', on: true },
        { text: 'Team schedule view - all therapists, one screen', on: true },
        { text: 'Per-therapist analytics & billing', on: true },
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
          🥉 Bronze is free forever - no credit card needed
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
              {c === 'monthly' ? 'Monthly' : 'Annual - save 20%'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 24px 80px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))', gap:24, alignItems:'start' }}>
        {tiers.map((tier,ti) => (
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
              ? <div style={{ fontSize:13, fontWeight:700, color:C.sage, marginBottom:20 }}>Free forever</div>
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
              {tier.features.map((f,i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, opacity:f.on?1:0.35 }}>
                  <span style={{ fontSize:13, flexShrink:0, marginTop:1, color:f.on?(tier.highlight?'#fff':C.forest):'#999' }}>{f.on?'✓':'✕'}</span>
                  <div>
                    <div style={{ fontSize:13, lineHeight:1.4, fontWeight:f.on?500:400,
                      color:tier.highlight?(f.on?'#fff':'rgba(255,255,255,0.4)'):(f.on?C.dark:C.gray) }}>
                      {f.auto
                        ? <><span style={{ color:tier.highlight?'#86EFAC':C.sage, fontWeight:700 }}>Automated</span>{' '}{f.text.replace('Automated ','').replace('automated ','')}</>
                        : f.text
                      }
                    </div>
                    {f.detail && f.on && (
                      <div style={{ fontSize:11, color:tier.highlight?'rgba(255,255,255,0.5)':C.gray, marginTop:1 }}>{f.detail}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ maxWidth:680, margin:'0 auto', padding:'0 24px 80px' }}>
        <h2 style={{ fontFamily:'Georgia,serif', fontSize:28, fontWeight:700, color:C.dark, textAlign:'center', marginBottom:40 }}>Common questions</h2>
        {[
          { q:'Is Bronze really free forever?', a:"Yes. Every tool on this page is free on Bronze. No credit card, no trial, no hidden limits. We plan to keep Bronze free for everyone who signs up now. As BodyMap grows, we reserve the right to introduce pricing for new signups - but anyone on Bronze today will be grandfathered. We believe every therapist deserves professional tools, not just the ones who can afford $70 a month." },
          { q:'How can you afford to offer this for free?', a:"Honestly, because technology has changed. The capabilities that used to cost thousands of dollars a month to build and run - AI, automated emails, intelligent scheduling, body mapping - now cost a fraction of that. We built BodyMap lean and pass that directly to you. We make money when you grow into Silver. That only happens if Bronze genuinely helps you first. So we are fully aligned with your success." },
          { q:'Why BodyMap and not the other scheduling tools?', bullets:['They charge for everything - reminders, SOAP notes, forms, and messaging are paywalled add-ons. On BodyMap they are all free on Bronze.','They require clients to create accounts or download an app just to book. That friction kills bookings. BodyMap clients book in 2 taps, no account, no app.','They have no intelligence. They store your data but never tell you anything useful with it. BodyMap surfaces patterns, flags retention risk, and forecasts revenue automatically.','They are built for salons and spas, not massage therapists. You pay for inventory management and loyalty points you will never use.','They push constant updates that break your workflow. Multiple competitors have reviews specifically about updates that caused missed bookings and dropped reminders. BodyMap is built for solo LMTs. Stable, focused, and fast.'] },
          { q:'What is the intelligence layer in Silver?', a:"Silver analyzes your entire client history - tension patterns, retention risk, revenue trends, schedule gaps - and automatically surfaces insights that help you earn more and keep clients longer. It compounds over time. The longer you use BodyMap, the smarter it gets." },
          { q:'What does first 5 sessions mean for intelligence on Bronze?', a:"On Bronze, you get a taste of intelligence based on the last 5 sessions per client - automated pattern alerts, retention signals, and business snapshots. On Silver, the intelligence goes back through every session you have ever recorded, getting smarter the longer you use BodyMap." },
          { q:'When is Gold launching?', a:"Gold is in development. Sign up for Bronze or Silver now and you will get early access and founding pricing when it launches." },
          { q:'Can I switch plans anytime?', a:"Yes. If you downgrade from Silver to Bronze, your full history is preserved - you just lose access to intelligence beyond 5 sessions until you re-upgrade." },
          { q:'What does "first 5 sessions" mean for intelligence?', a:'On Bronze, you get a taste of intelligence based on the last 5 sessions per client - automated pattern alerts, retention signals, and business snapshots. On Silver, the intelligence goes back through every session you have ever recorded, getting smarter the longer you use BodyMap.' },
          { q:'What is the intelligence layer in Silver?', a:'Silver analyzes your entire client history - tension patterns, retention risk, revenue trends, schedule gaps - and automatically surfaces insights that help you earn more and keep clients longer. It compounds over time. The longer you use BodyMap, the smarter it gets.' },
          { q:'When is Gold launching?', a:'Gold is in development. Sign up for Bronze or Silver now and you will get early access and founding pricing when it launches.' },
          { q:'Can I switch plans anytime?', a:'Yes. If you downgrade from Silver to Bronze, your full history is preserved - you just lose access to intelligence beyond 5 sessions until you re-upgrade.' },
        ].map((item) => (
          <div key={item.q} style={{ borderBottom:`1px solid ${C.border}`, padding:'20px 0' }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.dark, marginBottom:8 }}>{item.q}</div>
            {item.a && <div style={{ fontSize:14, color:C.gray, lineHeight:1.7 }}>{item.a}</div>}
            {item.bullets && (
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
                {item.bullets.map((b,i) => (
                  <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <span style={{ color:'#2A5741', fontWeight:700, flexShrink:0, marginTop:1 }}>{i+1}.</span>
                    <span style={{ fontSize:14, color:C.gray, lineHeight:1.6 }}>{b}</span>
                  </div>
                ))}
              </div>
            )}
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
