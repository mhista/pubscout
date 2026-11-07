/**
 * AI provider chain for free tiers.
 *
 * Providers are tried in AI_PROVIDERS order (default "gemini,groq,anthropic", skipping
 * any without a key). Each provider has a list of models; each model is throttled to
 * its requests-per-minute. When a model answers 429 / RESOURCE_EXHAUSTED:
 *   - per-minute limit  → that model cools down (Retry-After or 60s) and the next model/provider is tried
 *   - per-day limit     → that model is switched off for the rest of the run
 * 401/403 switches the whole provider off. When everything is exhausted, callers get
 * `null` and the package keeps its rule-based tags; the next run picks up where this
 * one stopped, because results are cached per package version.
 */
import { sleep } from "./util.mjs";

const env = (k, d = "") => (process.env[k] ?? "").trim() || d;
const list = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

export class QuotaError extends Error {
  constructor(message, { daily = false, retryAfterMs = 60_000, auth = false, missing = false } = {}) {
    super(message);
    Object.assign(this, { daily, retryAfterMs, auth, missing });
  }
}

function retryAfter(res, body) {
  const h = Number(res.headers.get("retry-after"));
  if (Number.isFinite(h) && h > 0) return h * 1000;
  const m = String(body).match(/(?:retryDelay|try again in)[^0-9]*([0-9.]+)\s*(ms|s)/i);
  if (!m) return 60_000;
  return Math.ceil(Number(m[1]) * (m[2].toLowerCase() === "ms" ? 1 : 1000)) + 500;
}

async function fail(res, provider) {
  const body = await res.text();
  const lower = body.toLowerCase();
  if (res.status === 401 || res.status === 403) throw new QuotaError(`${provider}: ${res.status} (check the API key)`, { auth: true });
  // Retired or unknown model: switch just this model off and let the next one answer.
  if (res.status === 404 || lower.includes("model_not_found") || lower.includes("no longer available") || lower.includes("decommissioned")) {
    const hint = body.match(/use (?:models\/)?([a-z0-9.\-]+)/i)?.[1];
    throw new QuotaError(`${provider}: model not available${hint ? ` (Google suggests ${hint})` : ""}`, { missing: true });
  }
  if (res.status === 429 || lower.includes("resource_exhausted") || lower.includes("rate limit")) {
    const daily = /per ?day|perday|daily|rpd|tokens per day|tpd/.test(lower);
    throw new QuotaError(`${provider}: ${daily ? "daily" : "rate"} limit`, { daily, retryAfterMs: retryAfter(res, body) });
  }
  // Overloaded / temporarily down (Gemini "high demand" 503, Groq 498/5xx): rest this model and try another.
  if (res.status >= 500 || res.status === 498 || /unavailable|overloaded|high demand/.test(lower)) {
    throw new QuotaError(`${provider}: busy (${res.status})`, { retryAfterMs: 45_000 });
  }
  throw new Error(`${provider} ${res.status}: ${body.slice(0, 240)}`);
}

// --- provider adapters: (model, system, user, maxChars) → text ----------------

async function callGemini(model, system, user) {
  // Keep reasoning short: this is classification + summarising, and thinking tokens eat the output budget.
  // Flash-Lite already defaults to minimal thinking; 3.x Flash accepts low/medium/high (not minimal).
  const thinking = /^gemini-2\.5/.test(model)
    ? { thinkingConfig: { thinkingBudget: 0 } }
    : /^gemini-3/.test(model) && !/lite/.test(model)
      ? { thinkingConfig: { thinkingLevel: "low" } }
      : {};
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: 4096, responseMimeType: "application/json", ...thinking },
    }),
  });
  if (!res.ok) await fail(res, "gemini");
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error(`gemini: empty response (${data.candidates?.[0]?.finishReason ?? data.promptFeedback?.blockReason ?? "unknown"})`);
  return text;
}

async function callGroq(model, system, user) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env("GROQ_API_KEY")}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      ...(/gpt-oss/.test(model) ? { reasoning_effort: "low" } : {}),
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) await fail(res, "groq");
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(model, system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 1800, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) await fail(res, "anthropic");
  const data = await res.json();
  return data.content?.map((c) => c.text ?? "").join("") ?? "";
}

/* Free-tier defaults (checked Nov 2026; providers retire models often).
   If a model is retired, it's switched off for the run and the next one is used;
   update the list here or set GEMINI_MODELS / GROQ_MODELS in .env.local. Your real limits are on each console's limits page:
   Gemini: aistudio.google.com → usage, Groq: console.groq.com/settings/limits.
   "model@rpm": requests per minute per model. Groq's real ceiling is tokens per minute
   (8-12K on the free plan, ~3.5K tokens per package), hence the low numbers.
   readmeChars keeps a request inside that budget. */
const PROVIDERS = {
  gemini: { key: "GEMINI_API_KEY", call: callGemini, models: "gemini-3.8-flash@5,gemini-3.5-flash-lite@10", readmeChars: 14_000 },
  groq: { key: "GROQ_API_KEY", call: callGroq, models: "openai/gpt-oss-120b@3,openai/gpt-oss-20b@4", readmeChars: 7_000 },
  anthropic: { key: "ANTHROPIC_API_KEY", call: callAnthropic, models: "claude-haiku-5-5@40", readmeChars: 14_000 },
};

export function createAiChain({ log = console.log } = {}) {
  const order = list(env("AI_PROVIDERS", "gemini,groq,anthropic"));
  const slots = [];
  for (const name of order) {
    const p = PROVIDERS[name];
    if (!p) { log(`  AI: unknown provider "${name}" in AI_PROVIDERS, skipped`); continue; }
    if (!env(p.key)) continue;
    for (const spec of list(env(`${name.toUpperCase()}_MODELS`, p.models))) {
      const [model, r] = spec.split("@");
      const rpm = Number(r) || 5;
      slots.push({ provider: name, model, call: p.call, gapMs: Math.ceil(60_000 / Math.max(1, rpm)), readmeChars: p.readmeChars, nextAt: 0, off: false, used: 0, why: "" });
    }
  }
  const stats = () => slots.map((s) => `${s.provider}/${s.model}: ${s.used}${s.off ? ` (off: ${s.why})` : ""}`).join(", ");

  /** buildPrompt(readmeChars) → {system, user}. Returns { text, provider, model } or null when every slot is exhausted. */
  async function complete(buildPrompt) {
    for (let round = 0; round < 50; round++) {
      const live = slots.filter((s) => !s.off);
      if (!live.length) return null;
      // Earliest-available slot, preferring the configured order on ties.
      const slot = live.reduce((a, b) => (b.nextAt < a.nextAt - 250 ? b : a));
      const wait = slot.nextAt - Date.now();
      if (wait > 0) {
        if (wait > 5 * 60_000) { slot.off = true; slot.why = "cooling down too long"; continue; }
        await sleep(wait);
      }
      slot.nextAt = Date.now() + slot.gapMs;
      const { system, user } = buildPrompt(slot.readmeChars);
      try {
        const text = await slot.call(slot.model, system, user);
        slot.used++;
        return { text, provider: slot.provider, model: slot.model };
      } catch (err) {
        if (err instanceof QuotaError) {
          if (err.missing) {
            slot.off = true; slot.why = "model not available";
            log(`  AI: ${slot.provider}/${slot.model}: ${err.message.replace(/^\w+: /, "")}; using the next model`);
          } else if (err.auth) {
            for (const s of slots) if (s.provider === slot.provider) { s.off = true; s.why = "auth failed"; }
            log(`  AI: ${err.message}; ${slot.provider} switched off`);
          } else if (err.daily) {
            slot.off = true; slot.why = "daily quota used";
            log(`  AI: ${slot.provider}/${slot.model} hit its daily quota, switching`);
          } else {
            slot.nextAt = Date.now() + err.retryAfterMs;
          }
          continue;
        }
        throw err; // a real error for this package: caller logs it and moves on
      }
    }
    return null;
  }

  return { complete, stats, enabled: slots.length > 0, describe: () => [...new Set(slots.map((s) => s.provider))].join(" → ") };
}
