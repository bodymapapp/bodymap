import React, { useState } from 'react';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { Link } from 'react-router-dom';

const C = {
  forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF',
  dark:'#1A1A2E', gray:'#6B7280', light:'#F3F4F6', border:'#E5E7EB',
  gold:'#C9A84C',
};

const CHECK  = () => <span style={{ color:'#16A34A', fontWeight:700, fontSize:16 }}>✓</span>;
const CROSS  = () => <span style={{ color:'#DC2626', fontWeight:700, fontSize:14 }}>✕</span>;
const DOLLAR = (n) => <span style={{ color:'#D97706', fontSize:12, fontWeight:600 }}>${n}/mo</span>;
const FREE   = () => <span style={{ color:'#16A34A', fontSize:12, fontWeight:700 }}>Free</span>;

const FEATURES = [
  { category:'Core Booking & Scheduling', items:[
    { name:'Online client booking',                  bm:true,  mb:true,  vg:true,  gg:true  },
    { name:'No client app or account required',      bm:true,  mb:false, vg:false, gg:false },
    { name:'Automated 24h email reminders',          bm:true,  mb:true,  vg:true,  gg:true  },
    { name:'Buffer time between sessions',           bm:true,  mb:true,  vg:true,  gg:true  },
    { name:'Calendar sync (Cal.com)',                bm:true,  mb:false, vg:true,  gg:false },
  ]},
  { category:'Client Intake', items:[
    { name:'Digital intake forms',                   bm:true,  mb:true,  vg:true,  gg:true  },
    { name:'Visual body map (front & back)',         bm:true,  mb:false, vg:false, gg:false },
    { name:'Focus zones, avoid areas, pressure',     bm:true,  mb:false, vg:false, gg:false },
    { name:'Medical flags & preferences',            bm:true,  mb:false, vg:false, gg:false },
    { name:'Auto-sent with every booking',           bm:true,  mb:false, vg:true,  gg:false },
  ]},
  { category:'SOAP Notes & Documentation', items:[
    { name:'SOAP notes (S/O/A/P)',                   bm:true,  mb:'$',   vg:'$',   gg:false },
    { name:'Private therapist notes',                bm:true,  mb:'$',   vg:'$',   gg:true  },
    { name:'Post-session brief to client',           bm:true,  mb:false, vg:false, gg:false },
    { name:'Session history per client',             bm:true,  mb:true,  vg:true,  gg:true  },
  ]},
  { category:'Intelligence & Retention', items:[
    { name:'Pattern intelligence (recurring areas)', bm:true,  mb:false, vg:false, gg:false },
    { name:'Lapsed client alerts',                   bm:true,  mb:false, vg:false, gg:false },
    { name:'AI pre-session brief',                   bm:true,  mb:false, vg:false, gg:false },
    { name:'Revenue forecasting',                    bm:true,  mb:false, vg:'$',   gg:false },
    { name:'Client retention dashboard',             bm:true,  mb:false, vg:false, gg:false },
  ]},
  { category:'Outreach & Marketing', items:[
    { name:'Email broadcast to client segments',     bm:true,  mb:false, vg:'$',   gg:false },
    { name:'SMS outreach to lapsed clients',         bm:true,  mb:false, vg:'$',   gg:false },
    { name:'Smart segments (due, lapsed, regulars)', bm:true,  mb:false, vg:false, gg:false },
    { name:'Practice Pulse daily digest',            bm:true,  mb:false, vg:false, gg:false },
  ]},
  { category:'Payments & Deposits', items:[
    { name:'New client deposit collection',          bm:true,  mb:true,  vg:true,  gg:true  },
    { name:'Gift certificates',                      bm:true,  mb:true,  vg:true,  gg:true  },
    { name:'Billing dashboard',                      bm:true,  mb:'$',   vg:true,  gg:'$'   },
    { name:'No platform transaction fee',            bm:true,  mb:false, vg:false, gg:false },
  ]},
  { category:'Switching & Data', items:[
    { name:'Import from MassageBook / Vagaro / GlossGenius', bm:true, mb:true, vg:true, gg:false },
    { name:'Client history preserved on import',     bm:true,  mb:true,  vg:false, gg:false },
    { name:'CSV export your data anytime',           bm:true,  mb:true,  vg:true,  gg:true  },
  ]},
];

const PRICING = {
  bm: { monthly: 0,  annual: 0,  name:'BodyMap Bronze' },
  mb: { monthly: 45, annual: 39, name:'MassageBook' },
  vg: { monthly: 25, annual: 20, name:'Vagaro' },
  gg: { monthly: 48, annual: 40, name:'GlossGenius' },
};

function CellValue({ val }) {
  if (val === true)  return <CHECK />;
  if (val === false) return <CROSS />;
  if (val === '$')   return <span style={{ color:'#D97706', fontSize:11, fontWeight:700 }}>Add-on $</span>;
  return <span style={{ fontSize:12, color:C.gray }}>{val}</span>;
}

export default function WhyBodyMap() {
  const [billing, setBilling] = useState('monthly');

  const savings = {
    mb: PRICING.mb[billing] - PRICING.bm[billing],
    vg: PRICING.vg[billing] - PRICING.bm[billing],
    gg: PRICING.gg[billing] - PRICING.bm[billing],
  };
  const annualSavings = {
    mb: savings.mb * 12,
    vg: savings.vg * 12,
    gg: savings.gg * 12,
  };

  return (
    <div style={{ fontFamily:'system-ui,-apple-system,sans-serif', color:C.dark, paddingTop:64 }}>
      <Nav />

      {/* HERO */}
      <section style={{ background:`linear-gradient(160deg,#0D1F17,#2A5741)`, padding:'80px 24px 60px', textAlign:'center' }}>
        <div style={{ maxWidth:760, margin:'0 auto' }}>
          <div style={{ display:'inline-block', background:'rgba(107,158,128,0.2)', border:'1px solid rgba(107,158,128,0.4)', borderRadius:20, padding:'6px 16px', fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.85)', marginBottom:24 }}>
            The honest comparison
          </div>
          <h1 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(32px,5vw,52px)', fontWeight:700, color:'#fff', margin:'0 0 20px', lineHeight:1.15 }}>
            Why therapists are switching to BodyMap
          </h1>
          <p style={{ fontSize:18, color:'rgba(255,255,255,0.7)', maxWidth:580, margin:'0 auto 32px', lineHeight:1.7 }}>
            BodyMap was built for one thing MassageBook, Vagaro, and GlossGenius were not: making every therapist irreplaceable to every client.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <Link to="/signup" style={{ background:'#fff', color:C.forest, borderRadius:12, padding:'14px 28px', fontSize:15, fontWeight:700, textDecoration:'none' }}>
              Start Free — No Card Needed
            </Link>
            <Link to="/features" style={{ background:'transparent', color:'rgba(255,255,255,0.85)', border:'1.5px solid rgba(255,255,255,0.3)', borderRadius:12, padding:'14px 24px', fontSize:14, fontWeight:600, textDecoration:'none' }}>
              See All Features
            </Link>
          </div>
        </div>
      </section>

      {/* SAVINGS CALCULATOR */}
      <section style={{ background:C.beige, padding:'60px 24px' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:36 }}>
            <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(24px,4vw,36px)', fontWeight:700, color:C.dark, margin:'0 0 12px' }}>
              Your annual savings with BodyMap
            </h2>
            <p style={{ fontSize:15, color:C.gray, margin:'0 0 20px' }}>BodyMap Bronze is free. Here's what you save vs. the competition.</p>
            <div style={{ display:'inline-flex', background:'#fff', borderRadius:10, padding:4, border:`1px solid ${C.border}`, gap:4 }}>
              {['monthly','annual'].map(c => (
                <button key={c} onClick={() => setBilling(c)}
                  style={{ padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, background:billing===c?C.forest:'transparent', color:billing===c?'#fff':C.gray, transition:'all 0.15s' }}>
                  {c === 'monthly' ? 'Monthly' : 'Annual (save 20%)'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:16 }}>
            {[
              { key:'mb', name:'MassageBook', color:'#3B82F6' },
              { key:'vg', name:'Vagaro',      color:'#8B5CF6' },
              { key:'gg', name:'GlossGenius', color:'#EC4899' },
            ].map(({ key, name, color }) => (
              <div key={key} style={{ background:C.white, borderRadius:16, padding:28, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:700, color, marginBottom:4 }}>{name}</div>
                <div style={{ fontSize:13, color:C.gray, marginBottom:16 }}>${PRICING[key][billing]}/mo</div>
                <div style={{ fontSize:36, fontWeight:700, color:C.forest, lineHeight:1, marginBottom:4 }}>
                  ${annualSavings[key]}
                </div>
                <div style={{ fontSize:13, color:C.gray }}>saved per year</div>
                <div style={{ marginTop:16, background:'#F0FDF4', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#16A34A', fontWeight:600 }}>
                  ${savings[key]}/mo less than {name}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:24, background:C.white, borderRadius:16, padding:24, textAlign:'center', border:`1.5px solid #86EFAC` }}>
            <div style={{ fontSize:13, color:C.gray, marginBottom:8 }}>Potential additional revenue from better client retention</div>
            <div style={{ fontSize:28, fontWeight:700, color:C.forest }}>$3,600 — $12,000/year</div>
            <div style={{ fontSize:13, color:C.gray, marginTop:4 }}>
              Based on retaining 2–5 additional clients per month at $85/session × 12 sessions/year. Pattern intelligence and automated outreach are the primary drivers.
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section style={{ padding:'60px 24px 80px', background:'#fff' }}>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:40 }}>
            <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(24px,4vw,36px)', fontWeight:700, color:C.dark, margin:'0 0 12px' }}>
              Feature by feature
            </h2>
            <p style={{ fontSize:14, color:C.gray }}>
              Based on publicly available pricing and feature documentation as of April 2026. $ = available as a paid add-on. Prices and features subject to change.
            </p>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
              <thead>
                <tr>
                  <th style={{ textAlign:'left', padding:'12px 16px', fontSize:13, color:C.gray, fontWeight:600, borderBottom:`2px solid ${C.border}`, width:'40%' }}>Feature</th>
                  {[
                    { key:'bm', name:'BodyMap',      sub:'Free on Bronze', highlight:true },
                    { key:'mb', name:'MassageBook',  sub:'From $45/mo' },
                    { key:'vg', name:'Vagaro',       sub:'From $25/mo' },
                    { key:'gg', name:'GlossGenius',  sub:'From $48/mo' },
                  ].map(({ key, name, sub, highlight }) => (
                    <th key={key} style={{ textAlign:'center', padding:'12px 8px', fontSize:13, fontWeight:700, borderBottom:`2px solid ${highlight?C.forest:C.border}`, color:highlight?C.forest:C.dark, background:highlight?'#F0FDF4':'transparent', borderRadius:highlight?'8px 8px 0 0':0, minWidth:110 }}>
                      <div>{name}</div>
                      <div style={{ fontSize:11, fontWeight:600, color:highlight?C.sage:C.gray, marginTop:2 }}>{sub}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((group, gi) => (
                  <>
                    <tr key={`cat-${gi}`}>
                      <td colSpan={5} style={{ padding:'16px 16px 6px', fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', background:C.light }}>
                        {group.category}
                      </td>
                    </tr>
                    {group.items.map((item, ii) => (
                      <tr key={`${gi}-${ii}`} style={{ borderBottom:`1px solid ${C.border}` }}
                        onMouseEnter={e => e.currentTarget.style.background='#FAFAFA'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <td style={{ padding:'11px 16px', fontSize:13, color:C.dark }}>{item.name}</td>
                        <td style={{ textAlign:'center', padding:'11px 8px', background:'#F0FDF4' }}><CellValue val={item.bm} /></td>
                        <td style={{ textAlign:'center', padding:'11px 8px' }}><CellValue val={item.mb} /></td>
                        <td style={{ textAlign:'center', padding:'11px 8px' }}><CellValue val={item.vg} /></td>
                        <td style={{ textAlign:'center', padding:'11px 8px' }}><CellValue val={item.gg} /></td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:C.forest }}>
                  <td style={{ padding:'16px', fontSize:14, fontWeight:700, color:'#fff' }}>Monthly price (Bronze/entry)</td>
                  <td style={{ textAlign:'center', padding:'16px', fontSize:16, fontWeight:700, color:'#6EE7A0' }}>Free</td>
                  <td style={{ textAlign:'center', padding:'16px', fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.7)' }}>$45/mo</td>
                  <td style={{ textAlign:'center', padding:'16px', fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.7)' }}>$25/mo</td>
                  <td style={{ textAlign:'center', padding:'16px', fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.7)' }}>$48/mo</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ marginTop:16, fontSize:11, color:C.gray, lineHeight:1.6, padding:'0 4px' }}>
            ✓ = Included · ✕ = Not available · $ = Available as paid add-on · Competitor pricing and features based on publicly available information as of April 2026. BodyMap makes no guarantee of accuracy. Prices and features may have changed — verify directly with each provider.
          </div>
        </div>
      </section>

      {/* TIME SAVINGS */}
      <section style={{ background:C.beige, padding:'60px 24px' }}>
        <div style={{ maxWidth:900, margin:'0 auto', textAlign:'center' }}>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(24px,4vw,36px)', fontWeight:700, color:C.dark, margin:'0 0 12px' }}>
            Time back in your hands
          </h2>
          <p style={{ fontSize:15, color:C.gray, marginBottom:36 }}>What automation actually means for your week</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16 }}>
            {[
              { time:'45 min', label:'saved on intake', desc:'Auto-sent, auto-mapped. No chasing.' },
              { time:'30 min', label:'saved on reminders', desc:'Fires automatically every day.' },
              { time:'2 hrs',  label:'saved on follow-up', desc:'Outreach handles lapsed clients.' },
              { time:'1 hr',   label:'saved on notes', desc:'SOAP notes structured, auto-filed.' },
            ].map(({ time, label, desc }) => (
              <div key={label} style={{ background:C.white, borderRadius:14, padding:24, boxShadow:'0 1px 6px rgba(0,0,0,0.06)' }}>
                <div style={{ fontFamily:'Georgia,serif', fontSize:36, fontWeight:700, color:C.forest, marginBottom:4 }}>{time}</div>
                <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:12, color:C.gray }}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:24, background:C.forest, borderRadius:14, padding:'20px 24px', color:'#fff', fontSize:16, fontWeight:600 }}>
            That's 4+ hours per week back to focus on your clients — not your back office.
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background:`linear-gradient(160deg,#0D1F17,#2A5741)`, padding:'80px 24px', textAlign:'center' }}>
        <div style={{ maxWidth:580, margin:'0 auto' }}>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(28px,4vw,44px)', fontWeight:700, color:'#fff', margin:'0 0 16px' }}>
            Ready to make the switch?
          </h2>
          <p style={{ fontSize:16, color:'rgba(255,255,255,0.7)', margin:'0 0 32px', lineHeight:1.7 }}>
            Free to start. Import your clients in 5 minutes. No credit card. No commitment.
          </p>
          <Link to="/signup" style={{ background:'#fff', color:C.forest, borderRadius:12, padding:'16px 36px', fontSize:16, fontWeight:700, textDecoration:'none', display:'inline-block' }}>
            Start Free Today →
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
