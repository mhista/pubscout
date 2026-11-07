import Link from "next/link";
import type { Pkg } from "@/lib/types";
import { ago, compact } from "@/lib/format";
import { categoryName } from "@/lib/catalog";
import { ShortlistButton } from "./shortlist";
import { Badges, FlagChips, HealthNumber, HealthStrip, Platforms, PkgName } from "./ui";

/** One result. Dense on purpose: everything needed to shortlist or skip, without opening it. */
export function PackageRow({ p }: { p: Pkg }) {
  const primary = p.categories.find((c) => c.primary);
  return (
    <li className="group relative -mx-3 grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 rounded-lg border-b border-line px-4 py-5 transition-colors duration-200 hover:bg-card/70 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <Link href={`/p/${p.name}`} className="text-[17px] text-ink after:absolute after:inset-0 after:content-[''] hover:text-cobalt">
            <PkgName name={p.name} />
          </Link>
          <span className="font-mono text-xs text-muted">{p.version}</span>
          <Badges p={p} />
        </div>
        <p className="mt-1.5 max-w-prose text-[15px] leading-6 text-body">{p.oneLiner}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
          {primary && <span className="font-medium text-body">{categoryName(primary.slug)}</span>}
          <Platforms p={p} dense />
          <span>Updated {ago(p.published)}</span>
          <FlagChips flags={p.flags} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 md:flex-col md:flex-nowrap md:items-end md:justify-between md:gap-3">
        <div className="flex items-center gap-3">
          <HealthStrip p={p} className="w-[104px]" />
          <HealthNumber value={p.scores.health} />
        </div>
        <dl className="flex gap-4 text-xs text-muted">
          <div className="flex gap-1"><dt className="sr-only">Downloads in 30 days</dt><dd className="tabular-nums text-ink">{compact(p.metrics.downloads30d)}</dd> downloads</div>
          <div className="flex gap-1"><dt className="sr-only">Likes</dt><dd className="tabular-nums text-ink">{compact(p.metrics.likes)}</dd> likes</div>
        </dl>
        <div className="relative z-10 ml-auto md:ml-0">
          <ShortlistButton name={p.name} version={p.version} />
        </div>
      </div>
    </li>
  );
}
