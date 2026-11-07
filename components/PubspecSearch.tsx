"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TRIES = ["state management", "pick images", "charts", "secure storage", "shadcn", "deep links"];

/** The home search, written as the next line of a pubspec.yaml dependencies block. */
export function PubspecSearch({ count }: { count: number }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const go = (term: string) => router.push(`/explore?q=${encodeURIComponent(term.trim())}`);

  const lines: React.ReactNode[] = [
    <><span className="text-code-key">name</span><span className="text-code-dim">:</span> my_app</>,
    <><span className="text-code-key">dependencies</span><span className="text-code-dim">:</span></>,
    <>  <span className="text-code-key">flutter</span><span className="text-code-dim">:</span></>,
    <>    <span className="text-code-key">sdk</span><span className="text-code-dim">:</span> flutter</>,
  ];

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) go(q);
          else router.push("/explore");
        }}
        className="overflow-hidden rounded-lg bg-code-bg text-code-val shadow-[0_30px_60px_-30px_rgba(14,26,43,0.6)] dark:ring-1 dark:ring-code-line"
      >
        <div className="flex items-center justify-between border-b border-code-line px-4 py-2.5 text-xs">
          <span className="font-mono text-code-val/80">pubspec.yaml</span>
          <span className="text-code-dim">{count.toLocaleString("en-US")} packages indexed</span>
        </div>
        <div className="py-3 font-mono text-[14px] leading-7 sm:text-[15px]">
          {lines.map((l, i) => (
            <div key={i} className="line-in flex whitespace-pre" style={{ animationDelay: `${250 + i * 110}ms` }}>
              <span className="w-8 shrink-0 select-none pr-3 text-right text-code-dim/70 sm:w-10">{i + 1}</span>
              <span>{l}</span>
            </div>
          ))}
          <div className={`line-in flex items-center transition-colors ${focused ? "bg-white/[0.04]" : ""}`} style={{ animationDelay: `${250 + lines.length * 110}ms` }}>
            <span className="w-8 shrink-0 select-none pr-3 text-right text-code-dim/70 sm:w-10">5</span>
            <span className="whitespace-pre">  </span>
            <label htmlFor="ps" className="sr-only">What does your app need?</label>
            <div className="relative flex-1 pr-2">
              {!q && !focused && <span className="caret pointer-events-none absolute left-0 top-1/2 h-5 w-[9px] -translate-y-1/2 bg-code-caret" aria-hidden />}
              <input
                id="ps"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoComplete="off"
                spellCheck={false}
                placeholder="what does your app need?"
                className={`w-full bg-transparent py-1 text-code-val caret-code-caret outline-none placeholder:text-code-dim ${!q && !focused ? "pl-4" : ""}`}
              />
            </div>
            <button type="submit" className="mr-3 shrink-0 rounded-sm bg-action px-3 py-1 font-sans text-[13px] font-medium text-white hover:bg-action-hover">
              Find<span className="hidden sm:inline"> packages</span>
            </button>
          </div>
        </div>
      </form>
      <p className="rise-in mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-body" style={{ animationDelay: "900ms" }}>
        <span>Try</span>
        {TRIES.map((t) => (
          <button key={t} type="button" onClick={() => go(t)} className="chip text-sm hover:border-ink/40 hover:text-ink">
            {t}
          </button>
        ))}
      </p>
    </div>
  );
}
