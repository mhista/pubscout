"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SORTS } from "@/lib/query";

type Opt = { value: string; label: string; count?: number };
type Props = { categories: Opt[]; platforms: Opt[]; worksWith: Opt[]; lockedCategory?: string; sort: string };

/** Filters as a row of compact menus above the results. Every change is written to the URL. */
export function FilterBar({ categories, platforms, worksWith, lockedCategory, sort }: Props) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const getList = (k: string) => (sp.get(k) ?? "").split(",").filter(Boolean);
  const flag = (k: string) => sp.get(k) === "1";
  const update = (mut: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(sp.toString());
    mut(next);
    next.delete("page");
    start(() => router.replace(`${path}${next.toString() ? `?${next}` : ""}`, { scroll: false }));
  };
  const toggleIn = (k: string, v: string) =>
    update((p) => {
      const cur = getList(k);
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      next.length ? p.set(k, next.join(",")) : p.delete(k);
    });
  const setOne = (k: string, v: string) => update((p) => (v ? p.set(k, v) : p.delete(k)));
  const toggleFlag = (k: string) => update((p) => (p.get(k) === "1" ? p.delete(k) : p.set(k, "1")));

  const cats = categories.filter((c) => c.value !== lockedCategory);
  const counts = {
    cat: getList("cat").filter((c) => c !== lockedCategory).length,
    plat: getList("plat").length + Number(flag("wasm")),
    with: getList("with").length,
    health: Number(!!sp.get("min")),
    activity: Number(!!sp.get("active")) + Number(!!sp.get("dl")) + Number(flag("stable")),
    trust: Number(flag("verified")) + Number(flag("permissive")) + Number(flag("disc")),
    setup: Number(flag("pure")) + Number(flag("nonative")) + Number(flag("nocodegen")),
  };
  const any = Object.values(counts).some(Boolean);

  return (
    <div className={`flex flex-wrap items-center gap-2 transition-opacity ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      {cats.length > 0 && (
        <Menu label={lockedCategory ? "Also tagged" : "Category"} count={counts.cat} wide>
          <Checks opts={cats} selected={getList("cat")} onToggle={(v) => toggleIn("cat", v)} />
        </Menu>
      )}
      <Menu label="Platform" count={counts.plat}>
        <Checks opts={platforms} selected={getList("plat")} onToggle={(v) => toggleIn("plat", v)} />
        <Sep />
        <Check label="WASM-ready" checked={flag("wasm")} onChange={() => toggleFlag("wasm")} />
      </Menu>
      {worksWith.length > 0 && (
        <Menu label="Works with" count={counts.with}>
          <Checks opts={worksWith} selected={getList("with")} onToggle={(v) => toggleIn("with", v)} />
        </Menu>
      )}
      <Menu label="Health" count={counts.health}>
        <Radios
          value={sp.get("min") ?? ""}
          onChange={(v) => setOne("min", v)}
          opts={[{ value: "", label: "Any score" }, { value: "50", label: "50 or higher" }, { value: "70", label: "70 or higher" }, { value: "85", label: "85 or higher" }]}
        />
      </Menu>
      <Menu label="Activity" count={counts.activity} wide>
        <Title>Latest release</Title>
        <Radios value={sp.get("active") ?? ""} onChange={(v) => setOne("active", v)} opts={[{ value: "", label: "Any time" }, { value: "3", label: "Last 3 months" }, { value: "6", label: "Last 6 months" }, { value: "12", label: "Last year" }]} />
        <Sep />
        <Title>Downloads in 30 days</Title>
        <Radios value={sp.get("dl") ?? ""} onChange={(v) => setOne("dl", v)} opts={[{ value: "", label: "Any" }, { value: "1000", label: "1k or more" }, { value: "10000", label: "10k or more" }, { value: "100000", label: "100k or more" }]} />
        <Sep />
        <Check label="Stable (1.0 or later)" checked={flag("stable")} onChange={() => toggleFlag("stable")} />
      </Menu>
      <Menu label="Trust" count={counts.trust} wide>
        <Check label="Verified publisher" checked={flag("verified")} onChange={() => toggleFlag("verified")} />
        <Check label="Permissive license only" hint="MIT, BSD, Apache" checked={flag("permissive")} onChange={() => toggleFlag("permissive")} />
        <Check label="Include discontinued" checked={flag("disc")} onChange={() => toggleFlag("disc")} />
      </Menu>
      <Menu label="Setup" count={counts.setup}>
        <Check label="Pure Dart only" checked={flag("pure")} onChange={() => toggleFlag("pure")} />
        <Check label="No native setup" checked={flag("nonative")} onChange={() => toggleFlag("nonative")} />
        <Check label="No code generation" checked={flag("nocodegen")} onChange={() => toggleFlag("nocodegen")} />
      </Menu>
      {any && (
        <button type="button" onClick={() => update((p) => [...p.keys()].filter((k) => !["q", "sort"].includes(k)).forEach((k) => p.delete(k)))} className="px-1.5 text-sm text-cobalt hover:underline">
          Clear filters
        </button>
      )}
      <label className="ml-auto flex items-center gap-2 text-sm text-muted">
        Sort
        <select className="field h-8 w-auto py-0 pr-8 text-sm" value={sort} onChange={(e) => setOne("sort", e.target.value === "best" ? "" : e.target.value)}>
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </label>
    </div>
  );
}

function Menu({ label, count, wide = false, children }: { label: string; count: number; wide?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors ${
          count ? "border-cobalt/40 bg-cobalt-wash text-cobalt" : "border-line bg-card text-body hover:border-ink/25 hover:text-ink"
        }`}
      >
        {label}
        {count > 0 && <span className="rounded-sm bg-action px-1 text-[11px] font-semibold leading-4 text-white">{count}</span>}
        <svg viewBox="0 0 16 16" className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>
      {open && (
        <div className={`pop-in absolute left-0 z-30 mt-1.5 max-h-[60vh] overflow-y-auto rounded-lg border border-line bg-card p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.25)] ${wide ? "w-64" : "w-52"}`}>{children}</div>
      )}
    </div>
  );
}

const Sep = () => <div className="my-1.5 border-t border-line-soft" />;
const Title = ({ children }: { children: React.ReactNode }) => <p className="px-2 pb-1 pt-1.5 text-xs font-medium text-muted">{children}</p>;

function Check({ label, hint, checked, onChange, count }: { label: string; hint?: string; checked: boolean; onChange: () => void; count?: number }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-body hover:bg-ink/[0.05] hover:text-ink">
      <input type="checkbox" className="check" checked={checked} onChange={onChange} />
      <span className="flex-1">{label}{hint && <span className="ml-1 text-xs text-muted">{hint}</span>}</span>
      {count != null && <span className="text-xs tabular-nums text-muted">{count}</span>}
    </label>
  );
}

function Checks({ opts, selected, onToggle }: { opts: Opt[]; selected: string[]; onToggle: (v: string) => void }) {
  return <>{opts.map((o) => <Check key={o.value} label={o.label} count={o.count} checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />)}</>;
}

function Radios({ opts, value, onChange }: { opts: Opt[]; value: string; onChange: (v: string) => void }) {
  return (
    <>
      {opts.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-body hover:bg-ink/[0.05] hover:text-ink">
          <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${value === o.value ? "border-[rgb(var(--action))]" : "border-line"}`}>
            {value === o.value && <span className="tick h-2 w-2 rounded-full bg-action" />}
          </span>
          {o.label}
        </button>
      ))}
    </>
  );
}
