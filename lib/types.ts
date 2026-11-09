export type ScorePart = { key: string; label: string; weight: number; value: number | null; raw: string };
export type SubScore = "maintenance" | "quality" | "popularity" | "community" | "compatibility";

export type Flag = { code: string; label: string; detail: string; level: "bad" | "warn" | "info" };
export type Badge = "flutter-favorite" | "wasm" | "material-ui" | "rock-solid" | "rising";
export type CategoryTag = { slug: string; primary: boolean; confidence: number; source: "rule" | "llm" | "human" | "community" };

export type Explainer = {
  whatItDoes: string;
  useWhen: string[];
  avoidWhen: string[];
  strengths: string[];
  weaknesses: string[];
  setupEffort: "low" | "medium" | "high";
  setupNotes: string;
  alternatives: { name: string; why_pick_it: string }[];
  example: string;
  model: string;
  forVersion: string;
  generatedAt: string | null;
};

export type Pkg = {
  name: string;
  version: string;
  description: string;
  oneLiner: string;
  published: string;
  firstPublished: string;
  repository: string | null;
  homepage: string | null;
  publisher: string | null;
  topics: string[];
  platforms: string[];
  wasm: boolean;
  flutterFavorite: boolean;
  dart3: boolean;
  license: string | null;
  licenseClass: "permissive" | "weak-copyleft" | "copyleft" | "unknown";
  kind: "dart" | "flutter" | "plugin" | "ffi";
  sdkFlutterMin: string | null;
  sdkDartMin: string | null;
  discontinued: boolean;
  replacedBy: string | null;
  dependencyCount: number;
  usesCodegen: boolean;
  hasExample: boolean | null;
  worksWith: string[];
  categories: CategoryTag[];
  primaryCategory: string | null;
  approach: string[];
  metrics: {
    downloads30d: number;
    likes: number;
    points: number | null;
    maxPoints: number | null;
    stars: number | null;
    openIssues: number | null;
    contributors: number | null;
    lastCommit: string | null;
    archived: boolean;
  };
  majorBumpsLastYear: number;
  explainer: Explainer | null;
  scores: {
    health: number;
    cap: { at: number; why: string } | null;
    partial: boolean;
    breakdown: Record<SubScore, ScorePart[]>;
  } & Record<SubScore, number | null>;
  flags: Flag[];
  badges: Badge[];
  /** Has docs but no AI summary yet; the next data run will try again. */
  summaryPending?: boolean;
  /** Hand-picked in data/essentials.json. */
  essential?: boolean;
  /** Position in pub.dev's ranking at the last sync, if known. */
  rank?: number | null;
  /** Packages that could replace this one. */
  alternatives: string[];
  /** Packages that work with this one, and how. */
  related: { name: string; relation: "uses" | "built-on" | "family" | "tooling" }[];
  syncedAt: string | null;
};

export type Category = { slug: string; name: string; blurb: string; count: number; group?: string };

export type Catalog = {
  generatedAt: string;
  source: "sample" | "pub.dev";
  count: number;
  categories: Category[];
  worksWith: { slug: string; name: string }[];
  packages: Pkg[];
};
