import Link from "next/link";
import { getCatalog } from "@/lib/catalog";
import { grouped } from "@/lib/taxonomy";
import { compact } from "@/lib/format";

/** Left sidebar on browse pages: every category, grouped, with counts. */
export function CategoryNav({ active }: { active?: string }) {
  const c = getCatalog();
  const groups = grouped(c.categories.filter((x) => x.count > 0));
  return (
    <nav aria-label="Categories" className="space-y-6 text-sm">
      <div>
        <Link href="/explore" className="navlink" aria-current={active === "all" ? "page" : undefined}>
          <span>All packages</span>
          <span className="text-xs tabular-nums text-muted">{compact(c.count)}</span>
        </Link>
      </div>
      {groups.map(({ group, items }) => (
        <div key={group}>
          <p className="mb-1.5 px-2.5 text-xs font-medium text-muted">{group}</p>
          <ul className="space-y-px">
            {items.map((cat) => (
              <li key={cat.slug}>
                <Link href={`/c/${cat.slug}`} className="navlink" aria-current={active === cat.slug ? "page" : undefined}>
                  <span className="truncate">{cat.name}</span>
                  <span className="text-xs tabular-nums text-muted">{compact(cat.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Mobile stand-in for the sidebar: a disclosure at the top of the page. */
export function CategoryNavMobile({ active, label }: { active?: string; label: string }) {
  return (
    <details className="group mb-6 rounded-lg border border-line bg-card lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm">
        <span><span className="text-muted">Category</span> <span className="ml-1 font-medium text-ink">{label}</span></span>
        <svg viewBox="0 0 16 16" className="h-4 w-4 text-muted transition-transform group-open:rotate-180" aria-hidden><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </summary>
      <div className="max-h-[60vh] overflow-y-auto border-t border-line p-3">
        <CategoryNav active={active} />
      </div>
    </details>
  );
}

/** Shared docs layout: sticky sidebar left, content right. */
export function DocsShell({ nav, children }: { nav: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="wrap grid gap-10 pt-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
      <aside className="hidden lg:block">
        <div className="sticky top-[4.5rem] -ml-2.5 max-h-[calc(100vh-5.5rem)] overflow-y-auto pb-10 pr-3 [scrollbar-width:thin]">{nav}</div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
