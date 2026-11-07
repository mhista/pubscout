import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

/* pubscout tokens.
   Light: cool porcelain ground, navy ink. Dark: deep navy ground, porcelain ink.
   One action colour (cobalt), three score colours.
   Navy panels are reserved for real code: the pubspec search and the shortlist tray.
   Components use these names only — never raw hex. */
export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    screens: { sm: "640px", md: "820px", lg: "1080px", xl: "1320px" },
    extend: {
      /* Every colour is a CSS variable (see globals.css), so light and dark share one set of names. */
      colors: {
        ground: v("ground"),
        card: v("card"),
        line: v("line"),
        "line-soft": v("line-soft"),
        ink: v("ink"),
        body: v("body"),
        muted: v("muted"),
        cobalt: { DEFAULT: v("cobalt"), deep: v("cobalt-deep"), wash: v("cobalt-wash") },
        action: { DEFAULT: v("action"), hover: v("action-hover") },
        good: { DEFAULT: v("good"), wash: v("good-wash") },
        fair: { DEFAULT: v("fair"), wash: v("fair-wash") },
        poor: { DEFAULT: v("poor"), wash: v("poor-wash") },
        code: { bg: v("code-bg"), line: v("code-line"), key: "#9DB0FF", val: "#E8EEF9", dim: "#6B7A90", caret: "#7B8BFF" },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      /* 1.25 scale from a 16px base */
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "26px" }],
        md: ["20px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
        lg: ["25px", { lineHeight: "32px", letterSpacing: "-0.02em" }],
        xl: ["31px", { lineHeight: "38px", letterSpacing: "-0.025em" }],
        "2xl": ["39px", { lineHeight: "44px", letterSpacing: "-0.03em" }],
        hero: ["clamp(2.6rem, 5.6vw, 4.4rem)", { lineHeight: "1", letterSpacing: "-0.045em" }],
      },
      borderRadius: { sm: "6px", DEFAULT: "8px", lg: "12px", xl: "16px" },
      maxWidth: { site: "1280px", prose: "68ch" },
      transitionTimingFunction: { out: "cubic-bezier(.16,1,.3,1)" },
    },
  },
  plugins: [],
} satisfies Config;
