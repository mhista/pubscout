import Link from "next/link";
import { NAV, SITE } from "@/lib/site";
import { ShortlistCount } from "./shortlist";
import { SearchButton } from "./CommandPalette";
import { ThemeToggle } from "./ThemeToggle";

export function Logo() {
  return (
    <Link href="/" className="group inline-flex items-center gap-2 text-ink" aria-label={`${SITE.name} home`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <rect x="1" y="1" width="22" height="22" rx="6" className="fill-ink" />
        <path d="M7 8.5 10 12l-3 3.5" fill="none" className="stroke-ground" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="12.5" y="14" width="5" height="1.8" rx=".9" className="fill-[rgb(var(--action))] dark:fill-cobalt" />
      </svg>
      <span className="font-mono text-[17px] font-semibold tracking-[-0.03em]">{SITE.name}</span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ground/90 backdrop-blur-md">
      <div className="wrap flex h-14 items-center gap-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded px-2.5 py-1.5 text-sm text-body hover:bg-ink/5 hover:text-ink">
              {n.label}
              {n.href === "/compare" && <ShortlistCount />}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex flex-1 items-center justify-end gap-1.5">
          <SearchButton />
          <a href={SITE.repo} className="hidden h-9 w-9 items-center justify-center rounded-md text-body hover:bg-ink/[0.06] hover:text-ink sm:inline-flex" aria-label="Source on GitHub">
            <svg viewBox="0 0 16 16" className="h-[17px] w-[17px]" fill="currentColor" aria-hidden><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg>
          </a>
          <ThemeToggle />
        </div>
      </div>
      <nav className="no-scrollbar wrap flex gap-1 overflow-x-auto pb-2 md:hidden" aria-label="Main (mobile)">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="shrink-0 rounded px-2.5 py-1 text-sm text-body hover:text-ink">
            {n.label}
            {n.href === "/compare" && <ShortlistCount />}
          </Link>
        ))}
      </nav>
    </header>
  );
}
