import React from 'react';
const C = { forest: '#2A5741', darkGray: '#1F2937', gray: '#6B7280', lightGray: '#F9FAFB', border: '#E5E7EB' };
export default function Terms() {
  const items = [
    { title: '1. What MyBodyMap Is', body: 'MyBodyMap is a client communication and intake management tool for licensed massage therapists. It is NOT a medical platform, EHR, or HIPAA-covered entity. Therapists are solely responsible for all clinical decisions.' },
    { title: '2. Eligibility', body: 'You must be at least 18 years old to use MyBodyMap. By using this platform you represent that you are a licensed wellness professional or a client of one.' },
    { title: '3. Your Account', body: 'You are responsible for maintaining confidentiality of your login credentials. Notify us at support@mybodymap.app if you suspect unauthorized access.' },
    { title: '4. Acceptable Use', body: 'You agree not to use MyBodyMap to collect data for unauthorized purposes, access another user\'s data, reverse engineer the platform, or use it for any unlawful purpose.' },
    { title: '5. Subscription and Payments', body: 'Paid plans are billed monthly through Stripe. Cancel anytime - access continues until end of billing period. No refunds for partial periods.' },
    { title: '6. SMS Communications', body: 'When you provide your phone number on a MyBodyMap booking page or therapist signup form and explicitly check the SMS consent checkbox, you agree to receive SMS messages from your therapist via the MyBodyMap platform. SMS consent is given directly to MyBodyMap and is voluntary; it is not bundled with, conditional on, or required by any third-party agreement or by completion of the booking itself. You may complete a booking without consenting to SMS, in which case no text messages will be sent to you. These messages may include appointment reminders, booking confirmations, post-session follow-ups, and re-engagement messages. Therapist accounts may also receive product updates, onboarding tips, and account messages from MyBodyMap directly.\n\nMessage frequency varies based on your booking activity (typically 2-6 messages per month per therapist relationship). Message and data rates may apply, charged by your mobile carrier. We do not charge for SMS.\n\nYou can opt out at any time by replying STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, or QUIT to any message. After opting out, you will receive one final confirmation message and no further texts. To re-subscribe, reply START. For help, reply HELP or email support@mybodymap.app.\n\nNo mobile information will be shared with third parties or affiliates for marketing or promotional purposes. We will never sell your phone number, share it with third parties for marketing, or use it for purposes outside the booking and communication features of the platform. SMS opt-in data and consent records are not shared across therapist accounts, not used to train AI, and not shared with any third party for any reason.' },
    { title: '7. Client Data Responsibility', body: 'As a therapist, you are the data controller for your clients information. You are responsible for obtaining client consent to store their intake data on MyBodyMap.' },
    { title: '8. Not Medical Software', body: 'MyBodyMap is a communication tool, not medical software. It is not designed to store protected health information (PHI) under HIPAA. BodyMap LLC does not sign Business Associate Agreements (BAAs).' },
    { title: '9. Limitation of Liability', body: 'BodyMap LLC shall not be liable for any indirect, incidental, or consequential damages. Our total liability shall not exceed the amount you paid us in the 12 months preceding any claim.' },
    { title: '10. Intellectual Property', body: 'All platform content, design, and software are owned by BodyMap LLC. You may not copy, modify, or distribute any part of the platform without written permission.' },
    { title: '11. Termination', body: 'You may close your account at any time by emailing support@mybodymap.app. Data is retained for 30 days then permanently deleted.' },
    { title: '12. Governing Law', body: 'These terms are governed by the laws of the State of Wyoming. Disputes shall be resolved in the courts of Sheridan County, Wyoming.' },
    { title: '13. Arbitration & Dispute Resolution', body: 'Any dispute arising out of these Terms shall be resolved by binding arbitration under AAA rules, rather than in court. The arbitration shall take place in Sheridan County, Wyoming.' },
    { title: '14. Changes', body: 'We may update these terms and will notify you of material changes by email or platform notice.' },
    { title: '15. Contact', body: 'BodyMap LLC\nsupport@mybodymap.app\nmybodymap.app' },
  ];
  return (
    <div style={{ background: C.lightGray, minHeight: '100vh', padding: '60px 24px' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto 24px auto' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <span style={{ fontSize: '22px' }}>🌿</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#2A5741', letterSpacing: '-0.3px' }}>MyBodyMap</span>
        </a>
      </div>
      <div style={{ maxWidth: '780px', margin: '0 auto', background: 'white', borderRadius: '16px', padding: '56px 64px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '13px', color: C.gray, marginBottom: '8px' }}>Last updated: May 2026</div>
          <h1 style={{ fontSize: '36px', fontWeight: '700', color: C.darkGray, margin: '0 0 12px 0' }}>Terms of Service</h1>
          <p style={{ fontSize: '16px', color: C.gray, lineHeight: '1.6', margin: 0 }}>These Terms of Service govern your use of MyBodyMap, operated by BodyMap LLC, a Wyoming limited liability company.</p>
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
