# Página 

**Página** turns a PDF into a simple digital book — realistic page turns, optional paper sound, and a focused neo-brutal reading experience.

Upload a PDF, open it as a book, turn pages, and read.

**Guest-first.** Upload and read without an account. Optional sign-in is identity only — PDFs stay local.

---

## Features

* **Landing → Upload → Reader** — three simple screens
* **Optional accounts** — Auth.js email/password (+ Google when configured)
* **Realistic page flips**
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

## How It Works

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

## Privacy

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

## Install on Phone

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

## Tech Stack

* **Next.js** — server build for Auth.js; optional static export via `build:static` for Capacitor
* **React**
* **TypeScript**
* **Tailwind CSS**
* **Auth.js (NextAuth v5)** — email/password + optional Google
* **SQLite (better-sqlite3)** — local user accounts (`DATABASE_URL`)
* **PDF.js** — local PDF rendering
* **StPageFlip** — realistic page turning
* **IndexedDB** — local document and annotation storage
* **Web App Manifest** — PWA installation
* **Service Worker** — offline-friendly application shell
* **Capacitor** — Android packaging

### Auth env

Copy `.env.example` → `.env.local`. Required: `AUTH_SECRET`, `DATABASE_URL`. Optional: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

```bash
npm run dev          # http://127.0.0.1:4321
npm run build && npm start
npm run build:static # Capacitor / serve-out path (no auth API)
```

---

## Author

**NITIN YADAV(Founder)**

* LinkedIn: [Linkedin](https://www.linkedin.com/in/nitin-yadav-681850299/)
* GitHub: [Github](https://github.com/nitinyadav2188)
* X: [X](https://x.com/nitindotdev)

---

## License

Add the project's chosen license here.
