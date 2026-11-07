import Link from "next/link";
import { categoryName, getCatalog } from "@/lib/catalog";
import { tone, toneText } from "@/lib/format";

/** Package-page sidebar: the other packages in this package's main category. */
export function SiblingNav({ current, category }: { current: string; category: string }) {
  const c = getCatalog();
  const list = c.packages
    .filter((p) => p.categories.some((t) => t.slug === category) && !p.discontinued)
    .sort((a, b) => b.metrics.downloads30d - a.metrics.downloads30d)
    .slice(0, 30);
  if (!list.some((p) => p.name === current)) {
    const self = c.packages.find((p) => p.name === current);
    if (self) list.unshift(self);
  }
  return (
    <nav aria-label={`Packages in ${categoryName(category)}`} className="text-sm">
      <Link href={`/c/${category}`} className="mb-2 flex items-center gap-1.5 px-2.5 text-xs font-medium text-muted hover:text-ink">
        <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden><path d="M10 4 6 8l4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        {categoryName(category)}
      </Link>
      <ul className="space-y-px">
        {list.map((p) => (
          <li key={p.name}>
            <Link href={`/p/${p.name}`} className="navlink" aria-current={p.name === current ? "page" : undefined}>
              <span className="truncate font-mono text-[13px]">{p.name}</span>
              <span className={`text-xs tabular-nums ${toneText[tone(p.scores.health)]}`}>{p.scores.health}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={`/c/${category}`} className="mt-3 block px-2.5 text-xs text-cobalt hover:underline">All {categoryName(category).toLowerCase()} packages</Link>
    </nav>
  );
}
