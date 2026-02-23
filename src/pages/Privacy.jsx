import React from 'react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  const C = { sage: '#6B9E80', forest: '#2A5741', gray: '#6B7280', darkGray: '#1F2937', lightGray: '#F9FAFB' };
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
        <h1 style={{ fontSize: '48px', fontWeight: '700', marginBottom: '32px' }}>Privacy Policy</h1>
        <p style={{ color: C.gray, marginBottom: '32px' }}>Last updated: February 20, 2026</p>
        
        <div style={{ lineHeight: '1.8', color: C.darkGray }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>1. Information We Collect</h2>
          <p style={{ marginBottom: '16px' }}>We collect information you provide directly to us, including:</p>
          <ul style={{ marginBottom: '24px', paddingLeft: '24px' }}>
            <li>Account information (name, email, business name)</li>
            <li>Client intake preferences (body map selections, session preferences)</li>
            <li>Session history and notes</li>
            <li>Payment information (processed securely through Stripe)</li>
          </ul>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>2. How We Use Your Information</h2>
          <p style={{ marginBottom: '16px' }}>We use the information we collect to:</p>
          <ul style={{ marginBottom: '24px', paddingLeft: '24px' }}>
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and send related information</li>
            <li>Send technical notices and support messages</li>
            <li>Respond to your comments and questions</li>
          </ul>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>3. Data Security</h2>
          <p style={{ marginBottom: '24px' }}>We use industry-standard encryption to protect your data both in transit (SSL) and at rest. Only you and your authorized clients can access your practice data.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>4. Data Sharing</h2>
          <p style={{ marginBottom: '24px' }}>We do not sell, trade, or rent your personal information to third parties. We may share data only with service providers who help us operate our business (hosting, payment processing) under strict confidentiality agreements.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>5. Your Rights</h2>
          <p style={{ marginBottom: '16px' }}>You have the right to:</p>
          <ul style={{ marginBottom: '24px', paddingLeft: '24px' }}>
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Export your data</li>
            <li>Opt out of marketing communications</li>
          </ul>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>6. HIPAA Compliance</h2>
          <p style={{ marginBottom: '24px' }}>BodyMap is a communication tool for intake preferences, not medical software. It does not store protected health information (PHI) and does not require HIPAA compliance. Your existing practice management software should be used for any HIPAA-regulated data.</p>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '32px', marginBottom: '16px' }}>7. Contact Us</h2>
          <p style={{ marginBottom: '24px' }}>If you have questions about this Privacy Policy, please contact us at: <a href="mailto:privacy@mybodymap.app" style={{ color: C.sage }}>privacy@mybodymap.app</a></p>
        </div>

        <div style={{ marginTop: '48px', textAlign: 'center' }}>
          <Link to="/" style={{ color: C.sage, textDecoration: 'none', fontWeight: '600' }}>← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
