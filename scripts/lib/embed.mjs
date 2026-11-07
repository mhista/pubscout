/**
 * Embeddings for "describe what you need" search.
 *
 * Each package gets a 256-number "meaning fingerprint" from Gemini's embedding model,
 * built from its name, one-liner, summary, use cases and categories. They're stored
 * compactly (int8, base64) in data/embeddings.json and only recomputed when that text
 * changes, so the nightly run embeds just the new or changed packages.
 */
import crypto from "node:crypto";
import path from "node:path";
import { DATA, readJson, sleep, writeJson } from "./util.mjs";

export const EMBED_DIMS = 256;
const FILE = path.join(DATA, "embeddings.json");

export const embedModel = () => (process.env.EMBED_MODEL || "gemini-embedding-001").trim();

export function embedText(p, categoryName) {
  const ex = p.explainer;
  return [
    `${p.name}: ${p.oneLiner}`,
    ex?.whatItDoes ?? p.description,
    ex?.useWhen?.length ? `Use it when: ${ex.useWhen.join("; ")}` : "",
    `Categories: ${p.categories.map((c) => categoryName(c.slug)).join(", ")}`,
    p.topics.length ? `Topics: ${p.topics.join(", ")}` : "",
    p.kind === "dart" ? "Pure Dart, any platform" : `Platforms: ${p.platforms.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 6000);
}

/** L2-normalise, then quantise to int8 and base64 (256 bytes per package). */
export function pack(values) {
  const norm = Math.hypot(...values) || 1;
  const bytes = Int8Array.from(values, (v) => Math.max(-127, Math.min(127, Math.round((v / norm) * 127))));
  return Buffer.from(bytes.buffer).toString("base64");
}

async function embedBatch(texts, apiKey, model) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      requests: texts.map((text) => ({ model: `models/${model}`, content: { parts: [{ text }] }, taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: EMBED_DIMS })),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`embeddings ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.embeddings.map((e) => e.values);
}

/** Adds/refreshes embeddings for pkgs; returns how many were computed. Safe to stop midway. */
export async function updateEmbeddings(pkgs, categoryName, { log = console.log } = {}) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  const model = embedModel();
  const store = readJson(FILE, null);
  const fresh = store && store.model === model && store.dims === EMBED_DIMS ? store : { model, dims: EMBED_DIMS, items: {} };
  const keep = new Set(pkgs.map((p) => p.name));
  for (const name of Object.keys(fresh.items)) if (!keep.has(name)) delete fresh.items[name];

  const todo = [];
  for (const p of pkgs) {
    const text = embedText(p, categoryName);
    const h = crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
    if (fresh.items[p.name]?.h !== h) todo.push({ name: p.name, text, h });
  }
  if (!todo.length) {
    writeJson(FILE, fresh);
    return 0;
  }
  if (!apiKey) {
    log(`  Embeddings: ${todo.length} packages need one, but there's no GEMINI_API_KEY. "Describe it" search will use keywords for them.`);
    writeJson(FILE, fresh);
    return 0;
  }

  let done = 0;
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    try {
      const vectors = await embedBatch(batch.map((b) => b.text), apiKey, model);
      batch.forEach((b, j) => (fresh.items[b.name] = { h: b.h, v: pack(vectors[j]) }));
      done += batch.length;
      writeJson(FILE, fresh); // save as we go, so a stopped run keeps its progress
    } catch (err) {
      if (err.status === 429) {
        log(`  Embeddings: free quota reached after ${done}; the rest are done on the next run.`);
        break;
      }
      if (err.status === 404) {
        log(`  Embeddings: model "${model}" isn't available. Set EMBED_MODEL in .env.local to a current Gemini embedding model.`);
        break;
      }
      log(`  Embeddings: ${err.message}`);
      break;
    }
    await sleep(1200);
  }
  log(`  Embeddings: ${done} computed, ${Object.keys(fresh.items).length} stored.`);
  return done;
}
