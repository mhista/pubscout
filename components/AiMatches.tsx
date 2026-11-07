"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShortlistButton } from "./shortlist";

type Card = { name: string; version: string; oneLiner: string; health: number; category: string | null; reason: string | null };
type Result = { mode: "ai" | "semantic" | "keyword"; picks: Card[]; more: Card[]; note: string };

const tone = (v: number) => (v >= 75 ? "text-good" : v >= 50 ? "text-fair" : "text-poor");

/** "Describe what you need" results: AI-picked packages with a reason for each. */
export function AiMatches({ q, auto }: { q: string; auto: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(auto ? "loading" : "idle");
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    setState(auto ? "loading" : "idle");
  }, [q, auto]);

  useEffect(() => {
    if (state !== "loading") return;
    let live = true;
    fetch(`/api/ask?q=${encodeURIComponent(q)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Search failed");
        return j as Result;
      })
      .then((j) => live && (setData(j), setState("done")))
      .catch((e) => live && (setError(e.message), setState("error")));
    return () => {
      live = false;
    };
  }, [state, q]);

  if (state === "idle") {
    return (
      <button type="button" onClick={() => setState("loading")} className="mt-5 inline-flex items-center gap-2 rounded-md border border-line bg-card px-3 py-2 text-sm text-body transition-colors hover:border-cobalt/50 hover:text-ink">
        <Spark /> Ask AI which packages fit &ldquo;{q}&rdquo;
      </button>
    );
  }

  return (
    <section aria-label="AI matches" aria-busy={state === "loading"} className="pop-in mt-6 overflow-hidden rounded-xl border border-cobalt/25 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Spark className="text-cobalt" />
          {state === "loading" ? "Finding packages that fit your description…" : data?.mode === "ai" ? "Best matches for your description" : "Closest matches"}
        </h2>
        {state === "done" && data && (
          <span className="text-xs text-muted">{data.mode === "ai" ? "Picked by AI from the catalog. Check the details before installing." : "AI is busy right now; ranked by similarity instead."}</span>
        )}
      </div>

      {state === "loading" && (
        <ul className="divide-y divide-line-soft">
          {[0, 1, 2].map((i) => (
            <li key={i} className="px-5 py-4">
              <div className="h-3.5 w-36 animate-pulse rounded bg-ink/[0.08]" style={{ animationDelay: `${i * 120}ms` }} />
              <div className="mt-2.5 h-3 w-4/5 animate-pulse rounded bg-ink/[0.06]" style={{ animationDelay: `${i * 120 + 60}ms` }} />
            </li>
          ))}
        </ul>
      )}

      {state === "error" && <p className="px-5 py-4 text-sm text-body">{error} The keyword results below still apply.</p>}

      {state === "done" && data && (
        <>
          {data.picks.length ? (
            <ol className="divide-y divide-line-soft">
              {data.picks.map((c, i) => (
                <li key={c.name} className="line-in grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 px-5 py-4" style={{ animationDelay: `${i * 70}ms` }}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2.5">
                      <Link href={`/p/${c.name}`} className="font-mono text-[16px] font-medium text-ink hover:text-cobalt">{c.name}</Link>
                      {c.category && <span className="text-xs text-muted">{c.category}</span>}
                    </div>
                    <p className="mt-1 text-[15px] leading-6 text-ink/90">{c.reason ?? c.oneLiner}</p>
                    {c.reason && <p className="mt-0.5 truncate text-xs text-muted">{c.oneLiner}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-md font-semibold tabular-nums ${tone(c.health)}`} title="Health score">{c.health}</span>
                    <ShortlistButton name={c.name} version={c.version} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-4 text-sm text-body">Nothing in the catalog fits that description yet. Try naming the feature, like &ldquo;QR scanner&rdquo; or &ldquo;offline database&rdquo;.</p>
          )}
          {(data.note || data.more.length > 0) && (
            <div className="border-t border-line-soft bg-ground/50 px-5 py-3 text-sm">
              {data.note && <p className="text-body">{data.note}</p>}
              {data.more.length > 0 && (
                <p className={`text-muted ${data.note ? "mt-1.5" : ""}`}>
                  Also close:{" "}
                  {data.more.map((c, i) => (
                    <span key={c.name}>
                      <Link href={`/p/${c.name}`} className="font-mono text-[13px] text-body hover:text-cobalt">{c.name}</Link>
                      {i < data.more.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Spark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-4 w-4 ${className}`} fill="currentColor" aria-hidden>
      <path d="M8 1.5 9.4 6.6 14.5 8 9.4 9.4 8 14.5 6.6 9.4 1.5 8 6.6 6.6Z" />
    </svg>
  );
}
