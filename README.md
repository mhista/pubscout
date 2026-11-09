# pubscout

A decision guide for Flutter and Dart packages: categories, filters, health scores and AI summaries, with every install sent to pub.dev.

Next.js 15 · React 19 · Tailwind 3 · Geist. Same stack as notraffix-web / acegraphiix. No database yet: the site reads one file, `data/catalog.json`, built by two scripts.

## Run it

```powershell
npm install
npm run dev          # http://localhost:3300
```

It starts on **demo data** (61 well-known packages, illustrative numbers, with a banner saying so). If PowerShell blocks npm scripts, use `npm.cmd`.

## Load real data

```powershell
copy .env.example .env.local   # then fill in the keys you have
npm run data                   # = data:sync + data:build
npm run dev
```

1. **`npm run data:sync`** pulls pub.dev's top packages (its own ranking, `SYNC_LIMIT`, default 2,000) into `data/raw/`: metadata, score, publisher, README/CHANGELOG from the package archive, and GitHub stats when `GITHUB_TOKEN` is set. Later runs only re-download docs for packages that published a new version. Try `npm run data:sync -- --limit 100` first.

   **Progress and resuming.** The sync shows a live progress bar (count, speed, ETA, failures, GitHub quota left). For a line per package (version change, docs downloaded, stars, retries) run `npm run data:sync:v` or `npm run data:sync -- -v`. If a run stops (Ctrl+C, crash, lost connection), run the same command again: packages synced in the last 12 hours (`SYNC_FRESH_HOURS`) are skipped, so it carries on from where it stopped. Add `--force` to redo everything. Press Ctrl+C once to stop cleanly after the packages in flight.
2. **`npm run data:build`** tags, scores and writes `data/catalog.json`. With an AI key it also writes categories and a summary per package, once per version (cached in `data/ai/`). Without one, categories come from keyword rules. `npm run data:build -- --ai-limit 50` caps new AI calls for a quick test.

`npm run data:sample` rebuilds the demo catalog.

### Free AI: Gemini and Groq

Put either key (or both) in `.env.local`:

| Key | Where | Free plan, roughly |
| --- | --- | --- |
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | 3.8 Flash and 3.5 Flash-Lite, 5–10 requests a minute, daily cap per model. New keys start with `AQ.` |
| `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) | GPT-OSS 120B and 20B; 30 requests a minute but only ~8K tokens a minute per model |

`AI_PROVIDERS=gemini,groq` sets the order. Each provider tries its models in order (`GEMINI_MODELS`, `GROQ_MODELS`, written `model@requests-per-minute`). If a model has been retired, it is skipped for the run. When a model hits a per-minute limit it waits and the others carry on; when it hits its daily limit it's switched off for the run. When everything is used up the build finishes with rule-based tags for the rest, and the next run continues where it stopped, because finished summaries are cached. Limits are per Google project / Groq organisation, so extra keys from the same account add nothing. Free-tier requests may be used by the provider to improve its models; that's fine here because the input is public READMEs.

Expect 2,000 packages to take a day or two of runs on free tiers. The nightly workflow does this for you.

### GitHub token

Without it GitHub allows 60 requests an hour, so the sync skips GitHub stats. With it: 5,000.

1. Go to **github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name it `pubscout`, pick an expiry, set **Repository access: Public repositories (read-only)**. Leave every permission at "No access".
3. Copy the token (starts with `github_pat_`) into `.env.local`: `GITHUB_TOKEN=github_pat_...`
4. Run `npm run data:sync` again; stars, issues and contributors now fill in and feed the Maintenance and Community scores.

If you use the GitHub CLI, `gh auth token` prints a token you can paste instead. In the GitHub Action the token is provided automatically.

## How it's put together

| Path | What it does |
| --- | --- |
| `data/taxonomy.json` | The 30 categories (slug, name, blurb, keywords) and "works with" groups. Edit here. |
| `data/overrides.json` | Human category decisions; they always win over rules and AI. `{ "pkg": { "primary": "ui-kits", "secondary": ["games"] } }`, or `{ "hide": true }`. |
| `scripts/lib/classify.mjs` | Rules layer: platforms, license class, kind, works-with, keyword classifier. |
| `scripts/lib/ai.mjs` | Provider chain (Gemini, Groq, Anthropic) with throttling and automatic fallback. |
| `scripts/lib/explain.mjs` | AI layer: one validated JSON call per version (categories + explainer). Bump `PROMPT_VERSION` to regenerate. |
| `scripts/lib/score.mjs` | Health score, sub-scores, caps, warnings and badges, as in the spec. |
| `lib/query.ts` | Search, filters, facet counts and sorting (server side; filters live in the URL). |
| `lib/ai-search.ts`, `app/api/ask` | "Describe what you need" search: embeddings + AI picks. |
| `scripts/lib/embed.mjs` | Builds `data/embeddings.json` during `data:build`. |
| `components/shortlist.tsx` | The shortlist and its pubspec tray (per browser, localStorage). |
| `components/CommandPalette.tsx` | Ctrl/⌘ K search across packages, categories and actions; reads `/api/index`. |
| `components/CategoryNav.tsx` | Docs-style grouped sidebar. Groups come from `groups` in `taxonomy.json`. |
| `app/globals.css` | Light and dark theme variables. Every colour in Tailwind points at one of them. |

## "Describe what you need" search

Type a sentence ("pick photos from the gallery and crop them") into any search box. `/explore` then shows **AI matches** above the normal keyword results:

1. At build time each package gets an embedding (a 256-number fingerprint of what it does) from `gemini-embedding-001`, stored in `data/embeddings.json` (~256 bytes per package, only recomputed when a package's text changes).
2. At search time `/api/ask` embeds the description (one small call), ranks packages by similarity, and asks a fast model (Gemini Flash-Lite, then Groq) to pick the best few and say why.
3. If the AI is busy it falls back to the similarity ranking; without embeddings it falls back to keyword search. Results are cached on Vercel's CDN for a day per description, and each visitor is limited to 20 searches per 10 minutes.

This is the one feature that calls AI from the live site, so the hosted app needs `GEMINI_API_KEY` (and optionally `GROQ_API_KEY`) as Vercel environment variables. Searches share your free quota with the nightly job.

## Pages

`/` search + categories · `/explore` all packages with filters and AI matches · `/c/[slug]` one category · `/p/[name]` package page · `/compare?p=a,b` side by side · `/about` how scoring works.

## Keeping it fresh (no manual indexing)

`.github/workflows/data.yml` runs every night at 03:17 UTC (04:17 Lagos time):

1. sync pub.dev + GitHub (only changed packages re-download their docs),
2. write AI summaries only for packages that don't have one (`AI_REFRESH=major`: a package gets a new summary only on a breaking release),
3. rebuild `data/catalog.json` and commit it; Vercel redeploys on that commit.

Setup, once: push the repo to GitHub, connect it to Vercel, then in **GitHub → Settings → Secrets and variables → Actions** add `GEMINI_API_KEY`, `GROQ_API_KEY` and `GH_PAT` (your GitHub token; the built-in Actions token allows only 1,000 GitHub API calls an hour, a full sync needs ~4,000). To run it immediately: **Actions → Refresh package data → Run workflow**. Change the time by editing the `cron` line (it's UTC).

**Vercel cost.** Package and home pages are prerendered at build time and served as static files, and nothing uses `revalidate`, so the site makes **no ISR reads or writes**. What you do use: one build per day (build minutes), `/explore`, category pages and `/api/ask` run as functions on each request (repeat AI searches are served from the CDN cache), and normal CDN bandwidth. All well inside the Hobby allowance at this size; note Hobby is for non-commercial use.


## Which packages are in the catalog

- **Top packages:** pub.dev's top `SYNC_LIMIT` (2,000) by its own ranking, refreshed nightly.
- **Growing coverage:** every nightly run also adds the next `SYNC_BATCH` (2,000) packages from the ranking, until the catalog covers the top `SYNC_MAX` (6,000 in the workflow). Progress is saved in `data/sync-state.json`. Packages ranked below the top 2,000 are refreshed on a weekly rotation (`TAIL_REFRESH_DAYS`), their GitHub stats every two weeks, and they need at least 100 downloads a month (`TAIL_MIN_DOWNLOADS`) and not be discontinued to be listed. Why stop at 6,000: the whole catalog is one JSON file that the server loads, so past ~6–8k packages pages start slower on a cold start and the free AI quota can't keep summaries current. Going beyond that is the point to move the catalog into a database.
- **Essentials:** `data/essentials.json`, a hand-picked list (theming, maps, code generation, forms…) that always stays, whatever its rank. Edit it freely; names that don't exist are skipped. On the home page, "Essentials you might have missed" lists the ones outside the top 300, and Explore → Trust → "Essentials only" filters to them.
- **Requests:** anyone can ask for a missing package (search box, `/request`, footer). That opens a `package-request` issue on GitHub; the data workflow syncs it, rebuilds, commits and closes the issue, usually within 10 minutes. Requested packages stay for good (`data/requests.json`). Locally: `node scripts/requests.mjs add flutter_map`, then `npm run data:sync -- --requested` and `npm run data:build`.
- **Leaving:** a package that's been out of the top list for 30 days (`STALE_DAYS`) and isn't essential or requested is left out of the catalog, so its numbers never go stale.

**AI summaries never block a build.** When the free quota runs out, the rest of the packages go live with their pub.dev description and are marked "summary pending". Every run summarises essentials and requests first, then by downloads, so pending ones are picked up first next time.

### Turning on package requests (Vercel)

1. GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token. Repository access: only your pubscout repo. Permissions: **Issues: Read and write**. Copy the token.
2. Vercel → your project → Settings → Environment Variables:
   - `GH_REQUEST_TOKEN` = that token
   - `GH_REPO` = `mhista/pubscout`
3. GitHub repo → Settings → Secrets and variables → Actions → **Variables** tab → `SITE_URL` = your live URL (used in the "Added" comment).
4. Redeploy. Until these are set, the request box replies "Requests aren't open right now".

### Support button

Set `NEXT_PUBLIC_SUPPORT_URL` on Vercel to your Buy Me a Coffee (or Ko-fi / GitHub Sponsors) link, then redeploy. A "Support" button appears in the header, a link in the footer, and a short note on the About page. With the variable empty, nothing shows.

## Next steps

- Move `catalog.json` into Supabase (Postgres) once the catalog passes ~5k packages, and put search on Meilisearch/Typesense.
- "Rising" badges start appearing after ~90 days of `data/history.json` snapshots.
- Community tag suggestions feeding `overrides.json`.

Built by [Diwe Innocent](https://diweinnocent.vercel.app).

## Publishing checklist

1. `lib/site.ts`: set `name`, `url` and `repo` (the repo link powers "Report an inaccuracy").
2. Delete the three stub files: `components/HeaderSearch.tsx`, `FilterPanel.tsx`, `SortSelect.tsx`.
3. Run `npm run data` locally once (full sync + build), check `npm run build` passes, commit everything except what `.gitignore` excludes (`.env.local`, `data/raw`, `node_modules`, `.next`).
4. Push to a new GitHub repo. Add `.github/workflows/data.yml` and the Actions secrets `GEMINI_API_KEY`, `GROQ_API_KEY`, `GH_PAT`.
5. Vercel → Add New Project → import the repo (Next.js is detected). Environment variables: `GEMINI_API_KEY`, `GROQ_API_KEY`, `NEXT_PUBLIC_SITE_URL`. Deploy.
6. Optional: add your domain in Vercel → Settings → Domains and update `NEXT_PUBLIC_SITE_URL`.
7. Actions → Refresh package data → Run workflow, to confirm the nightly job can commit and trigger a deploy.
