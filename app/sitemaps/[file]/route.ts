import { sitemapEntries, sitemapFiles, urlsetXml, xmlHeaders } from "@/lib/sitemap";

// /sitemaps/core.xml, /sitemaps/packages-1.xml … /sitemaps/compare.xml (all built at deploy time).
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return sitemapFiles().map((f) => ({ file: `${f}.xml` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const entries = sitemapEntries(file.replace(/\.xml$/, ""));
  if (!entries) return new Response("Not found", { status: 404 });
  return new Response(urlsetXml(entries), { headers: xmlHeaders });
}
