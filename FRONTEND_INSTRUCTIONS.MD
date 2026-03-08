# GYAANSETU — Design System & Theme Instructions

## Overview

GYAANSETU is an academic integrity intelligence platform with a **dark editorial / classified document** aesthetic. The visual language draws from intelligence agency dossiers, investigative journalism layouts, and institutional print design — projecting authority, precision, and urgency.

---

## Framework & Tech Stack

### Core Framework: Next.js (App Router)

All GYAANSETU frontend code is written in **Next.js 14+ using the App Router** (`/app` directory). Do not use the Pages Router.

```
GYAANSETU/
├── app/
│   ├── layout.tsx          # Root layout — ClassBar, Nav, global CSS vars
│   ├── page.tsx            # Homepage (Hero, StatBand, all sections)
│   ├── globals.css         # CSS custom properties, resets, body textures
│   └── fonts.ts            # next/font/google config
├── components/
│   ├── layout/
│   │   ├── ClassBar.tsx
│   │   ├── Nav.tsx
│   │   └── Footer.tsx
│   ├── sections/
│   │   ├── Hero.tsx
│   │   ├── StatBand.tsx
│   │   ├── ProblemSection.tsx
│   │   ├── FeaturesSection.tsx
│   │   ├── CalloutSection.tsx
│   │   ├── HowSection.tsx
│   │   └── PricingSection.tsx
│   └── ui/
│       ├── SectionLabel.tsx
│       ├── Badge.tsx
│       ├── ProblemCard.tsx
│       ├── FeatureItem.tsx
│       ├── HowStep.tsx
│       ├── PlanCard.tsx
│       └── RedactedText.tsx
└── public/
```

### Typography — `next/font/google`

Load all fonts via `next/font/google` in `app/fonts.ts`. Never use a `<link>` tag for Google Fonts.

```ts
// app/fonts.ts
import { Oswald, Courier_Prime, Playfair_Display } from 'next/font/google'

export const oswald = Oswald({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-display',
})

export const courierPrime = Courier_Prime({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-body',
})

export const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
})
```

Apply all three font variables on the `<html>` element in `app/layout.tsx`:

```tsx
// app/layout.tsx
import { oswald, courierPrime, playfairDisplay } from './fonts'

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${oswald.variable} ${courierPrime.variable} ${playfairDisplay.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

CSS custom properties reference them as `var(--font-display)`, `var(--font-body)`, `var(--font-serif)` exactly as defined in the design tokens.

### Styling: CSS Modules

Use **CSS Modules** (`.module.css`) for all component styles. Do not use Tailwind, styled-components, or inline styles.

- Each component has a co-located `.module.css` file: `Hero.tsx` + `Hero.module.css`.
- Global tokens (colors, fonts, resets, body textures) live in `app/globals.css` and are imported once in `layout.tsx`.
- CSS custom properties (`--ink`, `--cream`, etc.) are declared in `:root` inside `globals.css` and are globally available to all modules.

```css
/* Example: components/sections/Hero.module.css */
.hero {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  padding: 0 4rem;
  /* ... */
}

.headline {
  font-family: var(--font-display);
  font-size: clamp(4rem, 9vw, 9rem);
  /* ... */
}
```

### Server vs Client Components

| Component | Directive | Reason |
|---|---|---|
| All section components | Server (default) | Static content, no interactivity |
| `Nav.tsx` | Server | No state needed |
| `PricingSection.tsx` | `'use client'` | Billing toggle (`useState`) |
| `ScrollReveal.tsx` | `'use client'` | `IntersectionObserver` |
| `BlinkCursor.tsx` | `'use client'` | Animation state |
| `ClassBar.tsx` | Server | Static markup |

Keep `'use client'` usage **minimal**. Extract only the interactive parts into small client components rather than marking entire sections as client-side.

### Scroll Reveal — Client Wrapper

The `IntersectionObserver` scroll animation from the original JS must be implemented as a reusable `'use client'` wrapper:

```tsx
// components/ui/ScrollReveal.tsx
'use client'
import { useEffect, useRef } from 'react'
import styles from './ScrollReveal.module.css'

export default function ScrollReveal({ children, delay = 0 }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add(styles.visible) },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={styles.reveal} style={{ transitionDelay: `${delay}s` }}>
      {children}
    </div>
  )
}
```

Wrap `ProblemCard`, `FeatureItem`, `HowStep`, and `PlanCard` in `<ScrollReveal delay={index * 0.08}>` at the section level.

### Metadata & SEO

Define metadata in `app/layout.tsx` using the Next.js `Metadata` API:

```ts
export const metadata: Metadata = {
  title: 'GYAANSETU — Academic Integrity Intelligence',
  description: 'Multi-modal academic integrity system detecting plagiarism, AI content, proctoring violations, and cross-institutional fraud in real time.',
}
```

### Key Next.js Conventions

- Use `Link` from `next/link` for all internal navigation anchors in `Nav` and `Footer`.
- Use `Image` from `next/image` if any images are added — never a raw `<img>` tag.
- The `classbar`, `nav`, and `footer` are rendered once in `app/layout.tsx` so they persist across all routes.
- Anchor scroll links (`#solutions`, `#how`, `#pricing`) work natively with `scroll-behavior: smooth` set in `globals.css` on `html`.

---

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--ink` | `#080806` | Primary background (near-black warm) |
| `--ink-soft` | `#1a1a16` | Secondary dark surfaces, callout sections |
| `--cream` | `#f0ece0` | Primary text, light section backgrounds |
| `--cream-dark` | `#e4dfc9` | Feature list row backgrounds |
| `--red` | `#c0392b` | Accent — CTAs, labels, threat tags, classification bar |
| `--red-muted` | `#8b2a1f` | Hover state for red elements |
| `--yellow` | `#f5e642` | Hero italic headline, featured plan pricing, hover highlight |
| `--teal` | `#1a8c82` | Status indicators, feature list checkmarks |
| `--border` | `rgba(240,236,224,0.15)` | Dividers on dark backgrounds |
| `--border-dark` | `rgba(8,8,6,0.2)` | Dividers on light backgrounds |
| `--muted` | `rgba(240,236,224,0.45)` | Secondary text, nav links, descriptions |

### Principles
- Dark backgrounds dominate. Light sections (`--cream`) are used sparingly as contrast breaks.
- Red is reserved **exclusively** for urgency signals — CTAs, threat labels, section markers, the classification bar.
- Yellow appears only as an **emphasis accent** — never as a background or dominant color.
- All colors are warm-toned (no pure blacks or pure whites anywhere).

---

## Typography

### Typefaces

| Role | Family | Weights | Character |
|---|---|---|---|
| **Display / Headers** | `Oswald` | 300, 400, 500, 600, 700 | Condensed, uppercase, industrial |
| **Body / Mono** | `Courier Prime` | 400, 700, italic | Typewriter feel, procedural, data-driven |
| **Serif / Accent** | `Playfair Display` | 700, 900, italic | Editorial contrast, used in italics only |

### Usage Rules

- **All caps + letter-spacing** (`letter-spacing: 0.3em–0.5em`) is mandatory for Oswald section labels, nav items, badges, and buttons.
- **Playfair Display italic** is used exclusively as a counterpoint to Oswald — in hero sub-headlines, callout quotes, and pricing titles. Never upright.
- **Courier Prime** handles all descriptive body copy, metadata, stats labels, footers, and any "system" or "status" text.
- Section labels follow the pattern `// Label Text` — the `//` acts as a visual code comment prefix.
- Numbers in stats and metrics use Oswald at large sizes (`3.5rem–7rem`) as graphical elements.

### Scale Reference

| Element | Size | Font |
|---|---|---|
| Hero headline | `clamp(4rem, 9vw, 9rem)` | Oswald 700 |
| Section titles | `clamp(2rem, 4vw, 4.5rem)` | Oswald 700 |
| Feature names | `1.3rem–1.4rem` | Oswald 600 |
| Body copy | `0.85rem–0.9rem` | Courier Prime 400 |
| Labels / badges | `0.55rem–0.65rem` | Courier Prime, all caps |
| Ghost numbers | `7rem` | Oswald 700, opacity 0.03–0.04 |

---

## Layout & Grid

- **Base padding**: `4rem` horizontal on desktop, `1.5rem` on mobile (≤900px).
- The primary layout pattern is a **CSS Grid with 1px dividers** as visual separators — never use gap spacing between grid columns; use a `1px` element with `background: var(--border)` instead.
- Section structures follow two main patterns:
  - **Dark sections**: Full-bleed ink background, cream text, red accents.
  - **Light sections**: Cream background (`--cream`), ink text — used for Features and Pricing only.
- Card grids and step grids use `background: var(--border)` on the grid container and `gap: 1px` to create hairline dividers between cards.

---

## Texture & Atmosphere

### Film Grain Overlay
Applied as a fixed `::after` pseudo-element on `body`. Uses an inline SVG `feTurbulence` filter at `0.5` opacity. This layer sits above all content at `z-index: 9999` and is `pointer-events: none`.

### Dot Grid Background
Applied as a fixed `::before` on `body`. A `40px × 40px` grid of `rgba(240,236,224,0.025)` lines — extremely subtle. Reinforces the "graph paper / intelligence document" aesthetic.

### Ghost / Watermark Text
Large Oswald text at `opacity: 0.02–0.04` is used as a background element in sections and cards (e.g., `GYAANSETU` behind the callout, large numbers behind problem cards and how-it-works steps). Always `pointer-events: none; user-select: none`.

---

## Component Patterns

### Classification Bar
- Sticky top bar in `--red`.
- Oswald, `0.65rem`, `letter-spacing: 0.5em`, all caps.
- Content uses `◆` bullet separators with reduced opacity.

### Section Labels
- Format: `// Label Text`
- Courier Prime, `0.6rem`, `letter-spacing: 0.4em`, `--red` color.
- Always placed directly above the section headline.

### Badges & Tags
- Inline elements on cards/features.
- Courier Prime, `0.55rem`, `letter-spacing: 0.3–0.35em`, all caps.
- Two variants: **light background** (`background: var(--ink); color: var(--cream)`) for feature badges; **bordered** (`border: 1px solid var(--red-muted); color: var(--red)`) for threat tags on dark cards.

### Buttons
- **Primary** (`btn-primary`): Cream fill, ink text → yellow on hover. Oswald, `0.8rem`, `letter-spacing: 0.3em`.
- **Ghost** (`btn-ghost`): No fill, muted color, bottom-border only → cream on hover.
- **Nav CTA**: Red fill → red-muted on hover. Same type treatment as primary.
- **Plan buttons**: Border-only on white plans; cream fill on featured dark plan.
- No border-radius anywhere. All buttons are sharp rectangles.

### Cards (Problem Cards)
- Background: `--ink-soft`. Hover: slightly lighter (`#222218`).
- Ghost number watermark positioned `absolute` top-right.
- Red bordered tag at top, Oswald title, Courier body text.

### Feature List Items
- 4-column grid: `80px number | content left | 1px divider | metric right`.
- Metric is a large Oswald number with a small Courier label below.
- On mobile, right metric column collapses.

### Pricing Plans
- 3-column grid with hairline separators.
- Featured plan inverts to dark background with yellow price.
- "Most Popular" ribbon: red absolute tab at top of featured card.

### Redacted Text Effect
- `.redacted` class: `background: currentColor; color: transparent` — shows as black bar.
- On hover: `background: transparent; color: var(--red)` — text is "revealed" in red.

---

## Animation & Interaction

### Hero Entrance
- Elements stagger in with `fadeUp` keyframe (`opacity: 0, translateY(20px)` → final state).
- Delays: `0.1s`, `0.25s`, `0.45s`, `0.6s` per element.

### Scroll Reveal
- `IntersectionObserver` at `threshold: 0.1` triggers on `.problem-card`, `.feature-item`, `.how-step`, `.plan`.
- Elements start `opacity: 0; transform: translateY(24px)` and animate in.
- Stagger delay: `i * 0.08s` per element index.

### Blink Cursor
- `::blink` keyframe — `step-end` timing for authentic terminal cursor feel.
- Used on hero status indicator and system status dot in footer.

### Hover States
- Cards: background color shift only (no shadows, no borders appearing).
- Plans: `translateY(-3px)` lift.
- Buttons: color swap or `translateY(-1px/−2px)` micro-lift.
- No `box-shadow` anywhere — the aesthetic is flat and print-like.

---

## Tone & Voice Guidelines

- Copy follows an **intelligence briefing** register — clinical, declarative, urgent.
- Section labels use the `// comment` syntax borrowed from code — treating content as a system.
- Statistics are cited with institutional sources to project credibility.
- Threat vectors are named like security classifications: Alpha, Beta, Gamma, Delta.
- Product feature names use `™` suffixes (LinguisticaAI™, FederatedIndex™, etc.) as proprietary-sounding branded modules.
- The word GYAANSETU (Latin: *truth*) anchors all messaging — the brand is the concept.

---

## What to Avoid

- **No border-radius** on any element — everything is sharp-cornered.
- **No box shadows** — depth is created through color contrast and hairline borders only.
- **No pure black (`#000`) or pure white (`#fff`)** — always use warm-toned `--ink` and `--cream`.
- **No sans-serif body text** — body copy is always Courier Prime.
- **No color outside the palette** — especially no blues, greens, or purples.
- **No centered text** outside the callout section — all layout is left-aligned.
- **No gradient fills** — flat color only.

---

## Responsive Behavior

Breakpoint: `max-width: 900px`

- Nav links hidden; only logo + CTA button visible.
- All multi-column grids collapse to single column.
- Feature item right-side metrics hidden on mobile.
- Hero headline scales via `clamp()` — no manual override needed.
- Padding reduces from `4rem` → `1.5rem` horizontally.
- Stat band switches to `2×2` grid.
- Footer masthead stacks vertically with `2rem` gap.