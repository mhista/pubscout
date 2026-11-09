#!/usr/bin/env node
/**
 * Package requests. On the site, "Request a package" opens a GitHub issue titled
 * "Package request: <name>" with the `package-request` label. The data workflow then:
 *
 *   node scripts/requests.mjs pull    # open request issues → data/requests.json
 *   node scripts/sync.mjs --requested # fetch them from pub.dev
 *   node scripts/build-catalog.mjs    # add them to the catalog
 *   node scripts/requests.mjs close   # comment with the link and close the issues
 *
 * Locally, without GitHub:  node scripts/requests.mjs add material_ui cupertino_ui
 */
import path from "node:path";
import { DATA, getUrl, loadEnv, readJson } from "./lib/util.mjs";
import { NAME_RE, readRequests, writeRequests } from "./lib/pinned.mjs";

loadEnv();
const [cmd, ...rest] = process.argv.slice(2);
const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY; // set automatically inside GitHub Actions
const SITE = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const LABEL = "package-request";
const API = "https://api.github.com";

const gh = async (url, init = {}) => {
  const res = await fetch(`${API}${url}`, {
    ...init,
    headers: { accept: "application/vnd.github+json", authorization: `Bearer ${TOKEN}`, "user-agent": "pubscout-requests", ...(init.body ? { "content-type": "application/json" } : {}) },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${url}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
};

const nameFromTitle = (title) => title.match(/package request:\s*`?([a-z][a-z0-9_]*)`?/i)?.[1]?.toLowerCase() ?? null;

async function openIssues() {
  if (!TOKEN || !REPO) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are needed (they're set automatically in GitHub Actions).");
  return gh(`/repos/${REPO}/issues?labels=${LABEL}&state=open&per_page=100`);
}

if (cmd === "add") {
  const reqs = readRequests();
  for (const n of rest.map((s) => s.toLowerCase())) {
    if (!NAME_RE.test(n)) { console.warn(`  skip "${n}": not a valid package name`); continue; }
    reqs[n] ??= { requestedAt: new Date().toISOString() };
    console.log(`  + ${n}`);
  }
  writeRequests(reqs);
  console.log("Saved to data/requests.json. Run `npm run data:sync -- --requested` then `npm run data:build`.");
} else if (cmd === "pull") {
  const issues = await openIssues();
  const reqs = readRequests();
  let added = 0;
  for (const i of issues) {
    const name = nameFromTitle(i.title);
    if (!name || !NAME_RE.test(name)) { console.log(`  #${i.number}: no package name in "${i.title}"`); continue; }
    if (!reqs[name]) added++;
    reqs[name] = { ...reqs[name], requestedAt: reqs[name]?.requestedAt ?? i.created_at, issue: i.number };
  }
  writeRequests(reqs);
  console.log(`Package requests: ${issues.length} open issues, ${added} new → data/requests.json (${Object.keys(reqs).length} requested in total)`);
} else if (cmd === "close") {
  const issues = await openIssues();
  const inCatalog = new Set((readJson(path.join(DATA, "catalog.json"))?.packages ?? []).map((p) => p.name));
  for (const i of issues) {
    const name = nameFromTitle(i.title);
    let body = null;
    if (name && inCatalog.has(name)) {
      body = `Added. It's live once the site finishes redeploying (a few minutes)${SITE ? `: ${SITE}/p/${name}` : "."}\n\nIt will be refreshed every night from now on.`;
    } else if (name && NAME_RE.test(name) && !(await getUrl(`https://pub.dev/api/packages/${name}`).catch(() => true))) {
      body = `There's no package called \`${name}\` on pub.dev, so there's nothing to add. Check the spelling and request it again.`;
      const reqs = readRequests();
      delete reqs[name];
      writeRequests(reqs);
    } else if (!name) {
      body = "Couldn't find a package name in the title. Use the format `Package request: package_name`.";
    }
    if (!body) { console.log(`  #${i.number} ${name}: not in the catalog yet, leaving open`); continue; }
    await gh(`/repos/${REPO}/issues/${i.number}/comments`, { method: "POST", body: JSON.stringify({ body }) });
    await gh(`/repos/${REPO}/issues/${i.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed", state_reason: inCatalog.has(name) ? "completed" : "not_planned" }) });
    console.log(`  #${i.number} ${name ?? "?"}: closed`);
  }
} else {
  console.log("Usage: node scripts/requests.mjs add <name…> | pull | close");
  process.exit(1);
}
