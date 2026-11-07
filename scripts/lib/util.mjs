import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DATA = path.join(ROOT, "data");

/** Load .env / .env.local into process.env (no dependency needed). */
export function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]]) continue;
      let v = m[2].replace(/\s+#.*$/, "");
      if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
}

export function readJson(p, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJson(p, data, pretty = false) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, pretty ? 2 : 0));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Run `fn` over items with at most `limit` in flight. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

const UA = "pubscout-sync/0.1 (+https://github.com/kymaa/pubscout)";

/** fetch with retries + backoff; returns parsed JSON, raw text/buffer, or null on 404. */
export async function getUrl(url, { as = "json", headers = {}, tries = 4 } = {}) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, ...headers } });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { fatal: true });
      if (as === "json") return await res.json();
      if (as === "text") return await res.text();
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (err.fatal || attempt === tries) throw err;
      await sleep(500 * 2 ** attempt);
    }
  }
}

export const DAY = 86_400_000;
export const daysSince = (iso, now = Date.now()) => (iso ? Math.max(0, (now - Date.parse(iso)) / DAY) : Infinity);
export const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
