# Página 📖

**Página** turns a PDF into a simple digital book — realistic page turns, optional paper sound, and a focused neo-brutal reading experience.

Upload a PDF, open it as a book, turn pages, and read.

**No accounts. No cloud uploads. No unnecessary document-platform features.**

Built by **NITIN YADAV** · [LinkedIn](https://www.linkedin.com/in/nitin-yadav-681850299/) · [GitHub](https://github.com/nitinyadav2188) · [X](https://x.com/nitindotdev)

---

## ✨ Features

* **Landing → Upload → Reader** — three simple screens
* **Realistic page flips** powered by [StPageFlip](https://github.com/Nodlik/StPageFlip)
* **Local PDF rendering** with PDF.js
* **Private by design** — PDFs stay on the user's device
* **Mobile-first page turning** — swipe or drag with your finger
* **Desktop navigation** — Previous / Next buttons and keyboard controls
* **Page-turn sound** — optional and disabled by default
* **In-reader annotations** — highlights and sticky notes
* **Local resume** — continue reading without re-uploading
* **Page memory** — remembers the last page for a document
* **Fullscreen reading**
* **Basic zoom**
* **PDF download**
* **PWA installation** for phones
* **Android APK** support through Capacitor
* **Experience feedback** after meaningful usage

---

## 🎯 How It Works

```text
Upload PDF
     ↓
PDF.js renders the pages locally
     ↓
Página creates the digital book
     ↓
Turn the pages
     ↓
Read
```

The goal is simple:

> **Make a PDF feel like a real book.**

---

## 📱 Mobile Experience

Página is designed around natural touch interaction.

### Finger Page Turning

On mobile:

* Swipe left → **Next page**
* Swipe right → **Previous page**
* Drag a page → **Page follows your finger**
* Tap right side → **Next page**
* Tap left side → **Previous page**

The page should visually follow the user's finger during a drag rather than simply switching to the next page.

If the user doesn't drag far enough, the page smoothly returns to its original position.

---

## 💻 Desktop Experience

On laptops and desktops, page navigation is primarily controlled using buttons.

```text
← Previous        8 / 42        Next →
```

Also support:

* `←` → Previous page
* `→` → Next page
* `Space` → Next page
* Mouse interaction where supported

The book remains the main focus and controls stay minimal.

---

## 📖 Realistic Page Flip

Página uses [StPageFlip](https://github.com/Nodlik/StPageFlip) to create a physical page-turning effect.

A page should:

1. Lift from the edge
2. Follow the user's interaction
3. Curl toward the opposite side
4. Reveal the next page
5. Cast a subtle shadow
6. Settle naturally

Avoid simple slide or fade transitions.

The experience should feel closer to turning paper than changing screens.

---

## 🔊 Page-Turn Sound

Página includes an optional subtle paper sound.

Sound is:

* Off by default
* Played only when a page is successfully turned
* Toggleable from the reader controls
* Designed to remain subtle and non-distracting

Browser autoplay restrictions are respected.

---

## 📝 Annotations

Users can add simple annotations while reading:

* Highlights
* Sticky notes

Annotations are stored locally in the browser and associated with the document.

They do not need an account or cloud storage.

---

## 💾 Local Resume

Página can remember:

* The last opened document
* The last page
* Local annotations

This allows the user to return to a document without uploading it again.

Data is stored locally using **IndexedDB**.

---

## 🔒 Privacy

Your PDF stays private.

Página renders PDFs **locally in the browser**.

Files are not uploaded to a cloud server as part of the core reading experience.

Local data such as:

* PDFs
* Reading position
* Annotations
* Feedback

can be stored in the browser's local storage/IndexedDB.

Nothing needs to leave the user's device.

---

## 📥 Download

Users can download the original PDF directly to their device.

If annotations are present, Página can also provide a notes sidecar containing the user's annotations.

The original PDF itself is not modified.

---

## 📱 Install on Phone

Página is built to work well on mobile devices.

The landing page includes:

**Install on phone**

Depending on the device and browser, Página can:

1. Trigger the PWA installation prompt
2. Provide an Android APK when available
3. Show Add to Home Screen instructions

Users can also simply choose:

**Use in browser**

No installation is required.

---

## 🌐 Progressive Web App

Página supports PWA installation.

### Android

Open Página in Chrome and use:

**Install on phone**

or:

**Install app / Add to Home Screen**

### iOS

Open Página in Safari and use:

**Share → Add to Home Screen**

The PWA includes:

* Web App Manifest
* Service Worker
* Standalone display mode
* App icons
* Offline-friendly application shell

Manifest:

```text
public/manifest.webmanifest
```

The service worker uses a network-first strategy for HTML and JavaScript so new releases are not blocked by stale cached assets.

---

## 🤖 Android APK

Página uses **Capacitor** to package the same web application as an Android app.

### Requirements

* JDK
* Android SDK
* Android Studio
* Capacitor Android project

### First-time setup

```bash
npm run android:init
```

### Build APK

```bash
npm run android:build
```

The debug APK can be copied to:

```text
public/downloads/pagina.apk
```

> **Note:** This repo’s Capacitor build script currently still copies the debug APK to `public/downloads/bookly.apk`. Prefer `pagina.apk` going forward; update the script / install path when renaming the download.

Then rebuild the static site:

```bash
npm run build
```

### Open Android project

```bash
npm run android:open
```

Configure the Android SDK in:

```text
android/local.properties
```

Example:

```properties
sdk.dir=/Users/you/Library/Android/sdk
```

The Android version should support:

* PDF selection
* Finger page turning
* Page-turn sound
* Fullscreen
* Local reading
* Android back button
* Responsive book layout

---

## 🚀 Quick Start

Clone the repository:

```bash
git clone <repository-url>
cd pagina
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

For production testing:

```bash
npm run build
npm start
```

Open:

```text
http://127.0.0.1:4321
```

When testing the flipbook, prefer:

```bash
npm run build && npm start
```

This matches the static export used by the Capacitor Android build.

---

## 🛠️ Tech Stack

* **Next.js** — static export
* **React**
* **TypeScript**
* **Tailwind CSS**
* **PDF.js** — local PDF rendering
* **StPageFlip** — realistic page turning
* **IndexedDB** — local document and annotation storage
* **Web App Manifest** — PWA installation
* **Service Worker** — offline-friendly application shell
* **Capacitor** — Android packaging

---

## 📂 Project Structure

```text
pagina/
├── src/
│   ├── components/
│   │   ├── Upload/
│   │   ├── Reader/
│   │   ├── PageFlip/
│   │   ├── Annotations/
│   │   └── Controls/
│   │
│   ├── services/
│   │   ├── pdf/
│   │   └── storage/
│   │
│   ├── assets/
│   │   └── sounds/
│   │
│   ├── App.tsx
│   └── ...
│
├── public/
│   ├── downloads/
│   ├── icons/
│   └── manifest.webmanifest
│
├── android/
├── capacitor.config.*
├── package.json
└── README.md
```

---

## 📜 Scripts

| Command                 | Purpose                                |
| ----------------------- | -------------------------------------- |
| `npm run dev`           | Start development server on port 4321  |
| `npm run build`         | Build static export to `out/`          |
| `npm start`             | Serve production export on port 4321   |
| `npm run lint`          | Run ESLint                             |
| `npm run android:sync`  | Build web assets and sync Capacitor    |
| `npm run android:build` | Sync and build debug APK               |
| `npm run android:open`  | Open Android project in Android Studio |
| `npm run android:init`  | First-time Capacitor Android setup     |

---

## 💬 Experience Feedback

Página may occasionally ask:

> **How's Página feeling?**

The feedback prompt should appear only after meaningful use, such as:

* First successful page flip
* Approximately 60 seconds in the reader
* Return visit

Users can:

* Submit a rating
* Add an optional comment
* Dismiss the prompt

The prompt should never interrupt the initial upload or first reading experience.

Because Página is a static application with no API routes, feedback can be stored locally.

If Vercel Analytics is enabled, custom events can be recorded:

```text
experience_feedback
experience_feedback_dismiss
```

Comments remain on the user's device unless a backend is intentionally added later.

---

## 🎨 Product Principles

### Simple

Página should do one thing exceptionally well.

### Private

Documents should remain on the user's device.

### Natural

Pages should behave like pages.

### Fast

The reader should remain responsive, including with larger PDFs.

### Mobile-first

Finger interaction is the primary mobile experience.

### Focused

The book should remain the center of attention.

---

## 🗺️ Roadmap

### MVP

* [x] Landing page
* [x] PDF upload
* [x] Local PDF rendering
* [x] Realistic page flipping
* [x] Mobile swipe interaction
* [x] Desktop navigation
* [x] Page-turn sound
* [x] Page counter
* [x] Fullscreen
* [x] Basic zoom
* [x] Local resume
* [x] Local annotations
* [x] PWA installation
* [x] Android APK support

### Future

Potential features:

* Bookmarks
* Reading progress
* Reading themes
* Custom page-turn sounds
* Better offline support
* Additional document formats

New features should only be added when they improve the core reading experience.

---

## 📄 Supported Format

Currently supported:

**PDF**

Other formats may be considered in the future.

---

## 💡 Philosophy

Página isn't trying to become another complicated document platform.

It focuses on one simple idea:

> **Your PDF should feel like a book.**

Upload it.

Open it.

Turn the page.

Read.

---

## 👨‍💻 Author

**NITIN YADAV**

* LinkedIn: [nitin-yadav-681850299](https://www.linkedin.com/in/nitin-yadav-681850299/)
* GitHub: [nitinyadav2188](https://github.com/nitinyadav2188)
* X: [@nitindotdev](https://x.com/nitindotdev)

---

## 📜 License

Add the project's chosen license here.
