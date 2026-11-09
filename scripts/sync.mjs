#!/usr/bin/env node
/**
 * Step 1 of `npm run data`: pull the top N packages from pub.dev (+ GitHub stats)
 * into data/raw/<name>.json.
 *
 * Resumable: a package synced in the last SYNC_FRESH_HOURS (default 12) is skipped,
 * so if a run stops (Ctrl+C, crash, network) just run it again and it picks up
 * where it left off. README/CHANGELOG are only re-downloaded on a new version,
 * GitHub stats at most once a day.
 *
 *   node scripts/sync.mjs                 # SYNC_LIMIT packages (default 2000)
 *   node scripts/sync.mjs -v              # print every package as it's synced
 *   node scripts/sync.mjs --limit 200     # quick run
 *   node scripts/sync.mjs --force         # ignore the resume window, refresh everything
 *   node scripts/sync.mjs dio forui       # just these packages (always refreshed)
 *   node scripts/sync.mjs --requested     # only packages from data/requests.json (+ pinned ones)
 *
 * Growing coverage: data/sync-state.json remembers how deep into pub.dev's ranking the
 * catalog goes. With SYNC_GROW=1 (the nightly job), each completed run adds SYNC_BATCH
 * (default 2000) more packages, up to SYNC_MAX (default 10000). The top SYNC_LIMIT are
 * refreshed every night; the rest ("the tail") on a weekly rotation (TAIL_REFRESH_DAYS).
 *
 * Besides the ranked packages, every run also syncs "pinned" packages: the hand-picked
 * essentials (data/essentials.json), ones developers requested on the site (data/requests.json), ones in data/overrides.json, and the
 * "works with" packages in data/taxonomy.json. Pinned packages never go stale.
 *
 * Through npm, put flags after `--`:  npm run data:sync -- -v
 */
import fs from "node:fs";
import path from "node:path";
import { DATA, DAY, loadEnv, pool, readJson, writeJson, sleep, setRetryLogger } from "./lib/util.mjs";
import { archiveDocs, githubLimit, githubSlug, githubStats, pubPackage, topPackageNames } from "./lib/sources.mjs";
import { pinnedNames } from "./lib/pinned.mjs";

loadEnv();

// ── Options ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (...names) => names.some((n) => args.includes(n));
const valueOf = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const VERBOSE = flag("-v", "--verbose") || /^(1|true)$/i.test(process.env.VERBOSE ?? "");
const FORCE = flag("--force", "-f");
const REQUESTED_ONLY = flag("--requested");
const LIMIT_FLAG = valueOf("--limit");
const LIMIT = Number(LIMIT_FLAG ?? process.env.SYNC_LIMIT ?? 2000); // refreshed every night
const GROW = !LIMIT_FLAG && /^(1|true)$/i.test(process.env.SYNC_GROW ?? "");
const BATCH = Number(process.env.SYNC_BATCH ?? 2000);
const MAX = Number(process.env.SYNC_MAX ?? 10000);
const TAIL_MS = Number(process.env.TAIL_REFRESH_DAYS ?? 7) * DAY;
const GH_WAIT = /^(1|true)$/i.test(process.env.SYNC_GH_WAIT ?? process.env.CI ?? ""); // wait for GitHub's hourly reset
const STATE_FILE = path.join(DATA, "sync-state.json");
const state = readJson(STATE_FILE, {});
const FRESH_MS = Number(process.env.SYNC_FRESH_HOURS ?? 12) * 3_600_000;
const WORKERS = Number(process.env.SYNC_WORKERS ?? 6);
const explicit = args.filter((a, i) => !a.startsWith("-") && args[i - 1] !== "--limit");
const TOKEN = process.env.GITHUB_TOKEN || "";
const RAW = path.join(DATA, "raw");
fs.mkdirSync(RAW, { recursive: true });

// ── Console helpers ────────────────────────────────────────────────────────
const TTY = Boolean(process.stdout.isTTY) && !process.env.CI;
const c = (code) => (s) => (TTY ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const dim = c(2), green = c(32), yellow = c(33), red = c(31), cyan = c(36), bold = c(1);
const fmtNum = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));
const fmtBytes = (n) => (n >= 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fmtDur = (ms) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};
const ago = (iso) => fmtDur(Date.now() - Date.parse(iso)) + " ago";

let barShown = false;
const clearBar = () => { if (barShown) { process.stdout.write("\r\x1b[2K"); barShown = false; } };
/** Print a line without breaking the live progress bar. */
const log = (...parts) => { clearBar(); console.log(...parts); drawBar(); };
const verbose = (...parts) => { if (VERBOSE) log(...parts); };

// ── Plan the run ───────────────────────────────────────────────────────────
console.log(bold("pubscout · sync"));

let names;
let rankOf = new Map();
let coverage = null; // set for ranked runs; saved to data/sync-state.json when the run completes
const pinned = pinnedNames();
if (explicit.length) {
  names = explicit;
  console.log(`  Packages: ${explicit.join(", ")}`);
} else if (REQUESTED_ONLY) {
  names = pinned;
  console.log(`  Requested and pinned packages only (${pinned.length})`);
} else {
  // How deep to go: the top LIMIT always; plus whatever earlier runs grew to; plus one more batch if growing.
  const covered = LIMIT_FLAG ? LIMIT : Math.max(LIMIT, Math.min(MAX, state.coverage ?? LIMIT));
  coverage = GROW ? Math.min(MAX, covered + BATCH) : covered;
  const t = Date.now();
  process.stdout.write("  Fetching pub.dev ranking… ");
  const ranked = await topPackageNames(coverage, { onPage: (page, n) => TTY && process.stdout.write(`\r\x1b[2K  Fetching pub.dev ranking… ${fmtNum(n)} names (search page ${page})`) });
  if (TTY) process.stdout.write("\r\x1b[2K  Fetching pub.dev ranking… ");
  console.log(`${fmtNum(ranked.length)} names (${fmtDur(Date.now() - t)})`);
  rankOf = new Map(ranked.map((n, i) => [n, i + 1]));
  if (ranked.length < coverage) {
    console.log(yellow(`  pub.dev's ranking returned ${ranked.length} packages, fewer than ${coverage}; covering all of them.`));
    coverage = ranked.length;
  }
  const top = ranked.slice(0, coverage);
  const topSet = new Set(top);
  const extra = pinned.filter((n) => !topSet.has(n));
  names = [...top, ...extra];
  if (coverage > LIMIT) {
    const added = coverage - covered;
    console.log(`  Coverage: top ${fmtNum(coverage)} (${fmtNum(LIMIT)} refreshed nightly, ranks ${fmtNum(LIMIT + 1)}+ weekly${added > 0 ? `, +${fmtNum(added)} new tonight` : ""}${coverage >= MAX ? `, at the SYNC_MAX of ${fmtNum(MAX)}` : ""})`);
  }
  if (extra.length) console.log(`  Pinned:   +${extra.length} outside the ranked set (essentials, requested, overrides, "works with")`);
}

// Resume: skip anything synced recently (unless --force or named explicitly).
const prevOf = new Map(names.map((n) => [n, readJson(path.join(RAW, `${n}.json`))]));
const pinnedSet = new Set(pinned);
const isTail = (n) => !pinnedSet.has(n) && (rankOf.get(n) ?? 0) > LIMIT;
const isFresh = (n) => {
  const at = prevOf.get(n)?.syncedAt;
  if (!at) return false;
  const age = Date.now() - Date.parse(at);
  return age < FRESH_MS || (isTail(n) && age < TAIL_MS); // tail packages: weekly rotation
};
const skip = FORCE || explicit.length ? [] : names.filter(isFresh);
const skipSet = new Set(skip);
const todo = names.filter((n) => !skipSet.has(n));
const onDisk = names.filter((n) => prevOf.get(n)).length;

// Skipped packages are still part of the catalog: mark them as listed so the build keeps them.
const nowIso = new Date().toISOString();
for (const n of skip) {
  const prev = prevOf.get(n);
  if (prev.listedAt?.slice(0, 10) === nowIso.slice(0, 10) && prev.rank === (rankOf.get(n) ?? prev.rank)) continue;
  writeJson(path.join(RAW, `${n}.json`), { ...prev, listedAt: nowIso, rank: rankOf.get(n) ?? prev.rank ?? null });
}

console.log(`  Target:   ${names.length} packages`);
console.log(`  On disk:  ${onDisk} already in data/raw`);
if (skip.length) {
  const newest = skip.map((n) => prevOf.get(n).syncedAt).sort().at(-1);
  const tail = skip.filter(isTail).length;
  const recent = skip.length - tail;
  if (recent) console.log(green(`  Resuming: ${recent} synced in the last ${FRESH_MS / 3_600_000}h (latest ${ago(newest)}), skipping them. Use --force to redo.`));
  if (tail) console.log(`  Rotation: ${tail} lower-ranked packages synced in the last ${TAIL_MS / DAY} days, skipping until their turn.`);
}
console.log(`  To do:    ${bold(todo.length)} packages, ${WORKERS} at a time`);
console.log(`  GitHub:   ${TOKEN ? `token set, stats refresh at most daily${GH_WAIT ? ", waits for the hourly reset if the quota runs out" : ""}` : yellow("no GITHUB_TOKEN, stars/issues/contributors skipped")}`);
console.log(`  Output:   ${VERBOSE ? "every package (-v)" : "progress only; add -v for every package"}`);
console.log("");

// ── State + progress bar ───────────────────────────────────────────────────
const stats = { new: 0, updated: 0, refreshed: 0, failed: 0, missing: 0, docsBytes: 0, docsFetched: 0, ghFetched: 0, ghCached: 0 };
const failures = [];
let done = 0;
let stopping = false;
let ghPaused = false;
let ghWait = null;
const started = Date.now();
const total = todo.length;

function drawBar() {
  if (!TTY || !total) return;
  const pct = done / total;
  const width = 24;
  const filled = Math.round(pct * width);
  const elapsed = Date.now() - started;
  const rate = done / Math.max(1, elapsed / 1000);
  const eta = done ? fmtDur(((total - done) / rate) * 1000) : "…";
  const bar = cyan("█".repeat(filled)) + dim("░".repeat(width - filled));
  const counts = `${green("✓ " + (stats.new + stats.updated + stats.refreshed))}${stats.failed ? " " + red("✗ " + stats.failed) : ""}`;
  const gh = TOKEN && githubLimit.remaining != null ? dim(` · GitHub ${githubLimit.remaining} left`) : "";
  process.stdout.write(`\r\x1b[2K  ${bar} ${done}/${total} ${dim(`${Math.round(pct * 100)}%`)} · ${rate.toFixed(1)}/s · ETA ${eta} · ${counts}${gh}`);
  barShown = true;
}
const ticker = TTY ? setInterval(drawBar, 1000) : null;

// Non-TTY (GitHub Actions, piped output): a plain line every ~5%.
const step = Math.max(25, Math.round(total / 20));
const plainProgress = () => {
  if (TTY || done % step !== 0) return;
  const elapsed = Date.now() - started;
  const eta = fmtDur(((total - done) / (done / elapsed)));
  console.log(`  ${done}/${total} (${Math.round((done / total) * 100)}%) · ${fmtDur(elapsed)} elapsed · ETA ${eta} · ${stats.failed} failed`);
};

setRetryLogger((url, err, attempt, wait) => {
  verbose(dim(`    ↻ retry ${attempt} in ${wait / 1000}s: ${err.message} · ${url.replace(/^https:\/\//, "").slice(0, 70)}`));
});

// Ctrl+C: finish the packages in flight, save, and explain how to resume.
process.on("SIGINT", () => {
  if (stopping) { clearBar(); console.log(red("\n  Forced exit. Already-saved packages are kept; run again to resume.")); process.exit(130); }
  stopping = true;
  log(yellow(`\n  Stopping after the ${WORKERS} packages in flight… (Ctrl+C again to quit now)`));
});

// ── Sync ───────────────────────────────────────────────────────────────────
drawBar();

await pool(todo, WORKERS, async (name) => {
  if (stopping) return;
  const t = Date.now();
  const file = path.join(RAW, `${name}.json`);
  const prev = prevOf.get(name);
  try {
    const pkg = await pubPackage(name);
    if (!pkg) {
      stats.missing++;
      verbose(`  ${yellow("?")} ${name} ${dim("not found on pub.dev (removed or renamed)")}`);
      return;
    }

    // Docs only when the version changed (archives can be a few MB).
    let docsNote;
    if (prev?.docs && prev.version === pkg.version) {
      pkg.docs = prev.docs;
      docsNote = dim("docs cached");
    } else {
      pkg.docs = await archiveDocs(pkg.archiveUrl).catch((e) => { verbose(dim(`    docs failed for ${name}: ${e.message}`)); return null; });
      const bytes = (pkg.docs?.readme?.length ?? 0) + (pkg.docs?.changelog?.length ?? 0);
      stats.docsBytes += bytes;
      if (pkg.docs) stats.docsFetched++;
      docsNote = pkg.docs ? `docs ↓ ${fmtBytes(bytes)}${pkg.docs.hasExample ? "" : dim(" (no example/)")}` : yellow("no docs");
    }

    // GitHub: at most daily, and pause when the hourly quota is nearly gone.
    const slug = githubSlug(pkg.repository, pkg.homepage, pkg.issueTracker);
    const ghMaxAge = isTail(name) ? 14 * DAY : DAY; // stars move slowly; spend the quota on the top packages
    const ghFresh = prev?.github && Date.now() - Date.parse(prev.github.fetchedAt ?? 0) < ghMaxAge;
    if (TOKEN && !ghPaused && githubLimit.remaining != null && githubLimit.remaining < 20) {
      const waitMs = (githubLimit.reset ?? 0) - Date.now() + 5000;
      if (GH_WAIT && waitMs > 0 && waitMs < 65 * 60_000) {
        // Nightly job: pause GitHub calls (pub.dev work continues in other workers) until the quota resets.
        ghWait ??= (async () => {
          log(yellow(`  GitHub quota used up; waiting ${fmtDur(waitMs)} for the hourly reset, then carrying on.`));
          await sleep(waitMs);
          githubLimit.remaining = null;
          ghWait = null;
          log(green("  GitHub quota reset, continuing."));
        })();
        await ghWait;
      } else {
        ghPaused = true;
        const reset = githubLimit.reset ? new Date(githubLimit.reset).toLocaleTimeString() : "within the hour";
        log(yellow(`  GitHub quota almost used up (${githubLimit.remaining} left, resets ${reset}). Keeping previous GitHub stats for the rest of this run.`));
      }
    }
    let ghNote;
    if (!slug) {
      pkg.github = prev?.github ?? null;
      ghNote = dim("no GitHub repo");
    } else if (TOKEN && !ghFresh && !ghPaused) {
      const gh = await githubStats(slug, TOKEN).catch((e) => { verbose(dim(`    GitHub failed for ${slug}: ${e.message}`)); return null; });
      pkg.github = gh ? { ...gh, fetchedAt: new Date().toISOString() } : prev?.github ?? null;
      if (gh) stats.ghFetched++;
      ghNote = gh ? `★ ${fmtNum(gh.stars)}` : yellow("GitHub failed");
    } else {
      pkg.github = prev?.github ?? null;
      if (pkg.github) stats.ghCached++;
      ghNote = dim(pkg.github ? `★ ${fmtNum(pkg.github.stars)} cached` : TOKEN ? "GitHub paused" : "GitHub skipped");
    }

    pkg.syncedAt = new Date().toISOString();
    // "Listed" = in this run's target set (top N or pinned). The build hides packages
    // that haven't been listed for a while, so ones that fell out of the top don't go stale on the site.
    pkg.listedAt = pkg.syncedAt;
    pkg.rank = rankOf.get(name) ?? prev?.rank ?? null;
    writeJson(file, pkg);

    let kind;
    if (!prev) { stats.new++; kind = green("new    "); }
    else if (prev.version !== pkg.version) { stats.updated++; kind = cyan("updated"); }
    else { stats.refreshed++; kind = dim("same   "); }

    const ver = prev && prev.version !== pkg.version ? `${prev.version} → ${pkg.version}` : pkg.version;
    verbose(
      `  ${green("✓")} ${kind} ${name.padEnd(32)} ${dim(String(ver).padEnd(18))} ` +
        `${dim(`${pkg.score.points ?? "?"}/${pkg.score.maxPoints ?? "?"} pts · ${fmtNum(pkg.score.likes)} likes · ${fmtNum(pkg.score.downloads30d)} dl`)} · ${docsNote} · ${ghNote} ${dim(fmtDur(Date.now() - t))}`
    );
  } catch (err) {
    stats.failed++;
    failures.push({ name, error: err.message });
    log(`  ${red("✗")} ${name}: ${err.message}`);
  } finally {
    done++;
    plainProgress();
    await sleep(120); // stay polite: ~6 workers × ~8 req/s total
  }
});

if (ticker) clearInterval(ticker);
drawBar();
clearBar();

// ── History snapshot (for trends) ──────────────────────────────────────────
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

// ── Summary ────────────────────────────────────────────────────────────────
const synced = stats.new + stats.updated + stats.refreshed;
const remaining = total - done;
const stoppedEarly = stopping && remaining > 0;
const inRaw = fs.readdirSync(RAW).filter((f) => f.endsWith(".json")).length;
const elapsed = Date.now() - started;

console.log("");
console.log(bold(stoppedEarly ? yellow("Stopped early") : "Sync finished") + dim(` in ${fmtDur(elapsed)}`));
console.log(`  ${green("✓")} ${synced} synced   ${dim(`(${stats.new} new · ${stats.updated} new version · ${stats.refreshed} same version)`)}`);
if (skip.length) console.log(`  ↷ ${skip.length} skipped (recently synced)`);
if (stats.missing) console.log(`  ${yellow("?")} ${stats.missing} no longer on pub.dev`);
if (stats.failed) {
  console.log(`  ${red("✗")} ${stats.failed} failed (they'll be retried on the next run)`);
  for (const f of failures.slice(0, 10)) console.log(dim(`      ${f.name}: ${f.error}`));
  if (failures.length > 10) console.log(dim(`      …and ${failures.length - 10} more`));
}
console.log(`  Docs downloaded for ${stats.docsFetched} packages${stats.docsFetched ? ` (${fmtBytes(stats.docsBytes)})` : ""}; GitHub: ${stats.ghFetched} fetched, ${stats.ghCached} cached${TOKEN && githubLimit.remaining != null ? `, ${githubLimit.remaining}/${githubLimit.limit} requests left this hour` : ""}`);
console.log(`  data/raw now holds ${bold(inRaw)} packages.`);
console.log("");
if (coverage != null && !stoppedEarly) {
  writeJson(STATE_FILE, { coverage, limit: LIMIT, max: MAX, updatedAt: new Date().toISOString() }, true);
  if (GROW && coverage < MAX) console.log(dim(`  Coverage saved: top ${coverage}. The next nightly run adds up to ${Math.min(BATCH, MAX - coverage)} more.`));
}
if (stoppedEarly) {
  console.log(yellow(`  ${remaining} packages not done yet. Run the same command again to continue from here.`));
  console.log(dim(`  You can already build the site from what's synced: npm run data:build`));
  process.exitCode = 130; // so `npm run data` doesn't go on to build a half-finished sync
} else {
  console.log(`  Next: ${bold("npm run data:build")}`);
}
