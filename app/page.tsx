import Link from "next/link";
import { getCatalog } from "@/lib/catalog";
import { PubspecSearch } from "@/components/PubspecSearch";
import { CategoryIndex } from "@/components/CategoryIndex";
import { MiniList } from "@/components/MiniList";

export default function Home() {
  const c = getCatalog();
  const live = c.packages.filter((p) => !p.discontinued);
  const dependable = [...live].filter((p) => p.metrics.downloads30d >= 10_000).sort((a, b) => b.scores.health - a.scores.health).slice(0, 6);
  const fresh = [...live].filter((p) => p.scores.health >= 70).sort((a, b) => Date.parse(b.published) - Date.parse(a.published)).slice(0, 6);

  return (
    <>
      <section className="relative isolate">
      <div aria-hidden className="paper-grid pointer-events-none absolute inset-0 -z-10" />
      <div className="wrap grid items-center gap-12 pb-20 pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:pt-24">
        <div>
          <h1 className="rise-in text-hero font-semibold">Find the right Flutter package.</h1>
          <p className="rise-in mt-6 max-w-[46ch] text-md font-normal text-body" style={{ animationDelay: "90ms" }}>
            Search by what your app needs. Every package is sorted into categories, scored on maintenance, quality and community, and explained with when to use it and when not to.
          </p>
          <p className="mt-4 max-w-[46ch] text-sm text-muted">Installs, versions and docs stay on pub.dev. This is where you decide.</p>
        </div>
        <PubspecSearch count={c.count} />
      </div>
      </section>

      <section className="wrap" aria-labelledby="cats">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 id="cats" className="text-lg">Browse by category</h2>
          <Link href="/categories" className="link text-sm">All categories with descriptions</Link>
        </div>
        <CategoryIndex />
      </section>

      <div className="wrap mt-20 grid gap-14 md:grid-cols-2">
        <MiniList title="Most dependable" note="Highest health scores among packages with 10k+ monthly downloads." items={dependable} href="/explore?sort=health&dl=10000" />
        <MiniList title="Recently released" note="Fresh versions from packages scoring 70 or higher." items={fresh} href="/explore?sort=updated&min=70" />
      </div>
    </>
  );
}
