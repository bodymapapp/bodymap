// supabase/functions/phone-verify/index.ts
//
// Phone verification at signup via Twilio Verify.
//
// Two modes:
//   start  -> ask Twilio to send a 6-digit SMS code to the therapist's phone
//   check  -> validate the code the therapist entered, set phone_verified_at
//
// Why Twilio Verify (not roll-our-own SMS):
//   - Twilio handles rate limits, retry logic, fraud detection, and
//     multi-region SMS routing
//   - One API for global numbers (we default +1 but support international)
//   - Cost is ~$0.05 per verification, negligible at our scale
//   - Less code to maintain, less surface area for our own bugs
//
// Required environment variables (set in Supabase Dashboard -> Edge Functions -> Secrets):
//   TWILIO_ACCOUNT_SID         (Twilio account SID, starts AC...)
//   TWILIO_AUTH_TOKEN          (Twilio auth token)
//   TWILIO_VERIFY_SERVICE_SID  (Verify Service SID, starts VA...; create one
//                              at Twilio Console -> Verify -> Services)
//
// The function uses the user's auth token to look up the matching
// therapist row, so it cannot be abused to verify someone else's phone.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize a phone number to E.164 format (e.g. +15551234567).
// Twilio Verify requires E.164. We default to +1 (US/Canada) when no
// country code is present; therapists outside North America can include
// their own + prefix.
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Already E.164? +<digits>
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed;
  // Otherwise strip non-digits, treat as US/Canada if 10 or 11 digits
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { mode, phone, code } = await req.json();
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_VERIFY_SERVICE_SID = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
      return new Response(JSON.stringify({
        error: "Server misconfigured",
        details: "Twilio credentials not set in edge function secrets.",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: caller must be a signed-in therapist
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: therapist, error: therapistErr } = await supabase
      .from("therapists")
      .select("id, phone, phone_verified_at")
      .eq("id", user.id)
      .maybeSingle();

    if (therapistErr || !therapist) {
      return new Response(JSON.stringify({ error: "Therapist not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Always prefer the phone from the therapist row (canonical) over the
    // client-passed phone. The client only passes phone on 'start' calls
    // for therapists whose row has no phone yet (immediately post-signup
    // edge case) or when the therapist wants to change their phone.
    const normalizedPhone = normalizePhone(therapist.phone || phone || "");
    if (!normalizedPhone) {
      return new Response(JSON.stringify({
        error: "invalid_phone",
        message: "We could not read this phone number. Please re-enter with country code (e.g. +1 555 123 4567).",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const verifyBaseUrl = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}`;

    // ─────────────── START ───────────────
    // Ask Twilio to send a 6-digit SMS code to the phone. If the phone on
    // the therapist row is empty (rare race), also write the supplied phone
    // so subsequent check calls find it.
    if (mode === "start") {
      // Persist the phone if client supplied one and the row is empty.
      // Avoids the case where signup race-conditioned and phone never landed.
      if (!therapist.phone && phone) {
        await supabase
          .from("therapists")
          .update({ phone: normalizedPhone })
          .eq("id", therapist.id);
      }

      const body = new URLSearchParams({
        To: normalizedPhone,
        Channel: "sms",
      });
      const resp = await fetch(`${verifyBaseUrl}/Verifications`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${twilioAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      const data = await resp.json();
      if (!resp.ok) {
        // Twilio specific errors: 60200 invalid phone, 60203 max send attempts
        const code = data.code;
        let userMessage = "We could not send the code. Please try again in a moment.";
        if (code === 60200) userMessage = "That phone number is not valid. Please re-enter and try again.";
        else if (code === 60203) userMessage = "Too many attempts. Please wait a few minutes and try again.";
        else if (code === 60410) userMessage = "This phone number is blocked. Please use a different number or contact support.";

        return new Response(JSON.stringify({
          error: "twilio_error",
          message: userMessage,
          twilio_code: code,
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Twilio returns { sid, status: 'pending', ... }
      return new Response(JSON.stringify({
        ok: true,
        phone: normalizedPhone,
        masked: maskPhone(normalizedPhone),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────── CHECK ───────────────
    // Validate the code the therapist entered. On success, mark
    // phone_verified_at = now() on the therapist row.
    if (mode === "check") {
      if (!code || !/^\d{4,8}$/.test(String(code))) {
        return new Response(JSON.stringify({
          error: "invalid_code",
          message: "Please enter the 6-digit code we texted you.",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = new URLSearchParams({
        To: normalizedPhone,
        Code: String(code),
      });
      const resp = await fetch(`${verifyBaseUrl}/VerificationCheck`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${twilioAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      const data = await resp.json();

      if (!resp.ok) {
        return new Response(JSON.stringify({
          error: "twilio_error",
          message: "We could not check the code. Please try again.",
          twilio_code: data.code,
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Twilio returns { status: 'approved' | 'pending' | 'canceled', ... }
      if (data.status !== "approved") {
        return new Response(JSON.stringify({
          error: "code_invalid",
          message: "That code is not correct. Please re-check the text we sent you and try again.",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark verified on the therapist row
      const { error: updateErr } = await supabase
        .from("therapists")
        .update({ phone_verified_at: new Date().toISOString() })
        .eq("id", therapist.id);

      if (updateErr) {
        return new Response(JSON.stringify({
          error: "db_error",
          message: "Verified at Twilio but could not save. Please refresh and try again.",
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        ok: true,
        verified_at: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown_mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Mask the phone for display: +15551234567 -> +1 (555) ***-4567
function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length < 7) return e164;
  const last4 = digits.slice(-4);
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ***-${last4}`;
  }
  return `+${digits.slice(0, -10)} ***-${last4}`;
}
