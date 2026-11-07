"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

/* The shortlist is the user's working pubspec: packages they're considering.
   Stored per browser in localStorage; it powers the tray and the compare page. */

type Item = { name: string; version: string };
const KEY = "pubscout.shortlist.v1";
const MAX = 6;
const listeners = new Set<() => void>();
let memory: Item[] = [];
let loaded = false;

function read(): Item[] {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      memory = JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      memory = [];
    }
  }
  return memory;
}
function write(next: Item[]) {
  memory = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode: keep it in memory */
  }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const EMPTY: Item[] = [];

export function useShortlist() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    items,
    has: (name: string) => items.some((i) => i.name === name),
    toggle: (item: Item) =>
      write(items.some((i) => i.name === item.name) ? items.filter((i) => i.name !== item.name) : [...items, item].slice(-MAX)),
    remove: (name: string) => write(items.filter((i) => i.name !== name)),
    clear: () => write([]),
  };
}

const caret = (v: string) => (v.includes("-") ? v : `^${v}`);

export function ShortlistButton({ name, version, size = "sm" }: Item & { size?: "sm" | "md" }) {
  const { has, toggle } = useShortlist();
  const on = has(name);
  return (
    <button
      type="button"
      onClick={() => toggle({ name, version })}
      aria-pressed={on}
      className={
        size === "md"
          ? `btn ${on ? "border border-cobalt bg-cobalt-wash text-cobalt" : "btn-line"}`
          : `inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs font-medium transition ${
              on ? "border-cobalt bg-cobalt-wash text-cobalt" : "border-line bg-card text-body hover:border-ink/40 hover:text-ink"
            }`
      }
    >
      <svg key={on ? "on" : "off"} viewBox="0 0 16 16" className={`h-3.5 w-3.5 ${on ? "tick" : ""}`} aria-hidden>
        {on ? (
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        )}
      </svg>
      {on ? "Shortlisted" : "Shortlist"}
    </button>
  );
}

export function ShortlistCount() {
  const { items } = useShortlist();
  if (!items.length) return null;
  return <span className="ml-1.5 rounded-sm bg-action px-1.5 text-xs font-semibold text-white">{items.length}</span>;
}

/** Bottom tray: the shortlist rendered as the dependencies block you'd paste into pubspec.yaml. */
export function ShortlistTray() {
  const { items, remove, clear } = useShortlist();
  const path = usePathname();
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  // The compare page already shows these packages side by side.
  if (!items.length || path.startsWith("/compare")) return null;

  const yaml = `dependencies:\n${items.map((i) => `  ${i.name}: ${caret(i.version)}`).join("\n")}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <aside aria-label="Shortlist" className="tray-in fixed border border-code-line inset-x-3 bottom-3 z-40 mx-auto max-w-[560px] overflow-hidden rounded-lg bg-code-bg text-code-val shadow-[0_18px_50px_-12px_rgba(14,26,43,0.55)]">
      <div className="flex items-center justify-between border-b border-code-line px-4 py-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-sm text-code-val/90" aria-expanded={open}>
          <span className="font-mono text-code-dim">pubspec.yaml</span>
          <span>Your shortlist ({items.length})</span>
          <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 transition-transform ${open ? "" : "rotate-180"}`} aria-hidden>
            <path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" onClick={clear} className="text-xs text-code-dim hover:text-code-val">
          Clear
        </button>
      </div>
      {open && (
        <div className="px-4 py-3 font-mono text-[13px] leading-6">
          <div className="text-code-key">dependencies:</div>
          <ul>
            {items.map((i) => (
              <li key={i.name} className="line-in group flex items-center justify-between pl-4">
                <span>
                  <Link href={`/p/${i.name}`} className="text-code-val hover:underline">{i.name}</Link>
                  <span className="text-code-dim">: </span>
                  <span className="text-code-key">{caret(i.version)}</span>
                </span>
                <button type="button" onClick={() => remove(i.name)} className="px-1 text-code-dim opacity-60 hover:text-code-val group-hover:opacity-100" aria-label={`Remove ${i.name}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-2 border-t border-code-line px-3 py-2.5">
        <button type="button" onClick={copy} className="btn h-9 min-h-0 flex-1 bg-white/10 text-code-val hover:bg-white/15">
          {copied ? "Copied" : "Copy dependencies"}
        </button>
        <Link
          href={`/compare?p=${items.map((i) => i.name).join(",")}`}
          aria-disabled={items.length < 2}
          className={`btn h-9 min-h-0 flex-1 ${items.length < 2 ? "pointer-events-none bg-action/40 text-white/60" : "bg-action text-white hover:bg-action-hover"}`}
        >
          {items.length < 2 ? "Add one more to compare" : `Compare ${items.length}`}
        </Link>
      </div>
    </aside>
  );
}
