/**
 * Layer 1 (rules) of the tagging pipeline: platform, license, kind, works-with,
 * and a keyword classifier for categories. The LLM layer (explain.mjs) can
 * override categories; human overrides in data/overrides.json win over both.
 */

const PLATFORMS = ["android", "ios", "web", "windows", "macos", "linux"];
const COPYLEFT = /^(a?gpl)/;
const WEAK_COPYLEFT = /^(lgpl|mpl|eupl|cddl|epl)/;
const PERMISSIVE = /^(mit|bsd|apache|isc|zlib|unlicense|0bsd|bsl|cc0)/;

export function deriveFacts(raw) {
  const tags = raw.score?.tags ?? [];
  const has = (t) => tags.includes(t);
  const platforms = PLATFORMS.filter((p) => has(`platform:${p}`));
  const licenses = tags.filter((t) => t.startsWith("license:")).map((t) => t.slice(8)).filter((l) => !["osi-approved", "fsf-libre"].includes(l));
  const license = licenses[0] ?? null;
  const licenseClass = !license ? "unknown" : COPYLEFT.test(license) ? "copyleft" : WEAK_COPYLEFT.test(license) ? "weak-copyleft" : PERMISSIVE.test(license) ? "permissive" : "unknown";
  const isFlutter = has("sdk:flutter") && !has("sdk:dart") ? true : raw.dependencies.includes("flutter");
  const kind = raw.isPlugin ? "plugin" : raw.dependencies.includes("ffi") ? "ffi" : isFlutter ? "flutter" : "dart";
  return {
    platforms,
    wasm: has("is:wasm-ready"),
    flutterFavorite: has("is:flutter-favorite"),
    dart3: has("is:dart3-compatible") || supportsDart3(raw.sdk?.dart),
    license,
    licenseClass,
    kind,
    unlisted: has("is:unlisted"),
  };
}

/** True when the Dart SDK constraint's upper bound allows Dart 3. */
export function supportsDart3(constraint) {
  if (!constraint) return false;
  const upper = constraint.match(/<\s*(\d+)/);
  return upper ? Number(upper[1]) >= 4 : /\^3|>=\s*3/.test(constraint);
}

/** Minimum Flutter / Dart version from a constraint like ">=3.41.0" or "^3.11.0". */
export function minVersion(constraint) {
  const m = constraint?.match(/(?:>=|\^)\s*(\d+\.\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}

export function worksWith(raw, taxonomy) {
  return taxonomy.worksWith.filter((w) => w.deps.some((d) => raw.dependencies.includes(d) && d !== raw.name)).map((w) => w.slug);
}

const norm = (s) => ` ${String(s || "").toLowerCase().replace(/[_\-/]+/g, " ").replace(/[^a-z0-9+ ]+/g, " ")} `;

/** Keyword classifier. Returns [{slug, primary, confidence, source:"rule"}], best first. */
export function classifyByRules(raw, taxonomy) {
  const name = norm(raw.name);
  const desc = norm(raw.description);
  const topics = norm((raw.topics ?? []).join(" "));
  const readme = norm((raw.docs?.readme ?? "").slice(0, 4000));
  const scores = [];

  for (const cat of taxonomy.categories) {
    let s = 0;
    for (const kwRaw of cat.keywords) {
      const kw = norm(kwRaw);
      if (name.includes(kw)) s += 3;
      if (desc.includes(kw)) s += 2.5;
      if (topics.includes(kw)) s += 3;
      // README text is noisy: only count distinctive keywords there.
      if (kw.trim().length >= 5 && readme.includes(kw)) s += 0.4;
    }
    for (const t of cat.topics ?? []) if ((raw.topics ?? []).includes(t)) s += 4;
    if (cat.deps.some((d) => raw.dependencies.includes(d) && d !== raw.name)) s += 1.5;
    if (s > 0) scores.push({ slug: cat.slug, s });
  }

  scores.sort((a, b) => b.s - a.s);
  if (!scores.length) return [];
  const top = scores[0].s;
  const runnerUp = scores[1]?.s ?? 0;
  return scores
    .filter((c, i) => i === 0 || (c.s >= top * 0.45 && c.s >= 2.5))
    .slice(0, 5)
    .map((c, i) => ({
      slug: c.slug,
      primary: i === 0,
      confidence: Number(Math.min(0.9, (i === 0 ? top / (top + runnerUp + 1) : c.s / (top + 1)) + 0.1).toFixed(2)),
      source: "rule",
    }));
}
