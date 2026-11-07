import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap py-24">
      <h1 className="text-xl">That page isn&apos;t here.</h1>
      <p className="mt-3 max-w-prose text-body">If you followed a package link, it may not be in our catalog yet. Search for it, or open it on pub.dev.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/explore" className="btn-cobalt">Search packages</Link>
        <a href="https://pub.dev" className="btn-line">Go to pub.dev</a>
      </div>
    </div>
  );
}
