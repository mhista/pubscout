/**
 * Layer 2 (LLM): one call per package version returns category tags AND the
 * explainer. Results are cached in data/ai/<name>@<version>.json, so a package
 * is only sent again when it publishes a new version or PROMPT_VERSION changes.
 * Which model answers is decided by the provider chain in ai.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { DATA, readJson, writeJson } from "./util.mjs";
import { scrub } from "./scrub.mjs";

export const PROMPT_VERSION = 2;

const SYSTEM = `You help Flutter developers decide whether to use a pub.dev package.
Answer ONLY from the material given (pubspec, README, CHANGELOG, computed facts). If something isn't documented, say "not documented" rather than guessing.
Return a single JSON object, no prose around it.`;

function prompt(raw, facts, taxonomy, neighbours, readmeChars) {
  const cats = taxonomy.categories.map((c) => `${c.slug}: ${c.blurb}`).join("\n");
  return `Package: ${raw.name} ${raw.version}
Description: ${raw.description}
Topics: ${(raw.topics ?? []).join(", ") || "none"}
Dependencies: ${raw.dependencies.join(", ") || "none"}
Platforms: ${facts.platforms.join(", ") || "none listed"}; kind: ${facts.kind}; license: ${facts.license ?? "unknown"}

Categories (pick ONLY from these slugs):
${cats}

Other packages already in our catalog (alternatives may only come from this list):
${neighbours.join(", ")}

README (trimmed):
${(raw.docs?.readme ?? "").slice(0, readmeChars)}

CHANGELOG (latest entries):
${(raw.docs?.changelog ?? "").slice(0, Math.min(3000, readmeChars / 4))}

Return JSON:
{
  "primary_category": "<slug>",
  "secondary_categories": ["<slug>", ...],      // 0-4
  "approach": ["code generation" | "declarative" | "imperative" | "stream-based" | "hooks" | "no codegen" ...], // 0-3 short tags
  "one_liner": "max 110 characters, what it is, no marketing words",
  "what_it_does": "2-3 plain sentences",
  "use_when": ["...", "..."],                    // 2-4
  "avoid_when": ["...", "..."],                  // 1-3
  "strengths": ["...", "..."],                   // 2-4
  "weaknesses": ["...", "..."],                  // 1-3, honest
  "setup_effort": "low" | "medium" | "high",
  "setup_notes": "native steps, permissions, build_runner, etc. or empty",
  "alternatives": [{"name": "...", "why_pick_it": "..."}],  // 0-3 from the list above. An alternative does the SAME job and could REPLACE this package (dio vs http). Never list companions that are used together with it (firebase_core and firebase_auth, freezed and build_runner, bloc and bloc_test). Empty is fine.
  "minimal_example": "a short Dart snippet copied or adapted from the README, or empty",
  "confidence": 0.0-1.0
}`;
}

function parseJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no JSON in response");
  return JSON.parse(text.slice(start, end + 1));
}

/** Drop anything that isn't in our taxonomy / catalog. */
function validate(out, taxonomy, catalogNames, raw) {
  const slugs = new Set(taxonomy.categories.map((c) => c.slug));
  if (!slugs.has(out.primary_category)) throw new Error(`unknown category ${out.primary_category}`);
  out.secondary_categories = (out.secondary_categories ?? []).filter((s) => slugs.has(s) && s !== out.primary_category).slice(0, 4);
  out.alternatives = (out.alternatives ?? []).filter((a) => a?.name && a.name !== raw.name && catalogNames.has(a.name)).slice(0, 3);
  for (const k of ["use_when", "avoid_when", "strengths", "weaknesses", "approach"]) out[k] = Array.isArray(out[k]) ? out[k].slice(0, 4) : [];
  out.one_liner = String(out.one_liner ?? "").slice(0, 140);
  return out;
}

/* When does a package get a fresh summary? AI_REFRESH in .env.local:
     "major" (default) only when it makes a breaking release: 2.x → 3.x, or 0.4 → 0.5 before 1.0
     "never"           summarise each package once, ever
     "every"           every new version (most AI calls) */
const REFRESH = (process.env.AI_REFRESH || "major").toLowerCase();
const AI_DIR = path.join(DATA, "ai");
let aiFiles = null;
const breakingKey = (v) => {
  const [maj, min] = String(v).split(".").map((n) => parseInt(n, 10) || 0);
  return maj > 0 ? `${maj}` : `0.${min}`;
};

/** A usable summary for this package (same version, or an earlier one per AI_REFRESH), or null. */
export function cachedExplain(raw) {
  const exact = readJson(path.join(AI_DIR, `${raw.name}@${raw.version}.json`));
  if (exact && exact.promptVersion === PROMPT_VERSION) return exact;
  if (REFRESH === "every") return null;
  aiFiles ??= fs.existsSync(AI_DIR) ? fs.readdirSync(AI_DIR) : [];
  const older = aiFiles
    .filter((f) => f.startsWith(`${raw.name}@`) && f.endsWith(".json"))
    .map((f) => readJson(path.join(AI_DIR, f)))
    .filter((r) => r && r.promptVersion === PROMPT_VERSION)
    .sort((a, b) => Date.parse(b.generatedAt ?? 0) - Date.parse(a.generatedAt ?? 0))[0];
  if (!older) return null;
  if (REFRESH === "major" && breakingKey(older.version) !== breakingKey(raw.version)) return null;
  return older;
}

/** Returns a cached or fresh record, or null when no model is available right now. */
export async function explain(raw, facts, taxonomy, { catalogNames, neighbours, chain }) {
  const cached = cachedExplain(raw);
  if (cached) return cached;
  if (!chain?.enabled || !raw.docs?.readme) return null;

  const out = await chain.complete((readmeChars) => ({ system: SYSTEM, user: prompt(raw, facts, taxonomy, neighbours, readmeChars) }));
  if (!out) return null;
  const data = validate(parseJson(out.text), taxonomy, catalogNames, raw);
  const record = { promptVersion: PROMPT_VERSION, provider: out.provider, model: out.model, version: raw.version, generatedAt: new Date().toISOString(), data };
  writeJson(path.join(AI_DIR, `${raw.name}@${raw.version}.json`), scrub(record), true);
  // Keep one summary file per package: drop the ones this replaces.
  for (const f of (aiFiles ??= fs.existsSync(AI_DIR) ? fs.readdirSync(AI_DIR) : [])) {
    if (f.startsWith(`${raw.name}@`) && f !== `${raw.name}@${raw.version}.json`) fs.rmSync(path.join(AI_DIR, f), { force: true });
  }
  return record;
}
