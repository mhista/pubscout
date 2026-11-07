import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const c = getCatalog();
  const base = SITE.url;
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/explore`, changeFrequency: "daily" },
    { url: `${base}/categories`, changeFrequency: "weekly" },
    { url: `${base}/about`, changeFrequency: "monthly" },
    ...c.categories.filter((x) => x.count).map((x) => ({ url: `${base}/c/${x.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...c.packages.map((p) => ({ url: `${base}/p/${p.name}`, lastModified: p.published, changeFrequency: "weekly" as const })),
  ];
}
