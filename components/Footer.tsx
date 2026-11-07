import Link from "next/link";
import { SITE } from "@/lib/site";
import { getCatalog } from "@/lib/catalog";
import { ago } from "@/lib/format";

export function Footer() {
  const c = getCatalog();
  return (
    <footer className="mt-24 border-t border-line pb-36 pt-10 text-sm text-body">
      <div className="wrap grid gap-8 md:grid-cols-[2fr_1fr_1fr]">
        <div className="max-w-[46ch] space-y-3">
          <p>
            {SITE.name} is an independent guide to Flutter and Dart packages. Package data comes from{" "}
            <a href="https://pub.dev/help/api" className="link">pub.dev&apos;s public API</a> and GitHub; installs, docs and versions live on pub.dev.
          </p>
          <p className="text-muted">
            {c.count.toLocaleString("en-US")} packages, {c.source === "sample" ? "demo data" : `updated ${ago(c.generatedAt)}`}.
          </p>
        </div>
        <ul className="space-y-2">
          <li><Link href="/explore" className="hover:text-ink">Explore</Link></li>
          <li><Link href="/categories" className="hover:text-ink">Categories</Link></li>
          <li><Link href="/compare" className="hover:text-ink">Compare</Link></li>
          <li><Link href="/about" className="hover:text-ink">How scoring works</Link></li>
        </ul>
        <ul className="space-y-2">
          <li><a href={SITE.repo} className="hover:text-ink">Source on GitHub</a></li>
          <li><a href="https://pub.dev" className="hover:text-ink">pub.dev</a></li>
          <li>
            Built and managed by <a href={SITE.credit.href} className="text-ink hover:text-cobalt">{SITE.credit.label}</a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
