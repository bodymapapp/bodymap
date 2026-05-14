// supabase/functions/_shared/ai_cost.ts
//
// One shared module that every edge function calling Anthropic
// imports. Two responsibilities:
//   1. Compute USD cost from token counts using the model's rate.
//   2. Insert a row in ai_call_log so the founder dashboard
//      counter has live data.
//
// HK May 14 2026: 'I need to know how much the website is costing
// me in terms of AI cost.' Founder dashboard reads from this log.
// Rates verified from Anthropic pricing as of April 2026. Update
// the MODEL_RATES table when Anthropic changes prices.

export type ModelRate = {
  input_per_mtok: number;
  output_per_mtok: number;
};

// All prices in USD per 1M tokens. Sourced from
// https://platform.claude.com/docs/en/about-claude/pricing
// Last verified May 14 2026.
export const MODEL_RATES: Record<string, ModelRate> = {
  // Opus family: $5 / $25
  "claude-opus-4-7":  { input_per_mtok: 5.00,  output_per_mtok: 25.00 },
  "claude-opus-4-6":  { input_per_mtok: 5.00,  output_per_mtok: 25.00 },
  // Sonnet family: $3 / $15
  "claude-sonnet-4-6": { input_per_mtok: 3.00, output_per_mtok: 15.00 },
  "claude-sonnet-4-5-20250929": { input_per_mtok: 3.00, output_per_mtok: 15.00 },
  "claude-sonnet-4-20250514":   { input_per_mtok: 3.00, output_per_mtok: 15.00 },
  // Haiku family: $1 / $5
  "claude-haiku-4-5-20251001":  { input_per_mtok: 1.00, output_per_mtok: 5.00  },
  "claude-haiku-4-5":           { input_per_mtok: 1.00, output_per_mtok: 5.00  },
};

// Fallback if we hit a model we did not list. Conservative: assume
// Sonnet pricing. Caller can override if they know better.
const FALLBACK_RATE: ModelRate = { input_per_mtok: 3.00, output_per_mtok: 15.00 };

export type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
};

export type LogParams = {
  supabase: any;        // SupabaseClient with service role
  caller: string;       // e.g. 'bodymap-ai', 'founder-chat'
  purpose?: string;     // e.g. 'practice_q', 'outreach_draft'
  model: string;
  usage: AnthropicUsage | null | undefined;
  therapist_id?: string | null;
  success: boolean;
  error_message?: string;
};

export function rateFor(model: string): ModelRate {
  return MODEL_RATES[model] ?? FALLBACK_RATE;
}

export function costFor(
  model: string,
  input_tokens: number,
  output_tokens: number,
): { input_cost_usd: number; output_cost_usd: number; total_cost_usd: number } {
  const rate = rateFor(model);
  const input_cost_usd = (input_tokens / 1_000_000) * rate.input_per_mtok;
  const output_cost_usd = (output_tokens / 1_000_000) * rate.output_per_mtok;
  return {
    input_cost_usd,
    output_cost_usd,
    total_cost_usd: input_cost_usd + output_cost_usd,
  };
}

/**
 * Insert a row in ai_call_log. Fire-and-forget: never throws, never
 * blocks the response. Logging failures must not affect the caller.
 */
export async function logAiCall(p: LogParams): Promise<void> {
  try {
    const input_tokens = p.usage?.input_tokens ?? 0;
    const output_tokens = p.usage?.output_tokens ?? 0;
    const { input_cost_usd, output_cost_usd } = costFor(
      p.model,
      input_tokens,
      output_tokens,
    );
    await p.supabase.from("ai_call_log").insert({
      caller: p.caller,
      purpose: p.purpose ?? null,
      model: p.model,
      input_tokens,
      output_tokens,
      input_cost_usd,
      output_cost_usd,
      therapist_id: p.therapist_id ?? null,
      success: p.success,
      error_message: p.error_message ?? null,
    });
  } catch (e) {
    // Never propagate. Print only.
    console.error("[ai_cost] logAiCall failed", e);
  }
}
