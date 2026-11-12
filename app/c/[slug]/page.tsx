import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getCategory } from "@/lib/catalog";
import { JsonLd, abs, breadcrumbs, clip, hasParams, ogImage, pageMeta, year } from "@/lib/seo";
import { Explorer } from "@/components/Explorer";
import { CategoryNav, CategoryNavMobile, DocsShell } from "@/components/CategoryNav";
import { groupOf } from "@/lib/taxonomy";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// Filters live in the URL, so this page renders per request (a function call, never ISR).
export const dynamic = "force-dynamic";

const topIn = (slug: string, n: number) =>
  getCatalog().packages.filter((p) => !p.discontinued && p.categories.some((c) => c.slug === slug)).sort((a, b) => b.scores.health - a.scores.health).slice(0, n);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const cat = getCategory((await params).slug);
  if (!cat) return {};
  const top = topIn(cat.slug, 3).map((p) => p.name);
  const title = `Best Flutter ${cat.name.toLowerCase()} packages (${year()})`;
  return pageMeta({
    title,
    description: clip(`${cat.blurb} Compare ${cat.count} packages${top.length ? ` like ${top.join(", ")}` : ""} by health score, downloads and platform support.`),
    path: `/c/${cat.slug}`,
    image: ogImage(`Best Flutter ${cat.name.toLowerCase()} packages`, clip(cat.blurb, 120), { kind: `${cat.count} packages` }),
    // Filtered/sorted views are the same page; only the plain category is indexed.
    noindex: hasParams(await searchParams),
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const cat = getCategory(slug);
  if (!cat) notFound();
  return (
    <DocsShell nav={<CategoryNav active={slug} />}>
      <CategoryNavMobile active={slug} label={cat.name} />
      <nav className="text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/categories" className="hover:text-ink">Categories</Link>
        <span className="mx-1.5" aria-hidden>/</span>
        <span>{groupOf(slug)}</span>
      </nav>
      <JsonLd
        data={[
          breadcrumbs([{ name: "Categories", path: "/categories" }, { name: cat.name, path: `/c/${slug}` }]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `Best Flutter ${cat.name.toLowerCase()} packages`,
            numberOfItems: cat.count,
            itemListElement: topIn(slug, 10).map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.name, url: abs(`/p/${p.name}`) })),
          },
        ]}
      />
      <h1 className="mt-2 text-xl">{cat.name}</h1>
      <p className="mb-7 mt-2 max-w-prose text-body">{cat.blurb}</p>
      <Explorer searchParams={await searchParams} lockedCategory={slug} basePath={`/c/${slug}`} />
    </DocsShell>
  );
}
