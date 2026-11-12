import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { SUB_LABELS } from "@/lib/format";
import { SupportBlurb } from "@/components/SupportButton";

export const metadata: Metadata = pageMeta({
  title: "How Flutter package health scores work",
  description: "How pubscout scores Flutter packages from 0 to 100: maintenance, quality, popularity, community and compatibility, plus how categories and AI summaries are made.",
  path: "/about",
});

const PARTS: Record<keyof typeof SUB_LABELS, string[]> = {
  maintenance: ["Last release: 100 when released today, halving every 6 months (50%)", "Repo activity: last push to GitHub, halving every 3 months; release cadence when there's no repo (50%)"],
  quality: ["Pub points as a share of the maximum (70%)", "Ships an example app (15%)", "Breaking changes: minus 20 for each major version in the last 12 months (15%)"],
  popularity: ["30-day downloads, ranked against packages in the same main category (60%)", "Likes, ranked the same way (40%)"],
  community: ["Contributors on GitHub, full marks at 8 or more (45%)", "Verified publisher on pub.dev (35%)", "Flutter Favorite (20%)"],
  compatibility: ["Allows Dart 3 (50%)", "Platform coverage compared with its category (35%)", "WASM-ready, for packages that run on the web (15%)"],
};

export default function About() {
  return (
    <article className="wrap max-w-[760px] pt-10">
      <h1 className="text-xl">How scoring works</h1>
      <p className="mt-4 text-[17px] leading-7 text-body">
        The health score (0 to 100) is a weighted mix of five parts. Every package page shows each part and the numbers behind it, so you can disagree with the score and still use the data.
      </p>

      <ul className="mt-10 border-t border-line">
        {(Object.keys(SUB_LABELS) as (keyof typeof SUB_LABELS)[]).map((k) => (
          <li key={k} className="grid gap-3 border-b border-line py-6 sm:grid-cols-[180px_1fr]">
            <div>
              <h2 className="text-md">{SUB_LABELS[k].label}</h2>
              <p className="text-sm text-muted">{SUB_LABELS[k].weight}% of health</p>
            </div>
            <ul className="space-y-1.5 text-[15px] text-ink/90">
              {PARTS[k].map((s) => <li key={s}>{s}</li>)}
            </ul>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-lg">Caps</h2>
      <p className="mt-3 text-body">Some problems outweigh good numbers. A discontinued package scores at most 20, an archived repository at most 30, and a package with no release in two years at most 50.</p>

      <h2 className="mt-10 text-lg">Missing data</h2>
      <p className="mt-3 text-body">When a part can&apos;t be measured, for example a package without a public GitHub repository, it&apos;s left out and the other parts are re-weighted. The breakdown says &ldquo;no data&rdquo; for it.</p>

      <h2 className="mt-10 text-lg">Categories and summaries</h2>
      <p className="mt-3 text-body">
        Categories come from three layers: rules on the package&apos;s metadata, an AI pass over its README, and human review, which always wins. Summaries are written by AI from the package&apos;s own README, changelog and pubspec, are labeled as AI-written on every page, and are refreshed when a package makes a breaking release.
      </p>

      <h2 className="mt-10 text-lg">Alternatives and &ldquo;works with&rdquo;</h2>
      <p className="mt-3 text-body">
        Alternatives are packages that do the same job and could replace each other, like dio and http. &ldquo;Works with&rdquo; lists packages used together: ones a package depends on, ones built on top of it, and packages from the same family, like firebase_core and firebase_auth. A package never appears in both lists.
      </p>

      <h2 className="mt-10 text-lg">Which packages are included</h2>
      <p className="mt-3 text-body">
        pub.dev&apos;s 2,000 most-used packages, plus a hand-picked set of essentials (theming, maps, code generation and more) that stay whatever their rank, plus any package someone{" "}
        <Link href="/request" className="link">requests</Link>. Everything is refreshed every night. Packages that drop out of the top list for a month are removed so their numbers don&apos;t go stale.
      </p>

      <p className="mt-12"><Link href="/explore" className="btn-cobalt">Explore packages</Link></p>
      <div className="mt-12"><SupportBlurb /></div>
    </article>
  );
}
