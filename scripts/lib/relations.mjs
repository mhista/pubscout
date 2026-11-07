/**
 * Two different questions, kept apart:
 *   related      = packages that work WITH this one (dependency either way, or the same publisher family:
 *                  firebase_auth ↔ firebase_core, flutter_bloc ↔ bloc ↔ bloc_test)
 *   alternatives = packages that could REPLACE this one (same main category, not related,
 *                  and their own descriptions overlap in what they do)
 */

const STOP = new Set(
  ("a an and are as at be by can for from has have in into is it its of on or that the this to with your you via " +
    "flutter dart plugin package packages library libraries lib android ios web windows macos linux desktop mobile platform platforms " +
    "support supports supported simple easy easily fast powerful lightweight using use used based provides provide implementation " +
    "app apps application applications widget widgets api apis official native new more all also any well other").split(" "),
);

const words = (s) =>
  new Set(
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => w.replace(/(ies)$/, "y").replace(/(?<=[a-z]{3})s$/, "")),
  );

const prefix = (name) => name.replace(/^flutter_/, "").split("_")[0];

export function buildRelations(pkgs) {
  const by = new Map(pkgs.map((p) => [p.name, p]));
  const deps = new Map(pkgs.map((p) => [p.name, new Set(p.dependencies.filter((d) => by.has(d)))]));
  const dependents = new Map(pkgs.map((p) => [p.name, new Set()]));
  for (const [n, ds] of deps) for (const d of ds) dependents.get(d)?.add(n);
  const terms = new Map(pkgs.map((p) => [p.name, words(`${p.description} ${p.topics.join(" ")}`)]));

  const family = (a, b) => {
    if (!a.publisher || a.publisher !== b.publisher) return false;
    if (prefix(a.name) === prefix(b.name)) return true;
    // siblings built on the same core package from that publisher (flutter_bloc + bloc_test both use bloc)
    for (const d of deps.get(a.name)) if (deps.get(b.name).has(d) && by.get(d)?.publisher === a.publisher) return true;
    return false;
  };

  // Dependencies nearly everything uses (path, meta, collection…) say nothing about what a package is for.
  const common = new Set([...dependents].filter(([, s]) => s.size >= Math.max(5, pkgs.length * 0.08)).map(([n]) => n));
  const TOOLS = new Set(["build_runner"]); // run alongside code generators, never instead of them
  const isGenerator = (p) => [...deps.get(p.name)].some((d) => d === "build" || d === "source_gen") || p.name.endsWith("_generator");

  /** How `b` relates to `a`, from a's page: "built-on" (b depends on a), "uses" (a depends on b), "family", "tooling", or null. */
  const relation = (a, b) => {
    if (deps.get(b.name).has(a.name)) return "built-on";
    if (deps.get(a.name).has(b.name)) return common.has(b.name) ? "infra" : "uses";
    if (family(a, b)) return "family";
    if ((TOOLS.has(b.name) && isGenerator(a)) || (TOOLS.has(a.name) && isGenerator(b))) return "tooling";
    return null;
  };

  const overlap = (a, b) => {
    const A = terms.get(a.name), B = terms.get(b.name);
    if (!A.size || !B.size) return 0;
    let shared = 0;
    for (const w of A) if (B.has(w)) shared++;
    return shared >= 2 || Math.min(A.size, B.size) <= 3 ? shared / Math.min(A.size, B.size) : 0;
  };
  const isTest = (p) => p.categories.some((c) => c.slug === "testing");

  for (const p of pkgs) {
    const related = [];
    for (const o of pkgs) {
      if (o.name === p.name) continue;
      const r = relation(p, o);
      if (r) related.push({ name: o.name, relation: r, dl: o.metrics.downloads30d });
    }
    const shown = related.filter((r) => r.relation !== "infra");
    {
    }
    const order = { uses: 0, tooling: 1, family: 2, "built-on": 3 };
    shown.sort((a, b) => order[a.relation] - order[b.relation] || b.dl - a.dl);
    p.related = shown.slice(0, 8).map(({ name, relation }) => ({ name, relation }));
    const relatedNames = new Set(related.map((r) => r.name));

    // The AI read both READMEs, so when it named alternatives those are the list.
    const fromAi = (p.explainer?.alternatives ?? []).map((a) => a.name).filter((n) => by.has(n) && !relatedNames.has(n));
    if (fromAi.length) {
      p.alternatives = fromAi.slice(0, 5);
      continue;
    }
    // Otherwise a cautious keyword fallback: same main category and clearly overlapping descriptions.
    const scored = pkgs
      .filter((o) => o.name !== p.name && !o.discontinued && !relatedNames.has(o.name) && !TOOLS.has(o.name) && !TOOLS.has(p.name))
      .filter((o) => o.primaryCategory && o.primaryCategory === p.primaryCategory && isTest(o) === isTest(p))
      .map((o) => ({ o, sim: overlap(p, o) }))
      .filter((x) => x.sim >= 0.25)
      .sort((a, b) => b.sim * 100 + b.o.scores.health - (a.sim * 100 + a.o.scores.health))
      .map((x) => x.o.name);
    p.alternatives = scored.slice(0, 4);
  }
}
