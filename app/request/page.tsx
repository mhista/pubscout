import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { RequestPackage } from "@/components/RequestPackage";

export const metadata: Metadata = pageMeta({
  title: "Request a Flutter package",
  description: "Missing a package? Request any pub.dev package and it\u2019s added to pubscout with a health score and summary, usually within minutes.",
  path: "/request",
});

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name = "" } = await searchParams;
  return (
    <article className="wrap max-w-[640px] pt-10">
      <h1 className="text-xl">Request a package</h1>
      <p className="mt-4 text-[17px] leading-7 text-body">
        Type the package name exactly as it appears on pub.dev. Once it&apos;s added it gets the same health score, summary and comparisons as everything else, and it&apos;s refreshed every night.
      </p>
      <div className="mt-8">
        <RequestPackage initial={name.toLowerCase().replace(/[^a-z0-9_]/g, "")} />
      </div>
    </article>
  );
}
