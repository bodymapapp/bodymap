import React from 'react';
const C = { forest: '#2A5741', darkGray: '#1F2937', gray: '#6B7280', lightGray: '#F9FAFB', border: '#E5E7EB' };
export default function Terms() {
  const sections = [
    { title: '1. What BodyMap Is', body: 'BodyMap is a client communication and intake management tool for licensed massage therapists. It is NOT a medical platform, EHR, or HIPAA-covered entity. Therapists are solely responsible for all clinical decisions.' },
    { title: '2. Eligibility', body: 'You must be at least 18 years old to use BodyMap. By using this platform you represent that you are a licensed wellness professional or a client of one.' },
    { title: '3. Your Account', body: 'You are responsible for maintaining confidentiality of your login credentials. Notify us at support@mybodymap.app if you suspect unauthorized access.' },
    { title: '4. Acceptable Use', body: 'You agree not to use BodyMap to collect data for unauthorized purposes, access another user\'s data, reverse engineer the platform, or use it for any unlawful purpose. We may terminate accounts that violate these terms without notice.' },
    { title: '5. Subscription and Payments', body: 'Paid plans are billed monthly through Stripe. Cancel anytime — access continues until end of billing period. No refunds for partial periods. Pricing changes communicated with 30 days notice.' },
    { title: '6. Client Data Responsibility', body: 'As a therapist, you are the data controller for your clients information. You are responsible for obtaining client consent to store their intake data on BodyMap. BodyMap LLC acts as a data processor on your behalf.' },
    { title: '7. Not Medical Software — No HIPAA Coverage', body: 'BodyMap is a communication tool, not medical software. It is not designed to store protected health information (PHI) under HIPAA. BodyMap LLC does not sign Business Associate Agreements (BAAs). If your practice is subject to HIPAA, consult a legal professional before use.' },
    { title: '8. Limitation of Liability', body: 'BodyMap LLC shall not be liable for any indirect, incidental, or consequential damages. Our total liability shall not exceed the amount you paid us in the 12 months preceding any claim.' },
    { title: '9. Intellectual Property', body: 'All platform content, design, and software are owned by BodyMap LLC. You may not copy, modify, or distribute any part of the platform without written permission.' },
    { title: '10. Termination', body: 'You may close your account at any time by emailing support@mybodymap.app. Data is retained for 30 days then permanently deleted. We may terminate accounts for violations of these terms.' },
    { title: '11. Governing Law', body: 'These terms are governed by the laws of the State of Wyoming. Disputes shall be resolved in the courts of Sheridan County, Wyoming.' },
    { title: '12. Changes', body: 'We may update these terms and will notify you of material changes by email or platform notice.' },
    { title: '13. Platform Use for Wellness Purposes Only', body: 'BodyMap is designed exclusively for use as a communication and session management tool between wellness practitioners and their clients. BodyMap does not provide medical advice, medical diagnoses, or clinical recommendations of any kind. Therapists are solely responsible for all professional and clinical decisions made in the course of their practice. Nothing on this platform constitutes medical advice, and no information collected through BodyMap should be used as a substitute for professional medical judgment.' },
    { title: '14. Indemnification', body: 'You agree to indemnify, defend, and hold harmless BodyMap LLC, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses — including reasonable legal fees — arising out of or in any way connected with your use of the platform, your violation of these Terms, or your violation of any rights of another person or entity.' },
    { title: '15. Arbitration & Dispute Resolution', body: 'Any dispute, claim, or controversy arising out of or relating to these Terms or your use of BodyMap shall be resolved by binding arbitration under the rules of the American Arbitration Association (AAA), rather than in court. You waive any right to participate in a class action lawsuit or class-wide arbitration. The arbitration shall take place in Sheridan County, Wyoming. Nothing in this clause prevents either party from seeking injunctive relief in a court of competent jurisdiction.' },
    { title: '16. Anonymized Data for Platform Improvement', body: 'By using BodyMap, you agree that anonymized, de-identified data derived from platform usage — including body area selections, session frequency patterns, and preference data — may be used to improve BodyMap\'s recommendations and features. De-identified data means data from which all personally identifiable information (name, phone number, email, therapist identity) has been permanently removed. No individual therapist or client can be identified from this aggregate data. You may opt out of contributing to aggregate analysis at any time by contacting support@mybodymap.app.' },
    { title: '17. Contact', body: 'BodyMap LLC\nsupport@mybodymap.app\nmybodymap.app' },
  ];
  return (
    <div style={{ background: C.lightGray, minHeight: "100vh", padding: "60px 24px" }}>
      <div style={{ maxWidth: "780px", margin: "0 auto" }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "24px", textDecoration: "none" }}>
          <span style={{ fontSize: "22px" }}>🌿</span>
          <span style={{ fontSize: "18px", fontWeight: "800", color: C.forest, letterSpacing: "-0.3px" }}>BodyMap</span>
        </a>
      </div>
      <div style={{ maxWidth: "780px", margin: "0 auto", background: "white", borderRadius: "16px", padding: "56px 64px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ marginBottom: "40px" }}>
          <div style={{ fontSize: "13px", color: C.gray, marginBottom: "8px" }}>Last updated: March 2026</div>
          <h1 style={{ fontSize: "36px", fontWeight: "700", color: C.darkGray, margin: "0 0 12px 0" }}>Terms of Service</h1>
          <p style={{ fontSize: "16px", color: C.gray, lineHeight: "1.6", margin: 0 }}>These Terms of Service govern your use of BodyMap, operated by BodyMap LLC, a Texas limited liability company.</p>
        </div>
        {sections.map((s) => (
          <div key={s.title} style={{ marginBottom: "36px", paddingBottom: "36px", borderBottom: "1px solid " + C.border }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: C.darkGray, margin: "0 0 12px 0" }}>{s.title}</h2>
            <div style={{ fontSize: "15px", color: "#374151", lineHeight: "1.75", whiteSpace: "pre-line" }}>{s.body}</div>
          </div>
        ))}
        <div style={{ marginTop: "40px", padding: "24px", background: "#F0FDF4", borderRadius: "10px", border: "1px solid #BBF7D0" }}>
          <p style={{ fontSize: "14px", color: C.gray, margin: 0 }}>Questions? <a href="mailto:support@mybodymap.app" style={{ color: C.forest }}>support@mybodymap.app</a></p>
        </div>
      </div>
    </div>
  );
}