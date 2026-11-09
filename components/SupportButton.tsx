import { SITE } from "@/lib/site";

function Cup({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 6h9v4a3.5 3.5 0 0 1-3.5 3.5H6A3.5 3.5 0 0 1 2.5 10V6Z" />
      <path d="M11.5 7.5h1a1.5 1.5 0 0 1 0 3h-1.2" />
      <path d="M5.5 1.8c-.4.5-.4 1.2 0 1.7M8.5 1.8c-.4.5-.4 1.2 0 1.7" />
    </svg>
  );
}

/** Header button: compact. */
export function SupportButton() {
  if (!SITE.support.href) return null;
  return (
    <a
      href={SITE.support.href}
      target="_blank"
      rel="noopener"
      className="group hidden h-9 items-center gap-1.5 rounded-md border border-line px-2.5 text-sm text-body transition-colors hover:border-[#e8a33d]/60 hover:text-ink sm:inline-flex"
    >
      <Cup className="h-4 w-4 transition-transform group-hover:-rotate-12" />
      <span className="hidden lg:inline">Support</span>
    </a>
  );
}

/** Footer / about: a short ask with context. */
export function SupportBlurb() {
  if (!SITE.support.href) return null;
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <p className="text-md font-semibold text-ink">Find {SITE.name} useful?</p>
      <p className="mt-1 text-sm text-body">It&apos;s free, has no ads, and is run by one developer. Support helps cover the hosting and AI costs.</p>
      <a href={SITE.support.href} target="_blank" rel="noopener" className="btn-cobalt mt-4 gap-2">
        <Cup /> {SITE.support.label}
      </a>
    </div>
  );
}
