# Bookly

**Bookly** turns a PDF into a simple digital book — realistic page turns, optional paper sound, and a focused neo-brutal reading UI. Upload a file, open it as a book, turn pages, and read. No accounts, no cloud upload, no document platform baggage.

Built by **[NITIN YADAV](https://www.linkedin.com/in/nitin-yadav-681850299/)** · [GitHub](https://github.com/nitinyadav2188) · [X](https://x.com/nitindotdev)

## Features

- **Landing → Upload → Reader** — three screens, nothing else
- **Realistic page flips** via [StPageFlip](https://github.com/Nodlik/StPageFlip)
- **Local PDF rendering** with PDF.js (files never leave the browser)
- **In-reader annotations** — highlights and sticky notes, saved per document in the browser
- **Download** — keep the original PDF on your device (plus a notes sidecar when you have annotations)
- **Local resume** — the last book is kept in IndexedDB so you can continue reading without re-uploading
- **Page-turn sound** (off until you enable it)
- **Page memory** of the last page for the same file
- **PWA install** for mobile home-screen use
- **Capacitor Android** packaging from the same static export

## Quick start

```bash
npm install
npm run build
npm start
```

Open [http://127.0.0.1:4321](http://127.0.0.1:4321).

For local iteration you can also run `npm run dev` (Next.js Turbopack). Prefer `npm run build && npm start` when testing the flipbook — it serves the static export Capacitor uses.

## Privacy

Your PDF stays private. Bookly opens and renders files **locally in the browser**. Nothing is uploaded to a server. Use **Download** to save the PDF to your device. This browser can also keep a local IndexedDB copy (with annotations) so you can continue reading later — still on your machine, never in the cloud.

## Install on phone

### Progressive Web App

1. Open Bookly in a mobile browser (Chrome on Android, Safari on iOS).
2. Tap **Install Bookly**, or use the browser’s **Add to Home Screen / Install app** action.

A service worker caches a light app shell for offline-friendly revisits. HTML and JS stay network-first so updates are not stuck behind a stale cache. The large PDF.js worker is cached on first use — not during service-worker install — so first-load activate stays fast.

### Android APK (Capacitor)

Requires Android Studio / JDK / Android SDK on your machine.

```bash
# First time
npm run android:init

# Later builds — produces public/downloads/bookly.apk when Gradle succeeds
npm run android:build
```

Open the Android project anytime with:

```bash
npm run android:open
```

When `public/downloads/bookly.apk` exists, the Install dialog shows a **Download Android APK** button (hidden on iOS where APKs are not useful).

## Stack

- **Next.js** (static export) + **React** + **TypeScript** + **Tailwind CSS**
- **PDF.js** for rendering
- **StPageFlip** (`page-flip`) for page curls
- Web App Manifest + service worker for PWA
- **Capacitor** for the Android wrapper

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on port 4321 |
| `npm run build` | Static export to `out/` |
| `npm start` | Serve the export on port 4321 |
| `npm run lint` | ESLint |
| `npm run android:sync` | Build web assets and sync Capacitor |
| `npm run android:build` | Sync + assemble debug APK |
| `npm run android:open` | Open the Android project in Android Studio |
| `npm run android:init` | First-time Capacitor Android setup |

## Author

**NITIN YADAV**

- LinkedIn: [nitin-yadav-681850299](https://www.linkedin.com/in/nitin-yadav-681850299/)
- GitHub: [nitinyadav2188](https://github.com/nitinyadav2188)
- X: [@nitindotdev](https://x.com/nitindotdev)
