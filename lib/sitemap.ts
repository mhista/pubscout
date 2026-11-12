import { getCatalog } from "./catalog";
import { abs, comparePath, comparisonPairs } from "./seo";

/** Packages per sitemap file (Google allows 50,000; smaller files make Search Console reports easier to read). */
export const PER_FILE = 2000;

type Entry = { url: string; lastModified?: string; changeFrequency?: string; priority?: number };

const iso = (d?: string | null) => (d && !Number.isNaN(Date.parse(d)) ? new Date(d).toISOString() : undefined);

/** All sitemap files: core pages, packages split into chunks, comparisons. */
export function sitemapFiles(): string[] {
  const n = Math.max(1, Math.ceil(livePackages().length / PER_FILE));
  return ["core", ...Array.from({ length: n }, (_, i) => `packages-${i + 1}`), "compare"];
}

const livePackages = () => getCatalog().packages.filter((p) => !p.discontinued).sort((a, b) => a.name.localeCompare(b.name));

export function sitemapEntries(file: string): Entry[] | null {
  const c = getCatalog();
  const updated = iso(c.generatedAt);
  if (file === "core") {
    return [
      { url: abs("/"), lastModified: updated, changeFrequency: "daily", priority: 1 },
      { url: abs("/categories"), lastModified: updated, changeFrequency: "weekly", priority: 0.9 },
      { url: abs("/explore"), lastModified: updated, changeFrequency: "daily", priority: 0.7 },
      { url: abs("/compare"), changeFrequency: "weekly", priority: 0.6 },
      { url: abs("/about"), changeFrequency: "monthly", priority: 0.4 },
      { url: abs("/request"), changeFrequency: "monthly", priority: 0.3 },
      ...c.categories.filter((x) => x.count).map((x) => ({ url: abs(`/c/${x.slug}`), lastModified: updated, changeFrequency: "daily", priority: 0.8 })),
    ];
  }
  const m = file.match(/^packages-(\d+)$/);
  if (m) {
    const i = Number(m[1]) - 1;
    const chunk = livePackages().slice(i * PER_FILE, (i + 1) * PER_FILE);
    if (!chunk.length) return null;
    // lastModified = the package's latest release, not our nightly sync, so Google trusts the dates.
    return chunk.map((p) => ({ url: abs(`/p/${p.name}`), lastModified: iso(p.published), changeFrequency: "weekly", priority: p.essential ? 0.7 : 0.6 }));
  }
  if (file === "compare") {
    return comparisonPairs(1000).map(([a, b]) => ({ url: abs(comparePath([a.name, b.name])), changeFrequency: "weekly", priority: 0.5 }));
  }
  return null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function urlsetXml(entries: Entry[]) {
  const body = entries
    .map((e) => `<url><loc>${esc(e.url)}</loc>${e.lastModified ? `<lastmod>${e.lastModified}</lastmod>` : ""}${e.changeFrequency ? `<changefreq>${e.changeFrequency}</changefreq>` : ""}${e.priority != null ? `<priority>${e.priority}</priority>` : ""}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function indexXml(files: string[]) {
  const updated = iso(getCatalog().generatedAt);
  const body = files.map((f) => `<sitemap><loc>${esc(abs(`/sitemaps/${f}.xml`))}</loc>${updated ? `<lastmod>${updated}</lastmod>` : ""}</sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export const xmlHeaders = { "content-type": "application/xml; charset=utf-8", "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" };
