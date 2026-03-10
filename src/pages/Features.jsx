import { Link } from 'react-router-dom';
import React from 'react';
import Nav from '../components/Nav';
import Footer from '../components/Footer';


function TherapistCarousel() {
  const [active, setActive] = React.useState(0);
  const cards = [
    { step: 'Step 1', time: '30 seconds, once', barPct: 100, barColor: '#2A5741', barLabel: '30 sec — one time only', title: 'Sign in. Send the intake form.', desc: 'Your BodyMap dashboard is live the moment you sign up. Send your first client their intake form in one tap. They handle the rest.' },
    { step: 'Step 2', time: 'Automatic', barPct: 100, barColor: '#C9A84C', barLabel: 'Automatic — no effort needed', title: 'Their map is waiting when you are.', desc: 'Once your client fills in their intake, their body map, preferences and health notes appear instantly. Walk in already knowing their pressure, focus areas, and what to avoid.' },
    { step: 'Step 3', time: 'Builds over time', barPct: 100, barColor: '#C9A84C', barLabel: 'Automatic — every session', title: 'BodyMap learns with every session.', desc: 'Recurring focus areas, patterns across visits, preferences. It builds quietly in the background so you never have to ask the same question twice.' }
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
        <button onClick={() => setActive(a => Math.max(0, a-1))} disabled={active === 0} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid #E8E4DC', background: active === 0 ? '#F5F0E8' : 'white', cursor: active === 0 ? 'default' : 'pointer', fontSize: '16px', color: active === 0 ? '#D1CBC0' : '#2A5741', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div style={{ display: 'flex', gap: '8px' }}>
          {cards.map((_, i) => (<button key={i} onClick={() => setActive(i)} style={{ width: i === active ? '24px' : '8px', height: '8px', borderRadius: '4px', border: 'none', background: i === active ? '#2A5741' : '#D1CBC0', cursor: 'pointer', transition: 'all 0.3s ease', padding: 0 }} />))}
        </div>
        <button onClick={() => setActive(a => Math.min(cards.length-1, a+1))} disabled={active === cards.length-1} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid #E8E4DC', background: active === cards.length-1 ? '#F5F0E8' : 'white', cursor: active === cards.length-1 ? 'default' : 'pointer', fontSize: '16px', color: active === cards.length-1 ? '#D1CBC0' : '#2A5741', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      </div>
    </div>
  );
}

function ClientCarousel() {
  const [active, setActive] = React.useState(0);
  const cards = [
    { step: 'Step 1', time: 'Instant', barPct: 0, barColor: '#2A5741', barLabel: 'Zero effort', title: 'No app. No login. Just a link.', desc: 'Your therapist texts you a link. Tap it. Opens on any phone instantly. Nothing to download, nothing to remember.' },
    { step: 'Step 2', time: '30 seconds', barPct: 100, barColor: '#2A5741', barLabel: '30 sec total', title: 'Show them what you need.', desc: 'Tap your body map to mark focus and avoid areas, then set your pressure, music and lighting preferences. Done before you sit down.' },
    { step: 'Step 3', time: 'After every session', barPct: 100, barColor: '#C9A84C', barLabel: 'Automatic — every session', title: 'Your personal body report, automatically.', desc: 'After each session, receive a one-page summary with your body map, patterns, and a note from your therapist. Your wellness story, building over time.' }
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
        <button onClick={() => setActive(a => Math.max(0, a-1))} disabled={active === 0} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid #E8E4DC', background: active === 0 ? '#F5F0E8' : 'white', cursor: active === 0 ? 'default' : 'pointer', fontSize: '16px', color: active === 0 ? '#D1CBC0' : '#2A5741', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div style={{ display: 'flex', gap: '8px' }}>
          {cards.map((_, i) => (<button key={i} onClick={() => setActive(i)} style={{ width: i === active ? '24px' : '8px', height: '8px', borderRadius: '4px', border: 'none', background: i === active ? '#2A5741' : '#D1CBC0', cursor: 'pointer', transition: 'all 0.3s ease', padding: 0 }} />))}
        </div>
        <button onClick={() => setActive(a => Math.min(cards.length-1, a+1))} disabled={active === cards.length-1} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid #E8E4DC', background: active === cards.length-1 ? '#F5F0E8' : 'white', cursor: active === cards.length-1 ? 'default' : 'pointer', fontSize: '16px', color: active === cards.length-1 ? '#D1CBC0' : '#2A5741', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      </div>
    </div>
  );
}

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

      <section style={{ background: '#F5F0E8', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: '12px' }}>Your Clients Tell You Once. Your Practice Remembers Forever.</h2>
          <p style={{ fontSize: '18px', color: '#6B7280', textAlign: 'center', marginBottom: '64px' }}>Therapist setup: 30 seconds. Client intake: 30 seconds. Everything else: automatic.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>
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

      <section style={{ background: 'white', padding: '80px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', color: '#1A1A2E', marginBottom: '12px' }}>Experience Both Sides</h2>
          <p style={{ fontSize: '18px', color: '#6B7280', marginBottom: '48px' }}>No signup needed. See why clients love it — and why therapists never go back.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ background: '#E8F5EE', borderRadius: '20px', padding: '40px 32px', textAlign: 'center', border: '2px solid #C8E6D4' }}>
              <div style={{ fontSize: '52px', marginBottom: '16px' }}>💆</div>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: '700', color: '#1A1A2E', marginBottom: '12px' }}>Therapist Experience</h3>
              <p style={{ fontSize: '15px', color: '#6B7280', lineHeight: '1.6', marginBottom: '8px' }}>See your dashboard before each session — body map, preferences, medical flags, and the patterns BodyMap has detected across every visit. Walk in knowing exactly what this client needs.</p>
              <p style={{ fontSize: '13px', color: '#6B9E80', fontWeight: '600', marginBottom: '28px' }}>Free account · no credit card · live in 30 seconds →</p>
              <Link to="/signup" style={{ display: 'inline-block', background: '#2A5741', color: 'white', padding: '14px 32px', borderRadius: '50px', fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: '700', textDecoration: 'none' }}>Create Free Account →</Link>
            </div>
            <div style={{ background: '#F5F0E8', borderRadius: '20px', padding: '40px 32px', textAlign: 'center', border: '2px solid #E8E4DC' }}>
              <div style={{ fontSize: '52px', marginBottom: '16px' }}>📱</div>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: '700', color: '#1A1A2E', marginBottom: '12px' }}>Client Experience</h3>
              <p style={{ fontSize: '15px', color: '#6B7280', lineHeight: '1.6', marginBottom: '8px' }}>Tap your body map, mark focus and avoid areas, set your preferences — exactly what your clients will do before every session.</p>
              <p style={{ fontSize: '13px', color: '#6B9E80', fontWeight: '600', marginBottom: '28px' }}>Works on your phone right now →</p>
              <Link to="/demo" style={{ display: 'inline-block', background: '#2A5741', color: 'white', padding: '14px 32px', borderRadius: '50px', fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: '700', textDecoration: 'none' }}>Try Client Intake →</Link>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '24px' }}>🔒 Demo data only — nothing is saved</p>
        </div>
      </section>
      <Footer />
    </div>
  );
}
