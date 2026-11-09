import Link from "next/link";
import { getCatalog, getPackage } from "@/lib/catalog";
import { CATEGORY_INDEX } from "@/lib/taxonomy";
import { PLATFORMS } from "@/lib/format";
import { parseFilters, runQuery, toQuery, type Filters } from "@/lib/query";
import { FilterBar } from "./FilterBar";
import { PackageRow } from "./PackageRow";
import { AiMatches } from "./AiMatches";
import { RequestPackage } from "./RequestPackage";

type SP = Record<string, string | string[] | undefined>;

export function Explorer({ searchParams, lockedCategory, basePath }: { searchParams: SP; lockedCategory?: string; basePath: string }) {
  const catalog = getCatalog();
  const f: Filters = parseFilters(searchParams);
  if (lockedCategory && !f.cat.includes(lockedCategory)) f.cat = [lockedCategory, ...f.cat];
  const r = runQuery(catalog.packages, f, CATEGORY_INDEX);
  const catName = new Map(catalog.categories.map((c) => [c.slug, c.name]));
  // Searched for something that looks like a package name we don't have? Offer to add it.
  const nameLike = f.q.trim().toLowerCase();
  const isName = /^[a-z][a-z0-9_]{1,63}$/.test(nameLike);
  const missing = isName && (nameLike.includes("_") || r.total === 0); // "flutter_map", or a single word with no matches
  const offerRequest = missing && !getPackage(nameLike) && catalog.source !== "sample";

  const bar = (
    <FilterBar
      lockedCategory={lockedCategory}
      sort={f.sort}
      categories={[...r.facets.cat].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count, label: catName.get(value) ?? value }))}
      platforms={PLATFORMS.map((p) => ({ value: p.key, label: p.short, count: r.facets.plat.get(p.key) ?? 0 }))}
      worksWith={catalog.worksWith.filter((w) => r.facets.with.get(w.slug)).map((w) => ({ value: w.slug, label: w.name, count: r.facets.with.get(w.slug) }))}
    />
  );

  // Links keep the URL free of the locked category.
  const linkFor = (page: number) => {
    const g = { ...f, page, cat: f.cat.filter((c) => c !== lockedCategory) };
    return `${basePath}${toQuery(g)}`;
  };

  return (
    <section aria-label="Results">
      {offerRequest && (
        <div className="pop-in mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-dashed border-line px-4 py-3 text-sm">
          <p className="text-body">
            <span className="font-mono text-ink">{nameLike}</span> isn&apos;t in the catalog yet.
          </p>
          <div className="min-w-[260px] flex-1"><RequestPackage initial={nameLike} compact /></div>
        </div>
      )}
      {f.q && <AiMatches q={f.q} auto={f.q.trim().split(/\s+/).length >= 3} />}
      <div className={f.q ? "mt-8" : ""}>{bar}</div>
      <p className="mt-5 border-b border-line pb-3 text-sm text-body" aria-live="polite">
        <span className="font-semibold tabular-nums text-ink">{r.total.toLocaleString("en-US")}</span> {r.total === 1 ? "package" : "packages"}
        {f.q && (
          <>
            {" "}matching <span className="font-medium text-ink">&ldquo;{f.q}&rdquo;</span>
          </>
        )}
      </p>

      {r.items.length ? (
        <ul>{r.items.map((p) => <PackageRow key={p.name} p={p} />)}</ul>
      ) : (
        <div className="py-16">
          <p className="text-md font-medium">{f.q ? "No keyword matches." : "No packages match these filters."}</p>
          <p className="mt-2 text-body">{f.q ? "The AI matches above look for meaning, not exact words. You can also remove a filter or search for a category name." : "Remove a filter or try a broader search, like a category name."}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={basePath} className="btn-line">Clear filters</Link>
            <Link href={`/request${f.q ? `?name=${encodeURIComponent(f.q)}` : ""}`} className="btn-line">Request a package</Link>
          </div>
        </div>
      )}

      {r.pages > 1 && (
        <nav className="mt-8 flex items-center justify-between text-sm" aria-label="Pages">
          {r.page > 1 ? <Link className="btn-line" href={linkFor(r.page - 1)}>Previous</Link> : <span />}
          <span className="text-body">Page {r.page} of {r.pages}</span>
          {r.page < r.pages ? <Link className="btn-line" href={linkFor(r.page + 1)}>Next</Link> : <span />}
        </nav>
      )}
    </section>
  );
}
