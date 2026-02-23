import React from 'react';
import { Link } from 'react-router-dom';

export default function Terms() {
  const C = { sage: '#6B9E80', forest: '#2A5741', gray: '#6B7280', darkGray: '#1F2937' };
  return (
    <div style={{ fontFamily: '-apple-system, sans-serif' }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <span style={{ fontSize: '28px' }}>🌿</span>
            <span style={{ fontSize: '24px', fontWeight: '700', color: C.forest }}>BodyMap</span>
          </Link>
        </div>
      </nav>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '80px 24px' }}>
        <h1 style={{ fontSize: '48px', fontWeight: '700', marginBottom: '32px' }}>Terms of Service</h1>
        <p style={{ color: C.gray, marginBottom: '32px' }}>Last updated: February 20, 2026</p>
        
        <div style={{ lineHeight: '1.8', color: C.darkGray }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>1. Acceptance of Terms</h2>
          <p style={{ marginBottom: '24px' }}>By accessing and using BodyMap, you accept and agree to be bound by these Terms of Service. If you do not agree, do not use our services.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>2. Description of Service</h2>
          <p style={{ marginBottom: '24px' }}>BodyMap provides client intake management software for massage therapists. Our service allows therapists to collect visual body maps and preferences from clients before sessions.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>3. User Accounts</h2>
          <p style={{ marginBottom: '16px' }}>You are responsible for:</p>
          <ul style={{ marginBottom: '24px', paddingLeft: '24px' }}>
            <li>Maintaining the confidentiality of your account</li>
            <li>All activities that occur under your account</li>
            <li>Notifying us immediately of any unauthorized use</li>
          </ul>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>4. Acceptable Use</h2>
          <p style={{ marginBottom: '16px' }}>You agree not to:</p>
          <ul style={{ marginBottom: '24px', paddingLeft: '24px' }}>
            <li>Use the service for any illegal purpose</li>
            <li>Violate any laws in your jurisdiction</li>
            <li>Infringe on intellectual property rights</li>
            <li>Transmit malicious code or viruses</li>
            <li>Attempt to gain unauthorized access to our systems</li>
          </ul>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>5. Payment Terms</h2>
          <p style={{ marginBottom: '16px' }}>Subscription fees:</p>
          <ul style={{ marginBottom: '24px', paddingLeft: '24px' }}>
            <li>Billed monthly or annually based on your selection</li>
            <li>Charged automatically until you cancel</li>
            <li>Non-refundable except as required by law</li>
            <li>Subject to change with 30 days notice</li>
          </ul>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>6. Cancellation</h2>
          <p style={{ marginBottom: '24px' }}>You may cancel your subscription at any time. Cancellation takes effect at the end of your current billing period. You can export your data before canceling.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>7. Disclaimer of Warranties</h2>
          <p style={{ marginBottom: '24px' }}>BodyMap is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free service. BodyMap is a communication tool, not medical software, and should not be used for medical diagnosis or treatment.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>8. Limitation of Liability</h2>
          <p style={{ marginBottom: '24px' }}>BodyMap LLC shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service. Our total liability shall not exceed the amount you paid us in the past 12 months.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>9. Changes to Terms</h2>
          <p style={{ marginBottom: '24px' }}>We reserve the right to modify these terms at any time. We will notify you of significant changes via email. Continued use after changes constitutes acceptance.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>10. Contact</h2>
          <p style={{ marginBottom: '24px' }}>Questions about these Terms? Contact us at: <a href="mailto:legal@mybodymap.app" style={{ color: C.sage }}>legal@mybodymap.app</a></p>
        </div>

        <div style={{ marginTop: '48px', textAlign: 'center' }}>
          <Link to="/" style={{ color: C.sage, textDecoration: 'none', fontWeight: '600' }}>← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
