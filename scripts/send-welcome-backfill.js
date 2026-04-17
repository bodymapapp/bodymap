#!/usr/bin/env node
// One-time backfill: send welcome email to all real therapist accounts
// Run: node scripts/send-welcome-backfill.js

const SUPABASE_URL  = 'https://rmnqfrljoknmellbnpiy.supabase.co';
const ANON_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbnFmcmxqb2tubWVsbGJucGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDg4MDMsImV4cCI6MjA4NzMyNDgwM30.FiZzRBOtjbeGA6cWhj3YhTu87F0dImSsK8joMiWab9E';
const RESEND_KEY    = 're_STV4eeGC_8sHsVpQwaSjMyaqWUceAo18A';

// Test/internal accounts to skip
const SKIP_EMAILS = [
  'bodymapdemo@gmail.com',
  'bodymap01@gmail.com',
  'hk5@email.com',
  'testtherapistapr15@email.com',
  'sarah.demo@bodymap.test',
];

const SKIP_URLS = [
  'bodymapdemopractice',
  'hk5',
  'testtherapistapr15',
  'serenitystudio',   // remove this if serenitystudio is a real paying therapist
];

async function fetchTherapists() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/therapists?select=full_name,email,custom_url,created_at&order=created_at.asc`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
  });
  return res.json();
}

async function sendWelcome(therapist) {
  const firstName   = therapist.full_name?.split(' ')[0] || 'there';
  const customUrl   = therapist.custom_url || '';
  const dashLink    = 'https://mybodymap.app/dashboard';
  const bookingLink = `https://mybodymap.app/book/${customUrl}`;

  const steps = [
    { n:'1', title:'Move your clients over',
      body:'Import from Square, MassageBook, Vagaro, or any CSV in two clicks. Go to <b>Clients &gt; Import Clients</b> and upload your export file. Any row with a name, phone, or email comes in. Missing info can be added later.',
      link: dashLink, cta:'Import clients' },
    { n:'2', title:'Add your first service',
      body:'Tell clients what you offer and at what price. Go to <b>Settings &gt; Services</b> and add your massage types, duration, and price. This is what shows on your booking page.',
      link: dashLink, cta:'Settings' },
    { n:'3', title:'Set your working hours',
      body:'Clients can only book during your available times. Go to <b>Settings &gt; Availability</b> and toggle on your working days and set your start and end times.',
      link: dashLink, cta:'Set hours' },
    { n:'4', title:'Share your booking link',
      body:`Your personal booking page is live at <a href="${bookingLink}" style="color:#2A5741;">${bookingLink}</a>. Share it in your email signature, Instagram bio, or text it directly to clients. They book, fill their body map, and you see it all before they arrive.`,
      link: bookingLink, cta:'View your booking page' },
    { n:'5', title:'Send your first intake',
      body:'Go to <b>Clients &gt; Send Intake</b> and send the body map link to your first client. They tap their focus zones, pressure preference, and any areas to avoid. It will be waiting in your dashboard before they arrive. After the first session, BodyMap remembers everything for next time.',
      link: dashLink, cta:'Send an intake' },
  ];

  const stepsHtml = steps.map(s => `
    <div style="border-left:3px solid #2A5741;padding:16px 20px;margin-bottom:20px;background:#F9FAF9;border-radius:0 8px 8px 0;">
      <div style="font-family:system-ui;font-size:11px;font-weight:700;color:#6B9E80;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Step ${s.n}</div>
      <div style="font-size:17px;font-weight:700;color:#1A3A28;margin-bottom:8px;">${s.title}</div>
      <div style="font-family:system-ui;font-size:14px;color:#4B5563;line-height:1.7;margin-bottom:12px;">${s.body}</div>
      <a href="${s.link}" style="font-family:system-ui;font-size:13px;font-weight:700;color:#2A5741;text-decoration:none;">Go to ${s.cta} &rarr;</a>
    </div>
  `).join('');

  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;">
      <div style="margin-bottom:28px;">
        <span style="font-size:22px;font-weight:700;color:#1A3A28;">BodyMap</span>
        <span style="display:block;font-family:system-ui;font-size:11px;font-weight:700;color:#6B9E80;letter-spacing:0.12em;text-transform:uppercase;margin-top:2px;">Client Intelligence</span>
      </div>
      <h1 style="font-size:26px;font-weight:700;color:#1A3A28;margin:0 0 8px;">Welcome, ${firstName}.</h1>
      <p style="font-family:system-ui;font-size:15px;color:#6B7280;line-height:1.7;margin:0 0 32px;">Your BodyMap practice is ready. Here are your first 5 steps. Each takes under 2 minutes.</p>
      ${stepsHtml}
      <div style="background:#2A5741;border-radius:12px;padding:24px;margin-top:32px;text-align:center;">
        <p style="font-family:system-ui;font-size:14px;color:rgba(255,255,255,0.8);margin:0 0 16px;">Questions? Just reply to this email. We read every one.</p>
        <a href="${dashLink}" style="display:inline-block;background:#fff;color:#2A5741;font-family:system-ui;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Open my dashboard &rarr;</a>
      </div>
      <p style="font-family:system-ui;font-size:12px;color:#9CA3AF;margin-top:32px;line-height:1.6;">
        The BodyMap Team &middot; <a href="https://mybodymap.app" style="color:#9CA3AF;">mybodymap.app</a><br/>
        Built for massage therapists, by a massage therapist.
      </p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({
      from: 'The BodyMap Team <reminders@mybodymap.app>',
      to: [therapist.email],
      subject: `Welcome to BodyMap, ${firstName} - here's how to get started`,
      html,
    }),
  });
  return res.json();
}

async function main() {
  console.log('Fetching therapists...\n');
  const therapists = await fetchTherapists();

  if (!Array.isArray(therapists)) {
    console.log('Error fetching therapists:', therapists);
    return;
  }

  const real = therapists.filter(t => {
    if (!t.email) return false;
    if (SKIP_EMAILS.includes(t.email.toLowerCase())) return false;
    if (SKIP_URLS.includes(t.custom_url?.toLowerCase())) return false;
    return true;
  });

  console.log(`Found ${therapists.length} total, ${real.length} real accounts:\n`);
  real.forEach(t => console.log(`  ${t.email} (${t.custom_url}) — joined ${t.created_at?.slice(0,10)}`));
  console.log('');

  for (const t of real) {
    process.stdout.write(`Sending to ${t.email}... `);
    try {
      const result = await sendWelcome(t);
      if (result.id) console.log(`sent (${result.id})`);
      else console.log(`failed:`, JSON.stringify(result));
    } catch(e) {
      console.log(`error:`, e.message);
    }
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\nDone.');
}

main();
