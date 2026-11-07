#!/usr/bin/env node
/**
 * Step 1 of `npm run data`: pull the top N packages from pub.dev (+ GitHub stats)
 * into data/raw/<name>.json. Safe to re-run: README/CHANGELOG are only re-downloaded
 * when a package publishes a new version, and GitHub stats refresh at most daily.
 *
 *   node scripts/sync.mjs                 # SYNC_LIMIT packages (default 2000)
 *   node scripts/sync.mjs --limit 200     # quick run
 *   node scripts/sync.mjs dio forui       # just these packages
 */
import fs from "node:fs";
import path from "node:path";
import { DATA, DAY, loadEnv, pool, readJson, writeJson, sleep } from "./lib/util.mjs";
import { archiveDocs, githubSlug, githubStats, pubPackage, topPackageNames } from "./lib/sources.mjs";

loadEnv();
const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) : Number(process.env.SYNC_LIMIT || 2000);
const explicit = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--limit");
const TOKEN = process.env.GITHUB_TOKEN || "";
const RAW = path.join(DATA, "raw");
fs.mkdirSync(RAW, { recursive: true });

const ranked = explicit.length ? [] : await topPackageNames();
const names = explicit.length ? explicit : ranked.slice(0, LIMIT);
if (!explicit.length && ranked.length < LIMIT) console.log(`  pub.dev's ranking lists ${ranked.length} packages, fewer than SYNC_LIMIT=${LIMIT}; syncing all of them.`);
console.log(`Syncing ${names.length} packages (limit ${explicit.length ? "n/a" : LIMIT}, set with SYNC_LIMIT or --limit)${TOKEN ? "" : ". No GITHUB_TOKEN: GitHub stats skipped"}…`);

let done = 0, failed = 0;
const started = Date.now();

await pool(names, 6, async (name) => {
  const file = path.join(RAW, `${name}.json`);
  const prev = readJson(file);
  try {
    const pkg = await pubPackage(name);
    if (!pkg) return;

    // Docs only when the version changed (archives can be a few MB).
    if (prev?.docs && prev.version === pkg.version) pkg.docs = prev.docs;
    else pkg.docs = await archiveDocs(pkg.archiveUrl).catch(() => null);

    const slug = githubSlug(pkg.repository, pkg.homepage, pkg.issueTracker);
    const ghFresh = prev?.github && Date.now() - Date.parse(prev.github.fetchedAt ?? 0) < DAY;
    if (slug && TOKEN && !ghFresh) {
      const gh = await githubStats(slug, TOKEN).catch(() => null);
      pkg.github = gh ? { ...gh, fetchedAt: new Date().toISOString() } : prev?.github ?? null;
    } else {
      pkg.github = prev?.github ?? null;
    }

    pkg.syncedAt = new Date().toISOString();
    writeJson(file, pkg);
  } catch (err) {
    failed++;
    console.warn(`  ✗ ${name}: ${err.message}`);
  } finally {
    done++;
    if (done % 50 === 0) console.log(`  ${done}/${names.length} (${Math.round((Date.now() - started) / 1000)}s)`);
    await sleep(120); // stay polite: ~6 workers × ~8 req/s total
  }
});

// Daily snapshot of the numbers, for trends ("Rising") later.
const today = new Date().toISOString().slice(0, 10);
const histFile = path.join(DATA, "history.json");
const history = readJson(histFile, {});
for (const name of names) {
  const raw = readJson(path.join(RAW, `${name}.json`));
  if (!raw) continue;
  const h = (history[name] ??= {});
  h[today] = [raw.score.downloads30d, raw.score.likes];
  const keys = Object.keys(h).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 120))) delete h[k]; // keep ~4 months
}
writeJson(histFile, history);

console.log(`Done: ${done - failed} synced, ${failed} failed. Next: npm run data:build`);
