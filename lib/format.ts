export const PLATFORMS = [
  { key: "android", short: "Android" },
  { key: "ios", short: "iOS" },
  { key: "web", short: "Web" },
  { key: "windows", short: "Windows" },
  { key: "macos", short: "macOS" },
  { key: "linux", short: "Linux" },
] as const;

export function compact(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function ago(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "unknown";
  const d = Math.max(0, (now - Date.parse(iso)) / 86_400_000);
  if (d < 1) return "today";
  if (d < 2) return "yesterday";
  if (d < 14) return `${Math.round(d)} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  if (d < 365) return `${Math.round(d / 30.4)} months ago`;
  const y = d / 365;
  return y < 1.5 ? "a year ago" : `${Math.round(y)} years ago`;
}

export type Tone = "good" | "fair" | "poor" | "none";
export const tone = (v: number | null | undefined): Tone => (v == null ? "none" : v >= 75 ? "good" : v >= 50 ? "fair" : "poor");

export const toneText: Record<Tone, string> = { good: "text-good", fair: "text-fair", poor: "text-poor", none: "text-muted" };
export const toneBg: Record<Tone, string> = { good: "bg-good", fair: "bg-fair", poor: "bg-poor", none: "bg-line" };

export const SUB_LABELS = {
  maintenance: { label: "Maintenance", weight: 30, help: "How recently and how often it ships." },
  quality: { label: "Quality", weight: 20, help: "Pub points, an example app, and how often it breaks its API." },
  popularity: { label: "Popularity", weight: 20, help: "Downloads and likes, ranked against its own category." },
  community: { label: "Community", weight: 15, help: "Contributors, verified publisher, Flutter Favorite." },
  compatibility: { label: "Compatibility", weight: 15, help: "Dart 3, platform coverage, WASM." },
} as const;

export const BADGE_LABELS: Record<string, string> = {
  "flutter-favorite": "Flutter Favorite",
  wasm: "WASM-ready",
  "material-ui": "Uses material_ui",
  "rock-solid": "Rock solid",
  rising: "Rising",
};

export const KIND_LABELS = { dart: "Pure Dart", flutter: "Flutter widgets", plugin: "Plugin (native code)", ffi: "FFI (native library)" } as const;

export const pubUrl = (name: string) => `https://pub.dev/packages/${name}`;
export const caret = (version: string) => (version.includes("-") ? version : `^${version}`);
