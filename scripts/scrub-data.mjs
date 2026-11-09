#!/usr/bin/env node
// One-off: mask key-shaped strings in already-generated data (data/ai/*.json, data/catalog.json).
import fs from "node:fs";
import path from "node:path";
import { DATA, readJson, writeJson } from "./lib/util.mjs";
import { scrub } from "./lib/scrub.mjs";

const files = [path.join(DATA, "catalog.json"), ...fs.readdirSync(path.join(DATA, "ai")).filter((f) => f.endsWith(".json")).map((f) => path.join(DATA, "ai", f))];
let changed = 0;
for (const f of files) {
  const original = readJson(f);
  const data = scrub(original);
  if (JSON.stringify(data) === JSON.stringify(original)) continue; // untouched files keep their formatting
  writeJson(f, data, !f.endsWith("catalog.json"));
  changed++;
  console.log(`  masked: ${path.relative(DATA, f)}`);
}
console.log(`Checked ${files.length} files, ${changed} changed.`);
