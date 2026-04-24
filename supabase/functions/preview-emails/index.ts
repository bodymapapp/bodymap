// Preview edge function · renders every email template with sample data.
// Used by /founder/emails.
//
// TAXONOMY:
//   E1.x = Auto Drip (fires automatically, signup or cron)
//   E2.x = Founder Outreach (manual sends from /founder)
//
// TECH DEBT: this file vendors template code from send-welcome, send-drip,
// practice-pulse, and founder-outreach. When editing an email I edit both
// files in one commit. When the list grows past ~20, extract to
// supabase/functions/_shared/email_templates.ts.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = new Set([
  "bodymap01@gmail.com",
  "bodymapdemo@gmail.com",
  "harshk.mba@gmail.com",
]);

const FAKE = {
  first_name: "Sarah",
  full_name: "Sarah Mitchell",
  email: "sarah@example.com",
  custom_url: "sarahmitchell",
  days_on_platform: 34,
  days_since_use: 12,
  sessions_total: 47,
};

const DASH = "https://mybodymap.app/dashboard";

// Sample footer shown in previews. Real emails get a per-therapist signed
// unsubscribe token; in the preview we show a representative version.
const SAMPLE_UNSUB_FOOTER = `
<div style="margin-top:28px;padding-top:18px;border-top:1px solid #E8E4DC;font-size:11px;color:#9CA3AF;line-height:1.6">
  <div>You're receiving this because you signed up for MyBodyMap at mybodymap.app.</div>
  <div style="margin-top:6px"><a href="https://mybodymap.app/unsubscribe" style="color:#6B7280;text-decoration:underline">Unsubscribe from all marketing emails</a></div>
  <div style="margin-top:6px">BodyMap LLC, 30 N Gould St Ste R, Sheridan, WY 82801</div>
</div>`;

function wrap(inner: string) {
  return `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;">
      <div style="margin-bottom:24px;">
        <span style="font-size:20px;font-weight:700;color:#1A3A28;">MyBodyMap</span>
        <span style="display:block;font-family:system-ui;font-size:11px;font-weight:700;color:#6B9E80;letter-spacing:0.12em;text-transform:uppercase;margin-top:2px;">Client Intelligence</span>
      </div>
      ${inner}
      <p style="font-family:system-ui;font-size:12px;color:#9CA3AF;margin-top:32px;line-height:1.7;text-align:center;">
        Reply any time, we read every email.<br/>
        <span style="color:#D1D5DB;">The MyBodyMap Team &middot; <a href="https://mybodymap.app" style="color:#9CA3AF;">mybodymap.app</a></span>
      </p>
      ${SAMPLE_UNSUB_FOOTER}
    </div>
  `;
}

function plainTextWrap(lines: string[]) {
  return `
    <div style="font-family:Georgia,serif;max-width:560px;margin:24px auto;padding:32px 28px;background:#FFF9F3;border:1px solid #E8E4DC;border-radius:12px;color:#1F2937;line-height:1.6;font-size:15px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;color:#6B9E80;text-transform:uppercase;margin-bottom:16px">🌿 MyBodyMap</div>
      ${lines.map(l => l === "" ? "<br/>" : `<div>${l}</div>`).join("\n")}
      <div style="margin-top:28px;padding-top:18px;border-top:1px solid #E8E4DC;font-size:12px;color:#9CA3AF">
        Reply to this email and it reaches me directly.
      </div>
      ${SAMPLE_UNSUB_FOOTER}
    </div>
  `;
}

// ─── E1.1 Welcome / Onboarding ────────────────────────────

function e11Welcome(firstName: string) {
  const steps = [
    { n: "1", title: "Bring your clients in", body: "Import your list or add a few by hand. This is the foundation that everything else sits on top of.", link: DASH, cta: "Import clients" },
    { n: "2", title: "Tell us what you offer", body: "Your 60-min deep tissue. Your 90-min prenatal. Your hot stone add-on. Add your services so clients book the right thing.", link: `${DASH}/settings`, cta: "Add services" },
    { n: "3", title: "Set your hours", body: "When you're open. When you're closed. When you are with a client and not to be disturbed. This is how clients book themselves without you typing a single text.", link: `${DASH}/schedule`, cta: "Set hours" },
    { n: "4", title: "Connect payments", body: `Stripe or Square. One minute. After this, clients pay the moment they book. You never have to send "hey can you Venmo me" again.`, link: `${DASH}/billing`, cta: "Connect payments" },
    { n: "5", title: "Send your first intake", body: "Pick one regular client. Text them your MyBodyMap link. Watch them fill out a visual body map on their phone in 60 seconds instead of scribbling on a clipboard. The first time you see it land in your dashboard is the moment this all clicks.", link: DASH, cta: "Send first intake" },
  ];
  const stepsHtml = steps.map(s => `
    <div style="border-left:3px solid #2A5741;padding:16px 20px;margin-bottom:14px;background:#F9FAF9;border-radius:0 8px 8px 0;">
      <div style="font-family:system-ui;font-size:11px;font-weight:700;color:#6B9E80;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Step ${s.n}</div>
      <div style="font-size:17px;font-weight:700;color:#1A3A28;margin-bottom:6px;font-family:Georgia,serif;">${s.title}</div>
      <div style="font-family:system-ui;font-size:14px;color:#4B5563;line-height:1.7;margin-bottom:10px;">${s.body}</div>
      <a href="${s.link}" style="font-family:system-ui;font-size:13px;font-weight:700;color:#2A5741;text-decoration:none;">${s.cta} &rarr;</a>
    </div>
  `).join("");

  const inner = `
    <h1 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 18px;line-height:1.3;">Welcome home, ${firstName}. 5 steps, any order, no hurry. 🌿</h1>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Hi ${firstName},</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">You spent the day giving other people their breath back. Now here you are, screen on, thinking about one more thing to set up. We see you.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">So let's make this short.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 22px;">MyBodyMap works best once these 5 things are in place. Each one takes a minute or two. You can do them in any order. You can stop after three and come back next week. Whatever fits the day.</p>
    ${stepsHtml}
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:20px 0 16px;">That's it. No quiz at the end. No "complete your profile to unlock features." Just five small things that turn your hands-on practice into one that runs itself in the background.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">We are here if you get stuck. Reply to this email and a real person reads it.</p>
    <div style="background:#F0FDF4;border-left:3px solid #2A5741;padding:14px 18px;margin:0 0 24px;">
      <p style="font-family:Georgia,serif;font-size:16px;font-style:italic;color:#2A5741;margin:0;">Welcome home.</p>
    </div>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;">Cheers,</p>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;">MyBodyMap Team</p>
    <div style="margin-top:26px;text-align:center;">
      <span style="display:inline-block;background:#F0FDF4;border:1px solid #86EFAC;border-radius:20px;padding:5px 12px;font-family:system-ui;font-size:11px;font-weight:700;color:#2A5741;">🌿 Silver tier · Free for life (founding therapist)</span>
    </div>
  `;
  return { subject: `Welcome home, ${firstName}. 5 steps, any order, no hurry.`, html: wrap(inner) };
}

// ─── E1.2 Day 2 ───────────────────────────────────────────

function e12Day2(firstName: string) {
  const inner = `
    <div style="background:#E8F0EA;border:1px solid #C8DCCC;border-radius:8px;padding:4px 10px;display:inline-block;margin-bottom:16px;">
      <span style="font-family:system-ui;font-size:11px;font-weight:700;color:#2A5741;text-transform:uppercase;letter-spacing:0.08em;">🌿 Day 2 · Unusual energy</span>
    </div>
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">3 reasons MyBodyMap might be a terrible idea for you</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Hey ${firstName}, every software company in the world sends you the same email. "Here are 17 reasons you need us." We got tired of writing it. You're probably tired of reading it. So let's flip it.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Here are 3 reasons MyBodyMap might be a terrible idea for you. Said with love.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 4px;"><strong style="color:#1A3A28;">1. You have a deep, spiritual connection with your paper intake forms.</strong></p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Look, we get it. The crinkle. The pen ink. The little basket by the door. If clipping a fresh form to a clipboard is one of your favorite parts of the day, please do not let us ruin that for you. Nothing we build can compete with that basket. You have our respect.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 4px;"><strong style="color:#1A3A28;">2. Doing the back office work is your happy place.</strong></p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Some people love typing "Looking forward to seeing you Thursday!" for the 400th time. Some people find peace in digging through texts to figure out if a client paid. If that's you, we salute you. We'd only be in your way. Keep the flow going.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 4px;"><strong style="color:#1A3A28;">3. You think clients who quietly stop booking are fine on their own.</strong></p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">They almost always are going through something. Stress at work. A bad back. A week that got away from them. A body that's forgotten what it feels like to exhale. That is exactly why they need to come see you. You are the person who gives them their breath back. But they won't remember that in the middle of a hard week. You have to be the one who reaches out. A short message from you, at the right moment, is sometimes the only reason someone remembers they deserve an hour of peace.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Still with us? Great. You're probably the right kind of weird for this.</p>
    <div style="background:#F0FDF4;border-left:3px solid #2A5741;padding:14px 18px;margin-bottom:24px;">
      <p style="font-family:system-ui;font-size:14px;color:#1A3A28;line-height:1.7;margin:0;">Open your dashboard and look at the Clients tab. It quietly flags anyone whose booking gap is stretching. One tap, one message, most of them come back. And they usually need it more than they'll admit.</p>
    </div>
    <a href="${DASH}" style="display:inline-block;background:#2A5741;color:#fff;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Open my dashboard →</a>
  `;
  return { subject: `3 reasons MyBodyMap might be a terrible idea, ${firstName}`, html: wrap(inner) };
}

// ─── E1.3 Day 5 ───────────────────────────────────────────

function e13Day5(firstName: string, customUrl: string) {
  const selfIntakeLink = `https://mybodymap.app/book/${customUrl}`;
  const inner = `
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">${firstName}, feel what your clients feel</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Hey ${firstName},</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Here is a thing almost no therapist does before recommending a tool to their clients.</p>
    <p style="font-family:system-ui;font-size:17px;color:#1A3A28;line-height:1.7;margin:0 0 20px;font-weight:700;font-family:Georgia,serif;font-style:italic;">They actually try it themselves.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Take 60 seconds right now. Open your dashboard. Find your MyBodyMap link. Open it on your phone like you are a client booking with you for the first time.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Walk through the intake. Tap your own shoulders. Mark the spot on your lower back that aches after a long day. Note the places on your body that carry the week.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 12px;">When you are done, two things happen.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 10px;"><strong style="color:#1A3A28;">First,</strong> you realize how quick this is for your clients. Probably quicker than the paper form you currently hand them.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;"><strong style="color:#1A3A28;">Second,</strong> your own dashboard lights up with your own body. Your own pressure preference. Your own tension pattern. That is a small, quiet thing. But it is also exactly what every one of your clients is about to experience when they try this for themselves.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 24px;font-style:italic;">You give your clients peace. Let us give you a tiny moment of it too.</p>
    <a href="${selfIntakeLink}" style="display:inline-block;background:#2A5741;color:#fff;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Take the intake yourself →</a>
  `;
  return { subject: `${firstName}, feel what your clients feel`, html: wrap(inner) };
}

// ─── E1.4 Day 10 (unchanged) ──────────────────────────────

function e14Day10(firstName: string) {
  const inner = `
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">The whole idea</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Hey ${firstName}, here's what MyBodyMap is trying to do for you:</p>
    <div style="background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:0 10px 10px 0;padding:20px;margin-bottom:24px;">
      <p style="font-family:Georgia,serif;font-size:19px;color:#1A3A28;line-height:1.6;margin:0 0 10px;font-style:italic;">"After 20 years, I finally stopped juggling spreadsheets and paperwork."</p>
      <p style="font-family:system-ui;font-size:13px;color:#92400E;margin:0;">A massage therapist, 20 years in practice</p>
    </div>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">That's the whole idea. Your back office keeps working while you do the work on the table.</p>
    <a href="${DASH}" style="display:inline-block;background:#2A5741;color:#fff;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Open my dashboard →</a>
  `;
  return { subject: `The whole idea in one sentence`, html: wrap(inner) };
}

// ─── E1.5 Day 30 ──────────────────────────────────────────

function e15Day30(firstName: string) {
  const inner = `
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 16px;line-height:1.25;">${firstName}, no rush at all</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">You've been on your feet for 8 hours. You've given 5 massages. Your hands are done. Your back is done. The last thing you want to do right now is open a laptop and answer one more email.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">So this one is short. Delete it if you want. Come back to it whenever. Or never.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 24px;">We just wanted to check in.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">It's been a month since you joined MyBodyMap. If you ever get a quiet minute, maybe over tea, maybe on a Sunday, we'd love to hear how it's going. Good, not-great, or somewhere in the middle.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 12px;">Just hit reply. One sentence. No form, no survey, no rating scale.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 6px;">• "It's helping, here's what I like." We'll do more of that.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 6px;">• "It's not working for me, here's why." It goes straight into next week's build.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 24px;">• "Honestly, I haven't had a chance to look." Totally fair. You're running a practice and a body. That's two full-time jobs.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">We read every reply. Usually late at night, after our own long days. Always.</p>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;font-style:italic;">Take care of yourself first.</p>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:12px 0 0;">Cheers,</p>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;">MyBodyMap Team</p>
  `;
  return { subject: `${firstName}, no rush at all`, html: wrap(inner) };
}

// ─── E1.6 Day 60 ──────────────────────────────────────────

function e16Day60(firstName: string, customUrl: string) {
  const referralLink = `https://mybodymap.app/?ref=${customUrl}`;
  const inner = `
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 16px;line-height:1.25;">${firstName}, a quiet thank you (and a small ask)</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Hi ${firstName},</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Two months in. You've had enough sessions by now to know whether this thing earns its place in your practice or not.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">If it does, we want to say something first.</p>
    <p style="font-family:system-ui;font-size:17px;color:#1A3A28;line-height:1.7;margin:0 0 20px;font-weight:700;font-family:Georgia,serif;font-style:italic;">Thank you. Seriously. You are why this exists.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Every week, your body does physical work that most software founders will never understand. You stand, you lift, you hold space, you breathe through other people's weeks. And still you made room to try something new. That is a gift we do not take lightly.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Now the small ask.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Do you know another massage therapist out there who is buried under paper intake forms, chasing Venmo payments, wondering where their regulars went? Someone who would feel a little lighter if they found us?</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 14px;">Your personal referral link. Share it however feels natural.</p>
    <div style="text-align:center;margin:0 0 14px;">
      <a href="${referralLink}" style="display:inline-block;background:#2A5741;color:#fff;font-family:system-ui;font-size:14px;font-weight:700;padding:13px 32px;border-radius:10px;text-decoration:none;">Open your referral link →</a>
    </div>
    <div style="background:#F0FDF4;border:1.5px dashed #86EFAC;border-radius:10px;padding:12px 16px;margin:0 0 24px;text-align:center;">
      <div style="font-family:system-ui;font-size:10px;color:#2A5741;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Or copy and paste this anywhere</div>
      <a href="${referralLink}" style="font-family:'Courier New',monospace;font-size:14px;color:#2A5741;font-weight:700;word-break:break-all;text-decoration:none;">${referralLink}</a>
    </div>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 8px;"><strong style="color:#1A3A28;">What they get:</strong> full Silver tier, free for life. No trial. No credit card. No "upgrade later" trick.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;"><strong style="color:#1A3A28;">What you get:</strong> our genuine thanks, plus a small shoutout in our launch post when the time comes (with your permission).</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;font-style:italic;">No pressure. Only share it if you truly think they would love it. One therapist helping another is how healing work spreads. That is the oldest story there is.</p>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;">Cheers,</p>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0;">MyBodyMap Team</p>
  `;
  return { subject: `${firstName}, a quiet thank you (and a small ask)`, html: wrap(inner) };
}

// ─── E1.7 Practice Pulse ──────────────────────────────────

function e17Pulse(firstName: string) {
  const inner = `
    <h2 style="font-size:22px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">Your Practice Pulse</h2>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0 0 20px;">Good morning ${firstName}. Here's what's happening in your practice today.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
      <div style="background:#F0FDF4;border-left:3px solid #2A5741;padding:14px 16px;"><div style="font-size:28px;font-weight:700;color:#1A3A28;">3</div><div style="font-size:12px;color:#4B5563;margin-top:4px;">sessions today</div></div>
      <div style="background:#FEF9E7;border-left:3px solid #C59550;padding:14px 16px;"><div style="font-size:28px;font-weight:700;color:#78350F;">2</div><div style="font-size:12px;color:#4B5563;margin-top:4px;">lapsed clients</div></div>
    </div>
    <p style="font-family:system-ui;font-size:13px;color:#9CA3AF;line-height:1.7;margin:0;"><em>Sample Pulse · your real numbers fill in once you log sessions.</em></p>
  `;
  return { subject: `Your Practice Pulse for Wed, Oct 15`, html: wrap(inner) };
}

// ─── Founder outreach (E2.x, plain-text style) ────────────

function e21Welcome(n: string) {
  return {
    subject: `${n}, the 60-second question that decides how this goes`,
    lines: [
      `Hi ${n},`, ``,
      `MyBodyMap Team here. We already sent you the real welcome email with all the steps. So this one is different.`, ``,
      `This is the honest one.`, ``,
      `Here's what happens to most therapists who sign up for any new practice tool. They mean to set it up. The week gets busy. A client cancels last minute. Life happens. Three weeks later they realize they never actually used the thing, and they move on.`, ``,
      `There is one small thing that seems to prevent that pattern almost every time.`, ``,
      `Get your full client list in today. Not tomorrow. Not "when things slow down." Today.`, ``,
      `Once your real clients are in MyBodyMap, everything else follows. You see names you recognize. You send an intake to one of them. You watch their body map come back. It becomes real.`, ``,
      `If you have a CSV export from your current tool, send it to us as a reply to this email. Doesn't matter what format. Vagaro, MassageBook, Square, a messy spreadsheet, handwritten list you photographed. We will clean it up and load it in for you by tomorrow morning. No charge. No catch. Reply "import" and attach the file.`, ``,
      `Or, if you would rather do it yourself, this link takes you there now: https://mybodymap.app/dashboard`, ``,
      `Either way, today is the day this either becomes real or quietly fades. We are rooting for real.`, ``,
      `Cheers,`,
      `MyBodyMap Team`,
    ],
  };
}

function e22Checkin(n: string) {
  return {
    subject: `${n}, how are your hands?`,
    lines: [
      `Hi ${n},`, ``,
      `MyBodyMap Team here. Not writing to push anything. Just checking in.`, ``,
      `You signed up a little while ago, and we know signup week is the busiest week. New clients find you. Old clients need you. A hundred small things land on your plate that have nothing to do with the software you were going to set up on Tuesday.`, ``,
      `So we want to do something small and useful instead of sending another reminder.`, ``,
      `Want us to import your client list for you? Send us a CSV export from your current tool, or even a photo of a handwritten list. We will get it into your MyBodyMap dashboard by tomorrow morning. No forms, no back-and-forth, just send whatever you have.`, ``,
      `Or if something else is in the way, hit reply and tell us. "The payments setup confused me." "I'm not sure which plan I need." "I just need more time." Any of those, we can help with in one message.`, ``,
      `Take care of your hands this week.`, ``,
      `Cheers,`, `MyBodyMap Team`,
    ],
  };
}

function e23Reminder(n: string, days: number) {
  return {
    subject: `${n}, still thinking about you`,
    lines: [
      `Hi ${n},`, ``,
      `MyBodyMap Team here. It has been about ${days} days since you last opened MyBodyMap.`, ``,
      `We are not writing to drag you back. Your practice runs on your schedule, not ours.`, ``,
      `But we were thinking about you today, and we had a small idea.`, ``,
      `Want us to send you a short video of your dashboard? Two minutes, voiceover, walking through what's new since you last logged in and what other therapists are doing with it. No sales pitch. Just so the next time you have a quiet Sunday, you already know what you are walking back into.`, ``,
      `Reply with "yes video" and we'll record one and send it by the end of the day.`, ``,
      `Or if the honest truth is that this was not the right tool for you, tell us that too. "It did not click" is useful, and we promise to take it well.`, ``,
      `Either way, thank you for trying us. That alone is more than most therapists have time for.`, ``,
      `Cheers,`, `MyBodyMap Team`,
    ],
  };
}

function e24Testimonial(n: string, sessions: number) {
  return {
    subject: `${n}, the kindest thing you could do for another therapist`,
    lines: [
      `Hi ${n},`, ``,
      `MyBodyMap Team here. We are writing because of something real.`, ``,
      `You have logged ${sessions} sessions on MyBodyMap so far. That is not a vanity number to us. That is ${sessions} clients who walked in, were seen, and walked out a little lighter.`, ``,
      `Somewhere right now, another massage therapist is typing a search into Google. "Is there anything better than paper forms." "How do I stop losing regulars." "Something for a solo practice that actually respects my time."`, ``,
      `If they found one sentence from you, in your own words, about what this platform does for how you work, it would mean more to them than anything we could write.`, ``,
      `Would you share one sentence with us? Just hit reply. Say it how you would say it to a friend over coffee. One line. No need to be polished. No need to praise. Just true.`, ``,
      `We will put it on our site, with your name and practice (or anonymous, your call). If you want to see how we use it before committing, we will show you the draft first.`, ``,
      `And if you would rather not, no worries at all. Reply with "pass" and we will never ask again. That is a real promise.`, ``,
      `Cheers,`, `MyBodyMap Team`,
    ],
  };
}

function e25FirstSession(n: string) {
  return {
    subject: `Congrats on your first session, ${n}! 🎉`,
    lines: [
      `Hi ${n},`, ``,
      `MyBodyMap Team here. You just logged your first session on MyBodyMap. That's the hardest part.`, ``,
      `Every session after this gets easier. Your AI pre-session brief gets smarter. Your client starts seeing patterns.`, ``,
      `Anything trip you up on that first one? Reply and tell us. We iterate weekly.`, ``,
      `Cheers!`, `MyBodyMap Team`,
    ],
  };
}

function e26SetupNudge(n: string) {
  return {
    subject: `${n}, some free career advice (that we will take back in a second)`,
    lines: [
      `Hi ${n},`, ``,
      `MyBodyMap Team here with some genuinely useful career advice.`, ``,
      `Keep taking payment in Venmo, Zelle, cash, check, and occasionally baked goods. It is charming. It is personal. It is how massage therapy has worked for decades. Please do not let us talk you out of it.`, ``,
      `...`, ``,
      `Okay we lied. We're going to try to talk you out of it. Just a little.`, ``,
      `You haven't connected Stripe or Square yet. Which means when a client books through your MyBodyMap link, they can't actually pay you. Which means after a long day of holding space for everyone else, you still have to send the awkward "oh by the way, can you Venmo me" text. Which, fine. It's just one more small thing on top of a day that was already full.`, ``,
      `One minute in Settings and it's done. Clients pay the moment they book. You get to close the laptop and go back to the actual work.`, ``,
      `Want a hand walking through it? Hit reply and we'll help.`, ``,
      `Cheers,`, `MyBodyMap Team`,
    ],
  };
}

function e27Churned(n: string, days: number) {
  return {
    subject: `${n}, we miss your hands`,
    lines: [
      `Hi ${n},`, ``,
      `MyBodyMap Team here. Not writing to sell you anything. We just noticed you have not been back in about ${days} days, and we wanted to send something small.`, ``,
      `We built this platform for a particular kind of therapist. Someone who cares about their clients' actual bodies, not just their booking calendar. Someone who notices when a regular's shoulders are tighter than last month. Someone who would rather be good than fast.`, ``,
      `If that is you, and MyBodyMap fell short of that somehow, we want to know what happened. Not for a survey. For our next build.`, ``,
      `Pick whichever is easiest:`, ``,
      `- Hit reply with one sentence. What went wrong, what was missing, what you wish existed. We read every word.`,
      `- Or, if you'd like, we will get on a 15-minute call with you this week. No sales pitch. Just the two of us, listening. Reply with "call" and we'll send a link.`, ``,
      `And if the honest answer is that life got busy and MyBodyMap slipped off the list, that is a fine answer too. We understand. Your hands matter more than our retention rate.`, ``,
      `Whatever the reason, thank you for trying us. Really.`, ``,
      `Cheers,`, `MyBodyMap Team`,
    ],
  };
}

function e28ReferralThankyou(n: string) {
  return {
    subject: `Thank you, ${n}`,
    lines: [
      `Hi ${n},`, ``,
      `MyBodyMap Team here. Someone just signed up through your link. That means a lot.`, ``,
      `You're helping another therapist find something that actually fits how they practice. Thank you.`, ``,
      `If there's anything we can do to make MyBodyMap better for you, reply and tell us.`, ``,
      `Cheers!`, `MyBodyMap Team`,
    ],
  };
}

function e29ActivationNudge(n: string) {
  return {
    subject: `${n}, small things left`,
    lines: [
      `Hi ${n},`, ``,
      `MyBodyMap Team here. Just a quiet nudge. You've got a couple of setup steps left, and finishing them unlocks the whole point of the platform. No alarm, no urgency. You could knock them out during your next coffee break.`, ``,
      `If something is in the way, tell us. "I couldn't figure out the Stripe connection." "I don't know what to put for services." "I ran out of time." Any of those, we help with in one reply.`, ``,
      `Want us to walk through it on a quick call? Reply with "call" and we'll send you a 15-minute slot this week. We sit with you, you share your screen, we get it done.`, ``,
      `You are almost there.`, ``,
      `Cheers,`, `MyBodyMap Team`,
    ],
  };
}

// ─── SMS renderer ────────────────────────────────────────
// SMS previews as a phone-chat bubble so HK sees what the recipient
// sees. Character count surfaced since carriers segment at 160.

function smsPreview(body: string, meta: { from: string; to: string }): string {
  const chars = body.length;
  const segments = Math.ceil(chars / 160) || 1;
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:420px;margin:24px auto;padding:20px;background:#F5F5F7;border-radius:24px;">
      <div style="font-size:11px;color:#8E8E93;text-align:center;margin-bottom:12px;letter-spacing:0.02em;">
        <div style="font-weight:600;color:#1F2937;margin-bottom:2px;">${meta.from}</div>
        <div>Text Message</div>
      </div>
      <div style="background:#E5E5EA;color:#1F2937;padding:11px 15px;border-radius:18px;border-bottom-left-radius:4px;font-size:15px;line-height:1.4;word-wrap:break-word;">
        ${escaped}
      </div>
      <div style="margin-top:10px;font-size:10px;color:#8E8E93;text-align:center;">
        ${chars} character${chars === 1 ? "" : "s"} · ${segments} SMS segment${segments === 1 ? "" : "s"} · sent to ${meta.to}
      </div>
    </div>
  `;
}

// ─── SMS templates (from production code) ────────────────

function s11ReminderSms(clientFirst: string, therapistName: string, dateStr: string, timeStr: string, intakeUrl: string) {
  return `Hi ${clientFirst}, reminder: your session at ${therapistName} is ${dateStr} at ${timeStr}. Please fill your intake: ${intakeUrl}  Reply STOP to opt out.`;
}

function s12PostSessionSms(clientFirst: string, therapistName: string, bookingUrl: string) {
  return `Thanks for coming in today, ${clientFirst}! Book your next session at ${therapistName}: ${bookingUrl}  Reply STOP to opt out.`;
}

function s21OpeningSms(clientFirst: string, bookingUrl: string) {
  return `Hi ${clientFirst}, I have an opening this week and thought of you. Would love to see you. Grab a spot here: ${bookingUrl}`;
}

function s22CheckinSms(clientFirst: string, bookingUrl: string) {
  return `Hi ${clientFirst}, just checking in! It's been a while since your last visit. How are you feeling? I'd love to help: ${bookingUrl}`;
}

function s23SelfcareSms(clientFirst: string, bookingUrl: string) {
  return `Hi ${clientFirst}, a gentle reminder that taking care of yourself matters. I have some availability if you'd like to book: ${bookingUrl}`;
}

function s31FounderSms(therapistFirst: string, firstStep: string) {
  return `Hi ${therapistFirst},\n\nGood morning. This is MyBodyMap founder. Just wanted to send a message so you can reach out to me directly if you need any help.\n\nFirst step for you is to ${firstStep}.\n\nCheers!\nMyBodyMap founder`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Missing token" }, 401);
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const email = (payload?.email || "").toLowerCase();
      if (!ADMIN_EMAILS.has(email)) return json({ ok: false, error: "Not authorized" }, 403);
    } catch {
      return json({ ok: false, error: "Invalid token" }, 401);
    }

    const n = FAKE.first_name;
    const emails = [
      // Auto drip (E1.x)
      { id: "welcome", code: "E1.1", category: "auto_drip", label: "Welcome / Onboarding", when_fires: "Instantly when a new therapist signs up.", notes: "Warm healer voice. 5-step onboarding with CTA links per step. Any order, no hurry.", ...e11Welcome(n) },
      { id: "drip_day2", code: "E1.2", category: "auto_drip", label: "Day 2 · Pattern interrupt", when_fires: "Day 2 after signup (auto-cron).", notes: "Negative-framing humor. Uplifts therapist as healer who gives clients their breath back.", ...e12Day2(n) },
      { id: "drip_day5", code: "E1.3", category: "auto_drip", label: "Day 5 · Feel what clients feel", when_fires: "Day 5 after signup (auto-cron).", notes: "Warm healer voice. Invites therapist to take their own intake. Self-care framing.", ...e13Day5(n, FAKE.custom_url) },
      { id: "drip_day10", code: "E1.4", category: "auto_drip", label: "Day 10 · The whole idea", when_fires: "Day 10 after signup (auto-cron).", notes: "Brand voice message, anonymous 20-year therapist attribution. Not a real person.", ...e14Day10(n) },
      { id: "drip_day30", code: "E1.5", category: "auto_drip", label: "Day 30 · Soft check-in", when_fires: "Day 30 after signup (auto-cron).", notes: "Honors the therapist's long physical day. Three-option reply framework.", ...e15Day30(n) },
      { id: "drip_day60", code: "E1.6", category: "auto_drip", label: "Day 60 · Quiet thank you + referral", when_fires: "Day 60 after signup (auto-cron).", notes: "Warm gratitude first, then referral ask with specific what-they-get / what-you-get.", ...e16Day60(n, FAKE.custom_url) },
      { id: "practice_pulse", code: "E1.7", category: "auto_drip", label: "Practice Pulse", when_fires: "Every morning when therapist has activity to report.", notes: "Data digest. Neutral tone · not a place for prose voice.", ...e17Pulse(n) },

      // Founder outreach (E2.x)
      { id: "outreach_welcome", code: "E2.1", category: "founder_outreach", label: "Founder Welcome", when_fires: "Manual, fired from /founder within 24h of signup. Complements auto E1.1.", notes: "The 'honest' second welcome. Frames 'get your clients in today' as the one move that prevents fade-out. Specific CTA: reply with CSV and we'll import it for you.", subject: e21Welcome(n).subject, html: plainTextWrap(e21Welcome(n).lines) },
      { id: "outreach_checkin", code: "E2.2", category: "founder_outreach", label: "Check-in · How are your hands?", when_fires: "Manual, for therapists stalled in setup.", notes: "Offers concrete help: 'send us your CSV, we'll import.' Specific CTA, not just 'hit reply.'", subject: e22Checkin(n).subject, html: plainTextWrap(e22Checkin(n).lines) },
      { id: "outreach_reminder", code: "E2.3", category: "founder_outreach", label: "Reminder · Still thinking about you", when_fires: "Manual, for therapists gone quiet.", notes: "Offers video walkthrough CTA. Respects their schedule.", subject: e23Reminder(n, FAKE.days_since_use).subject, html: plainTextWrap(e23Reminder(n, FAKE.days_since_use).lines) },
      { id: "outreach_testimonial", code: "E2.4", category: "founder_outreach", label: "Testimonial · Kindest thing for another therapist", when_fires: "Manual, for power users.", notes: "Reframes ask as help for another therapist, not PR for us. Opt-out respected.", subject: e24Testimonial(n, FAKE.sessions_total).subject, html: plainTextWrap(e24Testimonial(n, FAKE.sessions_total).lines) },
      { id: "outreach_first_session", code: "E2.5", category: "founder_outreach", label: "First session celebration", when_fires: "Manual, after therapist logs first session.", notes: "Kept as-is. Already warm.", subject: e25FirstSession(n).subject, html: plainTextWrap(e25FirstSession(n).lines) },
      { id: "outreach_setup_nudge", code: "E2.6", category: "founder_outreach", label: "Setup nudge · Stripe/Square", when_fires: "Manual, for therapists who haven't connected payments.", notes: "Bait-and-switch career advice. Warm healer voice.", subject: e26SetupNudge(n).subject, html: plainTextWrap(e26SetupNudge(n).lines) },
      { id: "outreach_churned", code: "E2.7", category: "founder_outreach", label: "Churned · We miss your hands", when_fires: "Manual, for therapists idle 30+ days.", notes: "Offers reply OR 15-min call. Acknowledges life happens.", subject: e27Churned(n, FAKE.days_since_use).subject, html: plainTextWrap(e27Churned(n, FAKE.days_since_use).lines) },
      { id: "outreach_referral_thankyou", code: "E2.8", category: "founder_outreach", label: "Referral thank-you", when_fires: "Auto after a ref-link signup + manual backup.", notes: "Kept as-is. Already warm.", subject: e28ReferralThankyou(n).subject, html: plainTextWrap(e28ReferralThankyou(n).lines) },
      { id: "outreach_activation_nudge", code: "E2.9", category: "founder_outreach", label: "Activation nudge", when_fires: "Manual from /founder, usually with custom body built per therapist.", notes: "Placeholder shown here. Real sends use custom_subject + custom_body with missing steps named.", subject: e29ActivationNudge(n).subject, html: plainTextWrap(e29ActivationNudge(n).lines) },

      // SMS - S1.x = auto transactional to client, S2.x = manual from therapist to client, S3.x = manual from founder to therapist
      {
        id: "sms_reminder",
        code: "S1.1",
        category: "sms_auto",
        label: "24h appointment reminder",
        when_fires: "Auto, 24h before a booked session (cron).",
        notes: "Sent to client. Includes intake link so client arrives prepared. STOP keyword handles opt-out.",
        subject: "SMS (no subject)",
        html: smsPreview(
          s11ReminderSms("Sarah", "Jamie at Still Point Massage", "Thursday Oct 16", "10:00 AM", "https://mybodymap.app/intake/abc123"),
          { from: "Your practice number", to: "Client mobile" }
        ),
      },
      {
        id: "sms_post_session",
        code: "S1.2",
        category: "sms_auto",
        label: "Post-session thank-you + rebook",
        when_fires: "Auto, after the therapist logs a completed session.",
        notes: "Sent to client. Warm thank-you plus booking link for the next session.",
        subject: "SMS (no subject)",
        html: smsPreview(
          s12PostSessionSms("Sarah", "Jamie at Still Point Massage", `https://mybodymap.app/book/${FAKE.custom_url}`),
          { from: "Your practice number", to: "Client mobile" }
        ),
      },
      {
        id: "sms_opening",
        code: "S2.1",
        category: "sms_manual",
        label: "Opening available",
        when_fires: "Manual, from the therapist's Outreach page to targeted clients.",
        notes: "Uses client first name and a direct booking link. Feels personal, not mass-sent.",
        subject: "SMS (no subject)",
        html: smsPreview(
          s21OpeningSms("Sarah", `https://mybodymap.app/book/${FAKE.custom_url}`),
          { from: "Your practice number", to: "Client mobile" }
        ),
      },
      {
        id: "sms_checkin",
        code: "S2.2",
        category: "sms_manual",
        label: "Gentle check-in",
        when_fires: "Manual, from the therapist to lapsed clients.",
        notes: "No pressure, asks how they're feeling. Softer than the opening pitch.",
        subject: "SMS (no subject)",
        html: smsPreview(
          s22CheckinSms("Sarah", `https://mybodymap.app/book/${FAKE.custom_url}`),
          { from: "Your practice number", to: "Client mobile" }
        ),
      },
      {
        id: "sms_selfcare",
        code: "S2.3",
        category: "sms_manual",
        label: "Self-care reminder",
        when_fires: "Manual, from the therapist to their whole list or a segment.",
        notes: "Lowest-pressure version. Frames booking as taking care of oneself.",
        subject: "SMS (no subject)",
        html: smsPreview(
          s23SelfcareSms("Sarah", `https://mybodymap.app/book/${FAKE.custom_url}`),
          { from: "Your practice number", to: "Client mobile" }
        ),
      },
      {
        id: "sms_founder_nudge",
        code: "S3.1",
        category: "sms_founder",
        label: "Founder activation nudge",
        when_fires: "Manual, from HK to a therapist stuck on setup. Sent via HK's Google Voice.",
        notes: "Signed 'MyBodyMap founder' for personal touch. Surfaces the therapist's specific next step.",
        subject: "SMS (no subject)",
        html: smsPreview(
          s31FounderSms(n, "import your client list (step 1 of 5)"),
          { from: "MyBodyMap founder", to: `${n}'s mobile` }
        ),
      },
    ];

    return json({ ok: true, fake: FAKE, emails });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || String(e) });
  }
});
