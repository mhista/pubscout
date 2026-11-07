import { getCatalog } from "@/lib/catalog";

/** Shown only while the site runs on the bundled demo data. */
export function SampleNotice() {
  if (getCatalog().source !== "sample") return null;
  return (
    <div className="border-b border-fair/25 bg-fair-wash text-sm text-ink">
      <p className="wrap py-2">
        You&apos;re looking at demo data: the numbers on this site are illustrative, not real pub.dev figures.
      </p>
    </div>
  );
}
