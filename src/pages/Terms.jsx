import React from 'react';
const C = { forest: '#2A5741', darkGray: '#1F2937', gray: '#6B7280', lightGray: '#F9FAFB', border: '#E5E7EB' };
export default function Terms() {
  const items = [
    { title: '1. What BodyMap Is', body: 'BodyMap is a client communication and intake management tool for licensed massage therapists. It is NOT a medical platform, EHR, or HIPAA-covered entity. Therapists are solely responsible for all clinical decisions.' },
    { title: '2. Eligibility', body: 'You must be at least 18 years old to use BodyMap. By using this platform you represent that you are a licensed wellness professional or a client of one.' },
    { title: '3. Your Account', body: 'You are responsible for maintaining confidentiality of your login credentials. Notify us at support@mybodymap.app if you suspect unauthorized access.' },
    { title: '4. Acceptable Use', body: 'You agree not to use BodyMap to collect data for unauthorized purposes, access another user\'s data, reverse engineer the platform, or use it for any unlawful purpose.' },
    { title: '5. Subscription and Payments', body: 'Paid plans are billed monthly through Stripe. Cancel anytime — access continues until end of billing period. No refunds for partial periods.' },
    { title: '6. Client Data Responsibility', body: 'As a therapist, you are the data controller for your clients information. You are responsible for obtaining client consent to store their intake data on BodyMap.' },
    { title: '7. Not Medical Software', body: 'BodyMap is a communication tool, not medical software. It is not designed to store protected health information (PHI) under HIPAA. BodyMap LLC does not sign Business Associate Agreements (BAAs).' },
    { title: '8. Limitation of Liability', body: 'BodyMap LLC shall not be liable for any indirect, incidental, or consequential damages. Our total liability shall not exceed the amount you paid us in the 12 months preceding any claim.' },
    { title: '9. Intellectual Property', body: 'All platform content, design, and software are owned by BodyMap LLC. You may not copy, modify, or distribute any part of the platform without written permission.' },
    { title: '10. Termination', body: 'You may close your account at any time by emailing support@mybodymap.app. Data is retained for 30 days then permanently deleted.' },
    { title: '11. Governing Law', body: 'These terms are governed by the laws of the State of Wyoming. Disputes shall be resolved in the courts of Sheridan County, Wyoming.' },
    { title: '12. Arbitration & Dispute Resolution', body: 'Any dispute arising out of these Terms shall be resolved by binding arbitration under AAA rules, rather than in court. The arbitration shall take place in Sheridan County, Wyoming.' },
    { title: '13. Changes', body: 'We may update these terms and will notify you of material changes by email or platform notice.' },
    { title: '14. Contact', body: 'BodyMap LLC\nsupport@mybodymap.app\nmybodymap.app' },
  ];
  return (
    <div style={{ background: C.lightGray, minHeight: '100vh', padding: '60px 24px' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto 24px auto' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <span style={{ fontSize: '22px' }}>🌿</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#2A5741', letterSpacing: '-0.3px' }}>BodyMap</span>
        </a>
      </div>
      <div style={{ maxWidth: '780px', margin: '0 auto', background: 'white', borderRadius: '16px', padding: '56px 64px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '13px', color: C.gray, marginBottom: '8px' }}>Last updated: March 2026</div>
          <h1 style={{ fontSize: '36px', fontWeight: '700', color: C.darkGray, margin: '0 0 12px 0' }}>Terms of Service</h1>
          <p style={{ fontSize: '16px', color: C.gray, lineHeight: '1.6', margin: 0 }}>These Terms of Service govern your use of BodyMap, operated by BodyMap LLC, a Wyoming limited liability company.</p>
        </div>
        {items.map((s) => (
          <div key={s.title} style={{ marginBottom: '36px', paddingBottom: '36px', borderBottom: '1px solid ' + C.border }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: C.darkGray, margin: '0 0 12px 0' }}>{s.title}</h2>
            <p style={{ fontSize: '15px', color: C.gray, lineHeight: '1.7', margin: 0, whiteSpace: 'pre-line' }}>{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
