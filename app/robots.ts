import type { MetadataRoute } from "next";
import { abs } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    // /og stays crawlable: X, LinkedIn and Slack fetch share images from it.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: abs("/sitemap.xml"),
  };
}
