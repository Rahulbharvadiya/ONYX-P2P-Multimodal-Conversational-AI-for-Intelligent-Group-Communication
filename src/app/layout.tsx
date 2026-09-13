import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider, themeScript } from "@/components/theme-provider";
import { SessionProvider } from "@/components/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { NetworkProvider } from "@/components/network-provider";

/**
 * §2.3 typography — Inter + JetBrains Mono, self-hosted.
 *
 * The files in ./fonts are the SIL OFL 1.1 releases of both families
 * (licences committed alongside them), subset to the ranges below. They are
 * served from our own origin, so:
 *   - no request to a third-party font CDN (no privacy exposure, and the
 *     build no longer depends on fonts.googleapis.com being reachable);
 *   - next/font locally derives the fallback metrics, which removes the
 *     layout shift the system-font fallback used to cause on first paint.
 *
 * The Latin-Extended subset is declared as a second family rather than a
 * second @font-face for the same one: next/font cannot express
 * unicode-range, and two faces with identical family/weight/style would
 * make the last declaration win outright. As a family further down the
 * stack it is only fetched when a glyph actually needs it (preload: false).
 */
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: true,
});

const interExt = localFont({
  src: "./fonts/inter-latin-ext-wght-normal.woff2",
  variable: "--font-inter-ext",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-jetbrains-mono",
  weight: "100 800",
  style: "normal",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "ONYX — AI chat, alone or together",
    template: "%s · ONYX",
  },
  description:
    "A modern AI chat platform: private 1:1 AI chat plus opt-in AI participation inside multi-user rooms. Streaming, moderated, and built for teams.",
  openGraph: {
    title: "ONYX — AI chat, alone or together",
    description:
      "Private 1:1 AI chat plus opt-in AI participation inside multi-user rooms.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`antialiased ${inter.variable} ${interExt.variable} ${jetbrainsMono.variable}`}
      >
        <ThemeProvider>
          <NetworkProvider>
            <ToastProvider>
              <SessionProvider>{children}</SessionProvider>
            </ToastProvider>
          </NetworkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
