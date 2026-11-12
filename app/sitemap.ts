import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog";
import { abs, comparePath, comparisonPairs } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const c = getCatalog();
  const updated = c.generatedAt ? new Date(c.generatedAt) : new Date();
  return [
    { url: abs("/"), lastModified: updated, changeFrequency: "daily", priority: 1 },
    { url: abs("/categories"), lastModified: updated, changeFrequency: "weekly", priority: 0.9 },
    { url: abs("/explore"), lastModified: updated, changeFrequency: "daily", priority: 0.7 },
    { url: abs("/compare"), lastModified: updated, changeFrequency: "weekly", priority: 0.6 },
    { url: abs("/about"), changeFrequency: "monthly", priority: 0.4 },
    { url: abs("/request"), changeFrequency: "monthly", priority: 0.3 },
    ...c.categories.filter((x) => x.count).map((x) => ({ url: abs(`/c/${x.slug}`), lastModified: updated, changeFrequency: "daily" as const, priority: 0.8 })),
    ...c.packages
      .filter((p) => !p.discontinued)
      .map((p) => ({ url: abs(`/p/${p.name}`), lastModified: new Date(p.syncedAt ?? p.published), changeFrequency: "weekly" as const, priority: 0.6 })),
    // Head-to-head pages people search for ("dio vs http").
    ...comparisonPairs(500).map(([a, b]) => ({ url: abs(comparePath([a.name, b.name])), lastModified: updated, changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}
