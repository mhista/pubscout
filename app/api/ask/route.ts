import { ask } from "@/lib/ai-search";

// Searches are cached on Vercel's CDN for a day (free), so a popular description costs one AI call, not thousands.
export const dynamic = "force-dynamic";

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 20; // 20 searches per 10 minutes per visitor (per server instance)
}

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
  if (q.length < 3) return Response.json({ error: "Describe what you need in a few words." }, { status: 400 });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (limited(ip)) return Response.json({ error: "Too many searches. Try again in a few minutes." }, { status: 429 });

  const result = await ask(q);
  return Response.json(result, {
    headers: { "Cache-Control": result.mode === "ai" ? "public, s-maxage=86400, stale-while-revalidate=604800" : "public, s-maxage=600" },
  });
}
