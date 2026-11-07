"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useShortlist } from "./shortlist";

export function CompareAdd({ current, names }: { current: string[]; names: string[] }) {
  const router = useRouter();
  const [v, setV] = useState("");
  const { items } = useShortlist();
  const go = (list: string[]) => router.push(`/compare?p=${list.join(",")}`);
  const fromShortlist = items.map((i) => i.name).filter((n) => !current.includes(n));
  return (
    <div className="flex flex-wrap items-center gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = v.trim();
          if (n && names.includes(n) && !current.includes(n)) go([...current, n].slice(-4));
          setV("");
        }}
      >
        <label htmlFor="cmp" className="sr-only">Add a package</label>
        <input id="cmp" list="cmp-names" value={v} onChange={(e) => setV(e.target.value)} placeholder="Add a package" className="field h-9 w-56 font-mono" autoComplete="off" />
        <datalist id="cmp-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
        <button className="btn-line h-9 min-h-0" type="submit">Add</button>
      </form>
      {fromShortlist.length > 0 && current.length < 4 && (
        <button type="button" className="text-sm text-cobalt hover:underline" onClick={() => go([...current, ...fromShortlist].slice(0, 4))}>
          Add from your shortlist ({fromShortlist.length})
        </button>
      )}
    </div>
  );
}
