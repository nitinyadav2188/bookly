# Página — Design System

Design reference for **Página**, a local PDF → digital book experience. Landing UI is neo-brutal; the reader is a physical book on a warm desk.

---

## Brand

| Element | Spec |
| --- | --- |
| Product name | **Página** |
| Mark | Letter **P** (app icons / favicon) |
| Tagline | Turn your PDF into a book |
| Voice | Direct, private, tactile — no document-platform fluff |
| Theme color | `#fdfceb` (cream) |

**Brand test:** First viewport should still read as Página after removing the nav — hero mark + product name carry the identity.

---

## Dual-surface model

Página uses two visual languages on purpose:

1. **Marketing / chrome** — neo-brutal: cream grid, hard black borders, offset shadows, loud accent fills.
2. **Reader** — physical book: wood desk, leather cover, ivory paper, soft shadows. No lime offset bars on the book block.

Do not mix hard neo-brutal chrome into the page surface itself.

---

## Color

### Landing tokens (`:root`)

| Token | Hex | Role |
| --- | --- | --- |
| `--cream` | `#fdfceb` | Page background |
| `--cream-grid` | `#e8e6d4` | Grid lines on body |
| `--ink` | `#000000` | Primary text / borders |
| `--ink-muted` | `#3a3a3a` | Secondary text |
| `--paper` | `#ffffff` | Cards / panels |
| `--lime` | `#c8f542` | Primary CTA / selection |
| `--blue` | `#3b5bff` | Secondary accent |
| `--pink` | `#ff4d9a` | Tertiary accent |
| `--orange` | `#ff8a1f` | Accent / prev control family |
| `--danger` | `#d10000` | Errors |

### Reader desk / cover tokens (`.reader-shell`)

| Token | Hex | Role |
| --- | --- | --- |
| `--desk-deep` | `#1a1510` | Desk base |
| `--desk-mid` | `#2c241c` | Mid wood |
| `--desk-lit` | `#3a3128` | Lit wood |
| `--cover-outer` | `#2a211a` | Leather outer |
| `--cover-edge` | `#1c1612` | Cover edge |
| `--cover-rim` | `#3d3228` | Cover rim |
| `--paper-ivory` | `#f7f1e4` | Page fill |
| `--paper-cream` | `#fbf6eb` | Soft page fill |
| `--paper-edge` | `#e6dcc8` | Page edge |
| `--paper-stack` | `#d9cdb6` | Sheet-stack stripes |

### Structural chrome

| Token | Value |
| --- | --- |
| `--border` | `3px solid #000000` |
| `--shadow` | `5px 5px 0 #000000` |
| `--shadow-sm` | `3px 3px 0 #000000` |
| `--shadow-lg` | `8px 8px 0 #000000` |

Selection highlight: lime on black (`background: #c8f542; color: #000`).

---

## Typography

Loaded via `next/font/google` in `src/app/layout.tsx`.

| Role | Family | CSS variable | Usage |
| --- | --- | --- | --- |
| Display | **Archivo Black** | `--font-display` | Brand, headlines, buttons, tags |
| UI | **Space Grotesk** | `--font-ui` | Body copy, UI labels |
| Mono | **JetBrains Mono** | `--font-mono` | Eyebrows, meta, “mono labels” |

### Display rules

- Weight: 800 (or Black)
- `letter-spacing: -0.03em` (buttons ≈ `-0.02em`)
- `text-transform: uppercase`
- Class: `.font-display`

### Mono label rules

- Tracking: `0.12em`–`0.14em`
- Uppercase
- Class: `.font-mono-label` / feature `.eyebrow`

Avoid default UI stacks (Inter, Roboto, Arial, system-only) for branded surfaces.

---

## Layout & surfaces

### Body

- Cream fill + fixed **28×28px** grid (horizontal + vertical 1px lines).
- Content width utility: `.bookly-container` → `min(1100px, calc(100% - 2rem))` centered.

### Neo-brutal primitives

| Class | Behavior |
| --- | --- |
| `.nb-border` | 3px black border |
| `.nb-shadow` / `-sm` / `-lg` | Hard offset shadow |
| `.nb-btn` | Uppercase display button + press motion |
| `.nb-btn-lime` / `-blue` / `-pink` / `-orange` / `-white` / `-black` | Fill variants |
| `.nb-card` | White panel + large offset shadow |
| `.nb-tag` | Lime chip + small shadow |
| `.nb-ribbon` | Rotated (`-6deg`) accent ribbon |
| `.feature-tile` | Bordered tile, ~160px min height |

### Button motion

- Hover: `translate(-1px, -1px)` + shadow `6px 6px 0 #000`
- Active: `translate(3px, 3px)` + shadow `2px 2px 0 #000`
- Disabled: opacity `0.4`, no pointer events

---

## Screens & composition

### Flow

```text
Boot splash → Landing → Upload / Install → Preparing → Reader
```

### Boot splash

- Full-viewport cream + grid
- White stage square: 3px border + `8px 8px 0 #000`
- Lime + blue corner accents
- Animated mage + book SVG (~2s hold; shorter under reduced motion)
- Product name in display caps

### Landing (first viewport budget)

Keep the first viewport lean:

- Brand / product name (hero-level)
- One headline
- One short supporting line
- One CTA group (Upload / Install / Continue)
- One dominant visual: open **hero book** spread (not a card collage)

No stats strips, schedule blocks, or floating promo chips over the hero media.

### Hero book

- Class family: `.hero-book`, `.hero-book-spread`
- Aspect ≈ `16 / 11`, width `min(480px, 92vw)`
- Open spread with hard black frame + large offset shadow
- Neo-brutal illustration of a book, not a photo inset card

### Modals / bars

- Upload + Install modals: neo-brutal panels on cream
- Sticky mobile install bar when relevant
- Preparing state: clear progress / error copy (no lorem)

### Reader

Full-screen `.reader-shell`:

- Warm wood desk (grain SVG + radial light pool + vertical wood gradient)
- **Desktop:** `.reader-book-frame` leather cradle, fore-edge sheet stack, bottom sheet stack, center spine/gutter
- **Mobile:** leather rim + fore-edge peek around `.reader-touch-frame`; page nearly full-bleed
- Pages: ivory/cream paper; soft physical shadows (not lime bars)
- Desktop edge nav: vertical neo-brutal Prev/Next (`#ff6b35` / `#c8f542`)
- Mobile: swipe / drag-follow / tap halves — chrome floats, doesn’t fight gestures
- Zoom: 70–180% (buttons; mobile buttons-only)

---

## Motion

Intentional motion, not noise:

| Surface | Motion |
| --- | --- |
| Boot splash | Mage bob, hat, wand, page flutter, sparks |
| Buttons | Micro translate + shadow on hover/press |
| Page turn | StPageFlip curl (product core) |
| Zoom | Short transform ease (~160ms) on book host |
| Reduced motion | Shorter / quieter splash |

Page-turn **sound** is optional and **off by default**.

---

## Iconography & mark

- App icons under `/public/icons/` (192 / 512 / apple-touch)
- Favicon: `/public/favicon.png`
- Splash illustration: mage + open book SVG (`BootSplashMage`)
- Prefer hard geometric accents (small lime/blue squares) over soft glow or emoji

---

## Responsive rules

| Breakpoint intent | Behavior |
| --- | --- |
| Mobile-first reader | Touch frame fills stage; leather rim + sheet peek |
| Desktop reader | Leather frame + spine + stacked edges; vertical edge buttons |
| ≤900px desktop chrome | Hide vertical edge nav; tighten frame padding |

Always verify both desktop and mobile: landing grid + reader book illusion.

---

## Do / Don’t

### Do

- Keep landing loud and neo-brutal; keep pages quiet and paper-like
- Make leather, spine, and sheet stack **obvious** enough to read as a book
- Use real product copy
- Prefer hard borders and offset shadows on marketing chrome

### Don’t

- Put lime offset bars on the PDF page block
- Overlay floating badges / promo chips on hero media
- Default to purple gradients, cream+serif+terracotta clichés, or glow-heavy dark UI for the brand
- Turn the first viewport into a dashboard of secondary modules

---

## Implementation map

| Concern | Location |
| --- | --- |
| Tokens + neo-brutal + reader CSS | `src/app/globals.css` |
| Fonts / theme color / splash critical CSS | `src/app/layout.tsx` |
| Landing composition | `src/app/page.tsx`, `Header`, `HeroBook`, `SiteFooter` |
| Reader chrome + gestures | `src/components/BookReader.tsx` |
| Splash | `BootSplashController`, `BootSplashMage` |
| Modals / install | `UploadModal`, `InstallModal`, `MobileInstallBar` |

---

## Product principle

> Make a PDF feel like a real book — private, local, and simple.
