import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FOUNDER_EMAIL = "bodymap01@gmail.com";

serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date();
    const h24 = new Date(now.getTime() - 24*60*60*1000).toISOString();
    const d7  = new Date(now.getTime() - 7*24*60*60*1000).toISOString();

    const [
      { count: signups_24h },
      { count: total_signups },
      { count: silver_users },
      { count: bronze_users },
      { count: sessions_24h },
      { count: sessions_7d },
      { count: active_today },
      { data: recent_signups },
    ] = await Promise.all([
      supabase.from("profiles").select("*",{count:"exact",head:true}).gte("created_at",h24),
      supabase.from("profiles").select("*",{count:"exact",head:true}),
      supabase.from("profiles").select("*",{count:"exact",head:true}).eq("tier","silver"),
      supabase.from("profiles").select("*",{count:"exact",head:true}).eq("tier","bronze"),
      supabase.from("sessions").select("*",{count:"exact",head:true}).gte("created_at",h24),
      supabase.from("sessions").select("*",{count:"exact",head:true}).gte("created_at",d7),
      supabase.from("profiles").select("*",{count:"exact",head:true}).gte("last_sign_in_at",h24),
      supabase.from("profiles").select("email,created_at,tier").gte("created_at",h24).order("created_at",{ascending:false}),
    ]);

    const convRate = (total_signups??0)>0 ? Math.round(((silver_users??0)/(total_signups??1))*100) : 0;
    const dateStr = now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});

    const rows = (recent_signups??[]).map((u:any)=>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ede8;font-size:13px">${u.email}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ede8;color:#888;font-size:12px">${new Date(u.created_at).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ede8"><span style="background:${u.tier==="silver"?"#e8f5ee":"#f5f0e8"};color:${u.tier==="silver"?"#1a5c38":"#7a5c1a"};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">${u.tier||"bronze"}</span></td>
      </tr>`
    ).join("")||`<tr><td colspan="3" style="padding:16px;text-align:center;color:#bbb;font-size:13px">No new signups today</td></tr>`;

    const html=`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f4f0;font-family:-apple-system,sans-serif">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #e8e5e0;overflow:hidden">
<div style="background:#1a3a2a;padding:28px 32px">
  <div style="font-size:22px;font-weight:700;color:#fff">🌿 BodyMap</div>
  <div style="font-size:13px;color:#9fcfb8;margin-top:4px">Founder Daily Digest — ${dateStr}</div>
</div>
<div style="padding:28px 32px">
  <p style="font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#aaa;margin:0 0 12px">Signups</p>
  <table width="100%" style="border-collapse:collapse;margin-bottom:24px"><tr>
    <td style="background:#f9f8f5;border-radius:10px;padding:16px;text-align:center"><div style="font-size:32px;font-weight:700;color:#1a3a2a">${signups_24h??0}</div><div style="font-size:12px;color:#999">Today</div></td>
    <td width="10"></td>
    <td style="background:#f9f8f5;border-radius:10px;padding:16px;text-align:center"><div style="font-size:32px;font-weight:700;color:#1a3a2a">${total_signups??0}</div><div style="font-size:12px;color:#999">All time</div></td>
    <td width="10"></td>
    <td style="background:#f9f8f5;border-radius:10px;padding:16px;text-align:center"><div style="font-size:32px;font-weight:700;color:#1a3a2a">${silver_users??0}</div><div style="font-size:12px;color:#999">Silver (paid)</div></td>
  </tr></table>
  <p style="font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#aaa;margin:0 0 12px">Activity</p>
  <table width="100%" style="border-collapse:collapse;margin-bottom:24px"><tr>
    <td style="background:#f9f8f5;border-radius:10px;padding:16px;text-align:center"><div style="font-size:32px;font-weight:700;color:#1a3a2a">${sessions_24h??0}</div><div style="font-size:12px;color:#999">Sessions today</div></td>
    <td width="10"></td>
    <td style="background:#f9f8f5;border-radius:10px;padding:16px;text-align:center"><div style="font-size:32px;font-weight:700;color:#1a3a2a">${sessions_7d??0}</div><div style="font-size:12px;color:#999">Sessions (7d)</div></td>
    <td width="10"></td>
    <td style="background:#f9f8f5;border-radius:10px;padding:16px;text-align:center"><div style="font-size:32px;font-weight:700;color:#1a3a2a">${active_today??0}</div><div style="font-size:12px;color:#999">Active today</div></td>
  </tr></table>
  <p style="font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#aaa;margin:0 0 12px">Conversion</p>
  <div style="background:#f9f8f5;border-radius:10px;padding:16px;margin-bottom:24px">
    <div style="font-size:13px;color:#555;margin-bottom:4px">Bronze to Silver rate</div>
    <div style="font-size:11px;color:#bbb;margin-bottom:8px">${bronze_users??0} bronze · ${silver_users??0} silver</div>
    <div style="font-size:32px;font-weight:700;color:#1a3a2a">${convRate}%</div>
  </div>
  <p style="font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#aaa;margin:0 0 12px">New signups today</p>
  <table width="100%" style="border-collapse:collapse;background:#f9f8f5;border-radius:10px;overflow:hidden">
    <tr style="background:#f0ede8">
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:600">Email</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:600">Time</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:600">Tier</th>
    </tr>
    ${rows}
  </table>
</div>
<div style="background:#f9f8f5;padding:16px 32px;text-align:center;border-top:1px solid #e8e5e0">
  <a href="https://mybodymap.app/founder" style="font-size:13px;color:#1a3a2a;text-decoration:none;font-weight:500">Open Founder Dashboard</a>
  <p style="font-size:11px;color:#ccc;margin:8px 0 0">Sent daily at 8pm CT.</p>
</div>
</div></body></html>`;

    await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${RESEND_API_KEY}`},
      body:JSON.stringify({
        from:"BodyMap <noreply@mybodymap.app>",
        to:[FOUNDER_EMAIL],
        subject:`BodyMap Daily — ${signups_24h??0} new signup${(signups_24h??0)!==1?"s":""} today, ${total_signups??0} total`,
        html,
      }),
    });

    return new Response(JSON.stringify({ok:true}),{headers:{"Content-Type":"application/json"}});
  } catch(e:any) {
    return new Response(JSON.stringify({error:e.message}),{status:500,headers:{"Content-Type":"application/json"}});
  }
});
