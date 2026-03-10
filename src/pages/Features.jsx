import { Link } from 'react-router-dom';
import React from 'react';
import Nav from '../components/Nav';
import Footer from '../components/Footer';

export default function Features() {
  const C = {
    sage: '#6B9E80',
    forest: '#2A5741',
    lavender: '#B4A7D6',
    lavenderPale: '#F3F1F9',
    lavenderMid: '#D8D3E8',
    lightGray: '#F9FAFB',
    gray: '#6B7280',
    darkGray: '#1F2937',
  };

  return (
    <div style={{ paddingTop: "64px", fontFamily: "'Inter', -apple-system, sans-serif", color: C.darkGray }}>
      <Nav />
      <section style={{ background: C.lightGray, padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '42px', fontWeight: '700', color: C.darkGray, textAlign: 'center', marginBottom: '12px' }}>
            This Is What It Feels Like to Never Lose a Client to Drift
          </h1>
          <p style={{ fontSize: '18px', color: C.gray, textAlign: 'center', marginBottom: '64px' }}>
            Every feature was built with one person in mind — you.
          </p>

          {[
            {
              label: 'Before the Session',
              color: '#2A5741',
              bg: '#E8F5EE',
              cards: [
                { num: '01', label: 'Send Intake', img: '/ss-intake.png', title: 'Send Intake in One Tap', desc: 'Text your client their intake link directly from your dashboard. They fill it in before they arrive. You walk in already knowing what they need.' },
                { num: '02', label: 'Body Map', img: '/ss-bodymap.png', title: 'Clients Show You Exactly What They Need', desc: 'No more guessing or verbal back-and-forth. Clients tap front and back body maps to mark focus and avoid areas. Instant clarity, every session.' },
                { num: '03', label: 'Pre-Session Brief', img: '/ss-pre-brief.png', title: 'Your Pre-Session Brief, Ready to Go', desc: 'One tap opens a full therapist brief — body map, medical flags, preferences, and pattern history. Walk in prepared. Every single time.' }
              ]
            },
            {
              label: 'During the Session',
              color: '#6B4C9A',
              bg: '#F3EEFF',
              cards: [
                { num: '04', label: 'Client Preferences', img: '/ss-preferences.png', title: 'Never Ask the Same Question Twice', desc: 'Pressure, music, lighting, draping, temperature — captured once, carried forward forever. Every session starts exactly how they like it.' },
                { num: '05', label: 'Medical Flags', img: '/ss-patterns.png', title: 'Walk In With Eyes Wide Open', desc: 'Medical conditions surface as a red alert before you begin. Pattern confidence scores show avoid areas by frequency. Nothing gets missed.' },
                { num: '06', label: 'Pattern Heatmap', img: '/ss-heatmap.png', title: 'Know This Client Better Than They Know Themselves', desc: 'After a few sessions, BodyMap shows what this client always needs. Lower back 4 of 5 visits. Shoulders every time. Patterns memory alone would miss.' }
              ]
            },
            {
              label: 'After the Session',
              color: '#C9A84C',
              bg: '#FEF9EC',
              cards: [
                { num: '07', label: 'Post-Session Brief', img: '/ss-post-brief.png', title: 'Send Clients a Personalized Summary', desc: 'After each session, send your client a Post-Session Brief with their body map, patterns, and your notes. Clients who receive this book again.' },
                { num: '08', label: 'Client Feedback', img: '/ss-feedback.png', title: 'Capture Feedback That Makes You Better', desc: 'One-tap feedback after each session. Pressure ratings, focus area satisfaction, return likelihood. Know what landed. Improve with every visit.' },
                { num: '09', label: 'Repeat Customers', img: '/ss-lapsed3.png', title: 'Win Back Clients Before You Lose Them', desc: 'BodyMap flags clients who have not returned in 30, 60, or 90 days. One tap sends a personal text. Clients who feel remembered come back.' }
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
                  <div key={feature.title} style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
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
                      <img src={feature.img} alt={feature.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                    </div>
                    <div style={{ padding: '20px 24px 28px', flex: 1 }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', lineHeight: '1.35', margin: '0 0 10px 0' }}>{feature.title}</h3>
                      <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.65', margin: 0 }}>{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ marginTop: '40px', background: C.lavenderPale, padding: '24px', borderRadius: '12px', border: '1px solid ' + C.lavenderMid, textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: C.gray, margin: 0 }}>
              <strong>Note:</strong> BodyMap is a communication tool for intake preferences, not medical software. No HIPAA compliance required.
            </p>
          </div>
        </div>
      </section>
      <section style={{ background: "#f0f9f4", borderTop: "1px solid #c8ecd8", borderBottom: "1px solid #c8ecd8", padding: "64px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#2d6a4f", marginBottom: "16px" }}>See It In Action</div>
          <h2 style={{ fontFamily: "Georgia,serif", fontSize: "clamp(24px,3.5vw,38px)", fontWeight: 700, color: "#1a3d2b", margin: "0 0 16px", lineHeight: 1.25 }}>Experience Both Sides</h2>
          <p style={{ fontSize: "18px", color: "#4a4a4a", lineHeight: 1.6, marginBottom: "36px" }}>No signup needed. See why clients love it — and why therapists never go back.</p>
          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/demo" style={{ display: "inline-flex", alignItems: "center", background: "#2d6a4f", color: "#fff", fontSize: "16px", fontWeight: 700, padding: "16px 32px", borderRadius: "12px", textDecoration: "none", boxShadow: "0 4px 16px rgba(45,106,79,0.28)" }}>Try the Demo →</a>
            <a href="/signup" style={{ display: "inline-flex", alignItems: "center", background: "transparent", color: "#2d6a4f", fontSize: "16px", fontWeight: 600, padding: "15px 28px", borderRadius: "12px", textDecoration: "none", border: "1.5px solid #52b788" }}>Start Free</a>
          </div>
          <p style={{ marginTop: "20px", fontSize: "13px", color: "#7a7a7a" }}>No account. No credit card. 60 seconds.</p>
        </div>
      </section>

      <section style={{ background: '#f0f9f4', borderTop: '1px solid #c8ecd8', borderBottom: '1px solid #c8ecd8', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2d6a4f', marginBottom: '16px' }}>See It In Action</div>
          <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 'clamp(24px,3.5vw,38px)', fontWeight: 700, color: '#1a3d2b', margin: '0 0 16px', lineHeight: 1.25 }}>Experience Both Sides</h2>
          <p style={{ fontSize: '18px', color: '#4a4a4a', lineHeight: 1.6, marginBottom: '36px' }}>No signup needed. See why clients love it — and why therapists never go back.</p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to='/demo' style={{ display: 'inline-flex', alignItems: 'center', background: '#2d6a4f', color: '#fff', fontSize: '16px', fontWeight: 700, padding: '16px 32px', borderRadius: '12px', textDecoration: 'none', boxShadow: '0 4px 16px rgba(45,106,79,0.28)' }}>Try the Demo →</Link>
            <Link to='/signup' style={{ display: 'inline-flex', alignItems: 'center', background: 'transparent', color: '#2d6a4f', fontSize: '16px', fontWeight: 600, padding: '15px 28px', borderRadius: '12px', textDecoration: 'none', border: '1.5px solid #52b788' }}>Start Free</Link>
          </div>
          <p style={{ marginTop: '20px', fontSize: '13px', color: '#7a7a7a' }}>No account. No credit card. 60 seconds.</p>
        </div>
      </section>
      <Footer />
    </div>
  );
}
