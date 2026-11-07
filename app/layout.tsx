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

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  openGraph: { title: SITE.name, description: SITE.description, type: "website", siteName: SITE.name },
  twitter: { card: "summary", title: SITE.name, description: SITE.description },
  icons: { icon: "/icon.svg" },
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
