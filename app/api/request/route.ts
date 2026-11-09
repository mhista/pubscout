import { getPackage } from "@/lib/catalog";

// POST { name } → opens a "Package request: <name>" issue on the repo. The data workflow
// picks it up within a minute, syncs the package and redeploys. Needs two env vars on Vercel:
//   GH_REQUEST_TOKEN  fine-grained token, this repo only, "Issues: Read and write"
//   GH_REPO           owner/repo, e.g. mhista/pubscout
export const dynamic = "force-dynamic";

const NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;
const LABEL = "package-request";
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 6; // 6 requests an hour per visitor
}

const json = (body: object, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim().toLowerCase();
  if (!NAME_RE.test(name)) return json({ status: "invalid", message: "Use the package name exactly as on pub.dev, like flutter_map." }, 400);

  if (getPackage(name)) return json({ status: "exists", message: "Already here.", href: `/p/${name}` });

  const token = process.env.GH_REQUEST_TOKEN;
  const repo = process.env.GH_REPO || "mhista/pubscout";
  if (!token || !repo) return json({ status: "disabled", message: "Requests aren't open right now. Please try again later." }, 503);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (limited(ip)) return json({ status: "limited", message: "You've sent a lot of requests. Try again in an hour." }, 429);

  // Must exist on pub.dev.
  const pub = await fetch(`https://pub.dev/api/packages/${name}`, { headers: { accept: "application/json" } }).catch(() => null);
  if (!pub) return json({ status: "error", message: "Couldn't reach pub.dev. Try again in a moment." }, 502);
  if (pub.status === 404) return json({ status: "not_found", message: `There's no package called "${name}" on pub.dev. Check the spelling.` }, 404);
  const info = await pub.json().catch(() => null);

  const gh = (url: string, init: RequestInit = {}) =>
    fetch(`https://api.github.com/repos/${repo}${url}`, {
      ...init,
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "user-agent": "pubscout", "content-type": "application/json" },
      cache: "no-store",
    });

  // Already requested? Don't open a duplicate.
  const open = await gh(`/issues?labels=${LABEL}&state=open&per_page=100`);
  if (open.ok) {
    const list = (await open.json()) as { title: string }[];
    if (list.some((i) => i.title.toLowerCase().includes(`package request: ${name}`))) {
      return json({ status: "queued", message: "Someone already asked for this one. It's on its way." });
    }
  }

  const created = await gh("/issues", {
    method: "POST",
    body: JSON.stringify({
      title: `Package request: ${name}`,
      labels: [LABEL],
      body: [
        `Requested on pubscout: [\`${name}\`](https://pub.dev/packages/${name})`,
        info?.latest?.pubspec?.description ? `> ${String(info.latest.pubspec.description).slice(0, 300)}` : "",
        "",
        "The data workflow adds it automatically and closes this issue.",
      ].join("\n"),
    }),
  });
  if (!created.ok) return json({ status: "error", message: "Couldn't send the request. Try again later." }, 502);
  return json({ status: "queued", message: "Requested. It usually appears here within 10 minutes." });
}
