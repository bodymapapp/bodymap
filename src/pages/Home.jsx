import Nav from '../components/Nav';
import Footer from '../components/Footer';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

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
        overflow: 'hidden'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ 
            fontSize: '72px', 
            marginBottom: '16px',
            transition: 'all 0.5s ease',
            opacity: 1
          }}>
            {slides[currentSlide].emoji}
          </div>
          <h1 style={{ 
            fontSize: '56px', 
            fontWeight: '700', 
            marginBottom: '8px',
            transition: 'all 0.5s ease'
          }}>
            {slides[currentSlide].text}
          </h1>
          <p style={{ 
            fontSize: '24px', 
            opacity: 0.95,
            marginBottom: '32px',
            transition: 'all 0.5s ease'
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
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>Set Up in 2 Minutes</h3>
              <p style={{ fontSize: '15px', color: C.gray, lineHeight: '1.6', marginBottom: '12px' }}>
                Sign up, go to <strong>Settings</strong>, and copy your unique intake link — something like <em>bodymap.app/yourbusiness</em>. That's it.
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
                Client opens the link on any phone — no app needed. They tap <span style={{ color: '#22C55E', fontWeight: '700' }}>green</span> for focus areas, <span style={{ color: '#EF4444', fontWeight: '700' }}>red</span> for areas to avoid, and set preferences like pressure, music, and temperature.
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
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>You Deliver. Then Collect Feedback.</h3>
              <p style={{ fontSize: '15px', color: C.gray, lineHeight: '1.6', marginBottom: '12px' }}>
                Review their body map on any device — phone or laptop — before the session. Deliver a personalized massage. After, send a feedback link to keep improving.
              </p>
              <p style={{ fontSize: '13px', color: C.sage, fontWeight: '600' }}>Every session gets better than the last →</p>
            </div>

          </div>
        </div>
      </section>

      {/* Try It Section */}
      <section style={{ background: 'white', padding: '80px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>
            Try It Right Now
          </h2>
          <p style={{ fontSize: '18px', color: C.gray, marginBottom: '48px' }}>
            No signup needed. Experience BodyMap from both sides.
          </p>
          <div className="bm-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

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

            {/* Therapist card */}
            <div style={{ background: '#E8F5EE', borderRadius: '20px', padding: '40px 32px', textAlign: 'center', border: '2px solid #C8E6D4' }}>
              <div style={{ fontSize: '52px', marginBottom: '16px' }}>💆</div>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>
                Therapist Dashboard
              </h3>
              <p style={{ fontSize: '15px', color: C.gray, lineHeight: '1.6', marginBottom: '8px' }}>
                See exactly what you will see before each session — client body map, preferences, medical flags, session history, and feedback all in one place.
              </p>
              <p style={{ fontSize: '13px', color: C.sage, fontWeight: '600', marginBottom: '28px' }}>
                Free account · no credit card · live in 30 seconds →
              </p>
              <a href="/signup" style={{ display: 'inline-block', background: C.forest, color: 'white', padding: '14px 32px', borderRadius: '50px', fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: '700', textDecoration: 'none' }}>
                Create Free Account →
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

          <div className="bm-grid-2 bm-gap-60" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: C.sage, marginBottom: '12px' }}>⚡ BENEFIT #3</div>
              <h3 style={{ fontSize: '32px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
                Body Intelligence That Builds Over Time
              </h3>
              <p style={{ fontSize: '18px', color: C.gray, lineHeight: '1.6', marginBottom: '24px' }}>
                Every session adds to a client's body intelligence profile. BodyMap shows you which areas they consistently focus on, which they avoid, and how confident that pattern is — across every session you've ever had with them.
              </p>
              <div style={{ background: '#ECFDF5', borderRadius: '8px', padding: '16px', border: '1px solid #A7F3D0' }}>
                <div style={{ fontSize: '13px', color: C.green, fontWeight: '600', marginBottom: '8px' }}>Example — After 5 Sessions:</div>
                <div style={{ fontSize: '14px', color: C.darkGray, lineHeight: '1.9' }}>
                  🔥 Lower Back — 5/5 sessions · <strong>100%</strong><br/>
                  🔥 Hamstrings — 4/5 sessions · <strong>80%</strong><br/>
                  🚫 Head — always avoid · <strong>3/5 sessions</strong>
                </div>
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: C.sage, marginBottom: '12px' }}>💰 BENEFIT #4</div>
              <h3 style={{ fontSize: '32px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
                Time Savings Add Up
              </h3>
              <p style={{ fontSize: '18px', color: C.gray, lineHeight: '1.6', marginBottom: '24px' }}>
                8 minutes per session × 4 clients = 32 minutes per day. That's 640 minutes (10+ hours) per month. Use it for more clients, personal time, or better work-life balance.
              </p>
              <div style={{ background: C.lightGray, borderRadius: '8px', padding: '16px' }}>
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
          <h2 style={{ fontSize: '42px', fontWeight: '700', color: C.darkGray, textAlign: 'center', marginBottom: '60px' }}>
            Everything You Need
          </h2>
          
          <div className="bm-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
            {[
              {
                emoji: "🗺️",
                title: "Visual Body Maps",
                desc: "Front & back body diagrams. Clients tap to mark focus and avoid areas before every session. Clear visual communication that beats verbal descriptions every time."
              },
              {
                emoji: "🔥",
                title: "Heatmap Pattern Intelligence",
                desc: "See which body areas a client consistently requests across sessions — visualized as a heatmap with frequency badges. Lower Back marked 4 of 5 sessions? You'll know instantly."
              },
              {
                emoji: "📊",
                title: "Pattern Confidence Scores",
                desc: "Each recurring preference shows a progress bar and percentage. \"Always avoids: Head — 3/5 sessions · 60%.\" Know your client before they arrive."
              },
              {
                emoji: "🚨",
                title: "Medical Flag Alerts",
                desc: "Medical conditions surface as a full-width red alert the moment you open a session. Never miss a contraindication. Protects your client and your practice."
              },
              {
                emoji: "💬",
                title: "Post-Session Feedback",
                desc: "Send clients a one-tap feedback link after each session. Capture pressure ratings, focus area satisfaction, and return likelihood. Get better every session."
              },
              {
                emoji: "📱",
                title: "Works Everywhere",
                desc: "No app download for clients. Works on any phone or tablet. You review on any device — phone at the table, laptop at your desk."
              }
            ].map((feature) => (
              <div key={feature.title} style={{ 
                background: 'white', 
                padding: '32px', 
                borderRadius: '12px',
                border: '1px solid #E5E7EB'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>{feature.emoji}</div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>
                  {feature.title}
                </h3>
                <p style={{ fontSize: '15px', color: C.gray, lineHeight: '1.6' }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '40px', background: C.lavenderPale, padding: '24px', borderRadius: '12px', border: `1px solid ${C.lavenderMid}`, textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: C.gray, margin: 0 }}>
              <strong>Note:</strong> BodyMap is a communication tool for intake preferences, not medical software. No HIPAA compliance required.
            </p>
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
              { name: "Silver", price: "$24", clients: "Unlimited clients", cta: "Start Trial", badge: "🥈", popular: true },
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
                ) : (
                  <Link to="/signup" style={{
                    display: 'block',
                    background: tier.popular ? C.lavender : 'white',
                    color: tier.popular ? 'white' : C.lavender,
                    border: tier.popular ? 'none' : `2px solid ${C.lavender}`,
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
