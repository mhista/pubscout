import { getCatalog } from "@/lib/catalog";

export const dynamic = "force-static";

/** Compact index for the command palette: loaded once, on first open. */
export function GET() {
  const c = getCatalog();
  const catName = new Map(c.categories.map((x) => [x.slug, x.name]));
  return Response.json({
    categories: c.categories.filter((x) => x.count).map((x) => [x.slug, x.name, x.count]),
    packages: c.packages.map((p) => [p.name, p.oneLiner.slice(0, 120), p.primaryCategory ? catName.get(p.primaryCategory) ?? "" : "", p.scores.health, p.discontinued ? 1 : 0]),
  });
}
