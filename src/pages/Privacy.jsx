import React from 'react';
const C = { forest: '#2A5741', darkGray: '#1F2937', gray: '#6B7280', lightGray: '#F9FAFB', border: '#E5E7EB' };
export default function Privacy() {
  const items = [
    { title: '1. Who We Are', body: 'BodyMap LLC is a Wyoming limited liability company operating mybodymap.app. Contact us at support@mybodymap.app.' },
    { title: '2. What Data We Collect', body: 'Therapist data: name, business name, email, phone, license number. Payment data processed by Stripe - we never store card details.\n\nClient intake data: name, phone, body map selections, session preferences, massage goals, and health notes voluntarily provided.\n\nSession data: therapist notes, completion status, feedback, and session dates.\n\nUsage data: browser type, device type, pages visited - collected anonymously.' },
    { title: '3. How We Use Your Data', body: 'To operate the platform, enable session management, send intake links, process payments, improve features, and generate anonymized aggregate insights. We do not use your data for advertising. We do not sell your data. Ever.' },
    { title: '4. How Your Data Is Protected', body: 'BodyMap runs on Supabase with: AES-256 encryption at rest, TLS 1.3 encryption in transit, Row Level Security - each therapist can only access their own data, and SOC 2 Type II compliant infrastructure.' },
    { title: '5. Data Sharing', body: 'We do not sell or share your data. We share only with: Supabase (hosting), Stripe (payments), and SMS providers for intake links. All providers are contractually bound to protect your data.' },
    { title: '6. Client Data', body: 'Therapists are responsible for informing clients that intake data is stored digitally. Clients may request deletion by contacting their therapist or emailing support@mybodymap.app. We process requests within 30 days.' },
    { title: '7. Data Retention', body: 'Data is retained while your account is active. On closure, retained 30 days then permanently deleted.' },
    { title: '8. Your Rights (CCPA)', body: 'California residents have the right to know what data we collect, request deletion, and opt out of data sale (we do not sell data). Contact support@mybodymap.app.' },
    { title: '9. Cookies', body: 'We use only essential cookies for authentication. No tracking cookies, no advertising cookies.' },
    { title: '10. Changes', body: 'We will notify you of material changes by email or platform notice.' },
    { title: '11. Contact', body: 'BodyMap LLC\nsupport@mybodymap.app\nmybodymap.app' },
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
          <h1 style={{ fontSize: '36px', fontWeight: '700', color: C.darkGray, margin: '0 0 12px 0' }}>Privacy Policy</h1>
          <p style={{ fontSize: '16px', color: C.gray, lineHeight: '1.6', margin: 0 }}>BodyMap LLC is committed to protecting the privacy of therapists and their clients.</p>
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
