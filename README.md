# Página

**Página** turns a PDF into a simple digital book — realistic page turns, optional paper sound, and a focused neo-brutal reading UI. Upload a file, open it as a book, turn pages, and read. No accounts, no cloud upload, no document platform baggage.

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
- **Experience feedback** — optional neo-brutal popup after meaningful use (first page flip, ~60s in reader, or a return visit). Rating + optional comment; dismissible with a ~10-day snooze

## Quick start

```bash
npm install
npm run build
npm start
```

Open [http://127.0.0.1:4321](http://127.0.0.1:4321).

For local iteration you can also run `npm run dev` (Next.js Turbopack). Prefer `npm run build && npm start` when testing the flipbook — it serves the static export Capacitor uses.

## Privacy

Your PDF stays private. Página opens and renders files **locally in the browser**. Nothing is uploaded to a server. Use **Download** to save the PDF to your device. This browser can also keep a local IndexedDB copy (with annotations) so you can continue reading later — still on your machine, never in the cloud.

## Experience feedback

Página may ask “How’s Página feeling?” after you’ve actually used it — not on first paint. Triggers: first successful page flip, about a minute in the reader, or ~50s into a return visit. **Not now** / submit snoozes the prompt for this session and about 10 days (`localStorage`).

Because this is a **static export** (no API routes), feedback is recorded as:

1. **Vercel Analytics** custom events — `experience_feedback` (with `rating`, `hasComment`, `trigger`) and `experience_feedback_dismiss`. Enable Web Analytics on the Vercel project; custom events appear in the Analytics dashboard.
2. **Local log** — each submission is stored in IndexedDB (`bookly-feedback`) and mirrored in `localStorage` (`bookly-feedback-log`) so nothing is lost offline. Comments never leave the device unless you later add a backend.

## Install on phone

Página is built for phones first. On the landing page:

1. Tap **Install on phone** (hero, header, sticky bar, or the Get the app section).
2. Página tries, in order:
   - **PWA install** (`beforeinstallprompt`) when the browser supports it
   - **Android APK** download from `/downloads/bookly.apk` when that file is present
   - Clear **Add to Home Screen** steps (Safari / Chrome) otherwise

You can always **use in browser** with no install — same private local reader.

### Progressive Web App

1. Open Página in a mobile browser (Chrome on Android, Safari on iOS).
2. Tap **Install on phone**, or use the browser’s **Add to Home Screen / Install app** action.

A service worker caches a light app shell for offline-friendly revisits. HTML and JS stay network-first so updates are not stuck behind a stale cache. The large PDF.js worker is cached on first use — not during service-worker install — so first-load activate stays fast.

Manifest: `public/manifest.webmanifest` (`display: standalone`, cream theme, 192/512 icons + Apple touch icon).

### Android APK (Capacitor)

Requires **JDK**, **Android SDK**, and (for first-time setup) the Capacitor Android project.

```bash
# First time (creates android/ if needed)
npm run android:init

# Later builds — copies the debug APK to public/downloads/bookly.apk
npm run android:build

# Then rebuild the static site so the APK is in the export
npm run build
```

Open the Android project anytime with:

```bash
npm run android:open
```

When `public/downloads/bookly.apk` exists and is reachable, Install starts that download on Android (skipped on iOS). If the APK is missing, Install falls back to Add-to-Home-Screen steps and the modal notes how to build the APK.

Point `android/local.properties` at your SDK, for example:

```properties
sdk.dir=/Users/you/Library/Android/sdk
```

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
