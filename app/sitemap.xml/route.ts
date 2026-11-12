import { indexXml, sitemapFiles, xmlHeaders } from "@/lib/sitemap";

// /sitemap.xml is an index pointing at the smaller files under /sitemaps/. Rebuilt on every deploy.
export const dynamic = "force-static";

export function GET() {
  return new Response(indexXml(sitemapFiles()), { headers: xmlHeaders });
}
