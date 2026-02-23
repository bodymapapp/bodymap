import React from 'react';
import { Link } from 'react-router-dom';

export default function Contact() {
  const C = {
    sage: '#6B9E80',
    forest: '#2A5741',
    lavender: '#B4A7D6',
    lavenderPale: '#F3F1F9',
    gray: '#6B7280',
    darkGray: '#1F2937',
    lightGray: '#F9FAFB'
  };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <nav style={{ 
        background: 'white', 
        borderBottom: '1px solid #e5e7eb', 
        padding: '16px 0',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <span style={{ fontSize: '28px' }}>🌿</span>
            <span style={{ fontSize: '24px', fontWeight: '700', color: C.forest }}>BodyMap</span>
          </Link>
          <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
            <Link to="/" style={{ color: C.gray, textDecoration: 'none', fontWeight: '500' }}>Home</Link>
            <Link to="/pricing" style={{ color: C.gray, textDecoration: 'none', fontWeight: '500' }}>Pricing</Link>
            <Link to="/signup" style={{ 
              background: C.sage, 
              color: 'white', 
              padding: '10px 20px', 
              borderRadius: '8px', 
              textDecoration: 'none',
              fontWeight: '600'
            }}>Start Free Trial</Link>
          </div>
        </div>
      </nav>

      <section style={{ padding: '80px 24px', background: C.lightGray, minHeight: '70vh' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '700', color: C.darkGray, marginBottom: '16px', textAlign: 'center' }}>
            Get in Touch
          </h1>
          <p style={{ fontSize: '18px', color: C.gray, textAlign: 'center', marginBottom: '48px' }}>
            Questions? Feedback? Enterprise pricing? We'd love to hear from you.
          </p>

          <div style={{ background: 'white', borderRadius: '12px', padding: '48px', border: '1px solid #E5E7EB' }}>
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
                Email Us
              </h3>
              <a href="mailto:hello@mybodymap.app" style={{ 
                fontSize: '18px', 
                color: C.sage, 
                textDecoration: 'none',
                fontWeight: '600'
              }}>
                hello@mybodymap.app
              </a>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
                Response Time
              </h3>
              <p style={{ fontSize: '16px', color: C.gray, lineHeight: '1.6' }}>
                We typically respond within 24 hours during business days (Monday-Friday, 9am-5pm CST).
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>
                Enterprise & Schools
              </h3>
              <p style={{ fontSize: '16px', color: C.gray, lineHeight: '1.6', marginBottom: '16px' }}>
                Looking for volume discounts for massage chains or schools? Email us with:
              </p>
              <ul style={{ fontSize: '15px', color: C.gray, lineHeight: '1.8', paddingLeft: '24px' }}>
                <li>Number of therapists/students</li>
                <li>Number of locations (if applicable)</li>
                <li>Any specific feature needs</li>
              </ul>
            </div>
          </div>

          <div style={{ marginTop: '40px', textAlign: 'center' }}>
            <Link to="/" style={{ color: C.sage, textDecoration: 'none', fontWeight: '600' }}>
              ← Back to Home
            </Link>
          </div>
        </div>
      </section>

      <footer style={{ background: C.darkGray, color: 'white', padding: '40px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', opacity: 0.6 }}>
            © 2026 BodyMap LLC. Made with 🌿 for massage therapists.
          </div>
        </div>
      </footer>
    </div>
  );
}
