# Página 

**Página** turns a PDF into a simple digital book — realistic page turns, optional paper sound, and a focused neo-brutal reading experience.

Upload a PDF, open it as a book, turn pages, and read.

**No accounts. No cloud uploads. No unnecessary document-platform features.**

---

## Features

* **Landing → Upload → Reader** — three simple screens
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

## Desktop Experience

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


## Page-Turn Sound

Página includes an optional subtle paper sound.

Sound is:

* Off by default
* Played only when a page is successfully turned
* Toggleable from the reader controls
* Designed to remain subtle and non-distracting

Browser autoplay restrictions are respected.

---

## Annotations

Users can add simple annotations while reading:

* Highlights
* Sticky notes

Annotations are stored locally in the browser and associated with the document.

They do not need an account or cloud storage.

---

## Local Resume

Página can remember:

* The last opened document
* The last page
* Local annotations

This allows the user to return to a document without uploading it again.

Data is stored locally using **IndexedDB**.

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

## Download

Users can download the original PDF directly to their device.

If annotations are present, Página can also provide a notes sidecar containing the user's annotations.

The original PDF itself is not modified.

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

## Android APK

Página uses **Capacitor** to package the same web application as an Android app.

### Requirements

* JDK
* Android SDK
* Android Studio
* Capacitor Android project

The Android version should support:

* PDF selection
* Finger page turning
* Page-turn sound
* Fullscreen
* Local reading
* Android back button
* Responsive book layout

---

## Tech Stack

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

## Roadmap

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

## Author

**NITIN YADAV(Founder)**

* LinkedIn: [Linkedin](https://www.linkedin.com/in/nitin-yadav-681850299/)
* GitHub: [Github](https://github.com/nitinyadav2188)
* X: [X](https://x.com/nitindotdev)

---

## License

Add the project's chosen license here.
