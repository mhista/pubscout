/* Brand + links. Rename the project here. */
export const SITE = {
  name: "pubscout",
  tagline: "Find the right Flutter package",
  description:
    "Browse Flutter and Dart packages by what they do, filter by what your project needs, and see health scores, strengths and trade-offs before you open pub.dev.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://pubscout.dev",
  repo: "https://github.com/kymaa/pubscout", // PLACEHOLDER
  credit: { label: "Kymaa", href: "https://kymaa.tech" },
};

export const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/categories", label: "Categories" },
  { href: "/compare", label: "Compare" },
  { href: "/about", label: "How scoring works" },
];
