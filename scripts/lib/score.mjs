/**
 * Health score, sub-scores, caps, red flags and badges.
 * Weights and formulas match the spec; inputs that aren't available
 * (e.g. no GitHub data) are dropped and the rest re-weighted, and the
 * score is marked `partial`.
 */
import { clamp, daysSince } from "./util.mjs";

const W = { maintenance: 0.3, quality: 0.2, popularity: 0.2, community: 0.15, compatibility: 0.15 };
const SENSITIVE = new Set(["auth", "storage", "payments", "web3"]);

/** Weighted mean over parts that have a value. */
function mix(parts) {
  const have = parts.filter((p) => p.value != null && Number.isFinite(p.value));
  const total = have.reduce((s, p) => s + p.weight, 0);
  if (!total) return { value: null, partial: true, parts };
  return {
    value: Math.round(have.reduce((s, p) => s + p.value * p.weight, 0) / total),
    partial: have.length < parts.length,
    parts: parts.map((p) => ({ ...p, value: p.value == null ? null : Math.round(p.value) })),
  };
}

/** Percentile rank (0–100) of `v` within `arr`. */
export function percentile(arr, v) {
  if (arr.length <= 1) return 50;
  const below = arr.filter((x) => x < v).length;
  const equal = arr.filter((x) => x === v).length;
  return ((below + equal / 2) / arr.length) * 100;
}

/**
 * @param pkg   partially built catalog entry (facts, metrics, categories)
 * @param ctx   { downloadsByCat: Map<slug, number[]>, likesByCat, platformNormByCat, now }
 */
export function scorePackage(pkg, ctx) {
  const now = ctx.now;
  const m = pkg.metrics;
  const releaseDays = daysSince(pkg.published, now);
  const releasesLastYear = pkg.releaseDates.filter((d) => daysSince(d, now) <= 365).length;
  const majorsLastYear = pkg.majorBumpsLastYear;

  const maintenance = mix([
    { key: "recency", label: "Last release", weight: 50, value: 100 * 0.5 ** (releaseDays / 180), raw: `${Math.round(releaseDays)} days ago` },
    {
      key: "activity",
      label: m.lastCommit ? "Repo activity" : "Release cadence",
      weight: 50,
      value: m.lastCommit ? 100 * 0.5 ** (daysSince(m.lastCommit, now) / 90) : clamp((releasesLastYear / 6) * 100),
      raw: m.lastCommit ? `last push ${Math.round(daysSince(m.lastCommit, now))} days ago` : `${releasesLastYear} releases in 12 months`,
    },
  ]);

  const quality = mix([
    { key: "points", label: "Pub points", weight: 70, value: m.points != null && m.maxPoints ? (m.points / m.maxPoints) * 100 : null, raw: m.points != null ? `${m.points}/${m.maxPoints}` : "not analysed" },
    { key: "example", label: "Has example", weight: 15, value: pkg.hasExample == null ? null : pkg.hasExample ? 100 : 0, raw: pkg.hasExample == null ? "unknown" : pkg.hasExample ? "yes" : "no" },
    { key: "stability", label: "Breaking changes", weight: 15, value: clamp(100 - majorsLastYear * 20), raw: `${majorsLastYear} major version${majorsLastYear === 1 ? "" : "s"} in 12 months` },
  ]);

  const cat = pkg.primaryCategory;
  const dl = ctx.downloadsByCat.get(cat) ?? [];
  const lk = ctx.likesByCat.get(cat) ?? [];
  const popularity = mix([
    { key: "downloads", label: "Downloads in category", weight: 60, value: percentile(dl, Math.log10(1 + m.downloads30d)), raw: `${m.downloads30d.toLocaleString("en-US")} / 30 days` },
    { key: "likes", label: "Likes in category", weight: 40, value: percentile(lk, m.likes), raw: `${m.likes.toLocaleString("en-US")} likes` },
  ]);

  const community = mix([
    { key: "contributors", label: "Contributors", weight: 45, value: m.contributors == null ? null : clamp((m.contributors / 8) * 100), raw: m.contributors == null ? "no repo data" : `${m.contributors}${m.contributors >= 100 ? "+" : ""}` },
    { key: "publisher", label: "Verified publisher", weight: 35, value: pkg.publisher ? 100 : 0, raw: pkg.publisher ?? "none" },
    { key: "favorite", label: "Flutter Favorite", weight: 20, value: pkg.flutterFavorite ? 100 : 0, raw: pkg.flutterFavorite ? "yes" : "no" },
  ]);

  const norm = ctx.platformNormByCat.get(cat) ?? 6;
  const compatibility = mix([
    { key: "dart3", label: "Supports Dart 3", weight: 50, value: pkg.dart3 ? 100 : 0, raw: pkg.sdkDart ?? "unknown" },
    { key: "platforms", label: "Platform coverage", weight: 35, value: pkg.kind === "dart" ? 100 : clamp((pkg.platforms.length / norm) * 100), raw: `${pkg.platforms.length} of 6` },
    { key: "wasm", label: "WASM-ready", weight: 15, value: pkg.platforms.includes("web") || pkg.kind === "dart" ? (pkg.wasm ? 100 : 0) : null, raw: pkg.wasm ? "yes" : "no" },
  ]);

  const subs = { maintenance, quality, popularity, community, compatibility };
  let raw = 0, wsum = 0;
  for (const [k, s] of Object.entries(subs)) if (s.value != null) { raw += s.value * W[k]; wsum += W[k]; }
  let health = wsum ? Math.round(raw / wsum) : 0;

  let cap = null;
  if (pkg.discontinued) cap = { at: 20, why: "Discontinued on pub.dev" };
  else if (m.archived) cap = { at: 30, why: "GitHub repository archived" };
  else if (releaseDays > 730) cap = { at: 50, why: "No release in over 2 years" };
  if (cap && health > cap.at) health = cap.at;

  return {
    health,
    cap,
    partial: Object.values(subs).some((s) => s.partial),
    maintenance: maintenance.value,
    quality: quality.value,
    popularity: popularity.value,
    community: community.value,
    compatibility: compatibility.value,
    breakdown: Object.fromEntries(Object.entries(subs).map(([k, s]) => [k, s.parts])),
  };
}

export function flagsFor(pkg, now) {
  const m = pkg.metrics;
  const flags = [];
  const add = (code, label, detail, level = "warn") => flags.push({ code, label, detail, level });
  if (pkg.discontinued) add("discontinued", "Discontinued", pkg.replacedBy ? `The author recommends ${pkg.replacedBy} instead.` : "The author no longer maintains it.", "bad");
  if (pkg.licenseClass === "copyleft") add("copyleft", "Copyleft license", `${pkg.license?.toUpperCase()} can require you to publish your app's source. Check before using it in client or closed-source work.`, "bad");
  if (pkg.licenseClass === "weak-copyleft") add("weak-copyleft", "File-level copyleft", `${pkg.license?.toUpperCase()}: changes to this package's own files must stay open; your app code is not affected.`, "info");
  if (m.archived) add("archived", "Repository archived", "The GitHub repository is read-only.", "bad");
  if (daysSince(pkg.published, now) > 365 && m.openIssues > 50) add("stale", "Quiet but busy", `No release in a year while ${m.openIssues} issues are open.`);
  if (m.contributors === 1 && m.downloads30d > 100_000) add("bus-factor", "Single maintainer", "Widely used, but one person maintains it.");
  if (!pkg.dart3) add("old-sdk", "No Dart 3 support", "Its SDK constraint doesn't allow Dart 3, so it won't resolve on current Flutter.", "bad");
  if (pkg.kind === "plugin") add("native", "Native setup", "Uses platform code; may need Gradle, Podfile or manifest changes.", "info");
  if (!pkg.publisher && pkg.categories.some((c) => SENSITIVE.has(c.slug))) add("unverified-sensitive", "Unverified publisher", "Handles security-sensitive work without a verified publisher.");
  return flags;
}

export function badgesFor(pkg, history, now) {
  const badges = [];
  if (pkg.flutterFavorite) badges.push("flutter-favorite");
  if (pkg.wasm) badges.push("wasm");
  if (pkg.worksWith.includes("material_ui") || pkg.worksWith.includes("cupertino_ui")) badges.push("material-ui");
  const major = Number(String(pkg.version).split(".")[0]);
  if (major >= 1 && pkg.scores.health >= 85 && pkg.majorBumpsLastYear === 0) badges.push("rock-solid");
  const h = history?.[pkg.name];
  if (h) {
    const days = Object.keys(h).sort();
    const recent = days.at(-1);
    const old = days.find((d) => daysSince(d, now) <= 95 && daysSince(d, now) >= 80);
    if (recent && old && h[old][0] > 1000 && h[recent][0] >= h[old][0] * 1.5) badges.push("rising");
  }
  return badges;
}
