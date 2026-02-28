import Nav from '../components/Nav';
import Footer from '../components/Footer';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState('monthly');

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
    green: '#059669'
  };

  const tiers = [
    {
      name: "Bronze",
      badge: "🥉",
      price: { monthly: 0, annual: 0 },
      clients: "5 clients/month",
      tagline: "Perfect for new therapists",
      features: [
        "Visual body maps (front + back)",
        "Client preferences (pressure, music, temp, draping)",
        "Medical flag alerts",
        "Session history (last 10 sessions)",
        "Post-session feedback collection",
        "Print session brief"
      ],
      cta: "Start Free",
      ctaLink: "/signup"
    },
    {
      name: "Silver",
      badge: "🥈",
      price: { monthly: 24, annual: 19 },
      clients: "Unlimited clients",
      tagline: "Perfect for established therapists",
      popular: true,
      features: [
        "Everything in Bronze",
        "Unlimited clients & sessions",
        "Body map heatmap overlay",
        "Pattern confidence scores with progress bars",
        "Full session history (unlimited)",
        "Client Loyalty Program (coming soon)",
        "Priority email support (24hr)"
      ],
      cta: "Start 14-Day Free Trial",
      ctaLink: "/signup?plan=silver"
    },
    {
      name: "Gold",
      badge: "🥇",
      price: { monthly: 49, annual: 39 },
      clients: "Up to 5 therapists",
      tagline: "Perfect for small practices",
      features: [
        "Everything in Silver",
        "Up to 5 therapist accounts",
        "Shared client database",
        "Team dashboard",
        "Custom intake questions",
        "Priority support (12hr response)"
      ],
      cta: "Coming Soon",
      ctaLink: "/signup?plan=gold",
      comingSoon: true
    }
  ];

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <style>{`
        @media (max-width: 768px) {
          .bm-tiers { grid-template-columns: 1fr !important; }
          .bm-loyalty { grid-template-columns: 1fr !important; }
          .bm-table-wrap { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
          .bm-table-wrap table { min-width: 500px; }
          .bm-pricing-hero h1 { font-size: 36px !important; }
          .bm-faq { padding: 48px 16px !important; }
          .bm-section-pad { padding: 48px 16px !important; }
        }
      `}</style>
      
      {/* Header */}
      <Nav />

      {/* Hero */}
      <section style={{ background: `linear-gradient(135deg, ${C.sage} 0%, ${C.forest} 100%)`, padding: '80px 24px', textAlign: 'center', color: 'white' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '56px', fontWeight: '700', marginBottom: '16px' }}>
            Simple, Transparent Pricing
          </h1>
          <p style={{ fontSize: '20px', opacity: 0.95, marginBottom: '40px' }}>
            Start free. Upgrade anytime. Cancel anytime.
          </p>
          
          {/* Billing Toggle */}
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.2)', borderRadius: '12px', padding: '4px' }}>
            <button
              onClick={() => setBillingCycle('monthly')}
              style={{
                background: billingCycle === 'monthly' ? 'white' : 'transparent',
                color: billingCycle === 'monthly' ? C.forest : 'white',
                border: 'none',
                padding: '12px 32px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              style={{
                background: billingCycle === 'annual' ? 'white' : 'transparent',
                color: billingCycle === 'annual' ? C.forest : 'white',
                border: 'none',
                padding: '12px 32px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative'
              }}
            >
              Annual
              <span style={{ 
                position: 'absolute', 
                top: '-8px', 
                right: '-8px', 
                background: '#FBBF24', 
                color: '#92400E', 
                fontSize: '10px', 
                padding: '2px 6px', 
                borderRadius: '4px',
                fontWeight: '700'
              }}>
                SAVE 20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Tiers */}
      <section style={{ background: 'white', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="bm-tiers" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', marginBottom: '80px' }}>
            {tiers.map((tier) => {
              const price = billingCycle === 'monthly' ? tier.price.monthly : tier.price.annual;
              return (
                <div key={tier.name} style={{ 
                  background: tier.popular ? C.lavenderPale : C.lightGray,
                  border: tier.popular ? `3px solid ${C.lavender}` : '1px solid #E5E7EB',
                  borderRadius: '16px',
                  padding: '40px 32px',
                  position: 'relative',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                >
                  {tier.popular && (
                    <div style={{
                      position: 'absolute',
                      top: '-16px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: C.lavender,
                      color: 'white',
                      padding: '6px 20px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '700',
                      letterSpacing: '0.5px'
                    }}>MOST POPULAR</div>
                  )}
                  
                  <div style={{ fontSize: '48px', marginBottom: '12px', textAlign: 'center' }}>{tier.badge}</div>
                  
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '24px', fontWeight: '700', color: C.darkGray, marginBottom: '8px' }}>
                      {tier.name}
                    </h3>
                    <div style={{ fontSize: '48px', fontWeight: '700', color: C.lavender, marginBottom: '4px' }}>
                      ${price}
                    </div>
                    <div style={{ fontSize: '14px', color: C.gray }}>
                      per {billingCycle === 'monthly' ? 'month' : 'month, billed annually'}
                    </div>
                    {billingCycle === 'annual' && tier.price.annual > 0 && (
                      <div style={{ fontSize: '12px', color: C.green, marginTop: '4px', fontWeight: '600' }}>
                        Save ${(tier.price.monthly - tier.price.annual) * 12}/year
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '14px', color: C.gray, textAlign: 'center', marginBottom: '24px', minHeight: '60px' }}>
                    <div style={{ fontWeight: '600', color: C.darkGray, marginBottom: '4px' }}>{tier.clients}</div>
                    <div style={{ fontSize: '13px' }}>{tier.tagline}</div>
                  </div>

                  {tier.comingSoon ? (
                    <div style={{ display: 'block', background: '#F3F4F6', color: '#9CA3AF', border: '2px solid #E5E7EB', padding: '14px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '700', textAlign: 'center', marginBottom: '32px', cursor: 'not-allowed' }}>
                      🔒 Coming Soon — Join Waitlist
                    </div>
                  ) : (
                    <Link to={tier.ctaLink} style={{
                      display: 'block',
                      background: tier.popular ? C.lavender : 'white',
                      color: tier.popular ? 'white' : C.lavender,
                      border: tier.popular ? 'none' : `2px solid ${C.lavender}`,
                      padding: '14px 24px',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontSize: '15px',
                      fontWeight: '600',
                      textAlign: 'center',
                      marginBottom: '32px'
                    }}>
                      {tier.cta}
                    </Link>
                  )}

                  <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '24px' }}>
                    {tier.features.map((feature, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '12px', fontSize: '14px' }}>
                        <span style={{ color: C.green, fontWeight: '700' }}>✓</span>
                        <span style={{ color: '#374151' }}>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Enterprise */}
          <div style={{ 
            background: C.lightGray,
            borderRadius: '16px', 
            padding: '48px',
            textAlign: 'center',
            border: '1px solid #E5E7EB'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💼</div>
            <h3 style={{ fontSize: '32px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>Enterprise</h3>
            <p style={{ fontSize: '18px', color: C.gray, marginBottom: '32px', maxWidth: '600px', margin: '0 auto 32px' }}>
              For massage chains (10+ locations) and massage schools
            </p>
            <div style={{ background: 'white', borderRadius: '12px', padding: '32px', maxWidth: '700px', margin: '0 auto 32px' }}>
              <p style={{ fontSize: '16px', color: C.darkGray, marginBottom: '16px' }}>
                <strong>Coming Soon:</strong> Multi-location dashboards and school-wide licenses
              </p>
              <p style={{ fontSize: '14px', color: C.gray }}>
                For now, contact us for volume discounts on individual therapist accounts.
              </p>
            </div>
            <Link to="/contact" style={{
              display: 'inline-block',
              background: C.sage,
              color: 'white',
              padding: '16px 40px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Contact for Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section style={{ background: C.lightGray, padding: '80px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '36px', fontWeight: '700', textAlign: 'center', marginBottom: '48px', color: C.darkGray }}>
            Feature Comparison
          </h2>
          
          <div className="bm-table-wrap"><div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.lightGray }}>
                  <th style={{ padding: '20px', textAlign: 'left', fontWeight: '600', color: C.darkGray, borderBottom: '1px solid #E5E7EB' }}>Feature</th>
                  <th style={{ padding: '20px', textAlign: 'center', fontWeight: '600', color: C.darkGray, borderBottom: '1px solid #E5E7EB' }}>Bronze</th>
                  <th style={{ padding: '20px', textAlign: 'center', fontWeight: '600', color: C.darkGray, borderBottom: '1px solid #E5E7EB' }}>Silver</th>
                  <th style={{ padding: '20px', textAlign: 'center', fontWeight: '600', color: C.darkGray, borderBottom: '1px solid #E5E7EB' }}>Gold</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Client intakes/month", values: ["5", "∞", "∞"] },
                  { feature: "Visual body maps (front + back)", values: ["✓", "✓", "✓"] },
                  { feature: "Client preferences & medical flags", values: ["✓", "✓", "✓"] },
                  { feature: "Post-session feedback collection", values: ["✓", "✓", "✓"] },
                  { feature: "Print session brief", values: ["✓", "✓", "✓"] },
                  { feature: "Session history", values: ["10 sessions", "∞", "∞"] },
                  { feature: "Heatmap pattern overlay", values: ["—", "✓", "✓"] },
                  { feature: "Pattern confidence scores", values: ["—", "✓", "✓"] },
                  { feature: "Client Loyalty Program", values: ["—", "Soon", "Soon"] },
                  { feature: "Priority email support", values: ["—", "24hr", "12hr"] },
                  { feature: "Therapist accounts", values: ["1", "1", "5"] },
                  { feature: "Shared client database", values: ["—", "—", "✓"] },
                  { feature: "Team dashboard", values: ["—", "—", "✓"] },
                  { feature: "Custom intake questions", values: ["—", "—", "✓"] }
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '16px 20px', color: '#374151', fontWeight: '500' }}>{row.feature}</td>
                    {row.values.map((val, vidx) => (
                      <td key={vidx} style={{ padding: '16px 20px', textAlign: 'center', color: val === "✓" ? C.green : val === "—" ? '#D1D5DB' : '#374151', fontWeight: val === "✓" ? '700' : '400' }}>
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        </div>
      </section>

      {/* Client Loyalty - PROMINENT */}
      <section style={{ background: 'white', padding: '80px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>💜</div>
          <h2 style={{ fontSize: '42px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
            Client Loyalty Built Right In
          </h2>
          <p style={{ fontSize: '18px', color: C.gray, marginBottom: '48px' }}>
            Reward repeat clients automatically. Boost retention without extra work.
          </p>

          <div className="bm-loyalty" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '48px' }}>
            <div style={{ background: C.lavenderPale, padding: '32px', borderRadius: '12px', border: `1px solid ${C.lavenderMid}`, textAlign: 'left' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, marginBottom: '20px' }}>
                How It Works
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '15px', color: C.gray }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: C.lavender, fontWeight: '700' }}>1.</span>
                  <span>You set the rules in your dashboard (e.g., "10 sessions = 1 free")</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: C.lavender, fontWeight: '700' }}>2.</span>
                  <span>BodyMap automatically tracks every session</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: C.lavender, fontWeight: '700' }}>3.</span>
                  <span>When clients hit the milestone, you're notified</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: C.lavender, fontWeight: '700' }}>4.</span>
                  <span>Reward them with their free session</span>
                </div>
              </div>
            </div>

            <div style={{ background: C.lightGray, padding: '32px', borderRadius: '12px', border: '1px solid #E5E7EB', textAlign: 'left' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, marginBottom: '20px' }}>
                The Results
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: C.lavender, marginBottom: '4px' }}>2x</div>
                  <div style={{ fontSize: '14px', color: C.gray }}>Higher client retention vs. no loyalty program</div>
                </div>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: C.lavender, marginBottom: '4px' }}>78%</div>
                  <div style={{ fontSize: '14px', color: C.gray }}>Of clients complete loyalty cycle and return</div>
                </div>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: C.lavender, marginBottom: '4px' }}>$0</div>
                  <div style={{ fontSize: '14px', color: C.gray }}>Extra work for you - it's automatic</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: '#FFFBEB', padding: '20px', borderRadius: '12px', border: '1px solid #FDE68A' }}>
            <p style={{ fontSize: '14px', color: '#92400E', margin: 0 }}>
              <strong>🚧 Coming Soon — Silver & Gold plans.</strong> Be among the first to use it. Sign up now and you'll get access the day it launches.
            </p>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section style={{ background: C.lightGray, padding: '80px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '36px', fontWeight: '700', textAlign: 'center', marginBottom: '48px', color: C.darkGray }}>
            Frequently Asked Questions
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {[
              {
                q: "Can I upgrade/downgrade anytime?",
                a: "Yes. Changes take effect immediately. Prorated refunds for downgrades."
              },
              {
                q: "Is there a setup fee?",
                a: "No setup fees. Ever."
              },
              {
                q: "What if I go over my client limit on Bronze?",
                a: "You'll get a prompt to upgrade. Your account won't be locked - you can still use BodyMap."
              },
              {
                q: "Do my clients pay anything?",
                a: "No. Clients use BodyMap completely free. You pay the subscription, they fill out the intake."
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes. No contracts. No penalties. Export your data anytime before you cancel."
              },
              {
                q: "Is BodyMap HIPAA compliant?",
                a: "BodyMap is a communication tool for intake preferences, not medical software. It doesn't require HIPAA compliance. Your existing practice management software handles protected health information (PHI). BodyMap just collects preferences like pressure, music, and body areas."
              },
              {
                q: "How secure is my data?",
                a: "All data is encrypted in transit (SSL) and at rest. We use industry-standard security practices. Only you and your clients can access your practice data. We never sell or share your information."
              },
              {
                q: "Do you offer discounts for annual plans?",
                a: "Yes. Save 20% with annual billing on Silver and Gold plans."
              }
            ].map((faq, idx) => (
              <div key={idx} style={{ 
                background: 'white', 
                padding: '24px', 
                borderRadius: '12px',
                border: '1px solid #E5E7EB'
              }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: C.darkGray, marginBottom: '8px' }}>
                  {faq.q}
                </h3>
                <p style={{ fontSize: '15px', color: C.gray, margin: 0, lineHeight: '1.6' }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: `linear-gradient(135deg, ${C.sage} 0%, ${C.forest} 100%)`, padding: '80px 24px', textAlign: 'center', color: 'white' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', marginBottom: '16px' }}>
            Ready to get started?
          </h2>
          <p style={{ fontSize: '18px', opacity: 0.95, marginBottom: '32px' }}>
            Start free. Upgrade when you're ready. Cancel anytime.
          </p>
          <Link to="/signup" style={{
            display: 'inline-block',
            background: 'white',
            color: C.forest,
            padding: '16px 40px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '18px',
            fontWeight: '600'
          }}>
            Start Free Trial →
          </Link>
          <p style={{ fontSize: '14px', opacity: 0.8, marginTop: '16px' }}>
            No credit card required
          </p>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
