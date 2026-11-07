import type { Metadata } from "next";
import { Explorer } from "@/components/Explorer";
import { CategoryNav, CategoryNavMobile, DocsShell } from "@/components/CategoryNav";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = (await searchParams).q;
  return { title: q ? `“${q}” packages` : "Explore packages" };
}

export default async function ExplorePage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <DocsShell nav={<CategoryNav active="all" />}>
      <CategoryNavMobile active="all" label="All packages" />
      <h1 className="text-xl">{sp.q ? "Search results" : "All packages"}</h1>
      <p className="mb-7 mt-2 max-w-prose text-body">{sp.q ? (String(sp.q).trim().split(/\s+/).length >= 3 ? "AI matches by meaning first, then every keyword match below." : "Keyword matches below. Describing what you need in a sentence gets AI picks too.") : "Filter by what your project needs. Every filter updates the link, so you can share any view."}</p>
      <Explorer searchParams={sp} basePath="/explore" />
    </DocsShell>
  );
}
