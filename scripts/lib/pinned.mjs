import path from "node:path";
import { DATA, readJson, writeJson } from "./util.mjs";

export const NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;
const REQ_FILE = path.join(DATA, "requests.json");

/** Packages developers asked for: { name: { requestedAt, issue? } }. Committed to git. */
export const readRequests = () => readJson(REQ_FILE, { packages: {} }).packages ?? {};
export const writeRequests = (packages) =>
  writeJson(REQ_FILE, { packages: Object.fromEntries(Object.entries(packages).sort(([a], [b]) => a.localeCompare(b))) }, true);

/** Hand-picked essentials (data/essentials.json): important packages, including ones devs may not know about. */
export function essentialNames() {
  const groups = readJson(path.join(DATA, "essentials.json"), {}).groups ?? {};
  return [...new Set(Object.values(groups).flat())].filter((n) => NAME_RE.test(n));
}

/**
 * Names that are always synced and never hidden, whatever their rank:
 * essentials, requested packages, packages with a human override, and the "works with" packages the site filters by.
 */
export function pinnedNames() {
  const taxonomy = readJson(path.join(DATA, "taxonomy.json"), {});
  const overrides = readJson(path.join(DATA, "overrides.json"), {});
  const names = new Set([...essentialNames(), ...Object.keys(readRequests())]);
  for (const n of Object.keys(overrides)) names.add(n);
  for (const w of taxonomy.worksWith ?? []) for (const d of w.deps ?? []) names.add(d);
  return [...names].filter((n) => NAME_RE.test(n));
}
