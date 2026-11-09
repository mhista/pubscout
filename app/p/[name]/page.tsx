import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryName, getCatalog, getPackage } from "@/lib/catalog";
import type { Pkg, SubScore } from "@/lib/types";
import { KIND_LABELS, PLATFORMS, SUB_LABELS, ago, compact, pubUrl, tone, toneBg, toneText } from "@/lib/format";
import { SITE } from "@/lib/site";
import { CopyCommand } from "@/components/CopyCommand";
import { CopySummary } from "@/components/CopySummary";
import { SiblingNav } from "@/components/SiblingNav";
import { ShortlistButton } from "@/components/shortlist";
import { Arrow, Badges, CategoryChip, FlagChips, FlagList, HealthNumber, HealthStrip, PkgName } from "@/components/ui";

type Props = { params: Promise<{ name: string }> };

// Every package page is built at deploy time. Unknown names 404 instead of being
// rendered and cached on demand, so the site never writes to Vercel's ISR cache.
export const dynamicParams = false;

export function generateStaticParams() {
  return getCatalog().packages.map((p) => ({ name: p.name }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getPackage((await params).name);
  if (!p) return {};
  return { title: `${p.name}: ${p.oneLiner}`.slice(0, 70), description: p.explainer?.whatItDoes ?? p.description };
}

const ORDER: SubScore[] = ["maintenance", "quality", "popularity", "community", "compatibility"];

export default async function PackagePage({ params }: Props) {
  const p = getPackage((await params).name);
  if (!p) notFound();
  const catalog = getCatalog();
  const ex = p.explainer;
  const alts = p.alternatives.map((n) => getPackage(n)).filter((x): x is Pkg => !!x);
  const why = new Map((ex?.alternatives ?? []).map((a) => [a.name, a.why_pick_it]));
  const related = (p.related ?? []).map((r) => ({ ...r, pkg: getPackage(r.name) })).filter((r): r is typeof r & { pkg: Pkg } => !!r.pkg);
  const relationLabel = (r: Pkg["related"][number]["relation"]) =>
    ({ uses: `${p.name} depends on it`, "built-on": `Built on ${p.name}`, family: "Same family", tooling: "Used together" })[r];
  const primary = p.categories.find((c) => c.primary);

  const md = summaryMarkdown(p, primary ? categoryName(primary.slug) : null);

  return (
    <div className="wrap grid gap-12 pt-8 xl:grid-cols-[208px_minmax(0,1fr)]">
    {primary && (
      <aside className="hidden xl:block">
        <div className="sticky top-[4.5rem] -ml-2.5 max-h-[calc(100vh-5.5rem)] overflow-y-auto pb-10 pr-3 [scrollbar-width:thin]">
          <SiblingNav current={p.name} category={primary.slug} />
        </div>
      </aside>
    )}
    <article className="min-w-0">
      <nav className="text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/categories" className="hover:text-ink">Categories</Link>
        {primary && (
          <>
            <span className="mx-1.5" aria-hidden>/</span>
            <Link href={`/c/${primary.slug}`} className="hover:text-ink">{categoryName(primary.slug)}</Link>
          </>
        )}
      </nav>

      <header className="mt-3 grid gap-8 border-b border-line pb-10 lg:grid-cols-[1fr_340px] lg:gap-12">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold"><PkgName name={p.name} /></h1>
          <p className="mt-2 text-sm text-muted">
            <span className="font-mono text-body">{p.version}</span>, released {ago(p.published)}
            {p.publisher ? <> by <span className="text-body">{p.publisher}</span></> : <> by an unverified publisher</>}
          </p>
          <p className="mt-5 max-w-prose text-md text-ink">{p.oneLiner}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badges p={p} />
            <FlagChips flags={p.flags} />
          </div>
        </div>
        <div className="space-y-3 self-end">
          <CopyCommand text={`flutter pub add ${p.name}`} />
          <div className="flex flex-wrap gap-2">
            <a href={pubUrl(p.name)} className="btn-cobalt flex-1">Open on pub.dev <Arrow /></a>
            <ShortlistButton name={p.name} version={p.version} size="md" />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {p.repository && (
              <a href={p.repository} className="inline-flex items-center gap-1 text-sm text-body hover:text-ink">Source repository <Arrow /></a>
            )}
            <CopySummary markdown={md} />
          </div>
        </div>
      </header>

      {p.discontinued && (
        <div className="mt-8 rounded-lg border border-poor/30 bg-poor-wash px-5 py-4 text-ink">
          <p className="font-semibold">This package is discontinued.</p>
          <p className="mt-1 text-sm">
            {p.replacedBy ? (
              <>The author recommends <Link className="link" href={`/p/${p.replacedBy}`}>{p.replacedBy}</Link> instead.</>
            ) : (
              "It won't get fixes or Flutter updates. Pick an alternative below."
            )}
          </p>
        </div>
      )}

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-12">
          <section aria-labelledby="what">
            <h2 id="what" className="text-lg">What it does</h2>
            {(ex || p.description.trim() !== p.oneLiner.trim()) && (
              <p className="mt-3 max-w-prose text-[17px] leading-7 text-ink/90">{ex?.whatItDoes ?? p.description}</p>
            )}
            <p className="mt-3 text-xs text-muted">
              {ex ? (
                <>
                  {ex.model === "sample" ? "Example summary" : `AI-written summary of version ${ex.forVersion}, based on the package's README and metadata`}.{" "}
                  <a className="link" href={`${SITE.repo}/issues/new?title=${encodeURIComponent(`Inaccurate summary: ${p.name}`)}`}>Report an inaccuracy</a>
                </>
              ) : (
                p.summaryPending
                  ? "This is the author's description from pub.dev. A fuller summary with use cases and trade-offs is in the queue and usually appears within a day or two."
                  : "This is the author's description from pub.dev. We haven't written a summary with use cases and trade-offs for this package yet."
              )}
            </p>
          </section>

          {ex && (
            <>
              <div className="grid gap-10 md:grid-cols-2">
                <ListBlock title="Use it when" items={ex.useWhen} mark="+" tone="good" />
                <ListBlock title="Skip it when" items={ex.avoidWhen} mark="–" tone="poor" />
              </div>
              <div className="grid gap-10 md:grid-cols-2">
                <ListBlock title="Strengths" items={ex.strengths} />
                <ListBlock title="Weaknesses" items={ex.weaknesses} />
              </div>
            </>
          )}

          <section aria-labelledby="setup">
            <h2 id="setup" className="text-lg">Setup</h2>
            <dl className="mt-4 grid max-w-prose gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <Fact k="Kind" v={KIND_LABELS[p.kind]} />
              {ex?.setupEffort && <Fact k="Effort" v={ex.setupEffort[0].toUpperCase() + ex.setupEffort.slice(1)} />}
              <Fact k="Code generation" v={p.usesCodegen ? "Yes (build_runner)" : "No"} />
              <Fact k="Direct dependencies" v={String(p.dependencyCount)} />
            </dl>
            {ex?.setupNotes && <p className="mt-4 max-w-prose text-body">{ex.setupNotes}</p>}
            {ex?.example && (
              <pre className="mt-5 overflow-x-auto rounded-lg bg-code-bg p-4 font-mono dark:ring-1 dark:ring-code-line text-[13px] leading-6 text-code-val"><code>{ex.example}</code></pre>
            )}
          </section>

          {alts.length > 0 && (
            <section aria-labelledby="alts">
              <h2 id="alts" className="text-lg">Alternatives</h2>
              <p className="mt-1 text-sm text-body">Packages that do the same job and could replace {p.name}.</p>
              <ul className="mt-4 border-t border-line">
                {alts.map((a) => (
                  <li key={a.name} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line px-1 py-4">
                    <div className="min-w-0">
                      <Link href={`/p/${a.name}`} className="text-ink hover:text-cobalt"><PkgName name={a.name} /></Link>
                      <p className="mt-0.5 text-sm text-body">{why.get(a.name) ?? a.oneLiner}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <HealthNumber value={a.scores.health} />
                      <Link href={`/compare?p=${p.name},${a.name}`} className="btn-line h-8 min-h-0 px-3 text-xs">Compare</Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {related.length > 0 && (
            <section aria-labelledby="with">
              <h2 id="with" className="text-lg">Works with</h2>
              <p className="mt-1 text-sm text-body">Packages commonly used together with {p.name}: ones it builds on, ones built on it, and its own family.</p>
              <ul className="mt-4 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
                {related.map((r) => (
                  <li key={r.name} className="bg-card">
                    <Link href={`/p/${r.name}`} className="group block h-full px-4 py-3 hover:bg-ground/60">
                      <PkgName name={r.name} className="block truncate text-[14px] text-ink group-hover:text-cobalt" />
                      <span className="mt-0.5 block text-xs text-muted">{relationLabel(r.relation)}</span>
                      <span className="mt-1.5 line-clamp-2 text-sm leading-5 text-body">{r.pkg.oneLiner}</span>
                    </Link>
                  </li>
                ))}
                {related.length % 2 === 1 && <li aria-hidden className="hidden bg-card sm:block" />}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-10 lg:sticky lg:top-20 lg:self-start">
          <section aria-labelledby="health" className="panel p-5">
            <div className="flex items-end justify-between">
              <h2 id="health" className="text-sm font-semibold">Health score</h2>
              <span><HealthNumber value={p.scores.health} size="xl" /><span className="text-sm text-muted"> / 100</span></span>
            </div>
            <HealthStrip p={p} className="mt-3 w-full" />
            {p.scores.cap && <p className="mt-3 text-xs text-poor">Capped at {p.scores.cap.at}: {p.scores.cap.why}.</p>}
            <div className="mt-4 divide-y divide-line-soft">
              {ORDER.map((k, i) => (
                <details key={k} className="group py-2.5">
                  <summary className="flex cursor-pointer list-none items-center gap-3 text-sm">
                    <span className="flex-1 text-ink">{SUB_LABELS[k].label}<span className="ml-1.5 text-xs text-muted">{SUB_LABELS[k].weight}%</span></span>
                    <span className="h-1 w-16 overflow-hidden rounded-full bg-line-soft"><span className={`bar-fill block h-full ${toneBg[tone(p.scores[k])]}`} style={{ width: `${p.scores[k] ?? 0}%`, animationDelay: `${200 + i * 80}ms` }} /></span>
                    <span className={`w-7 text-right tabular-nums font-medium ${toneText[tone(p.scores[k])]}`}>{p.scores[k] ?? "–"}</span>
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-muted transition-transform group-open:rotate-180" aria-hidden><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </summary>
                  <p className="fade-in mt-2 text-xs text-muted">{SUB_LABELS[k].help}</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {p.scores.breakdown[k].map((part) => (
                      <li key={part.key} className="flex justify-between gap-3">
                        <span className="text-body">{part.label} <span className="text-muted">({part.raw})</span></span>
                        <span className="tabular-nums text-ink">{part.value ?? "no data"}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
            <Link href="/about" className="mt-3 inline-block text-xs text-cobalt hover:underline">How the score is calculated</Link>
          </section>

          <section aria-labelledby="facts">
            <h2 id="facts" className="text-sm font-semibold">At a glance</h2>
            <dl className="mt-3 divide-y divide-line-soft border-y border-line-soft text-sm">
              <Row k="Downloads (30 days)" v={compact(p.metrics.downloads30d)} />
              <Row k="Likes" v={compact(p.metrics.likes)} />
              <Row k="Pub points" v={p.metrics.points != null ? `${p.metrics.points} / ${p.metrics.maxPoints}` : "—"} />
              {p.metrics.stars != null && <Row k="GitHub stars" v={compact(p.metrics.stars)} />}
              {p.metrics.openIssues != null && <Row k="Open issues and PRs" v={compact(p.metrics.openIssues)} />}
              {p.metrics.contributors != null && <Row k="Contributors" v={`${p.metrics.contributors}${p.metrics.contributors >= 100 ? "+" : ""}`} />}
              <Row k="First published" v={ago(p.firstPublished)} />
              <Row k="License" v={p.license ? p.license.toUpperCase() : "Unknown"} />
              {p.sdkFlutterMin && <Row k="Minimum Flutter" v={p.sdkFlutterMin} />}
              {p.sdkDartMin && <Row k="Minimum Dart" v={p.sdkDartMin} />}
              <Row k="Platforms" v={p.kind === "dart" ? "All (pure Dart)" : PLATFORMS.filter((x) => p.platforms.includes(x.key)).map((x) => x.short).join(", ") || "None listed"} />
            </dl>
          </section>

          <section aria-labelledby="warn">
            <h2 id="warn" className="text-sm font-semibold">Things to know</h2>
            <div className="mt-3"><FlagList flags={p.flags} /></div>
          </section>

          <section aria-labelledby="tags">
            <h2 id="tags" className="text-sm font-semibold">Tags</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.categories.map((c) => <CategoryChip key={c.slug} slug={c.slug} name={categoryName(c.slug)} primary={c.primary} />)}
              {p.worksWith.map((w) => (
                <Link key={w} href={`/explore?with=${w}`} className="chip">Works with {catalog.worksWith.find((x) => x.slug === w)?.name ?? w}</Link>
              ))}
              {p.approach.map((a) => <span key={a} className="chip">{a}</span>)}
            </div>
          </section>

          <p className="text-xs text-muted">
            {catalog.source === "sample" ? "Demo data." : `Updated ${ago(p.syncedAt)}.`} Everything else, including the full README, changelog and versions, is on{" "}
            <a className="link" href={pubUrl(p.name)}>pub.dev</a>.
          </p>
        </aside>
      </div>
    </article>
    </div>
  );
}

function summaryMarkdown(p: Pkg, cat: string | null) {
  const ex = p.explainer;
  const lines = [
    `## ${p.name} ${p.version}`,
    "",
    p.oneLiner,
    "",
    `- Category: ${cat ?? "uncategorised"}`,
    `- Health: ${p.scores.health}/100 (maintenance ${p.scores.maintenance ?? "n/a"}, quality ${p.scores.quality ?? "n/a"}, popularity ${p.scores.popularity ?? "n/a"})`,
    `- ${compact(p.metrics.downloads30d)} downloads in 30 days, ${compact(p.metrics.likes)} likes, ${p.metrics.points ?? "?"}/${p.metrics.maxPoints ?? "?"} pub points`,
    `- Platforms: ${p.kind === "dart" ? "all (pure Dart)" : p.platforms.join(", ") || "none listed"}; license ${p.license ?? "unknown"}`,
    `- Install: \`flutter pub add ${p.name}\``,
    `- ${pubUrl(p.name)}`,
  ];
  if (ex) {
    lines.push("", ex.whatItDoes, "", "**Use it when**", ...ex.useWhen.map((s) => `- ${s}`), "", "**Skip it when**", ...ex.avoidWhen.map((s) => `- ${s}`));
    if (ex.weaknesses.length) lines.push("", "**Weaknesses**", ...ex.weaknesses.map((s) => `- ${s}`));
  }
  if (p.flags.length) lines.push("", "**Warnings**", ...p.flags.map((f) => `- ${f.label}: ${f.detail}`));
  if (p.alternatives.length) lines.push("", `Alternatives: ${p.alternatives.join(", ")}`);
  if (p.related?.length) lines.push(`Works with: ${p.related.map((r) => r.name).join(", ")}`);
  return lines.join("\n");
}

function ListBlock({ title, items, mark, tone: t }: { title: string; items: string[]; mark?: string; tone?: "good" | "poor" }) {
  if (!items?.length) return null;
  return (
    <section>
      <h2 className="text-md">{title}</h2>
      <ul className="mt-3 space-y-2.5">
        {items.map((s) => (
          <li key={s} className="flex gap-3 text-[15px] leading-6 text-ink/90">
            <span className={`mt-px w-3 shrink-0 font-mono font-semibold ${t === "good" ? "text-good" : t === "poor" ? "text-poor" : "text-muted"}`} aria-hidden>
              {mark ?? "•"}
            </span>
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}

const Fact = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-4 border-b border-line-soft pb-2"><dt className="text-body">{k}</dt><dd className="text-ink">{v}</dd></div>
);
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-4 py-2"><dt className="text-body">{k}</dt><dd className="text-right tabular-nums text-ink">{v}</dd></div>
);
