# MyBodyMap Email Broadcast Voice Guide
**Canonical reference. The voice we always write in.**

Captured from HK's actual product update broadcast on 2026-04-29 (sent to 28 therapists).

## Persona
- **Joy** — never HK, never initials, never first-person founder voice with a male name.
- Voice is **warm, feminine, plain-spoken**.
- Reader is a **70-year-old female solo LMT** who is tired, busy, juggling, and has heard a thousand pitches.

## Hard rules
1. **Sign-off:** *"With care, Joy, MyBodyMap Team"*. Never HK. Never just "MyBodyMap Team" without Joy.
2. **No em dashes anywhere.** Use commas, periods, or parentheses instead.
3. **No jargon without translation.** When a technical term must appear, follow it with a plain-English parenthetical: *"longitudinal pattern intelligence (a fancy word for client-preference patterns)"*.
4. **Transparency lines built in.** When a feature could feel imposed, add the opt-out inline: *"or you can turn it off if you don't like AI"*.
5. **Always link a specific page**, not just `/dashboard`. Example: `/dashboard/settings` so readers land where the work happens.
6. **Always include a `{name}` token** in subject and first line so the Edge Function substitutes per recipient.

## Structure (every broadcast)

### 1. Greeting
*"Hi {name},"*

### 2. Warm human acknowledgment (one sentence)
Acknowledge their day, their tiredness, or what they're juggling. Examples:
- *"I am sure you had a long day. So something to cheer you up."*
- *"Sundays come and go fast for solo therapists."*
- *"Long week, I bet. Quick lift for you."*

### 3. Joy intro + the goal in one sentence
*"Joy from MyBodyMap. We modernized the settings for you, with one goal in mind: give you back the hours you give everyone else."*

The goal sentence is always **time-back framed**, never feature-framed.

### 4. The body (numbered sections)
- **4 numbered sections max** (more feels like homework)
- Each section: **one-line intro + 6-7 specific features as a PROSE paragraph**, not a bullet list
- Use periods, not semicolons, between features (more readable on mobile)
- Mention named items where possible (Hot stones, aromatherapy, hot towels) — concreteness > abstraction
- Include opt-outs and transparency where relevant

### 5. The bonus line
One short sentence after the numbered sections highlighting the unsung feature:
*"Plus regional pricing intelligence so you know what therapists in your zip charge before you set yours."*

### 6. The close (time-back + emotional list)
Always 2 sentences:

> *"Two minutes today gives you back hundreds of hours over the year. Hours for your own body. For the clients you love. For your family. For yourself."*

The four-item list is non-negotiable: **own body, clients, family, yourself**. In that order. This is the emotional payoff of the entire email.

### 7. Direct dashboard link
A clickable URL on its own line, pointing to the specific page where the action is.

### 8. Sign-off
```
With care,
Joy
MyBodyMap Team
```

---

## CANONICAL EXAMPLE — Product Update Broadcast (sent 2026-04-29)

```
Hi {name},

Joy from MyBodyMap. I am sure you had a long day. So something to cheer you up. We modernized the settings for you, with one goal in mind: give you back the hours you give everyone else.

What's new across four areas.

1. How you practice. Your dashboard now greets you with live stats. Setup went from 125 clicks to 25. We added smart defaults so you can start on day one. Mobile flow is smoother. Booking link auto-updates with your business name. Service hours pre-fill Monday to Friday 9 to 5. Buffer time between sessions is set for you. Profile photo and intake link are one tap away.

2. What you offer. Add-ons are live (hot stones, aromatherapy, hot towels, extended sessions, CBD oil). Packages let clients buy 3, 5, or 10 sessions at a discount. Memberships bring monthly recurring revenue. Group classes for stretch, breathwork, or self-massage workshops. Gift certificates ready to sell. Referral codes built in. Three pricing tiers, one for every kind of client.

3. How you rest easier. AI features quietly read every client's history before they walk in, or you can turn it off if you don't like AI. Practice Pulse sends you a 6 PM digest of your day. Reminders go out automatically by text and email. Lapsed client alerts so no one slips away. Push notifications for new bookings. Notification preferences in your hands. AI chat with full client history when you need to remember a detail.

4. Your membership. Bronze stays free for life with five sessions per client. Silver at $19 a month is unlimited everything. All include the visual body map, AI brief, longitudinal pattern intelligence (a fancy word for client-preference patterns), full SOAP notes, and the secure HIPAA-encrypted vault. Cancel anytime.

Plus regional pricing intelligence so you know what therapists in your zip charge before you set yours.

Two minutes today gives you back hundreds of hours over the year. Hours for your own body. For the clients you love. For your family. For yourself.

https://www.mybodymap.app/dashboard/settings

With care,
Joy
MyBodyMap Team
```

---

## How to use this guide

When drafting any future broadcast template (referral campaigns, seasonal updates, new feature announcements, win-back, etc.):

1. Copy the structure above
2. Swap section content but keep the rhythm (warm note → goal → 4 numbered prose sections → bonus line → time-back close → link → Joy)
3. Verify: no em dashes, no HK initials anywhere, no jargon without parentheses, no bullet lists inside sections
4. Verify: the close ends with "own body / clients / family / yourself" in some adapted form
5. Test on HK's demo account first via Table 3 edit modal, then batch send via Table 1 Edit & Send

## When to deviate

- **Crisis or apology emails:** drop the warm-day opener; lead with the issue and ownership.
- **Very short tactical nudges** (e.g., "your Stripe is disconnected"): can skip the 4-section structure and use a short 3-paragraph form, but still close with time-back framing and Joy sign-off.
- **Celebratory milestones** (first session, big anniversary): can be 4-6 sentences total, no numbered sections needed.

Default template choice goes to: long form, numbered, prose paragraphs.
