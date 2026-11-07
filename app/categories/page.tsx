import type { Metadata } from "next";
import { CategoryIndex } from "@/components/CategoryIndex";

export const metadata: Metadata = { title: "Categories" };

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
