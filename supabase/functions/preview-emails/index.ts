// Preview edge function — renders every email template with sample data.
// Used by the /founder/emails page to let HK review copy in one place.
//
// IMPORTANT TECHNICAL DEBT: this file duplicates template code from
// send-drip, send-welcome, practice-pulse, and founder-outreach. Supabase
// edge functions don't cleanly share code across directories, so for now
// we vendor. When changing an email:
//   1. Change it in the real send function (send-drip, etc.)
//   2. Change it here too
//   3. Consider extracting to supabase/functions/_shared/email_templates.ts
//      if the list grows past ~20 templates
//
// Auth: admin email allowlist via JWT check. Returns JSON array:
//   [{ id, category, subject, html, when_fires, notes }]

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

// ─── Sample data ─────────────────────────────────────────

const FAKE = {
  first_name: "Sarah",
  full_name: "Sarah Mitchell",
  email: "sarah@example.com",
  custom_url: "sarahmitchell",
  days_on_platform: 34,
  days_since_use: 12,
  sessions_total: 47,
  practice_name: "Still Point Massage",
};

const DASH_LINK = "https://mybodymap.app/dashboard";
const BOOK_LINK = `https://mybodymap.app/book/${FAKE.custom_url}`;

// ─── Shared chrome ───────────────────────────────────────

function wrap(inner: string) {
  return `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;">
      <div style="margin-bottom:24px;">
        <span style="font-size:20px;font-weight:700;color:#1A3A28;">BodyMap</span>
        <span style="display:block;font-family:system-ui;font-size:11px;font-weight:700;color:#6B9E80;letter-spacing:0.12em;text-transform:uppercase;margin-top:2px;">Client Intelligence</span>
      </div>
      ${inner}
      <p style="font-family:system-ui;font-size:12px;color:#9CA3AF;margin-top:32px;line-height:1.7;text-align:center;">
        Reply any time, we read every email.<br/>
        <span style="color:#D1D5DB;">The BodyMap Team &middot; <a href="https://mybodymap.app" style="color:#9CA3AF;">mybodymap.app</a></span>
      </p>
    </div>
  `;
}

function plainTextWrap(lines: string[]) {
  // For founder-outreach emails that are plain-text style
  return `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;font-size:15px;color:#1F2937;line-height:1.7;">
      <div style="margin-bottom:24px;">
        <span style="font-size:20px;font-weight:700;color:#1A3A28;">BodyMap</span>
      </div>
      ${lines.map(l => l === "" ? "<br/>" : `<p style="margin:0 0 4px;">${l}</p>`).join("\n")}
    </div>
  `;
}

// ─── Drip templates (vendored from send-drip/index.ts) ───

function welcomeEmail(firstName: string) {
  const inner = `
    <h2 style="font-size:26px;font-weight:700;color:#1A3A28;margin:0 0 16px;line-height:1.25;">Welcome to BodyMap, ${firstName} 🌿</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Your back office just went on autopilot.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">Here's what happens next, so you know what to expect:</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 6px;"><strong style="color:#1A3A28;">Today:</strong> Connect Stripe, add your first service, set your hours.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 6px;"><strong style="color:#1A3A28;">This week:</strong> Send your BodyMap link to one regular client. Watch them light up.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;"><strong style="color:#1A3A28;">Ongoing:</strong> We'll send short, useful tips every few days. Nothing salesy.</p>
    <a href="${DASH_LINK}" style="display:inline-block;background:#2A5741;color:#fff;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Open my dashboard →</a>
  `;
  return { subject: `${firstName}, your back office just went on autopilot 🌿`, html: wrap(inner) };
}

function day2Email(firstName: string, dashLink: string) {
  const inner = `
    <div style="background:#E8F0EA;border:1px solid #C8DCCC;border-radius:8px;padding:4px 10px;display:inline-block;margin-bottom:16px;">
      <span style="font-family:system-ui;font-size:11px;font-weight:700;color:#2A5741;text-transform:uppercase;letter-spacing:0.08em;">🌿 Day 2 · Unusual energy</span>
    </div>
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">3 reasons BodyMap might be a terrible idea for you</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Hey ${firstName}, every software company in the world sends you the same email. "Here are 17 reasons you need us." We got tired of writing it. You're probably tired of reading it. So let's flip it.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Here are 3 reasons BodyMap might be a terrible idea for you. Said with love.</p>
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
    <a href="${dashLink}" style="display:inline-block;background:#2A5741;color:#fff;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Open my dashboard →</a>
  `;
  return { subject: `3 reasons BodyMap might be a terrible idea, ${firstName}`, html: wrap(inner) };
}

function day5Email(firstName: string, customUrl: string, dashLink: string) {
  const selfIntakeLink = `https://mybodymap.app/book/${customUrl}`;
  const inner = `
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">Try your own body map before your next client does</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">Hey ${firstName}, this one takes 60 seconds and changes how you'll think about intake forever.</p>
    <div style="background:#F9FAF9;border-radius:10px;padding:20px;margin-bottom:20px;">
      <p style="font-family:Georgia,serif;font-size:16px;color:#1A3A28;line-height:1.7;margin:0 0 8px;font-style:italic;">Send the body map to yourself.</p>
      <p style="font-family:system-ui;font-size:14px;color:#4B5563;line-height:1.7;margin:0;">Pretend you're a new client booking with you. Walk through the intake. Tap your own zones. See what your clients see.</p>
    </div>
    <a href="${selfIntakeLink}" style="display:inline-block;background:#2A5741;color:#fff;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:24px;">Take the intake yourself →</a>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 10px;">When you're done, two things usually happen:</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 6px;"><strong style="color:#1A3A28;">1.</strong> You realize it's way easier than what your clients fill out today.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 24px;"><strong style="color:#1A3A28;">2.</strong> You see your own dashboard light up with real data. Your own body map waiting, pressure preference, areas to avoid. That's what you get for every client going forward.</p>
  `;
  return { subject: `${firstName}, send yourself the body map`, html: wrap(inner) };
}

function day10Email(firstName: string, dashLink: string) {
  const inner = `
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">${firstName}, what Terra said about BodyMap</h2>
    <div style="background:#F9FAF9;border-left:3px solid #C59550;padding:20px 24px;margin:20px 0;">
      <p style="font-family:Georgia,serif;font-size:17px;color:#1A3A28;line-height:1.7;margin:0 0 10px;font-style:italic;">"Damn I like that. Gets right to the point and I don't have to do anything. Sweet."</p>
      <p style="font-family:system-ui;font-size:12px;color:#6B7280;margin:0;">— Terra, BodyMap therapist</p>
    </div>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">That was Terra's reaction the first time a BodyMap intake landed pre-filled in her dashboard. No typing. No chasing. Client filled it out on their phone while waiting for coffee.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 24px;">If you're not doing this yet, grab a regular client and send them your BodyMap link today. One send, one conversation, they'll never fill out another paper form.</p>
    <a href="${dashLink}" style="display:inline-block;background:#2A5741;color:#fff;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Open my dashboard →</a>
  `;
  return { subject: `${firstName}, what Terra said about BodyMap`, html: wrap(inner) };
}

function day30Email(firstName: string) {
  const inner = `
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 16px;line-height:1.25;">${firstName}, no rush at all</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">You've been on your feet for 8 hours. You've given 5 massages. Your hands are done. Your back is done. The last thing you want to do right now is open a laptop and answer one more email.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">So this one is short. Delete it if you want. Come back to it whenever. Or never.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 24px;">We just wanted to check in.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;">It's been a month since you joined BodyMap. If you ever get a quiet minute, maybe over tea, maybe on a Sunday, we'd love to hear how it's going. Good, not-great, or somewhere in the middle.</p>
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

function day60Email(firstName: string, customUrl: string) {
  const referralLink = `https://mybodymap.app/?ref=${customUrl}`;
  const inner = `
    <h2 style="font-size:24px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">${firstName}, a small ask (with a free thing attached)</h2>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">You've been on BodyMap for two months. Long enough to know if it fits your practice or not.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">If it does, here's a small ask: know another solo massage therapist who could use this? Share your link.</p>
    <div style="background:#F9FAF9;border-radius:10px;padding:16px 20px;margin:20px 0;">
      <p style="font-family:system-ui;font-size:12px;color:#6B7280;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Your referral link</p>
      <p style="font-family:Courier New, monospace;font-size:14px;color:#1A3A28;margin:0;font-weight:600;">${referralLink}</p>
    </div>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;"><strong style="color:#1A3A28;">What they get:</strong> full Silver tier, free for life. No trial, no credit card, no expiration.</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 20px;"><strong style="color:#1A3A28;">What you get:</strong> our genuine thanks, plus we'll mention you in our launch announcement (with your permission).</p>
    <p style="font-family:system-ui;font-size:15px;color:#4B5563;line-height:1.7;margin:0 0 16px;">No pressure. Only share it if you actually think they'd love it.</p>
  `;
  return { subject: `${firstName}, a small ask (with a free thing attached) 🌿`, html: wrap(inner) };
}

function pulseEmail(firstName: string) {
  const inner = `
    <h2 style="font-size:22px;font-weight:700;color:#1A3A28;margin:0 0 12px;line-height:1.25;">Your Practice Pulse</h2>
    <p style="font-family:system-ui;font-size:14px;color:#6B7280;line-height:1.7;margin:0 0 20px;">Good morning ${firstName}. Here's what's happening in your practice today.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
      <div style="background:#F0FDF4;border-left:3px solid #2A5741;padding:14px 16px;"><div style="font-size:28px;font-weight:700;color:#1A3A28;">3</div><div style="font-size:12px;color:#4B5563;margin-top:4px;">sessions today</div></div>
      <div style="background:#FEF9E7;border-left:3px solid #C59550;padding:14px 16px;"><div style="font-size:28px;font-weight:700;color:#78350F;">2</div><div style="font-size:12px;color:#4B5563;margin-top:4px;">lapsed clients</div></div>
    </div>
    <p style="font-family:system-ui;font-size:13px;color:#9CA3AF;line-height:1.7;margin:0;"><em>Sample Pulse — your real numbers fill in once you log sessions.</em></p>
  `;
  return { subject: `Your Practice Pulse for Wed, Oct 15`, html: wrap(inner) };
}

// ─── Founder outreach templates (vendored from founder-outreach/index.ts) ─

function outreachWelcome(name: string) {
  return {
    subject: `Welcome to BodyMap, ${name}`,
    lines: [
      `Hi ${name},`, ``,
      `MyBodyMap Team here. Welcome to BodyMap. First step to get value fast is to bring your full client list in.`, ``,
      `Reply if you need help. Cheers!`, ``,
      `MyBodyMap Team`,
    ],
  };
}
function outreachCheckin(name: string) {
  return {
    subject: `Checking in, ${name}`,
    lines: [
      `Hi ${name},`, ``,
      `MyBodyMap Team here. Just checking in. Are things clicking for you on BodyMap, or running into anything we could help with?`, ``,
      `Hit reply with whatever's on your mind. One sentence works fine.`, ``,
      `Cheers!`,
      `MyBodyMap Team`,
    ],
  };
}
function outreachReminder(name: string, days: number) {
  return {
    subject: `Haven't seen you in a bit, ${name}`,
    lines: [
      `Hi ${name},`, ``,
      `MyBodyMap Team here. It's been about ${days} days since you last used BodyMap. No pressure, just wanted to make sure you didn't hit a wall anywhere.`, ``,
      `If something's missing, reply and tell us. It goes straight to the build list.`, ``,
      `Cheers!`,
      `MyBodyMap Team`,
    ],
  };
}
function outreachTestimonial(name: string) {
  return {
    subject: `Quick favor, ${name}`,
    lines: [
      `Hi ${name},`, ``,
      `MyBodyMap Team here. You're one of the therapists who's really been making BodyMap a daily part of your practice. Thank you.`, ``,
      `If you've got 30 seconds, we'd love one sentence from you about what's working. We'd use it on our Features page. Any other therapist seeing your name would probably give it a serious look.`, ``,
      `If not your thing, no worries. Just hit reply with "pass" and we won't ask again.`, ``,
      `Cheers!`,
      `MyBodyMap Team`,
    ],
  };
}
function outreachFirstSession(name: string) {
  return {
    subject: `Congrats on your first session, ${name}! 🎉`,
    lines: [
      `Hi ${name},`, ``,
      `MyBodyMap Team here. You just logged your first session on BodyMap. That's the hardest part.`, ``,
      `Every session after this gets easier. Your AI pre-session brief gets smarter. Your client starts seeing patterns.`, ``,
      `Anything trip you up on that first one? Reply and tell us. We iterate weekly.`, ``,
      `Cheers!`,
      `MyBodyMap Team`,
    ],
  };
}
function outreachSetupNudge(name: string) {
  return {
    subject: `${name}, some free career advice (that we will take back in a second)`,
    lines: [
      `Hi ${name},`, ``,
      `MyBodyMap Team here with some genuinely useful career advice.`, ``,
      `Keep taking payment in Venmo, Zelle, cash, check, and occasionally baked goods. It is charming. It is personal. It is how massage therapy has worked for decades. Please do not let us talk you out of it.`, ``,
      `...`, ``,
      `Okay we lied. We're going to try to talk you out of it. Just a little.`, ``,
      `You haven't connected Stripe or Square yet. Which means when a client books through your BodyMap link, they can't actually pay you. Which means after a long day of holding space for everyone else, you still have to send the awkward "oh by the way, can you Venmo me" text. Which, fine. It's just one more small thing on top of a day that was already full.`, ``,
      `One minute in Settings and it's done. Clients pay the moment they book. You get to close the laptop and go back to the actual work.`, ``,
      `Want a hand walking through it? Hit reply and we'll help.`, ``,
      `Cheers,`,
      `MyBodyMap Team`,
    ],
  };
}
function outreachChurned(name: string, days: number) {
  return {
    subject: `Still with us, ${name}?`,
    lines: [
      `Hi ${name},`, ``,
      `MyBodyMap Team here. It's been ${days} days since you last used BodyMap. Not writing to push you back in. Writing to ask what didn't work.`, ``,
      `One sentence back would mean a lot. Thank you.`, ``,
      `Cheers!`,
      `MyBodyMap Team`,
    ],
  };
}
function outreachReferralThankyou(name: string) {
  return {
    subject: `Thank you, ${name}`,
    lines: [
      `Hi ${name},`, ``,
      `MyBodyMap Team here. Someone just signed up through your link. That means a lot.`, ``,
      `You're helping another therapist find something that actually fits how they practice. Thank you.`, ``,
      `If there's anything we can do to make BodyMap better for you, reply and tell us.`, ``,
      `Cheers!`,
      `MyBodyMap Team`,
    ],
  };
}
function outreachActivationNudge(name: string) {
  return {
    subject: `Quick hello from BodyMap`,
    lines: [
      `Hi ${name},`, ``,
      `MyBodyMap Team here. Noticed you started setting up BodyMap but haven't quite finished. Happens to all of us — the world gets loud, the to-do list gets long.`, ``,
      `You've got 2 steps left. Takes about 5 minutes. Want me to walk you through them? Just reply.`, ``,
      `Cheers!`,
      `MyBodyMap Team`,
    ],
  };
}

// ─── Main handler ────────────────────────────────────────

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
    const fn = FAKE.full_name.split(" ")[0];

    const emails = [
      // Auto drip
      {
        id: "welcome",
        category: "auto_drip",
        label: "Welcome",
        when_fires: "Instantly when a new therapist signs up.",
        notes: "Sets tone for the whole relationship. First impression.",
        ...welcomeEmail(fn),
      },
      {
        id: "drip_day2",
        category: "auto_drip",
        label: "Day 2 — Pattern interrupt",
        when_fires: "Day 2 after signup (auto-cron).",
        notes: "New warm-honest voice v4. Negative framing with humor. Uplifts therapist as healer.",
        ...day2Email(fn, DASH_LINK),
      },
      {
        id: "drip_day5",
        category: "auto_drip",
        label: "Day 5 — Send yourself the body map",
        when_fires: "Day 5 after signup (auto-cron).",
        notes: "Product tip. Still in old voice, candidate for rewrite.",
        ...day5Email(fn, FAKE.custom_url, DASH_LINK),
      },
      {
        id: "drip_day10",
        category: "auto_drip",
        label: "Day 10 — Terra quote",
        when_fires: "Day 10 after signup (auto-cron).",
        notes: "Real testimonial from Terra. Short, authentic. Don't overthink.",
        ...day10Email(fn, DASH_LINK),
      },
      {
        id: "drip_day30",
        category: "auto_drip",
        label: "Day 30 — Soft check-in",
        when_fires: "Day 30 after signup (auto-cron).",
        notes: "New warm-honest voice v4. Honors the therapist's long physical day.",
        ...day30Email(fn),
      },
      {
        id: "drip_day60",
        category: "auto_drip",
        label: "Day 60 — Referral ask",
        when_fires: "Day 60 after signup (auto-cron). Moved from Day 21.",
        notes: "Referral ask. Still in old voice, candidate for rewrite.",
        ...day60Email(fn, FAKE.custom_url),
      },
      {
        id: "practice_pulse",
        category: "auto_drip",
        label: "Practice Pulse",
        when_fires: "Every morning. Skipped if therapist has no activity or has it disabled.",
        notes: "Data digest. Not a place for voice rewrites — keep it neutral and useful.",
        ...pulseEmail(fn),
      },

      // Founder outreach (manual from /founder dashboard)
      {
        id: "outreach_welcome",
        category: "founder_outreach",
        label: "Founder Welcome",
        when_fires: "Manual, fired from /founder. Usually redundant with auto welcome.",
        notes: "Backward-compat. Rarely used now.",
        subject: outreachWelcome(n).subject,
        html: plainTextWrap(outreachWelcome(n).lines),
      },
      {
        id: "outreach_checkin",
        category: "founder_outreach",
        label: "Check-in",
        when_fires: "Manual, when HK wants to nudge an active therapist.",
        notes: "Still in old voice, candidate for rewrite.",
        subject: outreachCheckin(n).subject,
        html: plainTextWrap(outreachCheckin(n).lines),
      },
      {
        id: "outreach_reminder",
        category: "founder_outreach",
        label: "Reminder (days idle)",
        when_fires: "Manual, for therapists who started strong then went quiet.",
        notes: "Functional. Could be rewritten to be warmer.",
        subject: outreachReminder(n, FAKE.days_since_use ?? 14).subject,
        html: plainTextWrap(outreachReminder(n, FAKE.days_since_use ?? 14).lines),
      },
      {
        id: "outreach_testimonial",
        category: "founder_outreach",
        label: "Testimonial ask",
        when_fires: "Manual, for power users with many sessions.",
        notes: "Transactional today. Could be warmer and more specific.",
        subject: outreachTestimonial(n).subject,
        html: plainTextWrap(outreachTestimonial(n).lines),
      },
      {
        id: "outreach_first_session",
        category: "founder_outreach",
        label: "First session celebration",
        when_fires: "Manual, right after a therapist logs their first session.",
        notes: "Already warm. Low priority for rewrites.",
        subject: outreachFirstSession(n).subject,
        html: plainTextWrap(outreachFirstSession(n).lines),
      },
      {
        id: "outreach_setup_nudge",
        category: "founder_outreach",
        label: "Setup nudge — Stripe/Square",
        when_fires: "Manual, for therapists who haven't connected payments.",
        notes: "New warm-honest voice v4. Bait-and-switch career advice.",
        subject: outreachSetupNudge(n).subject,
        html: plainTextWrap(outreachSetupNudge(n).lines),
      },
      {
        id: "outreach_churned",
        category: "founder_outreach",
        label: "Churned",
        when_fires: "Manual, for therapists idle 30+ days.",
        notes: "Already decent. Could lift tone further.",
        subject: outreachChurned(n, FAKE.days_since_use ?? 45).subject,
        html: plainTextWrap(outreachChurned(n, FAKE.days_since_use ?? 45).lines),
      },
      {
        id: "outreach_referral_thankyou",
        category: "founder_outreach",
        label: "Referral thank-you",
        when_fires: "Auto after a ref-link signup + manual backup option.",
        notes: "Already warm. Low priority for rewrites.",
        subject: outreachReferralThankyou(n).subject,
        html: plainTextWrap(outreachReferralThankyou(n).lines),
      },
      {
        id: "outreach_activation_nudge",
        category: "founder_outreach",
        label: "Activation nudge",
        when_fires: "Manual from /founder, usually with custom body built per therapist.",
        notes: "This is a placeholder — real sends use custom_subject + custom_body based on missing steps.",
        subject: outreachActivationNudge(n).subject,
        html: plainTextWrap(outreachActivationNudge(n).lines),
      },
    ];

    return json({ ok: true, fake: FAKE, emails });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || String(e) });
  }
});
