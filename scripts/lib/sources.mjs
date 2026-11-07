import zlib from "node:zlib";
import { getUrl } from "./util.mjs";

const PUB = "https://pub.dev/api";

/** pub.dev's documented "top package names" list, in pub.dev's ranking order. */
export async function topPackageNames() {
  const data = await getUrl(`${PUB}/package-name-completion-data`, { headers: { "accept-encoding": "gzip" } });
  return data?.packages ?? [];
}

export async function pubPackage(name) {
  const [info, score, publisher] = await Promise.all([
    getUrl(`${PUB}/packages/${name}`),
    getUrl(`${PUB}/packages/${name}/score`),
    getUrl(`${PUB}/packages/${name}/publisher`),
  ]);
  if (!info) return null;
  const latest = info.latest ?? {};
  const pubspec = latest.pubspec ?? {};
  const versions = (info.versions ?? []).map((v) => ({ version: v.version, published: v.published }));
  return {
    name,
    version: latest.version,
    published: latest.published,
    firstPublished: versions[0]?.published ?? latest.published,
    archiveUrl: latest.archive_url,
    description: pubspec.description ?? "",
    repository: pubspec.repository ?? null,
    homepage: pubspec.homepage ?? null,
    issueTracker: pubspec.issue_tracker ?? null,
    topics: pubspec.topics ?? [],
    dependencies: Object.keys(pubspec.dependencies ?? {}),
    sdk: { dart: pubspec.environment?.sdk ?? null, flutter: pubspec.environment?.flutter ?? null },
    isPlugin: Boolean(pubspec.flutter?.plugin),
    discontinued: Boolean(info.isDiscontinued),
    replacedBy: info.replacedBy ?? null,
    versions: versions.slice(-60),
    score: {
      points: score?.grantedPoints ?? null,
      maxPoints: score?.maxPoints ?? null,
      likes: score?.likeCount ?? 0,
      downloads30d: score?.downloadCount30Days ?? 0,
      tags: score?.tags ?? [],
    },
    publisher: publisher?.publisherId ?? null,
  };
}

/** Pull README + CHANGELOG text and the presence of example/ out of the package archive (.tar.gz). */
export async function archiveDocs(url, maxBytes = 15 * 1024 * 1024) {
  if (!url) return null;
  const buf = await getUrl(url, { as: "buffer" });
  if (!buf || buf.length > maxBytes) return null;
  const tar = zlib.gunzipSync(buf);
  const out = { readme: "", changelog: "", hasExample: false };
  for (let off = 0; off + 512 <= tar.length; ) {
    const header = tar.subarray(off, off + 512);
    if (header[0] === 0) break;
    const name = header.toString("utf8", 0, 100).replace(/\0.*$/s, "").replace(/^\.\//, "");
    const size = parseInt(header.toString("utf8", 124, 136).replace(/\0.*$/s, "").trim() || "0", 8);
    const body = off + 512;
    const lower = name.toLowerCase();
    if (lower === "readme.md") out.readme = tar.toString("utf8", body, body + size).slice(0, 24_000);
    else if (lower === "changelog.md") out.changelog = tar.toString("utf8", body, body + size).slice(0, 6_000);
    else if (lower.startsWith("example/")) out.hasExample = true;
    off = body + Math.ceil(size / 512) * 512;
  }
  return out;
}

/** owner/repo from a pubspec repository or homepage URL, GitHub only. */
export function githubSlug(...urls) {
  for (const u of urls) {
    const m = u && String(u).match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?]|$)/i);
    if (m) return `${m[1]}/${m[2]}`;
  }
  return null;
}

export async function githubStats(slug, token) {
  const headers = { accept: "application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const repo = await getUrl(`https://api.github.com/repos/${slug}`, { headers });
  if (!repo) return null;
  // Contributors: count of the first page (cap 100) is enough to tell 1 from many.
  const contributors = await getUrl(`https://api.github.com/repos/${slug}/contributors?per_page=100&anon=0`, { headers }).catch(() => null);
  return {
    slug,
    stars: repo.stargazers_count ?? 0,
    openIssues: repo.open_issues_count ?? 0,
    pushedAt: repo.pushed_at ?? null,
    archived: Boolean(repo.archived),
    contributors: Array.isArray(contributors) ? contributors.length : null,
  };
}
