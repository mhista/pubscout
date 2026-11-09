import type { Pkg } from "./types";

/** Everything a results page can be filtered by; mirrors the URL query string. */
export type Filters = {
  q: string;
  cat: string[];
  plat: string[];
  with: string[];
  min: number;
  active: number; // months, 0 = any
  dl: number;
  stable: boolean;
  verified: boolean;
  permissive: boolean;
  showDisc: boolean;
  pure: boolean;
  nonative: boolean;
  nocodegen: boolean;
  wasm: boolean;
  essential: boolean;
  sort: SortKey;
  page: number;
};

export const SORTS = [
  { key: "best", label: "Best match" },
  { key: "health", label: "Health" },
  { key: "downloads", label: "Downloads" },
  { key: "likes", label: "Likes" },
  { key: "updated", label: "Recently updated" },
] as const;
export type SortKey = (typeof SORTS)[number]["key"];

export const PAGE_SIZE = 30;

// Filler words people use when describing a need ("I need a package to pick images for my app").
const STOP = new Set("a an and any app apps are best can do does flutter dart for from good have help how i in is it its like lib library me my need needs of on or package packages plugin some something that the this to want which with without".split(" "));
type SP = Record<string, string | string[] | undefined>;

const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => x.split(",")).map((x) => x.trim()).filter(Boolean);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const flag = (v: string | string[] | undefined) => one(v) === "1";

export function parseFilters(sp: SP): Filters {
  const sort = one(sp.sort) as SortKey;
  return {
    q: one(sp.q).trim().slice(0, 80),
    cat: list(sp.cat),
    plat: list(sp.plat),
    with: list(sp.with),
    min: Number(one(sp.min)) || 0,
    active: Number(one(sp.active)) || 0,
    dl: Number(one(sp.dl)) || 0,
    stable: flag(sp.stable),
    verified: flag(sp.verified),
    permissive: flag(sp.permissive),
    showDisc: flag(sp.disc),
    pure: flag(sp.pure),
    nonative: flag(sp.nonative),
    nocodegen: flag(sp.nocodegen),
    wasm: flag(sp.wasm),
    essential: flag(sp.essential),
    sort: SORTS.some((s) => s.key === sort) ? sort : "best",
    page: Math.max(1, Number(one(sp.page)) || 1),
  };
}

const MONTH = 30.4 * 86_400_000;

/** Facet predicates, kept separate so each facet's counts can ignore its own selection. */
function predicates(f: Filters, now: number) {
  return {
    cat: (p: Pkg) => !f.cat.length || f.cat.every((c) => p.categories.some((t) => t.slug === c)),
    plat: (p: Pkg) => !f.plat.length || p.kind === "dart" || f.plat.every((x) => p.platforms.includes(x)),
    with: (p: Pkg) => !f.with.length || f.with.every((w) => p.worksWith.includes(w)),
    rest: (p: Pkg) =>
      (!f.essential || !!p.essential) &&
      (!f.min || p.scores.health >= f.min) &&
      (!f.active || now - Date.parse(p.published) <= f.active * MONTH) &&
      (!f.dl || p.metrics.downloads30d >= f.dl) &&
      (!f.stable || Number(p.version.split(".")[0]) >= 1) &&
      (!f.verified || !!p.publisher) &&
      (!f.permissive || p.licenseClass === "permissive") &&
      (f.showDisc || !p.discontinued) &&
      (!f.pure || p.kind === "dart") &&
      (!f.nonative || (p.kind !== "plugin" && p.kind !== "ffi")) &&
      (!f.nocodegen || !p.usesCodegen) &&
      (!f.wasm || p.wasm),
  };
}

/** Plain text relevance. Category keyword hits let "pick images" find image pickers. */
function textScore(p: Pkg, terms: string[], catHits: Set<string>) {
  if (!terms.length) return 0;
  const name = p.name.toLowerCase();
  const joined = terms.join("_");
  let s = 0;
  if (name === joined || name === terms.join("")) s += 120;
  else if (name.startsWith(joined)) s += 50;
  const hay = `${p.oneLiner} ${p.description} ${p.topics.join(" ")}`.toLowerCase();
  let matched = 0;
  for (const t of terms) {
    let hit = false;
    if (name.includes(t)) { s += 25; hit = true; }
    if (hay.includes(t)) { s += 8; hit = true; }
    if (p.topics.some((x) => x.includes(t))) { s += 8; hit = true; }
    if (hit) matched++;
  }
  if (p.categories.some((c) => catHits.has(c.slug))) { s += 30; matched = Math.max(matched, Math.ceil(terms.length / 2)); }
  return matched >= Math.ceil(terms.length / 2) ? s : 0;
}

export function runQuery(all: Pkg[], f: Filters, categoryIndex: { slug: string; name: string; keywords?: string[] }[], now = Date.now()) {
  const pr = predicates(f, now);
  const terms = f.q.toLowerCase().split(/[\s,]+/).filter((t) => t.length > 1 && !STOP.has(t));
  const qLower = f.q.toLowerCase();
  const catHits = new Set(
    categoryIndex
      .filter((c) => qLower && (c.name.toLowerCase().includes(qLower) || (c.keywords ?? []).some((k) => qLower.includes(k) || (k.includes(qLower) && qLower.length > 3))))
      .map((c) => c.slug),
  );

  const scored = all
    .map((p) => ({ p, t: textScore(p, terms, catHits) }))
    .filter((x) => !terms.length || x.t > 0);

  const base = scored.filter((x) => pr.rest(x.p));
  const results = base.filter((x) => pr.cat(x.p) && pr.plat(x.p) && pr.with(x.p));

  // Facet counts: each facet counts against all the *other* filters.
  const count = (arr: typeof base, key: (p: Pkg) => string[]) => {
    const m = new Map<string, number>();
    for (const { p } of arr) for (const k of key(p)) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const facets = {
    // Categories combine with AND, so their counts are taken from the current results.
    cat: count(results, (p) => p.categories.map((c) => c.slug)),
    plat: count(base.filter((x) => pr.cat(x.p) && pr.with(x.p)), (p) => (p.kind === "dart" ? ["android", "ios", "web", "windows", "macos", "linux"] : p.platforms)),
    with: count(base.filter((x) => pr.cat(x.p) && pr.plat(x.p)), (p) => p.worksWith),
  };

  const pop = (p: Pkg) => Math.log10(1 + p.metrics.downloads30d);
  const sorters: Record<SortKey, (a: (typeof results)[0], b: (typeof results)[0]) => number> = {
    best: (a, b) => b.t + b.p.scores.health * 0.6 + pop(b.p) * 6 - (a.t + a.p.scores.health * 0.6 + pop(a.p) * 6),
    health: (a, b) => b.p.scores.health - a.p.scores.health || b.p.metrics.downloads30d - a.p.metrics.downloads30d,
    downloads: (a, b) => b.p.metrics.downloads30d - a.p.metrics.downloads30d,
    likes: (a, b) => b.p.metrics.likes - a.p.metrics.likes,
    updated: (a, b) => Date.parse(b.p.published) - Date.parse(a.p.published),
  };
  results.sort(sorters[f.sort]);

  const total = results.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  return {
    total,
    page,
    pages,
    items: results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((x) => x.p),
    facets,
  };
}

/** Build a query string from filters, dropping defaults. */
export function toQuery(f: Partial<Filters>) {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  for (const k of ["cat", "plat", "with"] as const) if (f[k]?.length) sp.set(k, f[k]!.join(","));
  for (const k of ["min", "active", "dl"] as const) if (f[k]) sp.set(k, String(f[k]));
  const flags: [keyof Filters, string][] = [["stable", "stable"], ["verified", "verified"], ["permissive", "permissive"], ["showDisc", "disc"], ["pure", "pure"], ["nonative", "nonative"], ["nocodegen", "nocodegen"], ["wasm", "wasm"], ["essential", "essential"]];
  for (const [k, key] of flags) if (f[k]) sp.set(key, "1");
  if (f.sort && f.sort !== "best") sp.set("sort", f.sort);
  if (f.page && f.page > 1) sp.set("page", String(f.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
