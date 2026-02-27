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
          <h2 style={{ fontSize: '48px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
            Elevate Every Client Experience
          </h2>
          <p style={{ fontSize: '20px', color: C.gray, marginBottom: '40px', lineHeight: '1.6' }}>
            Your clients visualize their needs in 60 seconds.<br/>
            You deliver personalized, data-driven sessions.<br/>
            They remember the experience. They come back.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '60px' }}>
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

      {/* How It Works - MOVED UP */}
      <section id="demo" style={{ background: C.lavenderPale, padding: '80px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '42px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
            How BodyMap Works
          </h2>
          <p style={{ fontSize: '18px', color: C.gray, marginBottom: '60px' }}>
            Three simple steps. Zero complexity. Immediate impact.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px', marginBottom: '60px' }}>
            {[
              {
                num: "1",
                title: "Share Your Link",
                desc: "Text or email your custom BodyMap link to clients",
                detail: "mybodymap.app/yourbusiness",
                image: "📱"
              },
              {
                num: "2",
                title: "Client Fills Visual Intake",
                desc: "They tap their body map and set preferences in 60 seconds",
                detail: "Works on any phone. No app needed.",
                image: "🗺️"
              },
              {
                num: "3",
                title: "You See Their Needs",
                desc: "Review their visual map and preferences on your dashboard",
                detail: "Personalized session ready to go.",
                image: "💻"
              }
            ].map((step) => (
              <div key={step.num} style={{ textAlign: 'center' }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '50%', 
                  background: C.lavender,
                  color: 'white',
                  fontSize: '24px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px'
                }}>
                  {step.num}
                </div>
                <div style={{ fontSize: '56px', marginBottom: '16px' }}>{step.image}</div>
                <h3 style={{ fontSize: '22px', fontWeight: '700', color: C.darkGray, marginBottom: '12px' }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: '16px', color: C.gray, lineHeight: '1.5', marginBottom: '8px' }}>
                  {step.desc}
                </p>
                <p style={{ fontSize: '14px', color: '#9CA3AF', fontStyle: 'italic' }}>
                  {step.detail}
                </p>
              </div>
            ))}
          </div>

          {/* Screenshot Demo Placeholder */}
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '40px',
            border: '1px solid #E5E7EB',
            marginBottom: '20px'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, marginBottom: '24px' }}>
              See BodyMap in Action
            </h3>
            <div style={{ 
              background: C.lightGray,
              borderRadius: '8px',
              padding: '80px 40px',
              border: '2px dashed #D1D5DB',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📸</div>
              <p style={{ fontSize: '16px', color: C.gray, marginBottom: '8px' }}>
                Demo screenshots coming here
              </p>
              <p style={{ fontSize: '14px', color: '#9CA3AF' }}>
                (Client intake flow → Body map interface → Therapist dashboard)
              </p>
            </div>
          </div>
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
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center', marginBottom: '60px' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: C.sage, marginBottom: '12px' }}>⚡ BENEFIT #3</div>
              <h3 style={{ fontSize: '32px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
                Give Clients 8 Extra Minutes
              </h3>
              <p style={{ fontSize: '18px', color: C.gray, lineHeight: '1.6', marginBottom: '24px' }}>
                Review their visual intake in 2 minutes. Spend the other 58 minutes on hands-on therapy. No rushed table conversations. Full session time for what matters most.
              </p>
              <div style={{ background: C.lightGray, borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '13px', color: C.gray, marginBottom: '8px' }}>Time Breakdown Per Session:</div>
                <div style={{ fontSize: '14px', color: C.darkGray, lineHeight: '1.8' }}>
                  • Quick review: 2 min<br/>
                  • Hands-on therapy: 58 min<br/>
                  • <strong>8 extra minutes of care</strong>
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
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
            {[
              {
                emoji: "🗺️",
                title: "Visual Body Maps",
                desc: "Front & back body diagrams. Clients tap to mark focus/avoid areas. Clear visual communication beats verbal every time."
              },
              {
                emoji: "🧠",
                title: "AI Session Intelligence",
                desc: "Pattern detection across sessions. \"Client often requests lower back + hamstring work.\" Gets smarter over time."
              },
              {
                emoji: "📊",
                title: "Session History",
                desc: "Track client preferences over time. See what worked last session. Build long-term relationships with data."
              },
              {
                emoji: "⚡",
                title: "Works in 60 Seconds",
                desc: "No app download required. Works on any phone. Simple for clients of all ages and tech comfort levels."
              },
              {
                emoji: "💜",
                title: "Client Loyalty Built-In",
                desc: "Automatic session tracking. Reward repeat clients. You set the rules (10 sessions = 1 free). We handle the counting."
              },
              {
                emoji: "📱",
                title: "Mobile-First Design",
                desc: "Works perfectly on phones, tablets, and desktop. Your clients can fill it anywhere. You can review anywhere."
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
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px' }}>
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
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }}>
            {[
              { name: "Bronze", price: "$0", clients: "5 clients/month", cta: "Start Free", badge: "🥉" },
              { name: "Silver", price: "$24", clients: "Unlimited clients", cta: "Start Trial", badge: "🥈", popular: true },
              { name: "Gold", price: "$49", clients: "Up to 5 therapists", cta: "Start Trial", badge: "🥇" }
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
                <Link to="/signup" style={{
                  display: 'block',
                  background: tier.popular ? C.lavender : 'white',
                  color: tier.popular ? 'white' : C.lavender,
                  border: tier.popular ? 'none' : `2px solid ${C.lavender}`,
                  padding: '12px 24px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {tier.cta}
                </Link>
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
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '24px' }}>
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
