import type { Metadata, Viewport } from "next";
import { Archivo_Black, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { BootSplashController } from "@/components/BootSplashController";
import "./globals.css";

const display = Archivo_Black({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const ui = Space_Grotesk({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${ui.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preload" href="/pdf.worker.min.mjs" as="script" />
        {/* Critical first-paint styles — cream canvas before CSS chunk loads */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
html,body{background:#fdfceb;margin:0;min-height:100%}
#bookly-boot-splash{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background-color:#fdfceb;background-image:linear-gradient(#e8e6d4 1px,transparent 1px),linear-gradient(90deg,#e8e6d4 1px,transparent 1px);background-size:28px 28px;transition:opacity .32s ease,visibility .32s ease}
#bookly-boot-splash.is-done{opacity:0;visibility:hidden;pointer-events:none}
#bookly-boot-splash .boot-mark{display:flex;flex-direction:column;align-items:center;gap:14px}
#bookly-boot-splash .boot-b{width:72px;height:72px;display:flex;align-items:center;justify-content:center;background:#c8f542;border:3px solid #000;box-shadow:6px 6px 0 #000;font-family:var(--font-display),Impact,Haettenschweiler,sans-serif;font-weight:800;font-size:2rem;color:#000;letter-spacing:-0.03em;text-transform:uppercase}
#bookly-boot-splash .boot-name{font-family:var(--font-display),Impact,Haettenschweiler,sans-serif;font-weight:800;font-size:1.75rem;letter-spacing:-0.03em;text-transform:uppercase;color:#000;margin:0}
#bookly-boot-splash .boot-tag{font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(0,0,0,.55);margin:0;font-weight:700}
`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <div id="bookly-boot-splash" aria-hidden="true">
          <div className="boot-mark">
            <div className="boot-b">B</div>
            <p className="boot-name">Bookly</p>
            <p className="boot-tag">PDF → Book</p>
          </div>
        </div>
        <BootSplashController />
        {children}
      </body>
    </html>
  );
}
