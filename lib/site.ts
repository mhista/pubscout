/* Brand + links. Rename the project here. */
/** Flip to true once a payout method is set up (see README → Support button). */
const SUPPORT_ENABLED = false;

export const SITE = {
  name: "pubscout",
  tagline: "Find the right Flutter package",
  description:
    "Browse Flutter and Dart packages by what they do, filter by what your project needs, and see health scores, strengths and trade-offs before you open pub.dev.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://pubscout-dev.vercel.app",
  repo: "https://github.com/mhista/pubscout",
  credit: { label: "Diwe Innocent", href: "https://diweinnocent.vercel.app" },
  // Support link (GitHub Sponsors, a Paystack payment page, Selar…). Set NEXT_PUBLIC_SUPPORT_URL on Vercel,
  // or paste the link here. The button is hidden while this is empty.
  // SUPPORT_ENABLED is the master switch: false hides the button everywhere, even if the env var is set.
  support: { label: process.env.NEXT_PUBLIC_SUPPORT_LABEL || "Support pubscout", href: SUPPORT_ENABLED ? process.env.NEXT_PUBLIC_SUPPORT_URL || "" : "" },
};

export const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/categories", label: "Categories" },
  { href: "/compare", label: "Compare" },
  { href: "/about", label: "How scoring works" },
];
