import type { Metadata } from "next";
import { clip, comparePath, ogImage, pageMeta } from "@/lib/seo";
import Link from "next/link";
import { categoryName, getCatalog, getPackage } from "@/lib/catalog";
import type { Pkg } from "@/lib/types";
import { KIND_LABELS, PLATFORMS, SUB_LABELS, ago, compact, pubUrl, tone, toneText } from "@/lib/format";
import { CompareAdd } from "@/components/CompareAdd";
import { HealthStrip, PkgName } from "@/components/ui";
import { ShortlistButton } from "@/components/shortlist";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const parse = (v: string | string[] | undefined) =>
  [...new Set((Array.isArray(v) ? v.join(",") : v ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 4);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const names = parse((await searchParams).p).filter((n) => getPackage(n));
  if (names.length < 2) {
    return pageMeta({
      title: "Compare Flutter packages side by side",
      description: "Compare up to four Flutter packages on health score, maintenance, downloads, platforms, license and setup effort.",
      path: "/compare",
    });
  }
  const pkgs = names.map((n) => getPackage(n)!);
  const vs = names.join(" vs ");
  const best = [...pkgs].sort((a, b) => b.scores.health - a.scores.health)[0];
  return pageMeta({
    title: `${vs}: which Flutter package should you use?`,
    description: clip(`${vs} compared: health scores (${pkgs.map((p) => `${p.name} ${p.scores.health}`).join(", ")}), downloads, maintenance, platforms and trade-offs. ${best.name} scores highest.`),
    path: comparePath(names),
    image: ogImage(vs, "Side-by-side Flutter package comparison", { kind: "Compare" }),
    // Index real head-to-heads (2–3 packages); bigger ad-hoc mixes stay out of search.
    noindex: names.length > 3,
  });
}

type RowDef = { label: string; get: (p: Pkg) => string | number | null; best?: "max" | "min"; render?: (p: Pkg) => React.ReactNode; group?: string };

const ROWS: RowDef[] = [
  { group: "Scores", label: "Health", get: (p) => p.scores.health, best: "max", render: (p) => <span className="flex items-center gap-3"><span className={`text-md font-semibold tabular-nums ${toneText[tone(p.scores.health)]}`}>{p.scores.health}</span><HealthStrip p={p} className="w-24" /></span> },
  ...(["maintenance", "quality", "popularity", "community", "compatibility"] as const).map((k) => ({
    label: SUB_LABELS[k].label,
    get: (p: Pkg) => p.scores[k],
    best: "max" as const,
  })),
  { group: "Usage", label: "Downloads (30 days)", get: (p) => p.metrics.downloads30d, best: "max", render: (p) => compact(p.metrics.downloads30d) },
  { label: "Likes", get: (p) => p.metrics.likes, best: "max", render: (p) => compact(p.metrics.likes) },
  { label: "Pub points", get: (p) => p.metrics.points, best: "max", render: (p) => (p.metrics.points != null ? `${p.metrics.points} / ${p.metrics.maxPoints}` : "—") },
  { label: "GitHub stars", get: (p) => p.metrics.stars, best: "max", render: (p) => compact(p.metrics.stars) },
  { group: "Maintenance", label: "Latest release", get: (p) => Date.parse(p.published), best: "max", render: (p) => `${p.version}, ${ago(p.published)}` },
  { label: "Major versions in 12 months", get: (p) => p.majorBumpsLastYear, best: "min" },
  { label: "Contributors", get: (p) => p.metrics.contributors, best: "max", render: (p) => (p.metrics.contributors == null ? "—" : `${p.metrics.contributors}${p.metrics.contributors >= 100 ? "+" : ""}`) },
  { label: "Publisher", get: (p) => p.publisher ?? "Unverified" },
  { group: "Fit", label: "Platforms", get: (p) => (p.kind === "dart" ? "All (pure Dart)" : p.platforms.length ? PLATFORMS.filter((x) => p.platforms.includes(x.key)).map((x) => x.short).join(", ") : "None listed") },
  { label: "WASM-ready", get: (p) => (p.wasm ? "Yes" : "No") },
  { label: "Kind", get: (p) => KIND_LABELS[p.kind] },
  { label: "Code generation", get: (p) => (p.usesCodegen ? "Yes" : "No") },
  { label: "Direct dependencies", get: (p) => p.dependencyCount, best: "min" },
  { label: "License", get: (p) => (p.license ? p.license.toUpperCase() : "Unknown") },
  { label: "Setup effort", get: (p) => (p.explainer?.setupEffort ? p.explainer.setupEffort[0].toUpperCase() + p.explainer.setupEffort.slice(1) : "—") },
];

export default async function ComparePage({ searchParams }: Props) {
  const names = parse((await searchParams).p);
  const pkgs = names.map((n) => getPackage(n)).filter((p): p is Pkg => !!p);
  const catalog = getCatalog();
  const allNames = catalog.packages.map((p) => p.name);

  if (pkgs.length < 2) {
    // Real head-to-heads: each popular package with its first alternative, one pair per category.
    const seenCats = new Set<string>();
    const seenPairs = new Set<string>();
    const pairs: [Pkg, Pkg][] = [];
    for (const a of catalog.packages) {
      if (pairs.length >= 12) break;
      // Only pairs that name each other as alternatives.
      const b = a.alternatives.map((n) => getPackage(n)).find((x): x is Pkg => !!x && x.alternatives.includes(a.name));
      if (!b || !a.primaryCategory || seenCats.has(a.primaryCategory)) continue;
      const key = [a.name, b.name].sort().join("|");
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      seenCats.add(a.primaryCategory);
      pairs.push([a, b]);
    }
    return (
      <div className="wrap pt-10">
        <h1 className="text-xl">Compare packages</h1>
        <p className="mt-2 max-w-prose text-body">Put two to four packages side by side: scores, usage, maintenance and fit. Shortlist packages while you browse, or add them here.</p>
        <div className="mt-6"><CompareAdd current={pkgs.map((p) => p.name)} names={allNames} /></div>
        {pkgs.length === 1 && <p className="mt-4 text-sm text-body">Comparing <PkgName name={pkgs[0].name} />. Add at least one more.</p>}
        <h2 className="mt-14 text-md">Common comparisons</h2>
        <ul className="mt-4 grid border-t border-line sm:grid-cols-2">
          {pairs.map(([a, b]) => (
            <li key={a.name + b.name} className="border-b border-line">
              <Link href={comparePath([a.name, b.name])} className="block px-1 py-4 hover:bg-card sm:px-4">
                <span className="font-mono text-ink">{a.name}</span> <span className="text-muted">vs</span> <span className="font-mono text-ink">{b.name}</span>
                <span className="mt-0.5 block text-sm text-body">{categoryName(a.primaryCategory!)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const bestOf = (row: RowDef) => {
    if (!row.best) return null;
    const vals = pkgs.map((p) => row.get(p)).filter((v): v is number => typeof v === "number");
    if (vals.length < 2) return null;
    const target = row.best === "max" ? Math.max(...vals) : Math.min(...vals);
    return vals.filter((v) => v === target).length === vals.length ? null : target;
  };

  const without = (n: string) => `/compare?p=${pkgs.map((p) => p.name).filter((x) => x !== n).join(",")}`;

  return (
    <div className="wrap pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl">Compare</h1>
          <p className="mt-2 text-body">The strongest value in each row is marked.</p>
        </div>
        <CompareAdd current={pkgs.map((p) => p.name)} names={allNames} />
      </div>

      <div className="mt-8 overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <colgroup><col className="w-[200px]" />{pkgs.map((p) => <col key={p.name} />)}</colgroup>
          <thead>
            <tr className="align-top">
              <th scope="col" className="sticky left-0 bg-card p-4 text-left font-normal text-muted"><span className="sr-only">Attribute</span></th>
              {pkgs.map((p) => (
                <th key={p.name} scope="col" className="border-l border-line-soft p-4 text-left font-normal">
                  <Link href={`/p/${p.name}`} className="text-[16px] text-ink hover:text-cobalt"><PkgName name={p.name} /></Link>
                  <p className="mt-1 line-clamp-3 text-xs leading-5 text-body">{p.oneLiner}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <ShortlistButton name={p.name} version={p.version} />
                    <a href={pubUrl(p.name)} className="text-xs text-body hover:text-ink">pub.dev</a>
                    <Link href={without(p.name)} className="text-xs text-muted hover:text-poor">Remove</Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const best = bestOf(row);
              return (
                <tr key={row.label} className={row.group ? "border-t-2 border-line" : "border-t border-line-soft"}>
                  <th scope="row" className="sticky left-0 bg-card px-4 py-2.5 text-left font-normal text-body">
                    {row.group && <span className="mb-1 block text-xs font-semibold text-ink">{row.group}</span>}
                    {row.label}
                  </th>
                  {pkgs.map((p) => {
                    const v = row.get(p);
                    const isBest = best != null && v === best;
                    return (
                      <td key={p.name} className={`border-l border-line-soft px-4 py-2.5 align-bottom tabular-nums ${isBest ? "font-semibold text-cobalt" : "text-ink"}`}>
                        {row.render ? row.render(p) : v ?? "—"}
                        {isBest && <span className="sr-only"> (best)</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="border-t-2 border-line align-top">
              <th scope="row" className="sticky left-0 bg-card px-4 py-3 text-left font-normal text-body"><span className="mb-1 block text-xs font-semibold text-ink">Judgement</span>Strengths</th>
              {pkgs.map((p) => <td key={p.name} className="border-l border-line-soft px-4 py-3"><Bullets items={p.explainer?.strengths} /></td>)}
            </tr>
            <tr className="border-t border-line-soft align-top">
              <th scope="row" className="sticky left-0 bg-card px-4 py-3 text-left font-normal text-body">Weaknesses</th>
              {pkgs.map((p) => <td key={p.name} className="border-l border-line-soft px-4 py-3"><Bullets items={p.explainer?.weaknesses} /></td>)}
            </tr>
            <tr className="border-t border-line-soft align-top">
              <th scope="row" className="sticky left-0 bg-card px-4 py-3 text-left font-normal text-body">Warnings</th>
              {pkgs.map((p) => (
                <td key={p.name} className="border-l border-line-soft px-4 py-3">
                  {p.flags.length ? <ul className="space-y-1">{p.flags.map((f) => <li key={f.code} className={f.level === "bad" ? "text-poor" : f.level === "warn" ? "text-fair" : "text-body"}>{f.label}</li>)}</ul> : <span className="text-muted">None</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Bullets({ items }: { items?: string[] }) {
  if (!items?.length) return <span className="text-muted">No summary yet</span>;
  return <ul className="list-disc space-y-1 pl-4 text-ink/90">{items.map((s) => <li key={s}>{s}</li>)}</ul>;
}
