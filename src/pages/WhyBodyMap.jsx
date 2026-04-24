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
    { name:'Online client booking',                  bm:true,  mb:true,  vg:true,  gg:true,  ac:true  },
    { name:'No client app or account required',      bm:true,  mb:false, vg:false, gg:false, ac:true  },
    { name:'Automated 24h email reminders',          bm:true,  mb:true,  vg:true,  gg:true,  ac:true  },
    { name:'Buffer time between sessions',           bm:true,  mb:true,  vg:true,  gg:true,  ac:true  },
    { name:'Calendar sync (Cal.com)',                bm:true,  mb:false, vg:true,  gg:false, ac:true  },
    { name:'Book up to 1 year in advance',            bm:true,  mb:false, vg:false, gg:false, ac:false },
    { name:'Couples massage with dual client intake', bm:true,  mb:false, vg:false, gg:false, ac:false },
  ]},
  { category:'Client Intake', items:[
    { name:'Digital intake forms',                   bm:true,  mb:true,  vg:true,  gg:true,  ac:true  },
    { name:'Visual body map (front & back)',         bm:true,  mb:false, vg:false, gg:false, ac:false },
    { name:'Focus zones, avoid areas, pressure',     bm:true,  mb:false, vg:false, gg:false, ac:false },
    { name:'Medical flags & preferences',            bm:true,  mb:false, vg:false, gg:false, ac:false },
    { name:'Auto-sent with every booking',           bm:true,  mb:false, vg:true,  gg:false, ac:true  },
    { name:'Returning client preferences pre-filled', bm:true,  mb:false, vg:false, gg:false, ac:false },
  ]},
  { category:'SOAP Notes & Documentation', items:[
    { name:'SOAP notes (S/O/A/P)',                   bm:true,  mb:'$',   vg:'$',   gg:false, ac:false },
    { name:'Private therapist notes',                bm:true,  mb:'$',   vg:'$',   gg:true,  ac:false },
    { name:'Post-session brief to client',           bm:true,  mb:false, vg:false, gg:false, ac:false },
    { name:'Session history per client',             bm:true,  mb:true,  vg:true,  gg:true,  ac:true  },
    { name:'Edit session duration after the fact',    bm:true,  mb:false, vg:false, gg:false, ac:false },
  ]},
  { category:'Intelligence & Retention', items:[
    { name:'Pattern intelligence (recurring areas)', bm:true,  mb:false, vg:false, gg:false, ac:false },
    { name:'Lapsed client alerts',                   bm:true,  mb:false, vg:false, gg:false, ac:false },
    { name:'AI pre-session brief',                   bm:true,  mb:false, vg:false, gg:false, ac:false },
    { name:'Revenue forecasting',                    bm:true,  mb:false, vg:'$',   gg:false, ac:false },
    { name:'Client retention dashboard',             bm:true,  mb:false, vg:false, gg:false, ac:false },
  ]},
  { category:'Outreach & Marketing', items:[
    { name:'Email broadcast to client segments',     bm:true,  mb:false, vg:'$',   gg:false, ac:false },
    { name:'SMS outreach to lapsed clients',         bm:true,  mb:false, vg:'$',   gg:false, ac:'$'   },
    { name:'Smart segments (due, lapsed, regulars)', bm:true,  mb:false, vg:false, gg:false, ac:false },
    { name:'Practice Pulse daily digest',            bm:true,  mb:false, vg:false, gg:false, ac:false },
  ]},
  { category:'Payments & Deposits', items:[
    { name:'New client deposit collection',          bm:true,  mb:true,  vg:true,  gg:true,  ac:true  },
    { name:'Gift certificates',                      bm:true,  mb:true,  vg:true,  gg:true,  ac:'$'   },
    { name:'Billing dashboard',                      bm:true,  mb:'$',   vg:true,  gg:'$',   ac:true  },
    { name:'No platform transaction fee',            bm:true,  mb:false, vg:false, gg:false, ac:true  },
  ]},
  { category:'Switching & Data', items:[
    { name:'Import from MassageBook / Vagaro / GlossGenius', bm:true, mb:true, vg:true, gg:false, ac:false },
    { name:'Client history preserved on import',     bm:true,  mb:true,  vg:false, gg:false, ac:false },
    { name:'CSV export your data anytime',           bm:true,  mb:true,  vg:true,  gg:true,  ac:true  },
  ]},
];

const PRICING = {
  bm: { monthly: 0,  annual: 0,  name:'MyBodyMap Bronze' },
  mb: { monthly: 45, annual: 39, name:'MassageBook' },
  vg: { monthly: 25, annual: 20, name:'Vagaro' },
  gg: { monthly: 48, annual: 40, name:'GlossGenius' },
  ac: { monthly: 20, annual: 16, name:'Acuity' },
};

function CellValue({ val }) {
  if (val === true)  return <CHECK />;
  if (val === false) return <CROSS />;
  if (val === '$')   return <span style={{ color:'#D97706', fontSize:11, fontWeight:700 }}>Add-on $</span>;
  return <span style={{ fontSize:12, color:C.gray }}>{val}</span>;
}

export default function WhyMyBodyMap() {
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
            Why therapists are switching to MyBodyMap
          </h1>
          <p style={{ fontSize:18, color:'rgba(255,255,255,0.7)', maxWidth:580, margin:'0 auto 32px', lineHeight:1.7 }}>
            MyBodyMap was built for one thing MassageBook, Vagaro, and GlossGenius were not: making every therapist irreplaceable to every client.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <Link to="/signup" style={{ background:'#fff', color:C.forest, borderRadius:12, padding:'14px 28px', fontSize:15, fontWeight:700, textDecoration:'none' }}>
              Start Free, No Card Needed
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
              Your annual savings with MyBodyMap
            </h2>
            <p style={{ fontSize:15, color:C.gray, margin:'0 0 20px' }}>MyBodyMap Bronze is free. Here's what you save vs. the competition.</p>
            <div style={{ display:'inline-flex', background:'#fff', borderRadius:10, padding:4, border:`1px solid ${C.border}`, gap:4 }}>
              {['monthly','annual'].map(c => (
                <button key={c} onClick={() => setBilling(c)}
                  style={{ padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, background:billing===c?C.forest:'transparent', color:billing===c?'#fff':C.gray, transition:'all 0.15s' }}>
                  {c === 'monthly' ? 'Monthly' : 'Annual (save 20%)'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:20, alignItems:'stretch' }}>

            {/* ── Bar Chart ── */}
            <div style={{ background:C.white, borderRadius:20, padding:'32px 32px 28px', boxShadow:'0 4px 24px rgba(0,0,0,0.07)', display:'flex', flexDirection:'column', justifyContent:'center' }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:28 }}>
                {billing === 'monthly' ? 'Monthly platform cost' : 'Annual platform cost, total per year'}
              </div>

              {/* borderBottom IS the baseline, bars sit flush on it */}
              <div className="bm-bar-chart-prices" style={{ display:'flex', alignItems:'flex-end', gap:16, borderBottom:'2.5px solid #C4BEB7' }}>
                {[
                  { key:'gg', name:'GlossGenius' },
                  { key:'mb', name:'MassageBook'  },
                  { key:'vg', name:'Vagaro'       },
                  { key:'ac', name:'Acuity'       },
                  { key:'bm', name:'MyBodyMap'      },
                ].map(({ key, name }) => {
                  const price  = PRICING[key][billing];
                  const isBM   = key === 'bm';
                  const h      = isBM ? 8 : Math.round((price / 60) * 260);
                  const label  = isBM
                    ? ''
                    : billing === 'annual'
                      ? `$${price * 12}/yr`
                      : `$${price}/mo`;
                  return (
                    <div key={key} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
                      <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:9, minHeight:20, textAlign:'center', lineHeight:1 }}>
                        {label}
                      </div>
                      <div style={{
                        width:'76%', height:h,
                        background: isBM ? C.forest : '#DDD8D2',
                        border:     `2px solid ${isBM ? C.forest : '#B0A9A1'}`,
                        borderBottom: 'none',
                        borderRadius:'6px 6px 0 0',
                        transition:'height 0.4s ease',
                      }} />
                    </div>
                  );
                })}
              </div>

              {/* Name labels */}
              <div className="bm-bar-chart-labels" style={{ display:'flex', gap:16, marginTop:12 }}>
                {[
                  { key:'gg', name:'GlossGenius' },
                  { key:'mb', name:'MassageBook'  },
                  { key:'vg', name:'Vagaro'       },
                  { key:'ac', name:'Acuity'       },
                  { key:'bm', name:'MyBodyMap'      },
                ].map(({ key, name }) => {
                  const isBM = key === 'bm';
                  return (
                    <div key={key} style={{ flex:1, textAlign:'center' }}>
                      {isBM && (
                        <div style={{ fontSize:12, fontWeight:700, color:C.forest, marginBottom:3 }}>Free</div>
                      )}
                      <div style={{ fontSize:12, fontWeight:isBM ? 700 : 500, color:isBM ? C.forest : C.dark, lineHeight:1.35 }}>
                        {name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Math Panel ── */}
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* Saved card */}
              <div style={{ flex:1, background:C.white, borderRadius:20, padding:'32px 24px', boxShadow:'0 4px 24px rgba(0,0,0,0.07)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center' }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:14 }}>
                  {billing === 'monthly' ? 'You save per month' : 'You save per year'}
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap:3, lineHeight:1 }}>
                  <span style={{ fontFamily:'Georgia,serif', fontSize:62, fontWeight:700, color:C.forest }}>
                    ${billing === 'monthly' ? savings.gg : annualSavings.gg}
                  </span>
                  <span style={{ fontSize:20, fontWeight:600, color:C.sage }}>
                    {billing === 'monthly' ? '/mo' : '/yr'}
                  </span>
                </div>
                <div style={{ fontSize:13, color:C.gray, marginTop:10 }}>
                  switching from GlossGenius
                </div>
                <div style={{ marginTop:18, display:'inline-block', padding:'6px 18px', background:'#F0FDF4', borderRadius:24, fontSize:12, color:'#16A34A', fontWeight:700 }}>
                  Free to start, limited time
                </div>
              </div>

              {/* Revenue card */}
              <div style={{ flex:1, background:C.forest, borderRadius:20, padding:'32px 24px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:14 }}>
                  1 more retained client/day
                </div>
                <div style={{ fontFamily:'Georgia,serif', fontSize:58, fontWeight:700, color:'#fff', lineHeight:1 }}>
                  $20,000
                </div>
                <div style={{ fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.65)', marginTop:6 }}>per year</div>
                <div style={{ marginTop:16, fontSize:12, color:'rgba(255,255,255,0.5)', lineHeight:1.9 }}>
                  200 sessions × $100<br/>That's the math.
                </div>
              </div>

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

          {/* Desktop: full comparison table. Hidden on mobile. */}
          <div className="bm-comparison-table-desktop" style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
              <thead>
                <tr>
                  <th style={{ textAlign:'left', padding:'12px 16px', fontSize:13, color:C.gray, fontWeight:600, borderBottom:`2px solid ${C.border}`, width:'40%' }}>Feature</th>
                  {[
                    { key:'bm', name:'MyBodyMap',      sub:'Free on Bronze', highlight:true },
                    { key:'mb', name:'MassageBook',  sub:'From $45/mo' },
                    { key:'vg', name:'Vagaro',       sub:'From $25/mo' },
                    { key:'gg', name:'GlossGenius',  sub:'From $48/mo' },
                    { key:'ac', name:'Acuity',       sub:'From $20/mo' },
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
                  <React.Fragment key={`group-${gi}`}>
                    <tr>
                      <td colSpan={6} style={{ padding:'16px 16px 6px', fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', background:C.light }}>
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
                        <td style={{ textAlign:'center', padding:'11px 8px' }}><CellValue val={item.ac} /></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:C.forest }}>
                  <td style={{ padding:'16px', fontSize:14, fontWeight:700, color:'#fff' }}>Monthly price (Bronze/entry)</td>
                  <td style={{ textAlign:'center', padding:'16px', fontSize:16, fontWeight:700, color:'#6EE7A0' }}>Free</td>
                  <td style={{ textAlign:'center', padding:'16px', fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.7)' }}>$45/mo</td>
                  <td style={{ textAlign:'center', padding:'16px', fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.7)' }}>$25/mo</td>
                  <td style={{ textAlign:'center', padding:'16px', fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.7)' }}>$48/mo</td>
                  <td style={{ textAlign:'center', padding:'16px', fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.7)' }}>$20/mo</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile: per-competitor stacked cards. Hidden on desktop.
              Each card shows: competitor name/price, annual savings vs
              MyBodyMap, up to 6 features MyBodyMap has that the competitor
              does not, and an import CTA. The "advantages" list is computed
              at render time by filtering FEATURES for items where bm=true
              and the competitor key is not exactly true. */}
          <div className="bm-comparison-cards-mobile" style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[
              { key:'mb', name:'MassageBook',  price:45 },
              { key:'vg', name:'Vagaro',       price:25 },
              { key:'gg', name:'GlossGenius',  price:48 },
              { key:'ac', name:'Acuity',       price:20 },
            ].map(({ key, name, price }) => {
              const advantages = FEATURES
                .flatMap(g => g.items)
                .filter(item => item.bm === true && item[key] !== true)
                .slice(0, 6);
              const annualSave = price * 12;
              return (
                <div key={key} style={{
                  background:C.white,
                  borderRadius:16,
                  padding:'20px 18px',
                  boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
                  border:`1px solid ${C.border}`,
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                    <div style={{ fontSize:17, fontWeight:700, color:C.dark }}>{name}</div>
                    <div style={{ fontSize:13, color:C.gray, fontWeight:600 }}>${price}/mo</div>
                  </div>
                  <div style={{ fontSize:13, color:C.forest, fontWeight:700, marginBottom:14 }}>
                    You save ${annualSave}/yr on MyBodyMap
                  </div>
                  <div style={{ fontSize:11, color:C.gray, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>
                    Missing from {name}, included on MyBodyMap:
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                    {advantages.map((item, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                        <span style={{ color:C.forest, fontWeight:700, fontSize:14, marginTop:1 }}>✓</span>
                        <span style={{ fontSize:13, color:C.dark, lineHeight:1.4 }}>{item.name}</span>
                      </div>
                    ))}
                  </div>
                  <Link to="/signup" style={{
                    display:'block',
                    textAlign:'center',
                    background:C.forest,
                    color:'#fff',
                    borderRadius:10,
                    padding:'12px 16px',
                    fontSize:14,
                    fontWeight:700,
                    textDecoration:'none',
                  }}>
                    Switch from {name} free →
                  </Link>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop:16, fontSize:11, color:C.gray, lineHeight:1.6, padding:'0 4px' }}>
            ✓ = Included · ✕ = Not available · $ = Available as paid add-on · Competitor pricing and features based on publicly available information as of April 2026. MyBodyMap makes no guarantee of accuracy. Prices and features may have changed, verify directly with each provider.
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
            That's 4+ hours per week back to focus on your clients, not your back office.
          </div>
        </div>
      </section>

      {/* 7 categories at a glance */}
      <section style={{ background:'#FFFBEB', padding:'70px 24px', borderTop:'1px solid #FDE68A' }}>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:30 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#92400E', letterSpacing:'0.16em', textTransform:'uppercase', marginBottom:8 }}>How it all fits</div>
            <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(26px,4vw,38px)', fontWeight:700, color:C.dark, margin:'0 0 10px' }}>
              Everything you need, across 7 parts of your practice
            </h2>
            <p style={{ fontSize:15, color:'#78350F', maxWidth:560, margin:'0 auto', lineHeight:1.6 }}>
              From first click to long-term regular, every moment of your client's journey, handled.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:12 }}>
            {[
              { id:'1', name:'Find & Book',           desc:'Online scheduling, deposits, your custom booking page.' },
              { id:'2', name:'Know Your Client',      desc:'Visual intake, waivers, preferences, all on submit.' },
              { id:'3', name:'Client Intelligence',   desc:'Patterns across visits. AI chat. Weekly practice pulse.' },
              { id:'4', name:'Day-of-Session',        desc:'Today\'s schedule, brief, and SOAP notes on your phone.' },
              { id:'5', name:'Relationships',         desc:'Reminders, follow-ups, loyalty, lapsed client outreach.' },
              { id:'6', name:'Money & Protection',    desc:'Billing, gift cards, signed waivers, privacy first.' },
              { id:'7', name:'On Your Phone',         desc:'Install to home screen, push alerts, referrals, switching.' },
            ].map(c => (
              <Link key={c.id} to={`/features#cat-${c.id}`} style={{ textDecoration:'none', background:C.white, border:'1px solid #FDE68A', borderRadius:12, padding:'16px 18px', display:'block', transition:'transform 0.15s' }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:6 }}>
                  <span style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:C.forest, lineHeight:1 }}>{c.id}</span>
                  <span style={{ fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:C.dark }}>{c.name}</span>
                </div>
                <div style={{ fontSize:12, color:'#78350F', lineHeight:1.5 }}>{c.desc}</div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign:'center', marginTop:24 }}>
            <Link to="/features" style={{ color:'#92400E', fontSize:13, fontWeight:700, textDecoration:'underline' }}>See every feature in detail →</Link>
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
