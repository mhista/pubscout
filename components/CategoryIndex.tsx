import Link from "next/link";
import { getCatalog } from "@/lib/catalog";
import { grouped } from "@/lib/taxonomy";
import { compact } from "@/lib/format";

/** Every category, grouped like a docs index: name, count, and its three most-downloaded packages. */
export function CategoryIndex({ withBlurb = false }: { withBlurb?: boolean }) {
  const c = getCatalog();
  const top = (slug: string) =>
    c.packages
      .filter((p) => !p.discontinued && p.categories.some((t) => t.slug === slug))
      .sort((a, b) => Number(b.primaryCategory === slug) - Number(a.primaryCategory === slug) || b.metrics.downloads30d - a.metrics.downloads30d)
      .slice(0, 3);
  return (
    <div className="space-y-10">
      {grouped(c.categories.filter((x) => x.count > 0)).map(({ group, items }) => (
        <section key={group} aria-label={group} className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-8">
          <h3 className="pt-4 text-sm font-semibold text-ink md:sticky md:top-20 md:self-start">{group}</h3>
          <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
            {items.map((cat) => (
              <li key={cat.slug} className="bg-card">
                <Link href={`/c/${cat.slug}`} className="group block h-full px-4 py-4 transition-colors hover:bg-ground/60">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-ink group-hover:text-cobalt">{cat.name}</span>
                    <span className="text-xs tabular-nums text-muted">{compact(cat.count)}</span>
                  </span>
                  {withBlurb && <span className="mt-1 block text-sm leading-5 text-body">{cat.blurb}</span>}
                  <span className="mt-2 block truncate font-mono text-[12.5px] text-muted">
                    {top(cat.slug).map((p) => p.name).join("  ") || " "}
                  </span>
                </Link>
              </li>
            ))}
            {/* fill the last row so the hairline grid stays even */}
            {Array.from({ length: (3 - (items.length % 3)) % 3 }, (_, i) => <li key={`f${i}`} aria-hidden className="hidden bg-card xl:block" />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
