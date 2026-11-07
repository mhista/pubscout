"use client";

import { useState } from "react";

export function CopyCommand({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded bg-code-bg py-1.5 pl-3 pr-1.5 dark:ring-1 dark:ring-code-line font-mono text-[13px] text-code-val">
      <code className="truncate"><span className="select-none text-code-dim">$ </span>{text}</code>
      <button
        type="button"
        className="shrink-0 rounded-sm px-2 py-1 font-sans text-xs text-code-val/80 hover:bg-white/10 hover:text-code-val"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          } catch {}
        }}
      >
        {done ? "Copied" : label}
      </button>
    </div>
  );
}
