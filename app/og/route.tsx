import { ImageResponse } from "next/og";

// Social share image (1200×630) for every page: /og?title=…&sub=…&score=…&kind=…
// Runs at the edge and is cached by the CDN for a week, so each image is drawn once.
export const runtime = "edge";

const tone = (n: number) => (n >= 75 ? "#3FB97E" : n >= 50 ? "#E0A33A" : "#E26A5C");

// Geist, the site's own font (copied from the geist package), loaded once per edge instance.
const fonts = Promise.all([
  fetch(new URL("./Geist-Regular.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
  fetch(new URL("./Geist-Bold.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
]);

export async function GET(req: Request) {
  const [regular, bold] = await fonts;
  const sp = new URL(req.url).searchParams;
  const title = (sp.get("title") ?? "pubscout").slice(0, 90);
  const sub = (sp.get("sub") ?? "Find the right Flutter package").slice(0, 180);
  const kind = (sp.get("kind") ?? "").slice(0, 40);
  const score = sp.get("score") ? Math.max(0, Math.min(100, Number(sp.get("score")) || 0)) : null;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: "#0A111C", color: "#E8EDF5", fontFamily: "Geist", backgroundImage: "radial-gradient(circle at 85% 15%, rgba(99,102,241,0.25), transparent 45%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", width: 48, height: 48, borderRadius: 10, background: "#E8EDF5", color: "#0A111C", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700 }}>{">_"}</div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>pubscout</div>
          {kind ? <div style={{ display: "flex", marginLeft: 12, fontSize: 24, color: "#8D99AE", border: "1px solid #2A3547", borderRadius: 999, padding: "4px 16px" }}>{kind}</div> : null}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: score != null ? 820 : 1050 }}>
            <div style={{ display: "flex", fontSize: title.length > 40 ? 64 : 80, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
            <div style={{ display: "flex", marginTop: 24, fontSize: 30, lineHeight: 1.35, color: "#AAB4C5" }}>{sub}</div>
          </div>
          {score != null && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 28px", borderRadius: 20, border: `3px solid ${tone(score)}` }}>
              <div style={{ display: "flex", fontSize: 88, fontWeight: 700, color: tone(score), lineHeight: 1 }}>{String(score)}</div>
              <div style={{ display: "flex", fontSize: 22, color: "#8D99AE", marginTop: 6 }}>health</div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", fontSize: 22, color: "#6B778C" }}>Flutter & Dart packages by category · health scores · alternatives</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: bold, weight: 700, style: "normal" },
      ],
      headers: { "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400" },
    },
  );
}
