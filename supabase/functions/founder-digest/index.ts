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
    const d30 = new Date(now.getTime() - 30*24*60*60*1000).toISOString();

    const [
      { count: signups_24h },
      { count: signups_7d },
      { count: signups_30d },
      { count: total_signups },
      { count: silver_users },
      { count: bronze_users },
      { count: sessions_24h },
      { count: sessions_7d },
      { count: clients_7d },
      { data: recent_signups },
    ] = await Promise.all([
      supabase.from("therapists").select("*",{count:"exact",head:true}).gte("created_at",h24),
      supabase.from("therapists").select("*",{count:"exact",head:true}).gte("created_at",d7),
      supabase.from("therapists").select("*",{count:"exact",head:true}).gte("created_at",d30),
      supabase.from("therapists").select("*",{count:"exact",head:true}),
      supabase.from("therapists").select("*",{count:"exact",head:true}).eq("tier","silver"),
      supabase.from("therapists").select("*",{count:"exact",head:true}).eq("tier","bronze"),
      supabase.from("sessions").select("*",{count:"exact",head:true}).gte("created_at",h24),
      supabase.from("sessions").select("*",{count:"exact",head:true}).gte("created_at",d7),
      supabase.from("clients").select("*",{count:"exact",head:true}).gte("created_at",d7),
      supabase.from("therapists").select("email,created_at,tier").order("created_at",{ascending:false}).limit(15),
    ]);

    const convRate = (total_signups??0)>0 ? Math.round(((silver_users??0)/(total_signups??1))*100) : 0;
    const dateStr = now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});

    const rows = (recent_signups??[]).map((u:any)=>
      `<tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0ede8;font-size:13px;color:#222">${u.email}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0ede8;color:#888;font-size:12px">${new Date(u.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0ede8"><span style="background:${u.tier==="silver"?"#e8f5ee":"#f5f0e8"};color:${u.tier==="silver"?"#1a5c38":"#7a5c1a"};border-radius:4px;padding:3px 10px;font-size:11px;font-weight:600">${u.tier||"bronze"}</span></td>
      </tr>`
    ).join("")||`<tr><td colspan="3" style="padding:20px;text-align:center;color:#bbb;font-size:13px">No new signups today</td></tr>`;

    const statBox = (val:any, label:string) =>
      `<td style="background:#f9f8f5;border-radius:10px;padding:18px;text-align:center;width:30%">
        <div style="font-size:36px;font-weight:700;color:#1a3a2a;line-height:1">${val}</div>
        <div style="font-size:12px;color:#999;margin-top:6px">${label}</div>
      </td>`;

    const spacer = `<td width="12"></td>`;

    const html=`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:620px;margin:32px auto;background:#fff;border-radius:16px;border:1px solid #e8e5e0;overflow:hidden">

  <div style="background:#1a3a2a;padding:32px 36px">
    <div style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.5px">🌿 BodyMap</div>
    <div style="font-size:14px;color:#9fcfb8;margin-top:6px">Founder Daily Digest — ${dateStr}</div>
  </div>

  <div style="padding:32px 36px">

    <p style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#bbb;margin:0 0 14px">Signups</p>
    <table width="100%" style="border-collapse:collapse;margin-bottom:28px">
      <tr>
        ${statBox(signups_24h??0,"Today")}
        ${spacer}
        ${statBox(signups_7d??0,"Last 7 days")}
        ${spacer}
        ${statBox(total_signups??0,"All time")}
      </tr>
    </table>

    <p style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#bbb;margin:0 0 14px">Tiers</p>
    <table width="100%" style="border-collapse:collapse;margin-bottom:28px">
      <tr>
        ${statBox(bronze_users??0,"Bronze (free)")}
        ${spacer}
        ${statBox(silver_users??0,"Silver (paid)")}
        ${spacer}
        ${statBox(convRate+"%","Conversion rate")}
      </tr>
    </table>

    <p style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#bbb;margin:0 0 14px">Platform Activity</p>
    <table width="100%" style="border-collapse:collapse;margin-bottom:28px">
      <tr>
        ${statBox(sessions_24h??0,"Sessions today")}
        ${spacer}
        ${statBox(sessions_7d??0,"Sessions (7d)")}
        ${spacer}
        ${statBox(clients_7d??0,"Clients added (7d)")}
      </tr>
    </table>

    <p style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#bbb;margin:0 0 14px">Recent signups</p>
    <table width="100%" style="border-collapse:collapse;border-radius:10px;overflow:hidden;background:#f9f8f5">
      <tr style="background:#f0ede8">
        <th style="padding:10px 16px;text-align:left;font-size:11px;color:#888;font-weight:600">Email</th>
        <th style="padding:10px 16px;text-align:left;font-size:11px;color:#888;font-weight:600">Signed up</th>
        <th style="padding:10px 16px;text-align:left;font-size:11px;color:#888;font-weight:600">Tier</th>
      </tr>
      ${rows}
    </table>

  </div>

  <div style="background:#f9f8f5;padding:20px 36px;text-align:center;border-top:1px solid #e8e5e0">
    <a href="https://mybodymap.app/founder" style="font-size:13px;color:#1a3a2a;text-decoration:none;font-weight:600">Open Founder Dashboard →</a>
    <p style="font-size:11px;color:#ccc;margin:8px 0 0">Sent daily at 8pm CT · BodyMap founder digest</p>
  </div>

</div>
</body></html>`;

    const emailRes = await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${RESEND_API_KEY}`},
      body:JSON.stringify({
        from:"BodyMap <noreply@mybodymap.app>",
        to:[FOUNDER_EMAIL],
        subject:`BodyMap Daily — ${signups_24h??0} new signup${(signups_24h??0)!==1?"s":""} today · ${total_signups??0} total · ${silver_users??0} paid`,
        html,
      }),
    });

    const emailJson = await emailRes.json();
    return new Response(JSON.stringify({ok:true, email:emailJson}),{headers:{"Content-Type":"application/json"}});
  } catch(e:any) {
    return new Response(JSON.stringify({error:e.message}),{status:500,headers:{"Content-Type":"application/json"}});
  }
});
