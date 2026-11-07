import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory } from "@/lib/catalog";
import { Explorer } from "@/components/Explorer";
import { CategoryNav, CategoryNavMobile, DocsShell } from "@/components/CategoryNav";
import { groupOf } from "@/lib/taxonomy";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// Filters live in the URL, so this page renders per request (a function call, never ISR).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = getCategory((await params).slug);
  if (!cat) return {};
  return { title: `Best Flutter ${cat.name.toLowerCase()} packages`, description: `${cat.blurb} Compare ${cat.count} Flutter packages by health, downloads and platform support.` };
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
      <h1 className="mt-2 text-xl">{cat.name}</h1>
      <p className="mb-7 mt-2 max-w-prose text-body">{cat.blurb}</p>
      <Explorer searchParams={await searchParams} lockedCategory={slug} basePath={`/c/${slug}`} />
    </DocsShell>
  );
}
