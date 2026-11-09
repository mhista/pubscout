"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setTheme } from "./ThemeToggle";
import { useShortlist } from "./shortlist";

type Index = { categories: [string, string, number][]; packages: [string, string, string, number, number][] };
type Item = { id: string; group: "Packages" | "Categories" | "Actions"; label: string; hint?: string; meta?: string; mono?: boolean; run: () => void };

let indexPromise: Promise<Index> | null = null;
const loadIndex = () => (indexPromise ??= fetch("/api/index").then((r) => r.json()));

export const openPalette = () => window.dispatchEvent(new Event("pubscout:palette"));

/** Ctrl/⌘ K (or "/") anywhere: jump to a package or category, or run an action. */
export function CommandPalette() {
  const router = useRouter();
  const { items: shortlist } = useShortlist();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<Index | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const show = useCallback(() => {
    lastFocus.current = document.activeElement as HTMLElement;
    setOpen(true);
    loadIndex().then(setIndex).catch(() => {});
  }, []);
  const hide = useCallback(() => {
    setOpen(false);
    setQ("");
    setActive(0);
    lastFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = /input|textarea|select/i.test(t.tagName) || t.isContentEditable;
      if ((e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        open ? hide() : show();
      }
    };
    const onOpen = () => show();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pubscout:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pubscout:palette", onOpen);
    };
  }, [open, show, hide]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const go = useCallback((href: string) => { hide(); router.push(href); }, [hide, router]);

  const items = useMemo<Item[]>(() => {
    const term = q.trim().toLowerCase();
    const out: Item[] = [];
    if (index) {
      const scored = index.packages
        .map(([name, one, cat, health, disc]) => {
          if (!term) return { s: disc ? -1 : 1 / (1 + index.packages.length), name, one, cat, health };
          const n = name.toLowerCase();
          let s = n === term || n === term.replace(/\s+/g, "_") ? 100 : n.startsWith(term) ? 60 : n.includes(term) ? 40 : 0;
          if (!s && `${one} ${cat}`.toLowerCase().includes(term)) s = 15;
          if (s && disc) s -= 20;
          return { s, name, one, cat, health };
        })
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || b.health - a.health)
        .slice(0, term ? 8 : 6);
      for (const x of scored) out.push({ id: `p:${x.name}`, group: "Packages", label: x.name, hint: x.one, meta: String(x.health), mono: true, run: () => go(`/p/${x.name}`) });
      const cats = index.categories.filter(([, name]) => !term || name.toLowerCase().includes(term)).slice(0, term ? 5 : 4);
      for (const [slug, name, count] of cats) out.push({ id: `c:${slug}`, group: "Categories", label: name, meta: String(count), run: () => go(`/c/${slug}`) });
    }
    const actions: Item[] = [
      ...(term ? [{ id: "a:search", group: "Actions" as const, label: q.trim().split(/\s+/).length >= 3 ? `Find packages for “${q.trim()}” with AI` : `Search all packages for “${q.trim()}”`, run: () => go(`/explore?q=${encodeURIComponent(q.trim())}`) }] : []),
      ...(shortlist.length > 1 ? [{ id: "a:compare", group: "Actions" as const, label: `Compare your shortlist (${shortlist.length})`, run: () => go(`/compare?p=${shortlist.map((s) => s.name).join(",")}`) }] : []),
      { id: "a:light", group: "Actions", label: "Use light theme", run: () => { setTheme("light"); hide(); } },
      { id: "a:dark", group: "Actions", label: "Use dark theme", run: () => { setTheme("dark"); hide(); } },
      { id: "a:system", group: "Actions", label: "Use system theme", run: () => { setTheme("system"); hide(); } },
    ];
    out.push(...actions.filter((a) => !term || a.id === "a:search" || a.label.toLowerCase().includes(term)));
    return out;
  }, [index, q, shortlist, go, hide]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); items[active]?.run(); }
    else if (e.key === "Escape") { e.preventDefault(); hide(); }
  };

  let idx = -1;
  const groups = (["Packages", "Categories", "Actions"] as const).map((g) => ({ g, list: items.filter((i) => i.group === g) })).filter((x) => x.list.length);

  return (
    <div className="fade-in fixed inset-0 z-[60] flex items-start justify-center bg-ink/30 px-4 pt-[12vh] backdrop-blur-[2px] dark:bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && hide()}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="pop-in w-full max-w-[600px] overflow-hidden rounded-xl border border-line bg-card shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)]" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3 3" strokeLinecap="round" /></svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search packages, or describe what you need"
            className="h-12 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `pi-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="rounded border border-line px-1.5 text-xs text-muted">Esc</kbd>
        </div>
        <div ref={listRef} id="palette-list" role="listbox" className="max-h-[min(60vh,440px)] overflow-y-auto p-2">
          {!index && <p className="px-3 py-6 text-sm text-muted">Loading packages…</p>}
          {index && !items.length && (
            <div className="px-3 py-6 text-sm text-body">
              <p>Nothing matches by name. Describe what you need and press Enter to let AI find it.</p>
              {/^[a-z][a-z0-9_]{1,63}$/.test(q.trim().toLowerCase()) && (
                <p className="mt-2">
                  Looking for a specific package?{" "}
                  <a href={`/request?name=${encodeURIComponent(q.trim().toLowerCase())}`} className="link">Request <span className="font-mono">{q.trim().toLowerCase()}</span></a>
                </p>
              )}
            </div>
          )}
          {groups.map(({ g, list }) => (
            <div key={g} className="mb-1">
              <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted">{g}</p>
              {list.map((it) => {
                idx++;
                const i = idx;
                return (
                  <button
                    key={it.id}
                    id={`pi-${i}`}
                    data-idx={i}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={it.run}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors duration-100 ${i === active ? "bg-ink/[0.06] text-ink" : "text-body"}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate ${it.mono ? "font-mono text-[13.5px] text-ink" : "text-ink"}`}>{it.label}</span>
                      {it.hint && <span className="block truncate text-xs text-muted">{it.hint}</span>}
                    </span>
                    {it.meta && <span className="shrink-0 text-xs tabular-nums text-muted">{it.meta}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-xs text-muted">
          <span><kbd className="font-sans">↑↓</kbd> to move</span>
          <span><kbd className="font-sans">Enter</kbd> to open</span>
          <span className="ml-auto">Health score on the right</span>
        </div>
      </div>
    </div>
  );
}

export function SearchButton() {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <button
      type="button"
      onClick={openPalette}
      className="group flex h-9 w-full max-w-[280px] items-center gap-2 rounded-md border border-line bg-card px-3 text-sm text-muted transition-colors hover:border-ink/25 hover:text-body"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3 3" strokeLinecap="round" /></svg>
      <span className="flex-1 truncate text-left">Search packages</span>
      <kbd className="hidden rounded border border-line bg-ground px-1.5 font-sans text-xs sm:inline">{mac ? "⌘" : "Ctrl"} K</kbd>
    </button>
  );
}
