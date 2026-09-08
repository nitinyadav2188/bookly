# Bookly

Turn a PDF into a simple, beautiful digital book — with realistic page turns and a subtle paper sound.

Bookly is a focused reading tool, not a document platform. Upload a PDF, open it as a book, turn pages, and read. Everything stays private on your device.

## Features

- **Landing → Upload → Reader** — three screens, nothing else
- **Realistic page flips** via [StPageFlip](https://github.com/Nodlik/StPageFlip)
- **Local PDF rendering** with PDF.js (files never leave the browser)
- **Page-turn sound** (off until you enable it)
- **Session memory** of the last page for the same file
- **PWA install** for mobile home-screen use
- **Capacitor Android** packaging from the same codebase

## Quick start

```bash
npm install
npm run build
npm start
```

Open [http://127.0.0.1:4321](http://127.0.0.1:4321).

For local iteration you can also run `npm run dev` (Next.js turbopack). Prefer `npm run build && npm start` when testing the flipbook — it serves the static export Capacitor uses.

## Privacy

Your PDF stays private. Bookly opens and renders files **locally in the browser**. Nothing is uploaded to a server. Closing the tab clears the document; only the last page index is kept in `sessionStorage` for the current browser session.

## Install on phone

### Progressive Web App

1. Open Bookly in a mobile browser (Chrome on Android, Safari on iOS).
2. Tap **Install Bookly**, or use the browser’s **Add to Home Screen / Install app** action.

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

When `public/downloads/bookly.apk` exists, the Install dialog shows a **Download Android APK** button.

## Stack

- Next.js (static export) + React + TypeScript + Tailwind CSS
- PDF.js for rendering
- StPageFlip for page curls
- Web App Manifest + service worker for PWA
- Capacitor for the Android wrapper

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on port 4321 |
| `npm run build` | Static export to `out/` |
| `npm start` | Serve the export on port 4321 |
| `npm run android:sync` | Build web assets and sync Capacitor |
| `npm run android:build` | Sync + assemble debug APK |
