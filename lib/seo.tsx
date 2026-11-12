import type { Metadata } from "next";
import { getCatalog, getPackage } from "./catalog";
import { SITE } from "./site";
import type { Pkg } from "./types";

/** Absolute URL on this site. */
export const abs = (path = "/") => new URL(path, SITE.url).toString();

/** The current year, for "Best … packages (2026)" titles. Pages render per request or per deploy, so it stays current. */
export const year = () => new Date().getFullYear();

/** Shared OG/Twitter image for a page: /og?title=…&sub=… */
export function ogImage(title: string, sub?: string, extra: Record<string, string> = {}) {
  const q = new URLSearchParams({ title, ...(sub ? { sub } : {}), ...extra });
  return `/og?${q.toString()}`;
}

/** Page metadata with canonical URL, Open Graph and Twitter cards filled in consistently. */
export function pageMeta({
  title,
  description,
  path,
  image,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  noindex?: boolean;
}): Metadata {
  const img = image ?? ogImage(title, description);
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url: path, siteName: SITE.name, type: "website", images: [{ url: img, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [img] },
  };
}

/** True when the URL has any query beyond what the canonical page shows (filters, sort, search). */
export const hasParams = (sp: Record<string, string | string[] | undefined>) => Object.values(sp).some((v) => v !== undefined && v !== "");

/** Shorten to a clean description length (~155 chars), cutting at a word. */
export function clip(s: string, max = 155) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, t.lastIndexOf(" ", max - 1)).replace(/[,;:.\s]+$/, "") + "…";
}

/**
 * Head-to-head pairs worth their own page (and a sitemap entry): two packages that list
 * each other as alternatives, share a main category, both see real use, and at least
 * one AI summary names the other as an alternative.
 */
export function comparisonPairs(limit = 300, minDownloads = 5000): [Pkg, Pkg][] {
  const seen = new Set<string>();
  const pairs: [Pkg, Pkg][] = [];
  for (const a of getCatalog().packages) {
    if (a.discontinued || a.metrics.downloads30d < minDownloads) continue;
    for (const n of a.alternatives) {
      const b = getPackage(n);
      if (!b || !b.alternatives.includes(a.name)) continue;
      if (b.discontinued || b.metrics.downloads30d < minDownloads || b.primaryCategory !== a.primaryCategory) continue;
      // Only pairs an AI summary actually named (the keyword fallback is too loose for search pages).
      const named = (x: Pkg, y: Pkg) => x.explainer?.alternatives?.some((alt) => alt.name === y.name) ?? false;
      if (!named(a, b) && !named(b, a)) continue;
      const key = [a.name, b.name].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([a, b]);
      if (pairs.length >= limit) return pairs;
    }
  }
  return pairs;
}

/** Canonical compare URL: names sorted so "a vs b" and "b vs a" are one page. */
export const comparePath = (names: string[]) => `/compare?p=${[...names].sort().join(",")}`;

/** <script type="application/ld+json"> for structured data. */
export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export const breadcrumbs = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
});
