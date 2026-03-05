import Nav from '../components/Nav';
import Footer from '../components/Footer';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';


function TherapistCarousel() {
  const [active, setActive] = React.useState(0);
  const cards = [
    {
      step: 'Step 1',
      time: '30 seconds, once',
      barPct: 100,
      barColor: '#2A5741',
      barLabel: '30 sec — one time only',
      title: 'Sign in. Send the intake form.',
      desc: 'Your BodyMap dashboard is live the moment you sign up. Send your first client their intake form in one tap. They handle the rest.'
    },
    {
      step: 'Step 2',
      time: 'Automatic',
      barPct: 100,
      barColor: '#C9A84C',
      barLabel: 'Automatic — no effort needed',
      title: 'Their map is waiting when you are.',
      desc: 'Once your client fills in their intake, their body map, preferences and health notes appear instantly. Walk in already knowing their pressure, focus areas, and what to avoid.'
    },
    {
      step: 'Step 3',
      time: 'Builds over time',
      barPct: 100,
      barColor: '#C9A84C',
      barLabel: 'Automatic — every session',
      title: 'BodyMap learns with every session.',
      desc: 'Recurring focus areas, patterns across visits, preferences. It builds quietly in the background so you never have to ask the same question twice.'
    }
  ];
  const card = cards[active];
  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#2A5741', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.step}</span>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>{card.barLabel}</span>
        </div>
        <div style={{ height: '6px', background: '#E8E4DC', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: card.barPct + '%', background: card.barColor, borderRadius: '3px', transition: 'all 0.4s ease' }} />
        </div>
      </div>
      <div style={{ background: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', minHeight: '200px', border: '1.5px solid #E8E4DC' }}>
        <span style={{ display: 'inline-block', background: '#FEF9EC', color: '#C9A84C', fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '20px', border: '1px solid #F0D88A', marginBottom: '16px' }}>{card.time}</span>
        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '21px', fontWeight: '700', color: '#1A1A2E', marginBottom: '10px', lineHeight: '1.3' }}>{card.title}</h3>
        <p style={{ fontSize: '15px', color: '#6B7280', lineHeight: '1.6', margin: 0 }}>{card.desc}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '20px' }}>
        <button onClick={() => setActive(a => Math.max(0, a-1))} disabled={active === 0}
          style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid #E8E4DC', background: active === 0 ? '#F5F0E8' : 'white', cursor: active === 0 ? 'default' : 'pointer', fontSize: '16px', color: active === 0 ? '#D1CBC0' : '#2A5741', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div style={{ display: 'flex', gap: '8px' }}>
          {cards.map((_, i) => (
            <button key={i} onClick={() => setActive(i)}
              style={{ width: i === active ? '24px' : '8px', height: '8px', borderRadius: '4px', border: 'none', background: i === active ? '#2A5741' : '#D1CBC0', cursor: 'pointer', transition: 'all 0.3s ease', padding: 0 }} />
          ))}
        </div>
        <button onClick={() => setActive(a => Math.min(cards.length-1, a+1))} disabled={active === cards.length-1}
          style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid #E8E4DC', background: active === cards.length-1 ? '#F5F0E8' : 'white', cursor: active === cards.length-1 ? 'default' : 'pointer', fontSize: '16px', color: active === cards.length-1 ? '#D1CBC0' : '#2A5741', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      </div>
    </div>
  );
}

function ClientCarousel() {
  const [active, setActive] = React.useState(0);
  const cards = [
    {
      step: 'Step 1',
      time: 'Instant',
      barPct: 0,
      barColor: '#2A5741',
      barLabel: 'Zero effort',
      title: 'No app. No login. Just a link.',
      desc: 'Your therapist texts you a link. Tap it. Opens on any phone instantly. Nothing to download, nothing to remember.'
    },
    {
      step: 'Step 2',
      time: '30 seconds',
      barPct: 100,
      barColor: '#2A5741',
      barLabel: '30 sec total',
      title: 'Show them what you need.',
      desc: 'Tap your body map to mark focus and avoid areas, then set your pressure, music and lighting preferences. Done before you sit down.'
    },
    {
      step: 'Step 3',
      time: 'After every session',
      barPct: 100,
      barColor: '#C9A84C',
      barLabel: 'Automatic — every session',
      title: 'Your personal body report, automatically.',
      desc: 'After each session, receive a one-page summary with your body map, patterns, and a note from your therapist. Your wellness story, building over time.'
    }
  ];
  const card = cards[active];
  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#2A5741', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.step}</span>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>{card.barLabel}</span>
        </div>
        <div style={{ height: '6px', background: '#E8E4DC', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: card.barPct + '%', background: card.barColor, borderRadius: '3px', transition: 'all 0.4s ease' }} />
        </div>
      </div>
      <div style={{ background: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', minHeight: '200px', border: '1.5px solid #E8E4DC' }}>
        <span style={{ display: 'inline-block', background: '#FEF9EC', color: '#C9A84C', fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '20px', border: '1px solid #F0D88A', marginBottom: '16px' }}>{card.time}</span>
        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '21px', fontWeight: '700', color: '#1A1A2E', marginBottom: '10px', lineHeight: '1.3' }}>{card.title}</h3>
        <p style={{ fontSize: '15px', color: '#6B7280', lineHeight: '1.6', margin: 0 }}>{card.desc}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '20px' }}>
        <button onClick={() => setActive(a => Math.max(0, a-1))} disabled={active === 0}
          style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid #E8E4DC', background: active === 0 ? '#F5F0E8' : 'white', cursor: active === 0 ? 'default' : 'pointer', fontSize: '16px', color: active === 0 ? '#D1CBC0' : '#2A5741', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div style={{ display: 'flex', gap: '8px' }}>
          {cards.map((_, i) => (
            <button key={i} onClick={() => setActive(i)}
              style={{ width: i === active ? '24px' : '8px', height: '8px', borderRadius: '4px', border: 'none', background: i === active ? '#2A5741' : '#D1CBC0', cursor: 'pointer', transition: 'all 0.3s ease', padding: 0 }} />
          ))}
        </div>
        <button onClick={() => setActive(a => Math.min(cards.length-1, a+1))} disabled={active === cards.length-1}
          style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid #E8E4DC', background: active === cards.length-1 ? '#F5F0E8' : 'white', cursor: active === cards.length-1 ? 'default' : 'pointer', fontSize: '16px', color: active === cards.length-1 ? '#D1CBC0' : '#2A5741', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      </div>
    </div>
  );
}

function HomePromoField() {
  const [code, setCode] = React.useState('');
  const [applied, setApplied] = React.useState(false);
  const [error, setError] = React.useState(false);
  if (new Date() > new Date('2026-04-17')) return null;
  const ctaLink = 'https://buy.stripe.com/test_28EdRbfAO34N973ddvafS00';
  const validCodes = ['REDDIT50'];
  const handleApply = () => {
    const c = code.trim().toUpperCase();
    if (validCodes.includes(c)) {
      setApplied(true);
      setError(false);
    } else {
      setError(true);
      setApplied(false);
    }
  };
  const finalLink = applied ? ctaLink + '?prefilled_promo_code=' + code.trim().toUpperCase() : ctaLink;
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
        <input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value); setApplied(false); setError(false); }}
          placeholder="Have a promo code?"
          style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: applied ? '2px solid #2A5741' : error ? '2px solid #EF4444' : '1px solid #E5E7EB', fontSize: '14px', outline: 'none', color: '#374151' }}
        />
        <button onClick={handleApply} style={{ padding: '10px 16px', borderRadius: '8px', background: '#6B5FB5', color: 'white', border: 'none', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Apply</button>
      </div>
      {error && <p style={{ fontSize: '12px', color: '#EF4444', margin: '0 0 8px 2px' }}>❌ That code doesn't look right. Try REDDIT50.</p>}
      {applied && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '10px 14px', marginBottom: '10px' }}>
          <p style={{ fontSize: '13px', color: '#2A5741', fontWeight: '700', margin: '0 0 4px 0' }}>🎉 You got 50% off for 3 months!</p>
          <p style={{ fontSize: '12px', color: '#374151', margin: 0, lineHeight: 1.5 }}>Instead of $24/mo, you pay just <strong>$12/mo</strong> for your first 3 months. Click below to lock it in.</p>
        </div>
      )}
      <a href={finalLink} target="_blank" rel="noopener noreferrer" style={{
        display: 'block', background: '#6B5FB5', color: 'white', padding: '12px 24px',
        borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600', textAlign: 'center'
      }}>
        {applied ? '🎉 Start My Free Trial — $12/mo' : 'Start Trial'}
      </a>
    </div>
  );
}


export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const slides = [
    { emoji: "🌿", text: "Be Professional", subtitle: "Modern intake that clients love" },
    { emoji: "⚡", text: "Be Efficient", subtitle: "Give clients 8 extra minutes of care" },
    { emoji: "💜", text: "Be Memorable", subtitle: "Data-driven sessions they'll remember" }
  ];

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const C = {
    sage: '#6B9E80',
    forest: '#2A5741',
    lavender: '#B4A7D6',
    lavenderPale: '#F3F1F9',
    lavenderMid: '#D8D3E8',
    beige: '#F0EAD9',
    white: '#FFFFFF',
    gray: '#6B7280',
    darkGray: '#1F2937',
    lightGray: '#F9FAFB',
    green: '#059669',
    red: '#DC2626'
  };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <style>{`
        @media (max-width: 768px) {
          .bm-grid-3 { grid-template-columns: 1fr !important; }
          .bm-grid-2 { grid-template-columns: 1fr !important; }
          .bm-grid-pricing { grid-template-columns: 1fr !important; }
          .bm-hero-btns { flex-direction: column !important; align-items: stretch !important; }
          .bm-hero-h1 { font-size: 36px !important; }
          .bm-hero-h2 { font-size: 28px !important; }
          .bm-section-h2 { font-size: 28px !important; }
          .bm-benefit-h3 { font-size: 22px !important; }
          .bm-gap-60 { gap: 32px !important; }
          .bm-section-pad { padding: 48px 16px !important; }
          .bm-hide-mobile { display: none !important; }
          .bm-try-card { padding: 28px 20px !important; }
          .bm-nav-full { font-size: 13px !important; }
        }
      `}</style>
      
      {/* Header/Navigation */}
      <Nav />

      {/* Carousel Hero */}
      <section style={{ 
        background: `linear-gradient(135deg, ${C.sage} 0%, ${C.forest} 100%)`,
        padding: '80px 24px',
        textAlign: 'center',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '420px'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ 
            fontSize: '72px', 
            marginBottom: '16px',
            transition: 'opacity 0.4s ease',
            opacity: 1
          }}>
            {slides[currentSlide].emoji}
          </div>
          <h1 style={{ 
            fontSize: '56px', 
            fontWeight: '700', 
            marginBottom: '8px',
            transition: 'opacity 0.4s ease',
            minHeight: '70px'
          }}>
            {slides[currentSlide].text}
          </h1>
          <p style={{ 
            fontSize: '24px', 
            opacity: 0.95,
            marginBottom: '32px',
            transition: 'opacity 0.4s ease',
            minHeight: '36px'
          }}>
            {slides[currentSlide].subtitle}
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '24px' }}>
            {slides.map((_, idx) => (
              <div key={idx} style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: currentSlide === idx ? 'white' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.3s'
              }} />
            ))}
          </div>
        </div>
      </section>

      {/* Main Hero */}
      <section style={{ background: 'white', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 className="bm-hero-h2" style={{ fontSize: '48px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
            Elevate Every Client Experience
          </h2>
          <p style={{ fontSize: '20px', color: C.gray, marginBottom: '40px', lineHeight: '1.6' }}>
            Your clients visualize their needs in 60 seconds.<br/>
            You deliver personalized, data-driven sessions.<br/>
            They remember the experience. They come back.
          </p>
          <div className="bm-hero-btns" style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '60px' }}>
            <a href="#demo" style={{
              background: C.sage,
              color: 'white',
              padding: '16px 32px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '18px',
              fontWeight: '600'
            }}>See How It Works</a>
            <Link to="/signup" style={{
              background: 'white',
              color: C.sage,
              padding: '16px 32px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '18px',
              fontWeight: '600',
              border: `2px solid ${C.sage}`
            }}>Start Free Trial</Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="demo" style={{ background: C.lavenderPale, padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
            How BodyMap Works
          </h2>
          <p style={{ fontSize: '18px', color: C.gray, marginBottom: '64px' }}>
            Three simple steps. Immediate impact for you and your clients.
          </p>

          <div className="bm-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>

            {/* Step 1 */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '36px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: C.forest, color: 'white', fontSize: '22px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>1</div>
              {/* SVG: Settings/link setup */}
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto 24px', display: 'block' }}>
                <circle cx="40" cy="40" r="38" fill="#E8F5EE" stroke="#6B9E80" strokeWidth="2"/>
                <rect x="20" y="28" width="40" height="28" rx="4" fill="white" stroke="#2A5741" strokeWidth="2"/>
                <line x1="20" y1="36" x2="60" y2="36" stroke="#2A5741" strokeWidth="2"/>
                <circle cx="26" cy="32" r="2" fill="#6B9E80"/>
                <circle cx="33" cy="32" r="2" fill="#6B9E80"/>
                <rect x="26" y="42" width="20" height="3" rx="1.5" fill="#6B9E80"/>
                <rect x="26" y="49" width="14" height="3" rx="1.5" fill="#C9A84C"/>
                <rect x="48" y="42" width="8" height="10" rx="2" fill="#2A5741"/>
                <line x1="40" y1="56" x2="40" y2="62" stroke="#2A5741" strokeWidth="2"/>
                <line x1="32" y1="62" x2="48" y2="62" stroke="#2A5741" strokeWidth="2"/>
              </svg>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>Set Up in 30 Seconds</h3>
              <p style={{ fontSize: '15px', color: C.gray, lineHeight: '1.6', marginBottom: '12px' }}>
                Sign up and your personal intake link is ready instantly — <strong>mybodymap.app/[yourbusiness]</strong>. Yours alone. With Gmail, you're live in under 10 seconds. Share it once. Clients use it before every session.
              </p>
              <p style={{ fontSize: '13px', color: C.sage, fontWeight: '600' }}>Text or email it to each client before their session →</p>
            </div>

            {/* Step 2 */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '36px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: C.forest, color: 'white', fontSize: '22px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>2</div>
              {/* SVG: Body with green/red dots */}
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto 24px', display: 'block' }}>
                <circle cx="40" cy="40" r="38" fill="#E8F5EE" stroke="#6B9E80" strokeWidth="2"/>
                {/* Body silhouette */}
                <circle cx="40" cy="22" r="7" fill="#D4C9B0"/>
                <rect x="32" y="30" width="16" height="18" rx="4" fill="#D4C9B0"/>
                <rect x="22" y="31" width="9" height="14" rx="3" fill="#D4C9B0"/>
                <rect x="49" y="31" width="9" height="14" rx="3" fill="#D4C9B0"/>
                <rect x="33" y="48" width="6" height="16" rx="3" fill="#D4C9B0"/>
                <rect x="41" y="48" width="6" height="16" rx="3" fill="#D4C9B0"/>
                {/* Green focus dots */}
                <circle cx="40" cy="35" r="4" fill="#22C55E" opacity="0.9"/>
                <circle cx="33" cy="40" r="3.5" fill="#22C55E" opacity="0.9"/>
                <circle cx="47" cy="40" r="3.5" fill="#22C55E" opacity="0.9"/>
                {/* Red avoid dots */}
                <circle cx="36" cy="52" r="3.5" fill="#EF4444" opacity="0.9"/>
                <circle cx="44" cy="52" r="3.5" fill="#EF4444" opacity="0.9"/>
              </svg>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>Client Maps Their Body</h3>
              <p style={{ fontSize: '15px', color: C.gray, lineHeight: '1.6', marginBottom: '12px' }}>
                Client opens your link on any phone or laptop — no app, no download, no login needed. They tap <span style={{ color: '#22C55E', fontWeight: '700' }}>green</span> for focus areas, <span style={{ color: '#EF4444', fontWeight: '700' }}>red</span> for areas to avoid, and set preferences like pressure, music, and temperature.
              </p>
              <p style={{ fontSize: '13px', color: C.sage, fontWeight: '600' }}>Done in under 60 seconds →</p>
            </div>

            {/* Step 3 */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '36px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: C.forest, color: 'white', fontSize: '22px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>3</div>
              {/* SVG: Laptop + phone side by side */}
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto 24px', display: 'block' }}>
                <circle cx="40" cy="40" r="38" fill="#E8F5EE" stroke="#6B9E80" strokeWidth="2"/>
                {/* Laptop */}
                <rect x="14" y="28" width="34" height="22" rx="2" fill="white" stroke="#2A5741" strokeWidth="1.5"/>
                <rect x="16" y="30" width="30" height="18" rx="1" fill="#E8F5EE"/>
                <line x1="10" y1="50" x2="52" y2="50" stroke="#2A5741" strokeWidth="2"/>
                <rect x="26" y="32" width="10" height="3" rx="1" fill="#6B9E80"/>
                <rect x="26" y="37" width="14" height="2" rx="1" fill="#C9A84C"/>
                <rect x="26" y="41" width="12" height="2" rx="1" fill="#9CA3AF"/>
                {/* Phone */}
                <rect x="54" y="30" width="13" height="22" rx="3" fill="white" stroke="#2A5741" strokeWidth="1.5"/>
                <rect x="56" y="33" width="9" height="14" rx="1" fill="#E8F5EE"/>
                <circle cx="60.5" cy="50" r="1.5" fill="#2A5741"/>
                <circle cx="60" cy="35" r="2" fill="#22C55E"/>
                <circle cx="63" cy="38" r="2" fill="#EF4444"/>
              </svg>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>You See Everything. Patterns Build Over Time.</h3>
              <p style={{ fontSize: '15px', color: C.gray, lineHeight: '1.6', marginBottom: '12px' }}>
                Review their body map before each session on any device. After session 3, BodyMap shows you patterns — which areas they always focus on, what they consistently avoid, pressure trends. After session 5, you know this client better than any notes ever could.
              </p>
              <p style={{ fontSize: '13px', color: C.sage, fontWeight: '600' }}>Session intelligence that compounds with every visit →</p>
            </div>

          </div>
        </div>
      </section>


      {/* Experience Carousels */}
      <section style={{ background: '#F5F0E8', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: '12px' }}>
            Your Clients Tell You Once. Your Practice Remembers Forever.
          </h2>
          <p style={{ fontSize: '18px', color: '#6B7280', textAlign: 'center', marginBottom: '64px' }}>
            Therapist setup: 30 seconds. Client intake: 30 seconds. Everything else: automatic.
          </p>
          <div className="bm-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>
            <div>
              <p style={{ fontSize: '18px', fontWeight: '700', color: '#2A5741', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px', textAlign: 'center' }}>💆 For Therapists</p>
              <TherapistCarousel />
            </div>
            <div>
              <p style={{ fontSize: '18px', fontWeight: '700', color: '#2A5741', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px', textAlign: 'center' }}>📱 For Clients</p>
              <ClientCarousel />
            </div>
          </div>
        </div>
      </section>

      {/* Try It Section */}
      <section style={{ background: 'white', padding: '80px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>
            Experience Both Sides
          </h2>
          <p style={{ fontSize: '18px', color: C.gray, marginBottom: '48px' }}>
            No signup needed. See why clients love it — and why therapists never go back.
          </p>
          <div className="bm-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

            {/* Therapist card */}
            <div style={{ background: '#E8F5EE', borderRadius: '20px', padding: '40px 32px', textAlign: 'center', border: '2px solid #C8E6D4' }}>
              <div style={{ fontSize: '52px', marginBottom: '16px' }}>💆</div>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>
                Therapist Experience
              </h3>
              <p style={{ fontSize: '15px', color: C.gray, lineHeight: '1.6', marginBottom: '8px' }}>
                See your dashboard before each session — body map, preferences, medical flags, and the patterns BodyMap has detected across every visit. Walk in knowing exactly what this client needs.
              </p>
              <p style={{ fontSize: '13px', color: C.sage, fontWeight: '600', marginBottom: '28px' }}>
                Free account · no credit card · live in 30 seconds →
              </p>
              <a href="/signup" style={{ display: 'inline-block', background: C.forest, color: 'white', padding: '14px 32px', borderRadius: '50px', fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: '700', textDecoration: 'none' }}>
                Create Free Account →
              </a>
            </div>

            {/* Client card */}
            <div style={{ background: C.beige, borderRadius: '20px', padding: '40px 32px', textAlign: 'center', border: '2px solid #E8E4DC' }}>
              <div style={{ fontSize: '52px', marginBottom: '16px' }}>📱</div>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>
                Client Experience
              </h3>
              <p style={{ fontSize: '15px', color: C.gray, lineHeight: '1.6', marginBottom: '8px' }}>
                Tap your body map, mark focus and avoid areas, set your preferences — exactly what your clients will do before every session.
              </p>
              <p style={{ fontSize: '13px', color: C.sage, fontWeight: '600', marginBottom: '28px' }}>
                Works on your phone right now →
              </p>
              <a href="/demo" style={{ display: 'inline-block', background: C.forest, color: 'white', padding: '14px 32px', borderRadius: '50px', fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: '700', textDecoration: 'none' }}>
                Try Client Intake →
              </a>
            </div>

          </div>
          <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '24px' }}>
            🔒 Demo data only — nothing is saved
          </p>
        </div>
      </section>

      {/* The Impact - BENEFITS FIRST */}
      <section style={{ background: 'white', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', color: C.darkGray, textAlign: 'center', marginBottom: '16px' }}>
            The Benefits Are Clear
          </h2>
          <p style={{ fontSize: '18px', color: C.gray, textAlign: 'center', marginBottom: '60px' }}>
            It's about more than efficiency. It's about transforming your practice.
          </p>
          
          <div className="bm-grid-2 bm-gap-60" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center', marginBottom: '60px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: C.lavender, marginBottom: '12px' }}>💜 BENEFIT #1</div>
              <h3 style={{ fontSize: '32px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
                Elevated Client Experience
              </h3>
              <p style={{ fontSize: '18px', color: C.gray, lineHeight: '1.6', marginBottom: '24px' }}>
                Clients feel heard before they arrive. Visual body maps beat verbal descriptions. Every session is personalized with their exact preferences. Data-driven care they can feel.
              </p>
              <div style={{ background: C.lavenderPale, borderRadius: '8px', padding: '20px', border: `1px solid ${C.lavenderMid}` }}>
                <div style={{ fontSize: '14px', color: C.lavender, fontWeight: '600', marginBottom: '8px' }}>The Result:</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: C.lavender, marginBottom: '4px' }}>92% of clients</div>
                <div style={{ fontSize: '14px', color: C.gray }}>say BodyMap therapists provide better sessions</div>
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: C.sage, marginBottom: '12px' }}>🌿 BENEFIT #2</div>
              <h3 style={{ fontSize: '32px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
                2x Higher Client Retention
              </h3>
              <p style={{ fontSize: '18px', color: C.gray, lineHeight: '1.6', marginBottom: '24px' }}>
                When clients feel understood, they come back. BodyMap therapists see double the repeat bookings compared to traditional intake methods. Loyal clients, predictable revenue.
              </p>
              <div style={{ background: '#ECFDF5', borderRadius: '8px', padding: '20px', border: '1px solid #A7F3D0' }}>
                <div style={{ fontSize: '14px', color: C.green, fontWeight: '600', marginBottom: '8px' }}>The Result:</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: C.green, marginBottom: '4px' }}>2x repeat rate</div>
                <div style={{ fontSize: '14px', color: C.gray }}>vs. therapists without visual intake</div>
              </div>
            </div>
          </div>

          <div className="bm-grid-2 bm-gap-60" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: C.sage, marginBottom: '12px' }}>⚡ BENEFIT #3</div>
              <h3 style={{ fontSize: '32px', fontWeight: '700', color: C.darkGray, marginBottom: '16px', minHeight: '80px' }}>
                Body Intelligence That Builds Over Time
              </h3>
              <p style={{ fontSize: '18px', color: C.gray, lineHeight: '1.6', marginBottom: '24px' }}>
                Every session adds to a client's body intelligence profile. BodyMap shows you which areas they consistently focus on, which they avoid, and how confident that pattern is — across every session you've ever had with them.
              </p>
              <div style={{ background: '#ECFDF5', borderRadius: '8px', padding: '16px', border: '1px solid #A7F3D0', marginTop: 'auto' }}>
                <div style={{ fontSize: '13px', color: C.green, fontWeight: '600', marginBottom: '8px' }}>Example — After 5 Sessions:</div>
                <div style={{ fontSize: '14px', color: C.darkGray, lineHeight: '1.9' }}>
                  🔥 Lower Back — 5/5 sessions · <strong>100%</strong><br/>
                  🔥 Hamstrings — 4/5 sessions · <strong>80%</strong><br/>
                  🚫 Head — always avoid · <strong>3/5 sessions</strong>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: C.sage, marginBottom: '12px' }}>💰 BENEFIT #4</div>
              <h3 style={{ fontSize: '32px', fontWeight: '700', color: C.darkGray, marginBottom: '16px', minHeight: '80px' }}>
                Time Savings Add Up
              </h3>
              <p style={{ fontSize: '18px', color: C.gray, lineHeight: '1.6', marginBottom: '24px' }}>
                8 minutes per session × 4 clients = 32 minutes per day. That's 640 minutes (10+ hours) per month. Use it for more clients, personal time, or better work-life balance.
              </p>
              <div style={{ background: C.lightGray, borderRadius: '8px', padding: '16px', marginTop: 'auto', border: '1px solid #D1CBC0', border: '1px solid #D1CBC0' }}>
                <div style={{ fontSize: '13px', color: C.gray, marginBottom: '8px' }}>Monthly Impact:</div>
                <div style={{ fontSize: '14px', color: C.darkGray, lineHeight: '1.8' }}>
                  • 4 sessions/day × 8 min = 32 min/day<br/>
                  • 32 min × 20 days = 640 min/month<br/>
                  • <strong>≈ $640 in time value</strong> (at $1/min)
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" style={{ background: C.lightGray, padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', color: C.darkGray, textAlign: 'center', marginBottom: '12px' }}>
            See What Your Practice Can Look Like
          </h2>
          <p style={{ fontSize: '18px', color: C.gray, textAlign: 'center', marginBottom: '64px' }}>
            Every feature is built around one goal — clients who feel known come back.
          </p>

          {[
            {
              label: 'Before the Session',
              color: '#2A5741',
              bg: '#E8F5EE',
              cards: [
                {
                  num: '01',
                  label: 'Send Intake',
                  img: '/ss-intake.png',
                  title: 'Send Intake in One Tap',
                  desc: 'Text your client their intake link directly from your dashboard. They fill it in before they arrive. You walk in already knowing what they need.'
                },
                {
                  num: '02',
                  label: 'Body Map',
                  img: '/ss-bodymap.png',
                  title: 'Clients Show You Exactly What They Need',
                  desc: 'No more guessing or verbal back-and-forth. Clients tap front and back body maps to mark focus and avoid areas. Instant clarity, every session.'
                },
                {
                  num: '03',
                  label: 'Pre-Session Brief',
                  img: '/ss-pre-brief.png',
                  title: 'Your Pre-Session Brief, Ready to Go',
                  desc: 'One tap opens a full therapist brief — body map, medical flags, preferences, and pattern history. Walk in prepared. Every single time.'
                }
              ]
            },
            {
              label: 'During the Session',
              color: '#6B4C9A',
              bg: '#F3EEFF',
              cards: [
                {
                  num: '04',
                  label: 'Client Preferences',
                  img: '/ss-preferences.png',
                  title: 'Never Ask the Same Question Twice',
                  desc: 'Pressure, music, lighting, draping, temperature — captured once, carried forward forever. Every session starts exactly how they like it.'
                },
                {
                  num: '05',
                  label: 'Medical Flags',
                  img: '/ss-patterns.png',
                  title: 'Walk In With Eyes Wide Open',
                  desc: 'Medical conditions surface as a red alert before you begin. Pattern confidence scores show avoid areas by frequency. Nothing gets missed.'
                },
                {
                  num: '06',
                  label: 'Pattern Heatmap',
                  img: '/ss-heatmap.png',
                  title: 'Know This Client Better Than They Know Themselves',
                  desc: 'After a few sessions, BodyMap shows what this client always needs. Lower back 4 of 5 visits. Shoulders every time. Patterns memory alone would miss.'
                }
              ]
            },
            {
              label: 'After the Session',
              color: '#C9A84C',
              bg: '#FEF9EC',
              cards: [
                {
                  num: '07',
                  label: 'Post-Session Brief',
                  img: '/ss-post-brief.png',
                  title: 'Send Clients a Personalized Summary',
                  desc: 'After each session, send your client a Post-Session Brief with their body map, patterns, and your notes. Clients who receive this book again.'
                },
                {
                  num: '08',
                  label: 'Client Feedback',
                  img: '/ss-feedback.png',
                  title: 'Capture Feedback That Makes You Better',
                  desc: 'One-tap feedback after each session. Pressure ratings, focus area satisfaction, return likelihood. Know what landed. Improve with every visit.'
                },
                {
                  num: '09',
                  label: 'Repeat Customers',
                  img: '/ss-lapsed3.png',
                  title: 'Win Back Clients Before You Lose Them',
                  desc: 'BodyMap flags clients who have not returned in 30, 60, or 90 days. One tap sends a personal text. Clients who feel remembered come back.'
                }
              ]
            }
          ].map((group) => (
            <div key={group.label} style={{ marginBottom: '56px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
                <div style={{ width: '4px', height: '28px', background: group.color, borderRadius: '2px' }} />
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: group.color, margin: 0 }}>{group.label}</h3>
              </div>
              <div className="bm-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                {group.cards.map((feature) => (
                  <div key={feature.title} style={{
                    background: 'white',
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    overflow: 'hidden',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <div style={{ background: '#F3F4F6', borderBottom: '1px solid #E5E7EB', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57', flexShrink: 0 }} />
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E', flexShrink: 0 }} />
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840', flexShrink: 0 }} />
                      <div style={{ marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: group.color }}>{feature.num}</span>
                        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>|</span>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#374151' }}>{feature.label}</span>
                      </div>
                    </div>
                    <div style={{ height: 220, overflow: 'hidden', background: group.bg }}>
                      <img src={feature.img} alt={feature.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: feature.imgFit || 'cover', objectPosition: feature.imgPosition || 'top', background: 'white' }} />
                    </div>
                    <div style={{ padding: '20px 24px 28px', flex: 1 }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', lineHeight: '1.35', margin: '0 0 10px 0' }}>
                        {feature.title}
                      </h3>
                      <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.65', margin: 0 }}>
                        {feature.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ marginTop: '40px', background: C.lavenderPale, padding: '24px', borderRadius: '12px', border: `1px solid ${C.lavenderMid}`, textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: C.gray, margin: 0 }}>
              <strong>Note:</strong> BodyMap is a communication tool for intake preferences, not medical software. No HIPAA compliance required.
            </p>
          </div>
        </div>
      </section>


      {/* Security Trust Section */}
      <section style={{ background: '#F8FAFC', padding: '80px 24px', borderTop: '1px solid #E5E7EB' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '20px', padding: '6px 16px', marginBottom: '16px' }}>
              <span style={{ fontSize: '14px' }}>🔒</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#2A5741' }}>Built for trust</span>
            </div>
            <h2 style={{ fontSize: '36px', fontWeight: '700', color: '#111827', margin: '0 0 16px 0' }}>Your clients' data is safe with you</h2>
            <p style={{ fontSize: '17px', color: '#6B7280', maxWidth: '560px', margin: '0 auto', lineHeight: '1.6' }}>
              BodyMap is built on enterprise-grade infrastructure. Your clients' intake data belongs to you — not us.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }}>
            {[
              {
                icon: '🔐',
                title: 'Encrypted end to end',
                desc: 'All data is encrypted at rest with AES-256 and in transit with TLS 1.3. The same standard used by banks.'
              },
              {
                icon: '🏠',
                title: 'Your data stays yours',
                desc: 'Every therapist operates in a completely isolated environment. No other practitioner can ever see your clients.'
              },
              {
                icon: '🚫',
                title: 'Never sold. Never shared.',
                desc: 'We do not sell your data or your clients\' data. No advertisers. No third-party data brokers. Ever.'
              },
              {
                icon: '🏗️',
                title: 'Enterprise infrastructure',
                desc: 'Built on Supabase — SOC 2 Type II certified. The same infrastructure trusted by thousands of companies worldwide.'
              },
              {
                icon: '🩺',
                title: 'Not medical software',
                desc: 'BodyMap is a communication tool, not an EHR. Solo massage therapists are generally not subject to HIPAA.'
              },
              {
                icon: '📋',
                title: 'Full transparency',
                desc: 'We publish our Privacy Policy and Terms of Service in plain language. No legalese designed to confuse.'
              },
            ].map((item) => (
              <div key={item.title} style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '28px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>{item.icon}</div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: '0 0 8px 0' }}>{item.title}</h3>
                <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.65', margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {['AES-256 Encryption', 'TLS 1.3', 'SOC 2 Type II', 'Row Level Security', 'No Ads. No Trackers.'].map((badge) => (
                <div key={badge} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#2A5741', fontSize: '13px' }}>✓</span>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{badge}</span>
                </div>
              ))}
            </div>
            <a href="/privacy" style={{ fontSize: '13px', color: '#2A5741', fontWeight: '600', textDecoration: 'none', whiteSpace: 'nowrap' }}>Read our Privacy Policy →</a>
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section style={{ background: 'white', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', color: C.darkGray, textAlign: 'center', marginBottom: '60px' }}>
            Built For Every Practice Size
          </h2>
          
          <div className="bm-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px' }}>
            {[
              {
                icon: "👤",
                title: "Solo Therapists",
                desc: "Elevate client experience, boost retention, reclaim your time",
                plan: "Free or Silver plan"
              },
              {
                icon: "🏢",
                title: "Small Practices (2-5 therapists)",
                desc: "Standardize intake, share insights, maintain quality across your team",
                plan: "Gold plan"
              },
              {
                icon: "🏭",
                title: "Massage Chains",
                desc: "Enterprise pricing available. Volume discounts for 10+ locations.",
                plan: "Contact for pricing"
              },
              {
                icon: "🎓",
                title: "Massage Schools",
                desc: "Train students with professional intake tools. Real-world experience.",
                plan: "Education pricing"
              }
            ].map((segment) => (
              <div key={segment.title} style={{ 
                background: C.lightGray, 
                padding: '32px', 
                borderRadius: '12px',
                border: '2px solid #E5E7EB',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = C.lavender;
                e.currentTarget.style.background = C.lavenderPale;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#E5E7EB';
                e.currentTarget.style.background = C.lightGray;
              }}
              >
                <div style={{ fontSize: '56px', marginBottom: '16px' }}>{segment.icon}</div>
                <h3 style={{ fontSize: '24px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>
                  {segment.title}
                </h3>
                <p style={{ fontSize: '16px', color: C.gray, lineHeight: '1.6', marginBottom: '12px' }}>
                  {segment.desc}
                </p>
                <div style={{ fontSize: '14px', color: C.lavender, fontWeight: '600' }}>
                  → {segment.plan}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section style={{ background: C.lavenderPale, padding: '80px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
            Start Free, Upgrade When Ready
          </h2>
          <p style={{ fontSize: '18px', color: C.gray, marginBottom: '60px' }}>
            No credit card required. Cancel anytime.
          </p>
          
          <div className="bm-grid-pricing" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }}>
            {[
              { name: "Bronze", price: "$0", clients: "5 clients/month", cta: "Start Free", badge: "🥉" },
              { name: "Silver", price: "$24", clients: "Unlimited clients", cta: "Start Trial", badge: "🥈", popular: true, note: "~50¢ per massage at 50 clients/month" },
              { name: "Gold", price: "$49", clients: "Up to 5 therapists", cta: "Coming Soon", badge: "🥇", comingSoon: true }
            ].map((tier) => (
              <div key={tier.name} style={{ 
                background: tier.popular ? 'white' : C.lightGray,
                border: tier.popular ? `3px solid ${C.lavender}` : '1px solid #E5E7EB',
                borderRadius: '12px',
                padding: '32px 24px',
                position: 'relative'
              }}>
                {tier.popular && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: C.lavender,
                    color: 'white',
                    padding: '4px 16px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '700'
                  }}>MOST POPULAR</div>
                )}
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>{tier.badge}</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: C.darkGray, marginBottom: '8px' }}>
                  {tier.name}
                </div>
                <div style={{ fontSize: '36px', fontWeight: '700', color: C.lavender, marginBottom: '4px' }}>
                  {tier.price}
                </div>
                <div style={{ fontSize: '14px', color: C.gray, marginBottom: '20px' }}>
                  per month
                </div>
                <div style={{ fontSize: '14px', color: C.gray, marginBottom: '24px', minHeight: '40px' }}>
                  {tier.clients}
                </div>
                {tier.comingSoon ? (
                  <div style={{ display: 'block', background: '#E5E7EB', color: '#9CA3AF', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', textAlign: 'center', cursor: 'not-allowed' }}>
                    🔒 Coming Soon
                  </div>
                ) : tier.popular ? (
                  <>
                    <HomePromoField />
                  </>
                ) : (
                  <Link to="/signup" style={{
                    display: 'block',
                    background: 'white',
                    color: C.lavender,
                    border: `2px solid ${C.lavender}`,
                    padding: '12px 24px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                    textAlign: 'center'
                  }}>
                    {tier.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>

          <Link to="/pricing" style={{
            display: 'inline-block',
            color: C.lavender,
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: '600',
            borderBottom: `2px solid ${C.lavender}`
          }}>
            See Full Pricing & Features →
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ background: 'white', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '48px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
            Ready to Elevate Your Client Experience?
          </h2>
          <p style={{ fontSize: '18px', color: C.gray, marginBottom: '40px' }}>
            Join therapists who are seeing 2x retention, happier clients, and more efficient practices.
          </p>
          <div className="bm-hero-btns" style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '24px' }}>
            <a href="#demo" style={{
              background: C.sage,
              color: 'white',
              padding: '16px 40px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '18px',
              fontWeight: '600'
            }}>See How It Works</a>
            <Link to="/signup" style={{
              background: 'white',
              color: C.lavender,
              padding: '16px 40px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '18px',
              fontWeight: '600',
              border: `2px solid ${C.lavender}`
            }}>Start Free Trial</Link>
          </div>
          <p style={{ fontSize: '14px', color: '#9CA3AF' }}>
            No credit card. No setup fees. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
