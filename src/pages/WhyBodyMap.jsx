import Nav from '../components/Nav';
import Footer from '../components/Footer';
import React from 'react';
import { Link } from 'react-router-dom';

export default function WhyBodyMap() {
  const C = {
    sage: '#6B9E80',
    forest: '#2A5741',
    lavender: '#B4A7D6',
    lavenderPale: '#F3F1F9',
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
      
      {/* Header */}
      <Nav />

      {/* Hero */}
      <section style={{ background: `linear-gradient(135deg, ${C.sage} 0%, ${C.forest} 100%)`, padding: '80px 24px', textAlign: 'center', color: 'white' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '56px', fontWeight: '700', marginBottom: '16px' }}>
            Why Massage Therapists Choose BodyMap
          </h1>
          <p style={{ fontSize: '22px', opacity: 0.95 }}>
            Better client experience. Higher retention. Time efficiency. All in one.
          </p>
        </div>
      </section>

      {/* Primary Benefits - MOVED UP */}
      <section style={{ background: 'white', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', textAlign: 'center', color: C.darkGray, marginBottom: '16px' }}>
            It's More Than Efficiency
          </h2>
          <p style={{ fontSize: '18px', color: C.gray, textAlign: 'center', marginBottom: '60px' }}>
            BodyMap transforms how you connect with clients. The time savings? That's just a bonus.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', marginBottom: '60px' }}>
            {[
              {
                emoji: "💜",
                title: "Elevated Client Experience",
                desc: "Clients feel heard before they arrive. Visual body maps beat verbal descriptions. Every session is personalized. Data-driven care they can feel.",
                stat: "92%",
                statLabel: "say sessions feel more personalized"
              },
              {
                emoji: "🔄",
                title: "2x Higher Retention",
                desc: "When clients feel understood, they come back. BodyMap therapists see double the repeat bookings vs. traditional intake methods.",
                stat: "2x",
                statLabel: "repeat client rate vs. old way"
              },
              {
                emoji: "⚡",
                title: "Time Efficiency",
                desc: "Review their visual intake in 2 minutes. Spend 58 minutes on hands-on therapy. Give clients 8 extra minutes of care every session.",
                stat: "8 min",
                statLabel: "extra care per session"
              }
            ].map((benefit) => (
              <div key={benefit.title} style={{ 
                background: C.lightGray, 
                padding: '32px', 
                borderRadius: '12px',
                border: '1px solid #E5E7EB'
              }}>
                <div style={{ fontSize: '56px', marginBottom: '16px', textAlign: 'center' }}>{benefit.emoji}</div>
                <h3 style={{ fontSize: '22px', fontWeight: '700', color: C.darkGray, marginBottom: '12px', textAlign: 'center' }}>
                  {benefit.title}
                </h3>
                <p style={{ fontSize: '15px', color: C.gray, lineHeight: '1.6', marginBottom: '20px', textAlign: 'center' }}>
                  {benefit.desc}
                </p>
                <div style={{ background: C.lavenderPale, borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: C.lavender, marginBottom: '4px' }}>{benefit.stat}</div>
                  <div style={{ fontSize: '13px', color: C.gray }}>{benefit.statLabel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Time-Money Equation - UPDATED MATH */}
      <section style={{ background: C.lightGray, padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', textAlign: 'center', color: C.darkGray, marginBottom: '60px' }}>
            The Time Efficiency Breakdown
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', marginBottom: '60px' }}>
            {/* Traditional Way */}
            <div style={{ background: '#FEF2F2', padding: '40px', borderRadius: '16px', border: '2px solid #FCA5A5' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: C.red, marginBottom: '16px' }}>❌ TRADITIONAL INTAKE</div>
              <h3 style={{ fontSize: '24px', fontWeight: '700', color: C.darkGray, marginBottom: '24px' }}>
                60-Minute Session Breakdown
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #FECACA' }}>
                  <span style={{ color: C.gray }}>Verbal intake conversation</span>
                  <span style={{ fontWeight: '700', color: C.red }}>10 min</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #FECACA' }}>
                  <span style={{ color: C.gray }}>Hands-on therapy</span>
                  <span style={{ fontWeight: '700', color: C.darkGray }}>50 min</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: C.red }}>
                  <span>Client gets:</span>
                  <span>50 min of care</span>
                </div>
              </div>

              <div style={{ marginTop: '32px', padding: '20px', background: '#FEE2E2', borderRadius: '12px' }}>
                <div style={{ fontSize: '13px', color: C.red, marginBottom: '8px' }}>DAILY IMPACT (4 clients)</div>
                <div style={{ fontSize: '14px', color: '#991B1B', marginBottom: '8px' }}>
                  4 sessions × 10 min = <strong>40 min/day in intake</strong>
                </div>
                <div style={{ fontSize: '13px', color: '#991B1B' }}>
                  40 min × $1/min = $40/day | $800/month (20 days)
                </div>
              </div>
            </div>

            {/* With BodyMap */}
            <div style={{ background: '#ECFDF5', padding: '40px', borderRadius: '16px', border: '2px solid #6EE7B7' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: C.green, marginBottom: '16px' }}>✅ WITH BODYMAP</div>
              <h3 style={{ fontSize: '24px', fontWeight: '700', color: C.darkGray, marginBottom: '24px' }}>
                60-Minute Session Breakdown
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #A7F3D0' }}>
                  <span style={{ color: C.gray }}>Review visual intake</span>
                  <span style={{ fontWeight: '700', color: C.green }}>2 min</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #A7F3D0' }}>
                  <span style={{ color: C.gray }}>Hands-on therapy</span>
                  <span style={{ fontWeight: '700', color: C.darkGray }}>58 min</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: C.green }}>
                  <span>Client gets:</span>
                  <span>58 min of care</span>
                </div>
              </div>

              <div style={{ marginTop: '32px', padding: '20px', background: '#D1FAE5', borderRadius: '12px' }}>
                <div style={{ fontSize: '13px', color: C.green, marginBottom: '8px' }}>DAILY IMPACT (4 clients)</div>
                <div style={{ fontSize: '14px', color: '#047857', marginBottom: '8px' }}>
                  4 sessions × 8 min saved = <strong>32 min/day efficiency</strong>
                </div>
                <div style={{ fontSize: '13px', color: '#047857' }}>
                  32 min × $1/min = $32/day | $640/month (20 days)
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Line - Clear Equation */}
          <div style={{ background: `linear-gradient(135deg, ${C.forest} 0%, #1a3d2e 100%)`, padding: '48px', borderRadius: '16px', textAlign: 'center', color: 'white' }}>
            <div style={{ fontSize: '16px', opacity: 0.9, marginBottom: '24px' }}>THE COMPLETE EQUATION</div>
            <div style={{ fontSize: '20px', marginBottom: '32px', lineHeight: '1.8', opacity: 0.95 }}>
              <strong>4 clients</strong> × <strong>8 min saved</strong> = <strong>32 min/day</strong><br/>
              <strong>32 min</strong> × <strong>$1/min</strong> × <strong>20 days</strong> = <strong>$640/month</strong>
            </div>
            
            <div style={{ display: 'flex', gap: '48px', justifyContent: 'center', paddingTop: '32px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <div>
                <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>Monthly Time Efficiency</div>
                <div style={{ fontSize: '36px', fontWeight: '700' }}>640 min</div>
                <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '4px' }}>≈ 10.5 hours/month</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>Time Value</div>
                <div style={{ fontSize: '36px', fontWeight: '700' }}>$640</div>
                <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '4px' }}>at $1/minute</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>BodyMap Cost</div>
                <div style={{ fontSize: '36px', fontWeight: '700' }}>$24</div>
                <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '4px' }}>Silver plan</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '40px', background: C.lavenderPale, padding: '24px', borderRadius: '12px', border: `1px solid ${C.lavender}`, textAlign: 'center' }}>
            <p style={{ fontSize: '16px', color: C.darkGray, margin: 0, lineHeight: '1.6' }}>
              <strong>But remember:</strong> The real value isn't just time or money. It's the elevated client experience, the 2x retention rate, and the professional edge that sets you apart. The efficiency? That's the bonus.
            </p>
          </div>
        </div>
      </section>

      {/* What You Actually Get */}
      <section style={{ background: 'white', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', textAlign: 'center', color: C.darkGray, marginBottom: '16px' }}>
            What You Actually Get
          </h2>
          <p style={{ fontSize: '18px', color: C.gray, textAlign: 'center', marginBottom: '60px' }}>
            Beyond the numbers, here's how BodyMap changes your practice.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px' }}>
            {[
              {
                emoji: "👂",
                title: "Clients Feel Truly Heard",
                desc: "Visual body maps beat verbal descriptions every time. Preferences are remembered. No repeating themselves. They arrive knowing you understand their needs."
              },
              {
                emoji: "📈",
                title: "Predictable Revenue",
                desc: "2x repeat booking rate means you can actually forecast revenue. Loyal clients, consistent schedule, less time spent on acquisition."
              },
              {
                emoji: "🧠",
                title: "Pattern Intelligence",
                desc: "AI detects patterns you might miss. \"This client always needs hamstring work.\" Personalize treatment plans with data, not guesswork."
              },
              {
                emoji: "😌",
                title: "Zero Awkward Moments",
                desc: "No more rushed table conversations. No \"wait, where does it hurt again?\" No forgotten preferences. Just smooth, professional sessions."
              },
              {
                emoji: "⭐",
                title: "Better Reviews",
                desc: "\"She knew exactly what I needed.\" \"So organized and professional.\" \"Best massage I've ever had.\" The reviews write themselves."
              },
              {
                emoji: "💼",
                title: "Professional Edge",
                desc: "Stand out from the therapist down the street. Clients see you as modern, organized, data-driven. You're not just good - you're different."
              }
            ].map((item) => (
              <div key={item.title} style={{ background: C.lightGray, padding: '32px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>{item.emoji}</div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '15px', color: C.gray, lineHeight: '1.6', margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases by Practice Size */}
      <section style={{ background: C.lavenderPale, padding: '80px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', textAlign: 'center', color: C.darkGray, marginBottom: '60px' }}>
            Impact Across Practice Sizes
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {[
              {
                icon: "👤",
                title: "Solo Therapist (You)",
                cost: "$24/month Silver",
                math: "4 clients/day × 8 min × 20 days = 640 min/month",
                value: "$640 time value for $24 = 27x return",
                impact: "See one extra client per week with saved time. Or finish early and have life balance. Your choice."
              },
              {
                icon: "🏢",
                title: "Small Practice (3 therapists)",
                cost: "$49/month Gold",
                math: "3 therapists × 640 min = 1,920 min/month",
                value: "$1,920 time value for $49 = 39x return",
                impact: "Standardized intake across team. Consistent quality. Shared client insights. Professional brand."
              },
              {
                icon: "🏭",
                title: "Massage Chain (10+ locations)",
                cost: "Custom pricing",
                math: "50 therapists × 640 min = 32,000 min/month",
                value: "$32,000 time value across organization",
                impact: "Brand consistency at scale. Data-driven operations. Training tool for new therapists. Competitive advantage."
              }
            ].map((use) => (
              <div key={use.title} style={{ background: 'white', padding: '32px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
                  <div style={{ fontSize: '56px' }}>{use.icon}</div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '24px', fontWeight: '700', color: C.darkGray, marginBottom: '8px' }}>
                      {use.title}
                    </h3>
                    <div style={{ fontSize: '14px', color: C.lavender, fontWeight: '600', marginBottom: '16px' }}>
                      {use.cost}
                    </div>
                    <div style={{ background: C.lightGray, padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                      <div style={{ fontSize: '13px', color: C.gray, marginBottom: '8px', fontWeight: '600' }}>THE MATH:</div>
                      <div style={{ fontSize: '14px', color: C.darkGray, marginBottom: '8px' }}>{use.math}</div>
                      <div style={{ fontSize: '14px', color: C.green, fontWeight: '600' }}>{use.value}</div>
                    </div>
                    <p style={{ fontSize: '15px', color: C.gray, lineHeight: '1.6', margin: 0 }}>
                      <strong>Real Impact:</strong> {use.impact}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ background: 'white', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '48px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
            The Decision Is Simple
          </h2>
          <p style={{ fontSize: '18px', color: C.gray, marginBottom: '40px', lineHeight: '1.6' }}>
            Keep doing verbal intake and hoping clients remember to mention everything.<br/>
            Or give them a visual way to show you exactly what they need.
          </p>
          
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '24px' }}>
            <Link to="/#demo" style={{
              background: C.sage,
              color: 'white',
              padding: '16px 40px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '18px',
              fontWeight: '600'
            }}>See How It Works</Link>
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
            No credit card. No commitment. See the difference yourself.
          </p>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
