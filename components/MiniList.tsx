import Link from "next/link";
import type { Pkg } from "@/lib/types";
import { HealthNumber, PkgName } from "./ui";

export function MiniList({ title, note, items, href }: { title: string; note: string; items: Pkg[]; href: string }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-md">{title}</h2>
        <Link href={href} className="link text-sm">See all</Link>
      </div>
      <p className="mt-1 text-sm text-body">{note}</p>
      <ol className="mt-4 border-t border-line">
        {items.map((p) => (
          <li key={p.name}>
            <Link href={`/p/${p.name}`} className="group grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line px-1 py-3 hover:bg-card">
              <span className="min-w-0">
                <PkgName name={p.name} className="text-[15px] text-ink group-hover:text-cobalt" />
                <span className="mt-0.5 block truncate text-sm text-body">{p.oneLiner}</span>
              </span>
              <HealthNumber value={p.scores.health} />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
