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
  cache = { catalog, byName: new Map(catalog.packages.map((p) => [p.name, p])) };
  return cache;
}

export const getCatalog = () => load().catalog;
export const getPackage = (name: string) => load().byName.get(name) ?? null;
export const getCategory = (slug: string) => load().catalog.categories.find((c) => c.slug === slug) ?? null;
export const categoryName = (slug: string) => getCategory(slug)?.name ?? slug;
