import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { SITE } from "@/lib/site";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SampleNotice } from "@/components/SampleNotice";
import { ShortlistTray } from "@/components/shortlist";
import { CommandPalette } from "@/components/CommandPalette";
import { themeScript } from "@/components/ThemeToggle";

const ogDefault = `/og?${new URLSearchParams({ title: "Find the right Flutter package", sub: SITE.description.slice(0, 150) })}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.credit.label, url: SITE.credit.href }],
  creator: SITE.credit.label,
  keywords: ["Flutter packages", "Dart packages", "pub.dev", "best Flutter packages", "Flutter package comparison", "Flutter state management", "Flutter libraries", "package health score"],
  category: "technology",
  openGraph: { title: `${SITE.name}: ${SITE.tagline}`, description: SITE.description, type: "website", siteName: SITE.name, url: "/", locale: "en_US", images: [{ url: ogDefault, width: 1200, height: 630, alt: SITE.tagline }] },
  twitter: { card: "summary_large_image", title: `${SITE.name}: ${SITE.tagline}`, description: SITE.description, images: [ogDefault] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  // Search Console / Bing Webmaster ownership: set these on Vercel after adding the site there.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F4F7" },
    { media: "(prefers-color-scheme: dark)", color: "#0A111C" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-card focus:px-4 focus:py-2">
          Skip to content
        </a>
        <SampleNotice />
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <ShortlistTray />
        <CommandPalette />
      </body>
    </html>
  );
}
