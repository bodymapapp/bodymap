import Nav from '../components/Nav';
import Footer from '../components/Footer';
import WaitlistModal from '../components/WaitlistModal';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function WhyBodyMap() {
  const [waitlistOpen, setWaitlistOpen] = React.useState(false);
  const [waitlistInterest, setWaitlistInterest] = React.useState('');
  const C = {
    sage: '#6B9E80', forest: '#2A5741', lavender: '#B4A7D6', lavenderPale: '#F3F1F9',
    beige: '#F0EAD9', white: '#FFFFFF', gray: '#6B7280', darkGray: '#1F2937',
    lightGray: '#F9FAFB', green: '#059669', red: '#DC2626'
  };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <style>{`
        @media (max-width: 768px) {
          .bm-why-3col { grid-template-columns: 1fr !important; }
          .bm-why-2col { grid-template-columns: 1fr !important; }
          .bm-why-hero h1 { font-size: 32px !important; }
          .bm-why-cta-btns { flex-direction: column !important; align-items: stretch !important; }
          .bm-equation-row { flex-direction: column !important; gap: 24px !important; }
        }
      `}</style>

      <Nav />

      {/* Hero */}
      <section style={{ overflowX: 'hidden', background: `linear-gradient(135deg, ${C.sage} 0%, ${C.forest} 100%)`, padding: '80px 24px', textAlign: 'center', color: 'white' }}>
        <div className="bm-why-hero" style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '56px', fontWeight: '700', marginBottom: '16px', lineHeight: 1.2 }}>
            Your clients come back<br/>when they feel known
          </h1>
          <p style={{ fontSize: '22px', opacity: 0.95, maxWidth: '600px', margin: '0 auto' }}>
            BodyMap gives every therapist the tools to make clients feel remembered — before they even walk in the door.
          </p>
        </div>
      </section>

      {/* Retention ROI */}
      <section style={{ overflowX: 'hidden', background: 'white', padding: '80px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
            One client back pays for everything
          </h2>
          <p style={{ fontSize: '18px', color: C.gray, marginBottom: '56px', maxWidth: '600px', margin: '0 auto 56px' }}>
            BodyMap is not a cost. It is a client back on your table.
          </p>

          <div className="bm-equation-row" style={{ display: 'flex', gap: '16px', justifyContent: 'center', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap' }}>
            {[
              { value: '$100', label: 'Average session value' },
              { value: '×12', label: 'Monthly visits per year' },
              { value: '$1,200', label: 'One loyal client per year', highlight: true },
            ].map((item, i) => (
              <React.Fragment key={item.label}>
                <div style={{ background: item.highlight ? C.forest : C.lightGray, borderRadius: '16px', padding: '32px 28px', textAlign: 'center', minWidth: '160px' }}>
                  <div style={{ fontSize: '40px', fontWeight: '800', color: item.highlight ? 'white' : C.lavender }}>{item.value}</div>
                  <div style={{ fontSize: '13px', color: item.highlight ? 'rgba(255,255,255,0.8)' : C.gray, marginTop: '8px' }}>{item.label}</div>
                </div>
                {i < 2 && <div style={{ fontSize: '28px', color: C.gray, fontWeight: '300' }}>=</div>}
              </React.Fragment>
            ))}
          </div>

          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '16px', padding: '32px', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: C.forest, marginBottom: '8px' }}>
              One month of BodyMap costs $9.
            </div>
            <div style={{ fontSize: '16px', color: '#374151', lineHeight: 1.6 }}>
              One lapsed client who comes back monthly for a year is worth $1,200 — that is the $9 you spent in January still paying off in December. It happens again next month. And the month after that. Not a subscription. A revenue recovery engine that compounds.
            </div>
          </div>
        </div>
      </section>

      {/* 6 Value Props */}
      <section style={{ overflowX: 'hidden', background: C.lightGray, padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', textAlign: 'center', color: C.darkGray, marginBottom: '16px' }}>
            Six reasons therapists never go back
          </h2>
          <p style={{ fontSize: '18px', color: C.gray, textAlign: 'center', marginBottom: '56px' }}>
            Once your clients feel this level of care, they stop looking for anyone else.
          </p>

          <div className="bm-why-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {[
              {
                emoji: '📱',
                title: 'One tap brings them back',
                desc: 'See a client who has not visited in 60 days? One tap sends them a personal text. No awkward calls. No bulk emails. Just a warm nudge that feels like it came from you.'
              },
              {
                emoji: '🏆',
                title: 'You look like a clinic',
                desc: 'You send a professional intake link before every session. Your client\'s experience feels like a high-end spa. That gap in professionalism is what sets you apart from the therapist down the street.'
              },
              {
                emoji: '💬',
                title: 'They never repeat themselves',
                desc: 'Every returning client dreads "so what are we working on today?" BodyMap eliminates that forever. You already know. That moment of "you remembered" turns a good therapist into their therapist.'
              },
              {
                emoji: '🌱',
                title: 'Your intake is your marketing',
                desc: 'Every time a client receives your BodyMap intake link, they see a professional, branded experience. When they tell a friend about their massage, they mention the app. Organic word of mouth built into your workflow.'
              },
              {
                emoji: '🛡️',
                title: 'You remember everything',
                desc: 'Every preference, every note, every session — documented and ready. Clients trust therapists who remember the details. That trust is what keeps them coming back to you and nobody else.'
              },
              {
                emoji: '🧠',
                title: 'Clarity going into every session',
                desc: 'You are not trying to remember what Sarah said last time about her shoulder. It is right there. That mental clarity makes you a better therapist — and your clients feel the difference.'
              }
            ].map((item) => (
              <div key={item.title} style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '32px' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>{item.emoji}</div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>{item.title}</h3>
                <p style={{ fontSize: '14px', color: C.gray, lineHeight: '1.7', margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The moment that changes everything */}
      <section style={{ overflowX: 'hidden', background: 'white', padding: '80px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }} className="bm-why-2col">
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: C.sage, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>The moment that changes everything</div>
              <h2 style={{ fontSize: '36px', fontWeight: '700', color: C.darkGray, marginBottom: '20px', lineHeight: 1.3 }}>
                It is 9am on a Tuesday. You have a gap in your schedule.
              </h2>
              <p style={{ fontSize: '16px', color: C.gray, lineHeight: '1.8', marginBottom: '20px' }}>
                Before BodyMap: you scroll your contacts, feel awkward about reaching out, and the slot stays empty.
              </p>
              <p style={{ fontSize: '16px', color: C.gray, lineHeight: '1.8', marginBottom: '20px' }}>
                With BodyMap: you open your lapsed clients list. You see Maria has not been in for 47 days. One tap. She gets a text. She books that afternoon.
              </p>
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: C.forest, marginBottom: '4px' }}>That one tap just recovered $100.</div>
                <div style={{ fontSize: '14px', color: '#374151' }}>If Maria stays monthly, that is $1,200 this year. From one tap on a Tuesday morning.</div>
              </div>
            </div>
            <div style={{ background: `linear-gradient(135deg, ${C.sage}22 0%, ${C.forest}22 100%)`, borderRadius: '20px', padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '64px', marginBottom: '24px' }}>📱</div>
              <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px', textAlign: 'left', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '12px', color: C.gray, marginBottom: '8px', fontWeight: '600' }}>LAPSED CLIENTS</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: C.darkGray }}>Maria S.</div>
                    <div style={{ fontSize: '12px', color: C.red }}>47 days since last visit</div>
                  </div>
                  <div style={{ background: C.forest, color: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}>Send Text 💬</div>
                </div>
              </div>
              <div style={{ background: '#DCF8C6', borderRadius: '12px', padding: '14px 18px', textAlign: 'left' }}>
                <div style={{ fontSize: '13px', color: '#1F2937' }}>Hey Maria! It has been a while — would love to see you back. Here is a link to book 🌿</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* You vs the therapist down the street */}
      <section style={{ overflowX: 'hidden', background: C.lightGray, padding: '80px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', textAlign: 'center', color: C.darkGray, marginBottom: '56px' }}>
            You vs. the therapist down the street
          </h2>

          <div className="bm-why-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ background: '#FEF2F2', borderRadius: '16px', border: '2px solid #FCA5A5', padding: '40px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: C.red, marginBottom: '20px' }}>WITHOUT BODYMAP</div>
              {[
                'Clients repeat themselves every visit',
                'Lapsed clients slip away quietly',
                'You guess what they need each session',
                'Intake is a verbal conversation at the table',
                'Nothing is documented if something goes wrong',
                'Looks the same as everyone else',
              ].map((item) => (
                <div key={item} style={{ display: 'flex', gap: '12px', marginBottom: '16px', fontSize: '14px', color: '#374151' }}>
                  <span style={{ color: C.red, fontWeight: '700', flexShrink: 0 }}>✗</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div style={{ background: '#ECFDF5', borderRadius: '16px', border: '2px solid #6EE7B7', padding: '40px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: C.green, marginBottom: '20px' }}>WITH BODYMAP</div>
              {[
                'Their preferences are remembered forever',
                'One tap brings lapsed clients back',
                'Body map + patterns tell you exactly what they need',
                'Intake is done before they arrive',
                'Every session is documented automatically',
                'Stands out as modern, professional, different',
              ].map((item) => (
                <div key={item} style={{ display: 'flex', gap: '12px', marginBottom: '16px', fontSize: '14px', color: '#374151' }}>
                  <span style={{ color: C.green, fontWeight: '700', flexShrink: 0 }}>✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Practice Sizes — retention framing */}
      <section style={{ overflowX: 'hidden', background: C.lavenderPale, padding: '80px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', textAlign: 'center', color: C.darkGray, marginBottom: '56px' }}>
            Works for every size practice
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {[
              {
                icon: '👤',
                title: 'Solo Therapist',
                cost: '$9/month Silver',
                retention: 'Re-engage just 1 lapsed client per month',
                value: '$1,200/year recovered. BodyMap pays for itself 133x over.',
                impact: 'You look professional, clients feel remembered, and your schedule stays full without chasing anyone.',
                available: true
              },
              {
                icon: '🏢',
                title: 'Small Practice (2–5 therapists)',
                cost: '$49/month Gold',
                retention: '3 therapists each re-engage 1 lapsed client/month',
                value: '$3,600/year recovered. 73x ROI on Gold plan.',
                impact: 'Consistent client experience across every therapist. Shared intake data. One professional brand.',
                available: false,
                waitlistLabel: 'Gold Plan — Launching Soon',
                waitlistSub: 'Join the waitlist to be first notified.'
              },
              {
                icon: '🏭',
                title: 'Massage Chain (10+ locations)',
                cost: 'Custom pricing',
                retention: 'Platform-wide retention intelligence',
                value: 'Predictable revenue recovery at scale.',
                impact: 'Brand consistency, training tool for new therapists, data-driven operations across every location.',
                available: false,
                waitlistLabel: 'Enterprise — Coming Soon',
                waitlistSub: 'Express interest and we will reach out first.'
              }
            ].map((use) => (
              <div key={use.title} style={{ background: 'white', padding: '32px', borderRadius: '12px', border: `1px solid ${use.available ? '#E5E7EB' : '#D8D3E8'}`, position: 'relative', opacity: use.available ? 1 : 0.92 }}>
                {!use.available && (
                  <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#B4A7D6', color: 'white', fontSize: '11px', fontWeight: '800', padding: '4px 12px', borderRadius: '20px', textTransform: 'uppercase' }}>🔒 Coming Soon</div>
                )}
                {use.available && (
                  <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#D1FAE5', color: '#065F46', fontSize: '11px', fontWeight: '800', padding: '4px 12px', borderRadius: '20px', textTransform: 'uppercase' }}>✅ Available Now</div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
                  <div style={{ fontSize: '48px' }}>{use.icon}</div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '22px', fontWeight: '700', color: C.darkGray, marginBottom: '4px' }}>{use.title}</h3>
                    <div style={{ fontSize: '14px', color: C.lavender, fontWeight: '600', marginBottom: '16px' }}>{use.cost}</div>
                    <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                      <div style={{ fontSize: '13px', color: C.green, fontWeight: '600', marginBottom: '4px' }}>{use.retention}</div>
                      <div style={{ fontSize: '14px', color: C.forest, fontWeight: '700' }}>{use.value}</div>
                    </div>
                    <p style={{ fontSize: '14px', color: C.gray, lineHeight: '1.7', margin: '0 0 16px 0' }}>{use.impact}</p>
                    {!use.available && (
                      <div style={{ background: '#F3F1F9', border: '1px solid #D8D3E8', borderRadius: '8px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '18px' }}>📬</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#6B5FA6', marginBottom: '2px' }}>{use.waitlistLabel}</div>
                          <div style={{ fontSize: '12px', color: C.gray }}>{use.waitlistSub}</div>
                        </div>
                        <button onClick={() => { setWaitlistInterest(use.waitlistLabel); setWaitlistOpen(true); }} style={{ background: '#2A5741', color: 'white', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>Join Waitlist →</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ overflowX: 'hidden', background: 'white', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '48px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
            The decision is simple
          </h2>
          <p style={{ fontSize: '18px', color: C.gray, marginBottom: '40px', lineHeight: '1.6' }}>
            Keep doing verbal intake and hoping clients remember to come back.<br/>
            Or give them a reason to.
          </p>
          <div className="bm-why-cta-btns" style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '24px' }}>
            <Link to="/#demo" style={{ background: C.sage, color: 'white', padding: '16px 40px', borderRadius: '8px', textDecoration: 'none', fontSize: '18px', fontWeight: '600' }}>See How It Works</Link>
            <Link to="/signup" style={{ background: 'white', color: C.lavender, padding: '16px 40px', borderRadius: '8px', textDecoration: 'none', fontSize: '18px', fontWeight: '600', border: `2px solid ${C.lavender}` }}>Start Free Trial</Link>
          </div>
          <p style={{ fontSize: '14px', color: '#9CA3AF' }}>No credit card. No commitment. See the difference in your first session.</p>
        </div>
      </section>

      <Footer />
    <WaitlistModal isOpen={waitlistOpen} onClose={() => setWaitlistOpen(false)} interest={waitlistInterest} />
    </div>
  );
}
