import "server-only";
import fs from "node:fs";
import path from "node:path";
import { categoryName, getCatalog, getPackage } from "./catalog";
import { CATEGORY_INDEX } from "./taxonomy";
import { parseFilters, runQuery } from "./query";
import type { Pkg } from "./types";

/* "Describe what you need" search.
   1. Turn the description into a meaning fingerprint (one Gemini embedding call) and
      rank packages by similarity. Falls back to keyword search if that isn't available.
   2. Ask a fast model to pick the best few of the top candidates and say why each fits.
      Falls back to the ranked list if every model is busy. */

const DIMS = 256;
type Vectors = { model: string; map: Map<string, Int8Array> };
let vectors: Vectors | null | undefined;

function loadVectors(): Vectors | null {
  if (vectors !== undefined) return vectors;
  const file = path.join(process.cwd(), "data", "embeddings.json");
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { model: string; dims: number; items: Record<string, { v: string }> };
    if (raw.dims !== DIMS) return (vectors = null);
    const map = new Map<string, Int8Array>();
    for (const [name, { v }] of Object.entries(raw.items)) {
      const b = Buffer.from(v, "base64");
      map.set(name, new Int8Array(b.buffer, b.byteOffset, b.length));
    }
    return (vectors = map.size ? { model: raw.model, map } : null);
  } catch {
    return (vectors = null);
  }
}

const key = (k: string) => (process.env[k] ?? "").trim();

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fn(ctl.signal);
  } finally {
    clearTimeout(t);
  }
}

async function embedQuery(q: string, model: string): Promise<Float32Array | null> {
  if (!key("GEMINI_API_KEY")) return null;
  try {
    const res = await withTimeout(6000, (signal) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", "x-goog-api-key": key("GEMINI_API_KEY") },
        body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text: q }] }, taskType: "RETRIEVAL_QUERY", outputDimensionality: DIMS }),
      }),
    );
    if (!res.ok) return null;
    const values = ((await res.json()) as { embedding?: { values: number[] } }).embedding?.values;
    if (!values) return null;
    const norm = Math.hypot(...values) || 1;
    return Float32Array.from(values, (v) => v / norm);
  } catch {
    return null;
  }
}

function semanticRank(qv: Float32Array, map: Map<string, Int8Array>) {
  const out: { name: string; score: number }[] = [];
  for (const [name, v] of map) {
    let dot = 0;
    for (let i = 0; i < DIMS; i++) dot += qv[i] * v[i];
    out.push({ name, score: dot / 127 });
  }
  return out.sort((a, b) => b.score - a.score);
}

type Pick = { name: string; reason: string };

const SYSTEM = `You help a Flutter developer pick pub.dev packages. You get their description and candidate packages.
Pick up to 5 that genuinely fit, best first. Prefer healthy, maintained packages; skip discontinued ones.
Return JSON only: {"picks":[{"name":"<exact candidate name>","reason":"<max 22 words, why it fits THEIR need>"}],"note":"<optional, max 25 words: a caveat or a better way to phrase the need; empty if none>"}`;

function prompt(q: string, cands: Pkg[]) {
  const lines = cands.map((p) => {
    const cats = p.categories.map((c) => categoryName(c.slug)).join(", ");
    const plat = p.kind === "dart" ? "all platforms" : p.platforms.join("/");
    const ex = p.explainer?.useWhen?.slice(0, 2).join("; ");
    return `- ${p.name} | health ${p.scores.health} | ${cats} | ${plat}${p.discontinued ? " | DISCONTINUED" : ""}\n  ${p.oneLiner}${ex ? `\n  Use when: ${ex}` : ""}`;
  });
  return `Developer's need: "${q}"\n\nCandidates:\n${lines.join("\n")}`;
}

function parsePicks(text: string, allowed: Set<string>): { picks: Pick[]; note: string } | null {
  try {
    const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { picks?: Pick[]; note?: string };
    const picks = (j.picks ?? []).filter((p) => p && allowed.has(p.name)).slice(0, 5).map((p) => ({ name: p.name, reason: String(p.reason ?? "").slice(0, 200) }));
    return { picks, note: String(j.note ?? "").slice(0, 220) };
  } catch {
    return null;
  }
}

async function rerank(q: string, cands: Pkg[]): Promise<{ picks: Pick[]; note: string; model: string } | null> {
  const allowed = new Set(cands.map((c) => c.name));
  const user = prompt(q, cands);
  const tries: { model: string; run: (signal: AbortSignal) => Promise<string> }[] = [];
  if (key("GEMINI_API_KEY")) {
    for (const model of (process.env.SEARCH_GEMINI_MODELS || "gemini-3.5-flash-lite,gemini-3.8-flash").split(",").map((s) => s.trim()).filter(Boolean)) {
      tries.push({
        model,
        run: async (signal) => {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: "POST",
            signal,
            headers: { "content-type": "application/json", "x-goog-api-key": key("GEMINI_API_KEY") },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM }] },
              contents: [{ role: "user", parts: [{ text: user }] }],
              generationConfig: { maxOutputTokens: 1200, responseMimeType: "application/json", ...(/lite/.test(model) ? {} : { thinkingConfig: { thinkingLevel: "low" } }) },
            }),
          });
          if (!res.ok) throw new Error(String(res.status));
          const d = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
          return d.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("") ?? "";
        },
      });
    }
  }
  if (key("GROQ_API_KEY")) {
    for (const model of (process.env.SEARCH_GROQ_MODELS || "openai/gpt-oss-20b,openai/gpt-oss-120b").split(",").map((s) => s.trim()).filter(Boolean)) {
      tries.push({
        model,
        run: async (signal) => {
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            signal,
            headers: { "content-type": "application/json", authorization: `Bearer ${key("GROQ_API_KEY")}` },
            body: JSON.stringify({
              model,
              temperature: 0.2,
              max_tokens: 1200,
              response_format: { type: "json_object" },
              ...(/gpt-oss/.test(model) ? { reasoning_effort: "low" } : {}),
              messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
            }),
          });
          if (!res.ok) throw new Error(String(res.status));
          const d = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          return d.choices?.[0]?.message?.content ?? "";
        },
      });
    }
  }
  for (const t of tries) {
    try {
      const text = await withTimeout(9000, t.run);
      const parsed = parsePicks(text, allowed);
      if (parsed?.picks.length) return { ...parsed, model: t.model };
    } catch {
      /* busy, retired or slow: try the next model */
    }
  }
  return null;
}

type Card = { name: string; version: string; oneLiner: string; health: number; category: string | null; reason: string | null };
export type AskResult = { mode: "ai" | "semantic" | "keyword"; picks: Card[]; more: Card[]; note: string };

const card = (name: string, reason: string | null = null): Card | null => {
  const p = getPackage(name);
  if (!p) return null;
  return { name, version: p.version, oneLiner: p.oneLiner, health: p.scores.health, category: p.primaryCategory ? categoryName(p.primaryCategory) : null, reason };
};
const cards = (list: (Card | null)[]) => list.filter((c): c is Card => !!c);

export async function ask(q: string): Promise<AskResult> {
  const catalog = getCatalog();
  const vec = loadVectors();
  let ranked: string[] = [];
  let mode: AskResult["mode"] = "keyword";

  if (vec) {
    const qv = await embedQuery(q, vec.model);
    if (qv) {
      ranked = semanticRank(qv, vec.map).slice(0, 40).map((x) => x.name);
      mode = "semantic";
    }
  }
  if (!ranked.length) {
    ranked = runQuery(catalog.packages, parseFilters({ q, disc: "1" }), CATEGORY_INDEX).items.map((p) => p.name);
  }

  // Healthier packages edge ahead among near-equal matches; discontinued ones sink.
  const cands = ranked
    .map((n, i) => ({ p: getPackage(n), i }))
    .filter((x): x is { p: Pkg; i: number } => !!x.p)
    .sort((a, b) => a.i - a.p.scores.health / 25 + (a.p.discontinued ? 15 : 0) - (b.i - b.p.scores.health / 25 + (b.p.discontinued ? 15 : 0)))
    .map((x) => x.p)
    .slice(0, 24);

  if (!cands.length) return { mode, picks: [], more: [], note: "" };

  const ai = await rerank(q, cands);
  if (ai) {
    const chosen = new Set(ai.picks.map((p) => p.name));
    return {
      mode: "ai",
      picks: cards(ai.picks.map((p) => card(p.name, p.reason))),
      more: cards(cands.filter((c) => !chosen.has(c.name)).slice(0, 6).map((c) => card(c.name))),
      note: ai.note,
    };
  }
  return { mode, picks: cards(cands.slice(0, 5).map((c) => card(c.name))), more: cards(cands.slice(5, 11).map((c) => card(c.name))), note: "" };
}
