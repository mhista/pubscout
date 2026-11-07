"use client";

import { useState } from "react";

/** Copies the package summary as Markdown: handy for notes, PRs or an AI chat. */
export function CopySummary({ markdown }: { markdown: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(markdown);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
      className="inline-flex items-center gap-1.5 text-sm text-body hover:text-ink"
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
        <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" /><path d="M10.5 5V3.5A1.5 1.5 0 0 0 9 2H3.5A1.5 1.5 0 0 0 2 3.5V9A1.5 1.5 0 0 0 3.5 10.5H5" />
      </svg>
      {done ? "Copied" : "Copy summary as Markdown"}
    </button>
  );
}
