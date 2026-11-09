import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Catalog, Pkg } from "./types";

let cache: { catalog: Catalog; byName: Map<string, Pkg> } | null = null;

/** data/catalog.json is produced by `npm run data` (or `npm run data:sample`). */
function load() {
  if (cache) return cache;
  const file = path.join(process.cwd(), "data", "catalog.json");
  if (!fs.existsSync(file)) {
    throw new Error("data/catalog.json is missing. Run `npm run data:sample` for demo data, or `npm run data` for real pub.dev data.");
  }
  const catalog = JSON.parse(fs.readFileSync(file, "utf8")) as Catalog;
  for (const p of catalog.packages) p.explainer = safeExplainer(p.explainer);
  cache = { catalog, byName: new Map(catalog.packages.map((p) => [p.name, p])) };
  return cache;
}

const EFFORTS = ["low", "medium", "high"] as const;
const SPILLED = /^(setup_effort|setup_notes|alternatives|minimal_example|confidence)$/;
/** Clean a list from the AI: split squashed items ("a\",\"b"), strip stray quotes, stop at spilled keys. */
function strList(v: unknown): string[] {
  const items = (Array.isArray(v) ? v : [])
    .filter((x): x is string => typeof x === "string")
    .flatMap((x) => x.split(/"\s*,\s*"/))
    .map((x) => x.replace(/^[\s"'\[\]{},:]+|[\s"'\[\]{},:]+$/g, "").trim());
  const out: string[] = [];
  for (const x of items) {
    if (SPILLED.test(x)) break;
    if (x.length >= 3) out.push(x);
  }
  return out;
}

/** The data job repairs AI output, but never let one odd summary break a page. */
function safeExplainer(ex: Pkg["explainer"]): Pkg["explainer"] {
  if (!ex || typeof ex !== "object" || typeof ex.whatItDoes !== "string" || !ex.whatItDoes.trim()) return null;
  const effort = EFFORTS.find((e) => e === String(ex.setupEffort ?? "").toLowerCase()) ?? null;
  return {
    ...ex,
    useWhen: strList(ex.useWhen),
    avoidWhen: strList(ex.avoidWhen),
    strengths: strList(ex.strengths),
    weaknesses: strList(ex.weaknesses),
    setupEffort: effort,
    setupNotes: typeof ex.setupNotes === "string" ? ex.setupNotes : "",
    alternatives: Array.isArray(ex.alternatives) ? ex.alternatives.filter((a) => a && typeof a.name === "string") : [],
    example: typeof ex.example === "string" ? ex.example : "",
  };
}

export const getCatalog = () => load().catalog;
export const getPackage = (name: string) => load().byName.get(name) ?? null;
export const getCategory = (slug: string) => load().catalog.categories.find((c) => c.slug === slug) ?? null;
export const categoryName = (slug: string) => getCategory(slug)?.name ?? slug;
