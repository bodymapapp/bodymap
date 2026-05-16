// api/agreement-preview.js
//
// HK May 15 2026: 'It loaded up as mybodymap.app preview not a client
// agreement preview.'
//
// SMS/iMessage/WhatsApp/Slack preview crawlers fetch the URL and read
// the static HTML for <title> and og:* tags. The React SPA they would
// otherwise hit only renders these tags after JavaScript executes,
// which preview crawlers don't run. So the static index.html with our
// marketing OG tags was what they saw.
//
// This serverless function intercepts /s/* and /agreement-sign/*
// paths via vercel.json rewrites, fetches the matching row from
// Supabase server-side, and returns purpose-built HTML with the
// correct OG tags. For real human visitors, the same HTML includes
// a meta refresh that hands off to the SPA at the same URL with a
// query param so the rewrite does not fire a second time.
//
// Runtime: Node.js (Vercel's default for /api routes).

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fallbackHtml() {
  // Minimal generic fallback if Supabase is unreachable. Falls
  // through to the SPA which will show the proper error state.
  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>Client Agreement</title>
<meta property="og:title" content="Client Agreement">
<meta property="og:description" content="Read and sign your client agreement.">
<meta http-equiv="refresh" content="0;url=/?from=preview">
</head><body><p>Loading...</p></body></html>`;
}

export default async function handler(req, res) {
  const url = req.url || '';
  // The rewrite passes the original path via the URL. Extract the
  // last segment as the lookup key.
  const pathOnly = url.split('?')[0];
  const segments = pathOnly.split('/').filter(Boolean);
  // segments[0] = 's' or 'agreement-sign', segments[1] = the code
  const route = segments[0];
  const key = segments[1];

  if (!key || (route !== 's' && route !== 'agreement-sign')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(fallbackHtml());
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(fallbackHtml());
    return;
  }

  const column = route === 's' ? 'short_code' : 'token';

  let therapistBusinessName = '';
  try {
    // Fetch via Supabase REST API directly to avoid pulling in the
    // SDK as a dependency.
    const reqUrl = `${SUPABASE_URL}/rest/v1/agreement_send_requests?${column}=eq.${encodeURIComponent(key)}&select=therapist_id`;
    const reqResp = await fetch(reqUrl, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (reqResp.ok) {
      const rows = await reqResp.json();
      const therapistId = rows[0]?.therapist_id;
      if (therapistId) {
        const tUrl = `${SUPABASE_URL}/rest/v1/therapists?id=eq.${therapistId}&select=business_name,full_name`;
        const tResp = await fetch(tUrl, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });
        if (tResp.ok) {
          const tRows = await tResp.json();
          therapistBusinessName = tRows[0]?.business_name || tRows[0]?.full_name || '';
        }
      }
    }
  } catch (e) {
    // Fallthrough to generic preview if Supabase is down
  }

  const fromName = therapistBusinessName ? ` from ${therapistBusinessName}` : '';
  const title = `Client Agreement${fromName}`;
  const description = therapistBusinessName
    ? `Please read and sign the client agreement from ${therapistBusinessName}. Tap to open and sign on your phone.`
    : 'Please read and sign your client agreement. Tap to open and sign on your phone.';

  // Pass through to the SPA after the crawler has read the meta tags.
  // Real users see a 0-second meta refresh to the same URL with a
  // ?spa=1 query param so the rewrite does not fire again. The SPA
  // ignores this param.
  const spaUrl = `${pathOnly}?spa=1`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">

  <!-- Open Graph (Facebook, iMessage, Slack, WhatsApp) -->
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="https://www.mybodymap.app/og-card-v3.png">
  <meta property="og:url" content="https://www.mybodymap.app${escapeHtml(pathOnly)}">
  <meta property="og:site_name" content="MyBodyMap">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="https://www.mybodymap.app/og-card-v3.png">

  <!-- Send real human visitors through to the SPA. Crawlers ignore
       meta refresh, so they get the metadata above and move on. -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(spaUrl)}">
  <link rel="canonical" href="https://www.mybodymap.app${escapeHtml(pathOnly)}">

  <style>
    body { font-family: Georgia, serif; background:#F5EFE0; color:#1F2937; padding:32px; text-align:center; }
    .loading { margin-top:18px; color:#6B7280; font-size:14px; }
  </style>
</head>
<body>
  <p style="font-size:18px; font-weight:700; margin:0;">${escapeHtml(title)}</p>
  <p class="loading">Loading your agreement...</p>
  <noscript>
    <p>JavaScript is required to read and sign this agreement. Please open the link in a modern web browser.</p>
  </noscript>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  res.status(200).send(html);
}
