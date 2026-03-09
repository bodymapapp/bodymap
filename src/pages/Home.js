import React from 'react';
import { Link } from 'react-router-dom';

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');
  :root {
    --green-deep: #1a3d2b; --green-mid: #2d6a4f; --green-soft: #52b788;
    --green-pale: #d8f3dc; --warm-white: #fafaf8; --warm-card: #f5f3ef;
    --warm-border: #e8e4dd; --text-dark: #1c1c1c; --text-mid: #4a4a4a; --text-light: #7a7a7a;
  }
  * { box-sizing: border-box; }
  .bm-page { font-family: 'DM Sans', sans-serif; background: var(--warm-white); color: var(--text-dark); }
  .bm-hero { min-height: 92vh; display: flex; align-items: center; justify-content: center; padding: 80px 24px 60px; background: linear-gradient(160deg, #f0f9f2 0%, var(--warm-white) 60%); position: relative; overflow: hidden; }
  .bm-hero::before { content: ''; position: absolute; top: -80px; right: -80px; width: 500px; height: 500px; background: radial-gradient(circle, rgba(82,183,136,0.12) 0%, transparent 70%); pointer-events: none; }
  .bm-hero-inner { max-width: 780px; text-align: center; position: relative; z-index: 1; }
  .bm-hero-eyebrow { display: inline-block; font-size: 13px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--green-mid); background: rgba(82,183,136,0.12); border: 1px solid rgba(82,183,136,0.25); padding: 6px 16px; border-radius: 100px; margin-bottom: 28px; }
  .bm-hero-h1 { font-family: 'Lora', Georgia, serif; font-size: clamp(36px, 5.5vw, 64px); font-weight: 700; line-height: 1.13; color: var(--green-deep); margin: 0 0 12px; letter-spacing: -0.02em; }
  .bm-hero-h1 em { font-style: italic; color: var(--green-mid); }
  .bm-hero-sub { font-size: clamp(16px, 2vw, 20px); color: var(--text-mid); line-height: 1.6; margin: 0 auto 36px; max-width: 560px; }
  .bm-hero-btns { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin-bottom: 44px; }
  .bm-btn-primary { display: inline-flex; align-items: center; gap: 8px; background: var(--green-mid); color: #fff; font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 600; padding: 16px 32px; border-radius: 12px; text-decoration: none; transition: background 0.2s, transform 0.15s, box-shadow 0.2s; box-shadow: 0 4px 16px rgba(45,106,79,0.28); }
  .bm-btn-primary:hover { background: var(--green-deep); transform: translateY(-2px); }
  .bm-btn-ghost { display: inline-flex; align-items: center; gap: 8px; background: transparent; color: var(--green-mid); font-size: 16px; font-weight: 500; padding: 15px 28px; border-radius: 12px; text-decoration: none; border: 1.5px solid var(--green-soft); transition: background 0.2s, transform 0.15s; }
  .bm-btn-ghost:hover { background: var(--green-pale); transform: translateY(-2px); }
  .bm-hero-proof { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; color: var(--text-light); }
  .bm-hero-proof-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--warm-border); display: inline-block; }
  .bm-hero-visual { margin-top: 56px; display: flex; justify-content: center; }
  .bm-hero-card { background: #fff; border: 1px solid var(--warm-border); border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.08); padding: 28px 32px; max-width: 480px; width: 100%; text-align: left; position: relative; }
  .bm-hero-card-label { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-light); margin-bottom: 16px; }
  .bm-hero-card-client { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .bm-hero-card-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--green-pale); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
  .bm-hero-card-name { font-weight: 600; font-size: 16px; }
  .bm-hero-card-meta { font-size: 13px; color: var(--text-light); margin-top: 2px; }
  .bm-body-zones { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px; }
  .bm-zone { border-radius: 10px; padding: 8px 10px; font-size: 13px; font-weight: 500; text-align: center; }
  .bm-zone-focus { background: rgba(82,183,136,0.15); color: var(--green-mid); border: 1px solid rgba(82,183,136,0.3); }
  .bm-zone-avoid { background: rgba(220,80,80,0.08); color: #b84040; border: 1px solid rgba(220,80,80,0.2); }
  .bm-zone-note { background: rgba(201,168,76,0.1); color: #9a7a20; border: 1px solid rgba(201,168,76,0.25); }
  .bm-pattern-line { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--warm-card); border-radius: 10px; font-size: 13px; color: var(--text-mid); margin-bottom: 8px; }
  .bm-pattern-badge { background: var(--green-mid); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 100px; margin-left: auto; flex-shrink: 0; }
  .bm-hero-card-ping { position: absolute; top: -12px; right: -12px; background: var(--green-mid); color: #fff; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 100px; box-shadow: 0 4px 12px rgba(45,106,79,0.3); }
  .bm-pain { background: var(--green-deep); padding: 56px 24px; text-align: center; }
  .bm-pain-eyebrow { font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--green-soft); margin-bottom: 16px; }
  .bm-pain-h2 { font-family: 'Lora', serif; font-size: clamp(24px, 3.5vw, 38px); font-weight: 600; color: #fff; margin: 0 auto 40px; max-width: 620px; line-height: 1.3; }
  .bm-pain-h2 em { font-style: italic; color: var(--green-soft); }
  .bm-pain-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 900px; margin: 0 auto; }
  .bm-pain-item { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; text-align: left; }
  .bm-pain-icon { font-size: 28px; margin-bottom: 12px; }
  .bm-pain-title { font-weight: 600; color: #fff; font-size: 15px; margin-bottom: 6px; }
  .bm-pain-desc { font-size: 14px; color: rgba(255,255,255,0.55); line-height: 1.5; }
  .bm-roi { padding: 80px 24px; background: var(--warm-white); text-align: center; }
  .bm-roi-eyebrow { font-size: 13px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--green-mid); margin-bottom: 16px; }
  .bm-roi-h2 { font-family: 'Lora', serif; font-size: clamp(26px, 4vw, 44px); font-weight: 700; color: var(--green-deep); margin: 0 auto 20px; max-width: 700px; line-height: 1.2; }
  .bm-roi-sub { font-size: 18px; color: var(--text-mid); max-width: 520px; margin: 0 auto 52px; line-height: 1.6; }
  .bm-roi-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 860px; margin: 0 auto 40px; align-items: stretch; }
  .bm-roi-card { background: var(--warm-card); border: 1px solid var(--warm-border); border-radius: 20px; padding: 32px 28px; text-align: center; }
  .bm-roi-card.highlight { background: var(--green-deep); border-color: var(--green-deep); transform: scale(1.04); box-shadow: 0 16px 40px rgba(26,61,43,0.2); }
  .bm-roi-val { font-size: 42px; font-weight: 700; color: var(--green-mid); margin-bottom: 6px; }
  .bm-roi-card.highlight .bm-roi-val { color: var(--green-soft); }
  .bm-roi-label { font-size: 14px; color: var(--text-light); line-height: 1.4; }
  .bm-roi-card.highlight .bm-roi-label { color: rgba(255,255,255,0.65); }
  .bm-roi-card.highlight .bm-roi-tag { color: #fff; font-weight: 700; font-size: 13px; margin-bottom: 8px; display: block; }
  .bm-roi-footnote { font-size: 14px; color: var(--text-light); max-width: 500px; margin: 0 auto; line-height: 1.6; }
  .bm-stories { background: var(--warm-card); padding: 80px 24px; }
  .bm-stories-eyebrow { text-align: center; font-size: 13px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--green-mid); margin-bottom: 16px; }
  .bm-stories-h2 { font-family: 'Lora', serif; font-size: clamp(26px, 3.5vw, 40px); font-weight: 700; color: var(--green-deep); text-align: center; margin: 0 auto 14px; max-width: 640px; line-height: 1.25; }
  .bm-stories-sub { text-align: center; font-size: 17px; color: var(--text-light); margin: 0 auto 52px; max-width: 480px; }
  .bm-story-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 1020px; margin: 0 auto; }
  .bm-story-card { background: #fff; border-radius: 20px; border: 1px solid var(--warm-border); padding: 32px 28px; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; }
  .bm-story-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.08); }
  .bm-story-client { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  .bm-story-avatar { width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; flex-shrink: 0; color: #fff; }
  .bm-story-name { font-weight: 600; font-size: 15px; }
  .bm-story-since { font-size: 12px; color: var(--text-light); margin-top: 2px; }
  .bm-story-headline { font-family: 'Lora', serif; font-size: 18px; font-weight: 600; color: var(--green-deep); line-height: 1.35; margin-bottom: 12px; }
  .bm-story-body { font-size: 14px; color: var(--text-mid); line-height: 1.65; flex: 1; }
  .bm-story-outcome { margin-top: 20px; padding: 12px 16px; background: var(--green-pale); border-radius: 10px; font-size: 13px; font-weight: 600; color: var(--green-mid); }
  .bm-how { padding: 80px 24px; background: var(--warm-white); text-align: center; }
  .bm-how-eyebrow { font-size: 13px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--green-mid); margin-bottom: 16px; }
  .bm-how-h2 { font-family: 'Lora', serif; font-size: clamp(26px, 3.5vw, 40px); font-weight: 700; color: var(--green-deep); margin: 0 auto 14px; max-width: 580px; line-height: 1.25; }
  .bm-how-sub { font-size: 17px; color: var(--text-light); max-width: 440px; margin: 0 auto 56px; line-height: 1.6; }
  .bm-how-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; max-width: 920px; margin: 0 auto; }
  .bm-how-step { text-align: left; }
  .bm-how-num { width: 48px; height: 48px; border-radius: 14px; background: var(--green-mid); color: #fff; font-weight: 700; font-size: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; }
  .bm-how-title { font-size: 17px; font-weight: 600; color: var(--text-dark); margin-bottom: 10px; }
  .bm-how-desc { font-size: 15px; color: var(--text-mid); line-height: 1.6; }
  .bm-trust { background: var(--warm-card); padding: 64px 24px; text-align: center; }
  .bm-trust-h2 { font-family: 'Lora', serif; font-size: clamp(22px, 3vw, 34px); color: var(--green-deep); font-weight: 600; margin: 0 auto 40px; max-width: 500px; }
  .bm-trust-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 860px; margin: 0 auto; }
  .bm-trust-item { background: #fff; border: 1px solid var(--warm-border); border-radius: 16px; padding: 24px 22px; text-align: left; }
  .bm-trust-icon { font-size: 24px; margin-bottom: 10px; }
  .bm-trust-label { font-weight: 600; font-size: 14px; margin-bottom: 6px; }
  .bm-trust-desc { font-size: 13px; color: var(--text-light); line-height: 1.55; }
  .bm-cta { background: var(--green-deep); padding: 96px 24px; text-align: center; position: relative; overflow: hidden; }
  .bm-cta::before { content: ''; position: absolute; top: -100px; left: -100px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(82,183,136,0.15) 0%, transparent 70%); pointer-events: none; }
  .bm-cta-h2 { font-family: 'Lora', serif; font-size: clamp(28px, 4.5vw, 50px); font-weight: 700; color: #fff; margin: 0 auto 20px; max-width: 680px; line-height: 1.2; position: relative; }
  .bm-cta-h2 em { font-style: italic; color: var(--green-soft); }
  .bm-cta-sub { font-size: 18px; color: rgba(255,255,255,0.65); max-width: 440px; margin: 0 auto 40px; line-height: 1.6; position: relative; }
  .bm-cta-btns { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px; position: relative; }
  .bm-cta-fine { font-size: 13px; color: rgba(255,255,255,0.4); position: relative; }
  .bm-btn-white { display: inline-flex; align-items: center; gap: 8px; background: #fff; color: var(--green-deep); font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 700; padding: 16px 34px; border-radius: 12px; text-decoration: none; transition: transform 0.15s, box-shadow 0.2s; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
  .bm-btn-white:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
  .bm-btn-outline-white { display: inline-flex; align-items: center; gap: 8px; background: transparent; color: rgba(255,255,255,0.85); font-size: 16px; font-weight: 500; padding: 15px 28px; border-radius: 12px; text-decoration: none; border: 1.5px solid rgba(255,255,255,0.25); transition: background 0.2s, transform 0.15s; }
  .bm-btn-outline-white:hover { background: rgba(255,255,255,0.1); transform: translateY(-2px); }
  @media (max-width: 768px) {
    .bm-pain-grid, .bm-roi-cards, .bm-story-grid, .bm-how-steps, .bm-trust-grid { grid-template-columns: 1fr !important; }
    .bm-roi-card.highlight { transform: scale(1); }
    .bm-hero-btns, .bm-cta-btns { flex-direction: column; align-items: stretch; }
    .bm-body-zones { grid-template-columns: repeat(2, 1fr); }
  }
`;

export default function Home() {
  return (
    <div className="bm-page">
      <style>{STYLES}</style>

      <section className="bm-hero">
        <div className="bm-hero-inner">
          <div className="bm-hero-eyebrow">Built for Massage Therapists</div>
          <h1 className="bm-hero-h1">Make it impossible for<br />clients <em>not</em> to come back.</h1>
          <p className="bm-hero-sub">The only tool built around what every other app ignores — knowing your clients so well, they never need to find someone else.</p>
          <div className="bm-hero-btns">
            <Link to="/signup" className="bm-btn-primary">Start Free — No Card Needed →</Link>
            <a href="#how-it-works" className="bm-btn-ghost">See How It Works</a>
          </div>
          <div className="bm-hero-proof">
            <span>Free forever on Bronze</span>
            <span className="bm-hero-proof-dot" />
            <span>Live in 30 seconds</span>
            <span className="bm-hero-proof-dot" />
            <span>No credit card</span>
          </div>
          <div className="bm-hero-visual">
            <div className="bm-hero-card">
              <div className="bm-hero-card-ping">📍 Session in 40 min</div>
              <div className="bm-hero-card-label">Your next client</div>
              <div className="bm-hero-card-client">
                <div className="bm-hero-card-avatar">💆</div>
                <div>
                  <div className="bm-hero-card-name">Sarah M.</div>
                  <div className="bm-hero-card-meta">Client since Jan 2024 · 8 sessions</div>
                </div>
              </div>
              <div className="bm-body-zones">
                <div className="bm-zone bm-zone-focus">🟢 Upper back</div>
                <div className="bm-zone bm-zone-focus">🟢 Left shoulder</div>
                <div className="bm-zone bm-zone-avoid">🔴 Neck — skip</div>
                <div className="bm-zone bm-zone-note">🎵 Ambient music</div>
                <div className="bm-zone bm-zone-note">💆 Medium pressure</div>
                <div className="bm-zone bm-zone-focus">🟢 Lower back</div>
              </div>
              <div className="bm-pattern-line">
                <span>📊 Pattern: left shoulder — 6 of 8 sessions</span>
                <span className="bm-pattern-badge">Recurring</span>
              </div>
              <div className="bm-pattern-line">
                <span>💬 "Stress from work lately — go deeper today"</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bm-pain">
        <div className="bm-pain-eyebrow">The Problem</div>
        <h2 className="bm-pain-h2">You're losing clients you worked hard to earn.<em> Not because of your work — because they feel forgotten.</em></h2>
        <div className="bm-pain-grid">
          <div className="bm-pain-item">
            <div className="bm-pain-icon">🗂️</div>
            <div className="bm-pain-title">Starting over every session</div>
            <div className="bm-pain-desc">Clients repeat their history. You take mental notes you'll lose by next week. Nothing accumulates.</div>
          </div>
          <div className="bm-pain-item">
            <div className="bm-pain-icon">📅</div>
            <div className="bm-pain-title">Lapsed clients, zero alerts</div>
            <div className="bm-pain-desc">Your best clients go quiet. Life happens. You had no way to notice — or reach back out at the right moment.</div>
          </div>
          <div className="bm-pain-item">
            <div className="bm-pain-icon">💸</div>
            <div className="bm-pain-title">Revenue walking out the door</div>
            <div className="bm-pain-desc">One lost monthly client = $600–$1,200/year gone. Multiply that by a few and you're running harder just to stay in place.</div>
          </div>
        </div>
      </section>

      <section className="bm-roi">
        <div className="bm-roi-eyebrow">The Math</div>
        <h2 className="bm-roi-h2">$24 in January.<br />Still paying off in December.</h2>
        <p className="bm-roi-sub">One client you almost lost — brought back by a single BodyMap alert — pays for your entire year.</p>
        <div className="bm-roi-cards">
          <div className="bm-roi-card">
            <div className="bm-roi-val">$24</div>
            <div className="bm-roi-label">One month of BodyMap Silver</div>
          </div>
          <div className="bm-roi-card highlight">
            <span className="bm-roi-tag">One returned client × 12 months</span>
            <div className="bm-roi-val">$1,200</div>
            <div className="bm-roi-label">Revenue that would have walked out the door</div>
          </div>
          <div className="bm-roi-card">
            <div className="bm-roi-val">50×</div>
            <div className="bm-roi-label">Return on that one month, all year long</div>
          </div>
        </div>
        <p className="bm-roi-footnote">That's the $24 you spent in January still paying off in December — again in January, again in December.</p>
      </section>

      <section className="bm-stories">
        <div className="bm-stories-eyebrow">Real Moments</div>
        <h2 className="bm-stories-h2">This is what it feels like when your therapist truly knows you.</h2>
        <p className="bm-stories-sub">What changes when you stop relying on memory.</p>
        <div className="bm-story-grid">
          <div className="bm-story-card">
            <div className="bm-story-client">
              <div className="bm-story-avatar" style={{background:'#52b788'}}>M</div>
              <div><div className="bm-story-name">Maya</div><div className="bm-story-since">Regular client · 3 years</div></div>
            </div>
            <div className="bm-story-headline">She was gone 8 weeks. One BodyMap alert brought her back.</div>
            <div className="bm-story-body">Life got busy — new job, a move. Six weeks went by, then eight. BodyMap flagged her as quiet. Her therapist sent one text: "Hey Maya, been thinking about you. Lower back still giving you trouble?" She booked the next day. She's been coming ever since.</div>
            <div className="bm-story-outcome">✓ One text. Client retained.</div>
          </div>
          <div className="bm-story-card">
            <div className="bm-story-client">
              <div className="bm-story-avatar" style={{background:'#2d6a4f'}}>J</div>
              <div><div className="bm-story-name">James</div><div className="bm-story-since">Monthly client · 1 year</div></div>
            </div>
            <div className="bm-story-headline">Every visit, he repeated himself. Until she just knew.</div>
            <div className="bm-story-body">He hated deep pressure on his left shoulder. Every session, he'd wince and say it again. Third visit with BodyMap, his therapist just said "I've got you" before he even sat down. He told his wife that night. His wife booked the next morning.</div>
            <div className="bm-story-outcome">✓ Loyalty earned. Referral earned.</div>
          </div>
          <div className="bm-story-card">
            <div className="bm-story-client">
              <div className="bm-story-avatar" style={{background:'#c9a84c'}}>P</div>
              <div><div className="bm-story-name">Priya</div><div className="bm-story-since">New client · found her person</div></div>
            </div>
            <div className="bm-story-headline">3 therapists in 2 years. BodyMap changed that.</div>
            <div className="bm-story-body">Good hands, all of them — but every session felt like starting over. With BodyMap, her therapist knew her patterns by session two. By session four, Priya stopped looking. She'd found her person.</div>
            <div className="bm-story-outcome">✓ Client stopped searching.</div>
          </div>
        </div>
      </section>

      <section className="bm-how" id="how-it-works">
        <div className="bm-how-eyebrow">How It Works</div>
        <h2 className="bm-how-h2">Set up once. Know every client, forever.</h2>
        <p className="bm-how-sub">You already put everything into every session. BodyMap makes sure clients feel all of it.</p>
        <div className="bm-how-steps">
          <div className="bm-how-step">
            <div className="bm-how-num">1</div>
            <div className="bm-how-title">You're live in 30 seconds</div>
            <div className="bm-how-desc">Sign in, get your personal intake link. Share it once. Clients use it before every session — no app, no download, no friction.</div>
          </div>
          <div className="bm-how-step">
            <div className="bm-how-num">2</div>
            <div className="bm-how-title">Clients tell you everything, once</div>
            <div className="bm-how-desc">They tap focus areas, flag what to avoid, set pressure and preferences. Takes 60 seconds. You never ask again — it's all there waiting before they arrive.</div>
          </div>
          <div className="bm-how-step">
            <div className="bm-how-num">3</div>
            <div className="bm-how-title">Patterns emerge. Retention follows.</div>
            <div className="bm-how-desc">After session 3, BodyMap shows recurring patterns. After session 5, you know this client better than any notes ever could. They feel it — and they keep coming back.</div>
          </div>
        </div>
      </section>

      <section className="bm-trust">
        <h2 className="bm-trust-h2">Your clients trust you. BodyMap makes sure you earn it every session.</h2>
        <div className="bm-trust-grid">
          <div className="bm-trust-item">
            <div className="bm-trust-icon">🔐</div>
            <div className="bm-trust-label">AES-256 encryption</div>
            <div className="bm-trust-desc">All data encrypted at rest and in transit. Same standard as banks.</div>
          </div>
          <div className="bm-trust-item">
            <div className="bm-trust-icon">🏠</div>
            <div className="bm-trust-label">Your data. Always.</div>
            <div className="bm-trust-desc">Every therapist is completely isolated. No other practitioner can ever see your clients.</div>
          </div>
          <div className="bm-trust-item">
            <div className="bm-trust-icon">🚫</div>
            <div className="bm-trust-label">Never sold. Never shared.</div>
            <div className="bm-trust-desc">No advertisers. No data brokers. No exceptions. Your clients' information belongs to you.</div>
          </div>
        </div>
      </section>

      <section className="bm-cta">
        <h2 className="bm-cta-h2">Your clients deserve to feel like <em>your only client.</em></h2>
        <p className="bm-cta-sub">Start free. Upgrade when you're ready. Your first 5 clients are always free.</p>
        <div className="bm-cta-btns">
          <Link to="/signup" className="bm-btn-white">Start Free — No Card Needed →</Link>
          <a href="#how-it-works" className="bm-btn-outline-white">See How It Works</a>
        </div>
        <div className="bm-cta-fine">Free forever on Bronze · $24/mo when you're ready to grow</div>
      </section>
    </div>
  );
}
