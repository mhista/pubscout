import Link from "next/link";
import type { Flag, Pkg, SubScore } from "@/lib/types";
import { BADGE_LABELS, PLATFORMS, SUB_LABELS, tone, toneBg, toneText } from "@/lib/format";

const ORDER: SubScore[] = ["maintenance", "quality", "popularity", "community", "compatibility"];

/** Five segments, sized by weight; each fills to its sub-score. Reads as one bar at a glance. */
export function HealthStrip({ p, className = "w-[132px]" }: { p: Pkg; className?: string }) {
  const title = ORDER.map((k) => `${SUB_LABELS[k].label}: ${p.scores[k] ?? "n/a"}`).join("\n");
  return (
    <div className={`flex h-1.5 gap-[3px] ${className}`} title={title} role="img" aria-label={`Health ${p.scores.health}. ${title.replace(/\n/g, ", ")}`}>
      {ORDER.map((k, i) => {
        const v = p.scores[k];
        return (
          <span key={k} className="relative overflow-hidden rounded-full bg-line-soft" style={{ flexGrow: SUB_LABELS[k].weight, flexBasis: 0 }}>
            <span className={`bar-fill absolute inset-y-0 left-0 rounded-full ${toneBg[tone(v)]}`} style={{ width: `${v ?? 0}%`, animationDelay: `${120 + i * 70}ms` }} />
          </span>
        );
      })}
    </div>
  );
}

export function HealthNumber({ value, size = "md" }: { value: number; size?: "md" | "xl" }) {
  return (
    <span className={`font-semibold tabular-nums ${toneText[tone(value)]} ${size === "xl" ? "text-2xl" : "text-md"}`}>{value}</span>
  );
}

export function Platforms({ p, dense = false }: { p: Pkg; dense?: boolean }) {
  if (p.kind === "dart") return <span className="text-xs text-body">All platforms (pure Dart)</span>;
  return (
    <span className="inline-flex flex-wrap gap-x-2 gap-y-0.5 text-xs" aria-label={`Platforms: ${p.platforms.join(", ") || "none listed"}`}>
      {PLATFORMS.map(({ key, short }) => {
        const on = p.platforms.includes(key);
        return (
          <span key={key} className={on ? "text-ink" : "text-muted/60 line-through decoration-muted/40"} aria-hidden>
            {dense ? short.replace("Windows", "Win") : short}
          </span>
        );
      })}
    </span>
  );
}

const FLAG_STYLE: Record<Flag["level"], string> = {
  bad: "border-poor/30 bg-poor-wash text-poor",
  warn: "border-fair/30 bg-fair-wash text-fair",
  info: "border-line bg-ground text-body",
};

export function FlagChips({ flags, include = ["bad", "warn"] }: { flags: Flag[]; include?: Flag["level"][] }) {
  const shown = flags.filter((f) => include.includes(f.level));
  if (!shown.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {shown.map((f) => (
        <span key={f.code} title={f.detail} className={`inline-flex items-center rounded-sm border px-1.5 py-px text-xs font-medium ${FLAG_STYLE[f.level]}`}>
          {f.label}
        </span>
      ))}
    </span>
  );
}

export function FlagList({ flags }: { flags: Flag[] }) {
  if (!flags.length) return <p className="text-sm text-body">No warnings.</p>;
  return (
    <ul className="space-y-2.5">
      {flags.map((f) => (
        <li key={f.code} className={`rounded border px-3 py-2.5 text-sm ${FLAG_STYLE[f.level]}`}>
          <span className="font-semibold">{f.label}.</span> <span className="text-ink/80">{f.detail}</span>
        </li>
      ))}
    </ul>
  );
}

export function Badges({ p }: { p: Pkg }) {
  if (!p.badges.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {p.badges.map((b) => (
        <span key={b} className="inline-flex items-center rounded-sm bg-cobalt-wash px-1.5 py-px text-xs font-medium text-cobalt">
          {BADGE_LABELS[b] ?? b}
        </span>
      ))}
    </span>
  );
}

export function CategoryChip({ slug, name, primary = false }: { slug: string; name: string; primary?: boolean }) {
  return (
    <Link href={`/c/${slug}`} className={`chip ${primary ? "border-ink/25 text-ink" : ""}`}>
      {name}
    </Link>
  );
}

export function PkgName({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`font-mono font-medium tracking-[-0.01em] ${className}`}>{name}</span>;
}

export function Arrow({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path d="M5 11 11 5M6.5 5H11v4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
