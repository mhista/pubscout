"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";
const KEY = "pubscout.theme";

/** Runs before paint (inlined in <head>) so there's no flash of the wrong theme. */
export const themeScript = `try{var t=localStorage.getItem('${KEY}');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}`;

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(mode: Mode) {
  try {
    if (mode === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {}
  apply(mode);
  window.dispatchEvent(new CustomEvent("pubscout:theme", { detail: mode }));
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    try {
      setMode((localStorage.getItem(KEY) as Mode) || "system");
    } catch {}
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onSys = () => {
      try {
        if (!localStorage.getItem(KEY)) apply("system");
      } catch {}
    };
    const onSet = (e: Event) => setMode((e as CustomEvent<Mode>).detail);
    mq.addEventListener("change", onSys);
    window.addEventListener("pubscout:theme", onSet);
    return () => {
      mq.removeEventListener("change", onSys);
      window.removeEventListener("pubscout:theme", onSet);
    };
  }, []);

  const next: Mode = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
  const label = { light: "Light theme", dark: "Dark theme", system: "System theme" }[mode];
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-body hover:bg-ink/[0.06] hover:text-ink"
      aria-label={`${label}. Switch to ${next}`}
      title={label}
    >
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
        {mode === "light" && (
          <>
            <circle cx="10" cy="10" r="3.5" />
            <path d="M10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1 1M14.3 14.3l1 1M4.7 15.3l1-1M14.3 5.7l1-1" />
          </>
        )}
        {mode === "dark" && <path d="M16 12.2A6.5 6.5 0 0 1 7.8 4a6.5 6.5 0 1 0 8.2 8.2Z" />}
        {mode === "system" && (
          <>
            <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
            <path d="M7 16.5h6M10 13.5v3" />
          </>
        )}
      </svg>
    </button>
  );
}
