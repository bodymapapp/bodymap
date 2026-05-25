// src/pages/Security.jsx
//
// Security — the page sharp prospects find via the footer link when they
// want to verify our security claims before signing up. Mirrors the
// editorial design of Pricing and WhyBodyMap. Honest, accurate, calm.
//
// Linked from: Footer "Security" link, Privacy & Security modal on /features.

import React from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import Footer from "../components/Footer";

// Six pillars of how we protect data, each with a one-line claim and a
// short paragraph explaining what it actually means in plain language.
const PILLARS = [
  {
    title: "Bank-grade encryption, end to end",
    claim: "AES-256 at rest. TLS 1.3 in transit.",
    body:
      "Your client data is locked with the same encryption standards used by online banks and the major massage platforms (MassageBook, Vagaro, ClinicSense). When data sits in our database, it is encrypted. When it travels between your phone and our servers, it is encrypted. Nobody can read it in transit, and nobody can read it at rest without the keys.",
  },
  {
    title: "Each therapist's data is isolated",
    claim: "Row-level security on Postgres. You see your data. Nobody else's.",
    body:
      "Even though many therapists use MyBodyMap, your client list is walled off from every other therapist on the platform. The database itself enforces this at the row level — meaning a software bug cannot accidentally show your clients to someone else. This is a stronger guarantee than 'we trust our code to filter properly.'",
  },
  {
    title: "Hosted on a SOC 2 Type II audited platform",
    claim: "Supabase, audited annually for security controls.",
    body:
      "Our infrastructure runs on Supabase, which holds an active SOC 2 Type II certification. Independent auditors review their controls every year — encryption, access logging, incident response, employee security training. We inherit those controls for the parts of the stack they manage.",
  },
  {
    title: "We never sell your data",
    claim: "Not to advertisers, not to insurers, not to anyone.",
    body:
      "Your client data is yours. We do not sell it, license it, or share it with third parties for marketing or analytics. The only times we touch your data are: (1) to make MyBodyMap work for you, (2) when legally compelled by a court, and (3) to fix a bug if you ask us for help and grant access. That is it.",
  },
  {
    title: "The platform is trained only on your practice",
    claim: "PracticeIQ never crosses practice boundaries.",
    body:
      "When you ask the platform a question about your client history, it sees only your data. It is not trained or fine-tuned on other therapists' clients. Your patterns, your notes, your client base stay isolated to you. The The platform gets smarter at YOUR practice without your data ever leaving it.",
  },
  {
    title: "If you delete a client, it is actually deleted",
    claim: "Hard delete, not soft delete.",
    body:
      "When you delete a client record, it is removed from our active database immediately and from our backups within 30 days. We do not keep 'deleted' rows around for re-marketing or analytics. Gone means gone.",
  },
];

export default function Security() {
  React.useEffect(() => {
    const previous = document.title;
    document.title = "Security · MyBodyMap";
    return () => { document.title = previous; };
  }, []);

  return (
    <div className="bm-security-v2">
      <Nav />

      {/* Header */}
      <header className="bm-security-v2-head">
        <div className="bm-security-v2-eyebrow">Security</div>
        <h1 className="bm-security-v2-title">
          How we protect your <em>client data.</em>
        </h1>
        <p className="bm-security-v2-sub">
          You trust us with your clients' bodies, names, and stories. Here is
          exactly what we do to keep that trust, in plain language.
        </p>
      </header>

      {/* Six pillars */}
      <main className="bm-security-v2-pillars">
        {PILLARS.map((pillar, i) => (
          <article key={i} className="bm-security-v2-pillar">
            <div className="bm-security-v2-pillar__num">0{i + 1}</div>
            <div className="bm-security-v2-pillar__body">
              <h2 className="bm-security-v2-pillar__title">{pillar.title}</h2>
              <p className="bm-security-v2-pillar__claim">{pillar.claim}</p>
              <p className="bm-security-v2-pillar__text">{pillar.body}</p>
            </div>
          </article>
        ))}
      </main>

      {/* HIPAA section — the honest one */}
      <section className="bm-security-v2-hipaa">
        <div className="bm-security-v2-hipaa__inner">
          <p className="bm-security-v2-hipaa__eyebrow">A note on HIPAA</p>
          <h2 className="bm-security-v2-hipaa__title">
            What HIPAA actually means for <em>your practice.</em>
          </h2>

          <div className="bm-security-v2-hipaa__body">
            <p>
              HIPAA is the US healthcare privacy law. It is the law most
              massage software companies (us included) reference when they
              talk about security. But there is a quiet truth about HIPAA
              that the marketing pages skip:
            </p>
            <p>
              <strong>HIPAA the law only legally applies if you bill
              insurance electronically, share notes with another healthcare
              provider, or get paid through certain insurance arrangements.</strong>
              {' '}Most solo cash-pay massage therapists do none of these
              things, which means HIPAA the law does not apply to your
              practice.
            </p>
            <p>
              That said, every therapist should still keep client data
              private, and we treat your data with HIPAA-level care
              regardless. Same encryption. Same isolation. Same
              never-sell, never-share commitment.
            </p>
            <p>
              If you DO bill insurance or work inside a chiropractor or
              physical therapy clinic, HIPAA may legally apply to your
              practice. In that case, you will want a software vendor that
              has signed a Business Associate Agreement (BAA) with you.
              We are working through the formal BAA process for therapists
              who need it. Email us at{' '}
              <a href="mailto:hello@mybodymap.app">hello@mybodymap.app</a>{' '}
              and we will share where we are.
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bm-security-v2-closing">
        <h2>
          Questions? <em>Just ask.</em>
        </h2>
        <p>
          We will give you a straight answer, even if it is not the
          marketing one. Reach out anytime.
        </p>
        <div className="bm-security-v2-closing__ctas">
          <a
            href="mailto:hello@mybodymap.app"
            className="bm-security-v2-cta-primary"
          >
            Email us →
          </a>
          <Link to="/signup" className="bm-security-v2-cta-secondary">
            Start free
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
