#!/usr/bin/env node
/**
 * Step 2 of `npm run data`: turn data/raw/*.json into data/catalog.json —
 * tags (rules → LLM → human overrides), scores, flags, badges, alternatives.
 *
 *   node scripts/build-catalog.mjs            # from data/raw (after sync)
 *   node scripts/build-catalog.mjs --sample   # from data/sample (offline demo data)
 *   node scripts/build-catalog.mjs --no-ai    # skip LLM calls, use cached AI results only
 *   node scripts/build-catalog.mjs --ai-limit 50   # at most 50 new AI calls this run
 */
import fs from "node:fs";
import path from "node:path";
import { DATA, daysSince, loadEnv, pool, readJson, writeJson } from "./lib/util.mjs";
import { classifyByRules, deriveFacts, minVersion, worksWith } from "./lib/classify.mjs";
import { badgesFor, flagsFor, scorePackage } from "./lib/score.mjs";
import { cachedExplain, explain } from "./lib/explain.mjs";
import { createAiChain } from "./lib/ai.mjs";
import { buildRelations } from "./lib/relations.mjs";
import { updateEmbeddings } from "./lib/embed.mjs";

loadEnv();
const SAMPLE = process.argv.includes("--sample");
const NO_AI = process.argv.includes("--no-ai") || SAMPLE;
const now = Date.now();

const taxonomy = readJson(path.join(DATA, "taxonomy.json"));
const overrides = readJson(path.join(DATA, "overrides.json"), {});
const history = readJson(path.join(DATA, "history.json"), {});

let raws;
let sampleAi = {};
if (SAMPLE) {
  raws = readJson(path.join(DATA, "sample", "raw.json"), []);
  sampleAi = readJson(path.join(DATA, "sample", "ai.json"), {});
} else {
  const dir = path.join(DATA, "raw");
  if (!fs.existsSync(dir)) {
    console.error("No data/raw yet. Run `npm run data:sync` first (or `npm run data:sample` for demo data).");
    process.exit(1);
  }
  raws = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => readJson(path.join(dir, f))).filter(Boolean);
}
console.log(`Building catalog from ${raws.length} packages${SAMPLE ? " (sample data)" : " already synced into data/raw"}…`);
if (!SAMPLE && raws.length < Number(process.env.SYNC_LIMIT || 2000)) {
  console.log(`  To index more, run \`npm run data:sync\` first (it fetches SYNC_LIMIT=${process.env.SYNC_LIMIT || 2000} packages), or \`npm run data\` for both steps.`);
}

const catalogNames = new Set(raws.map((r) => r.name));
const limitArg = process.argv.indexOf("--ai-limit");
const AI_LIMIT = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Infinity;
const chain = NO_AI ? { enabled: false } : createAiChain();
if (!SAMPLE) {
  const todo = raws.filter((r) => r.docs?.readme && !cachedExplain(r)).length;
  if (chain.enabled) console.log(`  AI: ${chain.describe()}, ${todo} packages need a summary${Number.isFinite(AI_LIMIT) ? ` (limit ${AI_LIMIT} this run)` : ""}.`);
  else if (!NO_AI) console.log("  No AI keys (GEMINI_API_KEY / GROQ_API_KEY): categories from keyword rules, summaries only where cached.");
}
let aiExhausted = false;

// ---- 1. facts + tags --------------------------------------------------------
const rulesByName = new Map(raws.map((r) => [r.name, classifyByRules(r, taxonomy)]));
let aiCalls = 0, aiFailed = 0;

const entries = await pool(raws, 4, async (raw) => {
  const facts = deriveFacts(raw);
  if (facts.unlisted) return null;

  let categories = rulesByName.get(raw.name);
  const primarySlug = categories[0]?.slug;
  const neighbours = raws
    .filter((r) => r.name !== raw.name && rulesByName.get(r.name)[0]?.slug === primarySlug)
    .sort((a, b) => b.score.downloads30d - a.score.downloads30d)
    .slice(0, 12)
    .map((r) => r.name);

  let ai = null;
  if (SAMPLE) {
    ai = sampleAi[raw.name] ? { model: "sample", version: raw.version, generatedAt: null, data: sampleAi[raw.name] } : null;
  } else {
    try {
      const canCall = chain.enabled && !aiExhausted && aiCalls < AI_LIMIT;
      ai = cachedExplain(raw);
      if (!ai && canCall && raw.docs?.readme) {
        aiCalls++;
        ai = await explain(raw, facts, taxonomy, { catalogNames, neighbours, chain });
        if (!ai) {
          aiCalls--;
          if (!aiExhausted) console.log("  AI: every provider is out of quota for now; the rest keep rule-based tags. Run again later to continue.");
          aiExhausted = true;
        } else if (aiCalls % 25 === 0) console.log(`  AI: ${aiCalls} summaries so far`);
      }
    } catch (err) {
      aiFailed++;
      console.warn(`  AI ✗ ${raw.name}: ${err.message}`);
    }
  }

  if (ai?.data?.primary_category) {
    const conf = Number(ai.data.confidence) || 0.75;
    categories = [
      { slug: ai.data.primary_category, primary: true, confidence: conf, source: "llm" },
      ...ai.data.secondary_categories.map((slug) => ({ slug, primary: false, confidence: conf, source: "llm" })),
    ];
  }
  const ov = overrides[raw.name];
  if (ov?.hide) return null;
  if (ov?.primary) {
    categories = [ov.primary, ...(ov.secondary ?? [])].map((slug, i) => ({ slug, primary: i === 0, confidence: 1, source: "human" }));
  }

  const versions = raw.versions ?? [];
  const majorOf = (v) => Number(String(v).split(".")[0]) || 0;
  let majorBumpsLastYear = 0;
  for (let i = 1; i < versions.length; i++) {
    if (daysSince(versions[i].published, now) <= 365 && majorOf(versions[i].version) > majorOf(versions[i - 1].version) && !/-/.test(versions[i].version)) majorBumpsLastYear++;
  }

  return {
    name: raw.name,
    version: raw.version,
    description: raw.description,
    oneLiner: ai?.data?.one_liner || raw.description,
    published: raw.published,
    firstPublished: raw.firstPublished,
    repository: raw.repository ?? (raw.homepage?.includes("github.com") ? raw.homepage : null),
    homepage: raw.homepage,
    publisher: raw.publisher,
    topics: raw.topics ?? [],
    ...facts,
    sdkDart: raw.sdk?.dart ?? null,
    sdkFlutterMin: minVersion(raw.sdk?.flutter),
    sdkDartMin: minVersion(raw.sdk?.dart),
    discontinued: raw.discontinued,
    replacedBy: raw.replacedBy,
    dependencies: raw.dependencies.filter((d) => d !== raw.name),
    dependencyCount: raw.dependencies.filter((d) => d !== "flutter" && d !== "flutter_web_plugins").length,
    usesCodegen: raw.dependencies.some((d) => ["json_annotation", "freezed_annotation", "build_runner", "source_gen"].includes(d)) || /build_runner/.test(raw.docs?.readme ?? ""),
    hasExample: raw.docs ? raw.docs.hasExample : null,
    worksWith: worksWith(raw, taxonomy),
    categories,
    primaryCategory: categories[0]?.slug ?? null,
    approach: ai?.data?.approach ?? [],
    metrics: {
      downloads30d: raw.score.downloads30d,
      likes: raw.score.likes,
      points: raw.score.points,
      maxPoints: raw.score.maxPoints,
      stars: raw.github?.stars ?? null,
      openIssues: raw.github?.openIssues ?? null,
      contributors: raw.github?.contributors ?? null,
      lastCommit: raw.github?.pushedAt ?? null,
      archived: raw.github?.archived ?? false,
    },
    releaseDates: versions.map((v) => v.published),
    majorBumpsLastYear,
    explainer: ai?.data
      ? {
          whatItDoes: ai.data.what_it_does,
          useWhen: ai.data.use_when,
          avoidWhen: ai.data.avoid_when,
          strengths: ai.data.strengths,
          weaknesses: ai.data.weaknesses,
          setupEffort: ai.data.setup_effort,
          setupNotes: ai.data.setup_notes,
          alternatives: ai.data.alternatives,
          example: ai.data.minimal_example,
          model: ai.provider ? `${ai.provider}/${ai.model}` : ai.model,
          forVersion: ai.version,
          generatedAt: ai.generatedAt,
        }
      : null,
    syncedAt: raw.syncedAt ?? null,
  };
});

const pkgs = entries.filter(Boolean);

// ---- 2. category distributions (popularity is ranked within category) -------
const downloadsByCat = new Map(), likesByCat = new Map(), platformsByCat = new Map();
for (const p of pkgs) {
  const c = p.primaryCategory;
  if (!c) continue;
  (downloadsByCat.get(c) ?? downloadsByCat.set(c, []).get(c)).push(Math.log10(1 + p.metrics.downloads30d));
  (likesByCat.get(c) ?? likesByCat.set(c, []).get(c)).push(p.metrics.likes);
  if (p.kind !== "dart") (platformsByCat.get(c) ?? platformsByCat.set(c, []).get(c)).push(p.platforms.length);
}
const allDl = pkgs.map((p) => Math.log10(1 + p.metrics.downloads30d));
const allLikes = pkgs.map((p) => p.metrics.likes);
const platformNormByCat = new Map(
  [...platformsByCat].map(([c, arr]) => {
    const s = [...arr].sort((a, b) => a - b);
    return [c, Math.max(1, s[Math.floor(s.length / 2)])];
  }),
);
const ctx = {
  now,
  downloadsByCat: { get: (c) => (downloadsByCat.get(c)?.length >= 5 ? downloadsByCat.get(c) : allDl) },
  likesByCat: { get: (c) => (likesByCat.get(c)?.length >= 5 ? likesByCat.get(c) : allLikes) },
  platformNormByCat,
};

// ---- 3. scores, flags, badges ----------------------------------------------
for (const p of pkgs) {
  p.scores = scorePackage(p, ctx);
  p.flags = flagsFor(p, now);
  p.badges = badgesFor(p, history, now);
}

// ---- 4. related ("works with") vs alternatives ("could replace") -------------
buildRelations(pkgs);
for (const p of pkgs) {
  delete p.releaseDates;
  delete p.dependencies;
}

// ---- 5. embeddings for "describe what you need" search -------------------
if (!SAMPLE && !process.argv.includes("--no-embed")) {
  const nameOf = new Map(taxonomy.categories.map((c) => [c.slug, c.name]));
  await updateEmbeddings(pkgs, (slug) => nameOf.get(slug) ?? slug);
}

// ---- 6. write --------------------------------------------------------------
const categories = taxonomy.categories.map((c) => ({
  slug: c.slug,
  name: c.name,
  blurb: c.blurb,
  group: c.group,
  count: pkgs.filter((p) => p.categories.some((t) => t.slug === c.slug)).length,
}));

pkgs.sort((a, b) => b.metrics.downloads30d - a.metrics.downloads30d);
writeJson(path.join(DATA, "catalog.json"), {
  generatedAt: new Date().toISOString(),
  source: SAMPLE ? "sample" : "pub.dev",
  count: pkgs.length,
  categories,
  worksWith: taxonomy.worksWith.map(({ slug, name }) => ({ slug, name })),
  packages: pkgs,
});

if (chain.enabled) console.log(`  AI usage: ${chain.stats()}`);
const untagged = pkgs.filter((p) => !p.primaryCategory).length;
console.log(`Wrote data/catalog.json: ${pkgs.length} packages, ${untagged} without a category${aiCalls ? `, ${aiCalls} AI calls` : ""}${aiFailed ? `, ${aiFailed} AI failures` : ""}.`);
if (untagged) console.log("  Tip: add them to data/overrides.json, e.g. { \"some_pkg\": { \"primary\": \"widgets\" } }");
