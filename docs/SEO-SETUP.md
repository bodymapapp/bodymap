# SEO Setup Checklist for mybodymap.app

**Status as of this commit:** sitemap.xml and robots.txt are live. Structured
data (SoftwareApplication schema) is in place. Meta tags are clean (no em
dashes, proper OG card). The remaining piece requires an action from HK
in Google Search Console (10 minutes, one-time).

---

## Step 1: Submit site to Google Search Console

1. Go to https://search.google.com/search-console
2. Click "Add property"
3. Choose **"Domain"** property type (not URL prefix)
4. Enter: `mybodymap.app`
5. Google will show a TXT record to add to your domain DNS
6. Add that TXT record wherever you manage DNS (Vercel dashboard, GoDaddy,
   Namecheap, wherever mybodymap.app is registered). Takes ~15 min to
   propagate.
7. Click "Verify" back in Search Console
8. Once verified: in Search Console, go to **Sitemaps** in the left nav
9. Paste: `sitemap.xml` and click Submit

Google will start indexing within a few days. Full indexing takes 2-6 weeks
for a new site. You can check progress under **Pages** in Search Console.

---

## Step 2: (Optional) Add site verification meta tag

Alternative to the DNS method if DNS is painful. Google gives you a
snippet like:

    <meta name="google-site-verification" content="abc123xyz..." />

If you use this method instead of DNS, paste the tag in `public/index.html`
in the `<head>` section (anywhere before the closing `</head>`).

---

## Step 3: What's already done (no action needed)

- `public/sitemap.xml` lists 10 public-facing pages with priorities
- `public/robots.txt` allows crawling and points to sitemap, blocks
  private pages (/dashboard, /founder, /admin, per-client /summary, etc.)
- `public/index.html` has:
  - Clean `<title>` and meta description (no em dash)
  - Open Graph card pointing to the new 1200x630 og-card.png
  - Twitter card tags
  - Schema.org SoftwareApplication JSON-LD for rich search snippets
  - Canonical URL
  - robots meta (index, follow)

---

## Step 4: Content plan (for later — biggest lever for actual rankings)

Technical SEO alone won't rank you. The highest-leverage unclaimed search
phrases that massage therapists actually Google:

1. "Mindbody alternative for solo massage therapists"
2. "Vagaro vs [competitor] for independent LMTs"
3. "How to reduce no-shows in a massage practice"
4. "SOAP notes software for independent massage therapists"
5. "Client retention for massage therapists"
6. "Best booking system for solo massage therapist"
7. "How to track client patterns as a massage therapist"
8. "Massage practice management software comparison"

Each one of these is a 600-1000 word page that answers the question and
naturally mentions BodyMap as the solution. Target one per week. Creates
long-tail traffic that compounds over 6-12 months.

---

## Step 5: Backlinks (after content is live)

Highest-quality sources to pursue, in order:

1. ABMP resource directory (https://www.abmp.com)
2. AMTA tool listings (https://www.amta.org)
3. MBLExGuide software comparison (they maintain a big list — pitch them)
4. Reddit r/MassageTherapists (be a real contributor, not spam)
5. Massage therapy podcasts that review tools
6. Massage therapy YouTubers (send them Silver tier free for 1 year)

One good ABMP backlink = more ranking juice than 50 scrapy SEO directories.
