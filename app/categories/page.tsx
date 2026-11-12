import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CategoryIndex } from "@/components/CategoryIndex";

export const metadata: Metadata = pageMeta({
  title: "Flutter package categories",
  description: "Every Flutter and Dart package sorted by what it does: state management, networking, storage, UI, maps, payments, testing and 25+ more categories.",
  path: "/categories",
});

export default function CategoriesPage() {
  return (
    <div className="wrap pt-10">
      <h1 className="text-xl">Categories</h1>
      <p className="mb-8 mt-2 max-w-prose text-body">
        A package can sit in several categories. Its main category decides who it&apos;s ranked against for popularity.
      </p>
      <CategoryIndex withBlurb />
    </div>
  );
}
