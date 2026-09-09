import type { Metadata, Viewport } from "next";
import { Archivo_Black, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { BootSplashController } from "@/components/BootSplashController";
import { BootSplashMage } from "@/components/BootSplashMage";
import "./globals.css";

const display = Archivo_Black({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const ui = Space_Grotesk({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bookly — Turn your PDF into a book",
  description:
    "Upload a PDF and read it with the feeling of turning real pages. Private, local, and simple.",
  applicationName: "Bookly",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bookly",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512-any.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: {
    "msapplication-TileColor": "#fdfceb",
  },
};

export const viewport: Viewport = {
  themeColor: "#fdfceb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

const bootSplashCriticalCss = `
html,body{background:#fdfceb;margin:0;min-height:100%}
#bookly-boot-splash{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background-color:#fdfceb;background-image:linear-gradient(#e8e6d4 1px,transparent 1px),linear-gradient(90deg,#e8e6d4 1px,transparent 1px);background-size:28px 28px;transition:opacity .28s ease,visibility .28s ease}
#bookly-boot-splash.is-done{opacity:0;visibility:hidden;pointer-events:none}
#bookly-boot-splash .boot-mark{display:flex;flex-direction:column;align-items:center;gap:16px;padding:0 16px}
#bookly-boot-splash .boot-stage{display:flex;align-items:center;justify-content:center;width:188px;height:188px;background:#fff;border:3px solid #000;box-shadow:8px 8px 0 #000;position:relative}
#bookly-boot-splash .boot-stage::before{content:"";position:absolute;top:-10px;left:-10px;width:22px;height:22px;background:#c8f542;border:3px solid #000;box-shadow:3px 3px 0 #000}
#bookly-boot-splash .boot-stage::after{content:"";position:absolute;bottom:-8px;right:-8px;width:16px;height:16px;background:#3b5bff;border:3px solid #000}
#bookly-boot-splash .boot-name{font-family:var(--font-display),Impact,Haettenschweiler,sans-serif;font-weight:800;font-size:2rem;letter-spacing:-0.03em;text-transform:uppercase;color:#000;margin:0;line-height:1}
#bookly-boot-splash .boot-tag{font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(0,0,0,.55);margin:0;font-weight:700}
#bookly-boot-splash .boot-mage{display:block;overflow:visible}
#bookly-boot-splash .boot-mage-bob{transform-origin:100px 170px;animation:boot-bob 1.05s ease-in-out infinite}
#bookly-boot-splash .boot-hat{transform-origin:100px 78px;animation:boot-hat 1.2s ease-in-out infinite}
#bookly-boot-splash .boot-page-l{transform-origin:22px 16px;animation:boot-page-l .9s ease-in-out infinite}
#bookly-boot-splash .boot-page-r{transform-origin:22px 16px;animation:boot-page-r .9s ease-in-out infinite .08s}
#bookly-boot-splash .boot-wand{transform-origin:0 8px;animation:boot-wand 1s ease-in-out infinite}
#bookly-boot-splash .boot-wand-tip{transform-origin:28px -12px;animation:boot-twinkle .7s ease-in-out infinite}
#bookly-boot-splash .boot-spark-a{transform-origin:28px 48px;animation:boot-spark 1.1s ease-in-out infinite}
#bookly-boot-splash .boot-spark-b{transform-origin:168px 42px;animation:boot-spark 1.25s ease-in-out infinite .2s}
#bookly-boot-splash .boot-spark-c{transform-origin:178px 94px;animation:boot-spark 1s ease-in-out infinite .35s}
#bookly-boot-splash .boot-dot-a{animation:boot-dot 1.2s ease-in-out infinite}
#bookly-boot-splash .boot-dot-b{animation:boot-dot 1.05s ease-in-out infinite .15s}
#bookly-boot-splash .boot-dot-c{animation:boot-dot .95s ease-in-out infinite .28s}
#bookly-boot-splash .boot-ground{animation:boot-shadow 1.05s ease-in-out infinite}
@keyframes boot-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes boot-hat{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-3deg)}}
@keyframes boot-page-l{0%,100%{transform:rotate(0deg) translateY(0)}50%{transform:rotate(-7deg) translateY(-3px)}}
@keyframes boot-page-r{0%,100%{transform:rotate(0deg) translateY(0)}50%{transform:rotate(9deg) translateY(-4px)}}
@keyframes boot-wand{0%,100%{transform:rotate(0deg)}50%{transform:rotate(8deg)}}
@keyframes boot-twinkle{0%,100%{transform:scale(1) rotate(0deg);opacity:1}50%{transform:scale(1.18) rotate(12deg);opacity:.85}}
@keyframes boot-spark{0%,100%{transform:scale(.85) rotate(0deg);opacity:.55}50%{transform:scale(1.15) rotate(18deg);opacity:1}}
@keyframes boot-dot{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-6px);opacity:1}}
@keyframes boot-shadow{0%,100%{transform:scaleX(1);opacity:.12}50%{transform:scaleX(.88);opacity:.08}}
@media (prefers-reduced-motion:reduce){
#bookly-boot-splash .boot-mage-bob,#bookly-boot-splash .boot-hat,#bookly-boot-splash .boot-page-l,#bookly-boot-splash .boot-page-r,#bookly-boot-splash .boot-wand,#bookly-boot-splash .boot-wand-tip,#bookly-boot-splash .boot-spark-a,#bookly-boot-splash .boot-spark-b,#bookly-boot-splash .boot-spark-c,#bookly-boot-splash .boot-dot-a,#bookly-boot-splash .boot-dot-b,#bookly-boot-splash .boot-dot-c,#bookly-boot-splash .boot-ground{animation:none!important}
#bookly-boot-splash{transition-duration:.15s}
}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${ui.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        {/* Prefetch (not preload) so the ~1.3MB worker never blocks window load / splash. */}
        <link rel="prefetch" href="/pdf.worker.min.mjs" as="script" />
        {/* Critical first-paint styles — cream canvas + splash before CSS chunk loads */}
        <style
          dangerouslySetInnerHTML={{
            __html: bootSplashCriticalCss,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <div id="bookly-boot-splash" aria-hidden="true">
          <div className="boot-mark">
            <div className="boot-stage">
              <BootSplashMage />
            </div>
            <p className="boot-name">Bookly</p>
            <p className="boot-tag">PDF → Book</p>
          </div>
        </div>
        <BootSplashController />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
