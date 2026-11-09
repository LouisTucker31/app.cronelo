# Cronelo brand pack

The visual language of Cronelo: a calm, dense, neutral planner. Ink-black on white (or soft white on near-black in dark mode), one muted blue as the accent, small type, tight spacing and gently rounded corners. Colour is kept for meaning: task colours, statuses and milestones.

Source of truth: [css/styles.css](css/styles.css) (tokens at the top) and [css/fonts.css](css/fonts.css).

---

## 1. Name and logo

| | |
|---|---|
| Name | **Cronelo** (one word, capital C) |
| Tagline (page title) | Cronelo: project planner |
| Logo | A white rounded **C** stroke on a dark rounded-square tile |
| Tile colour | `#121417` (ink) |
| Mark colour | `#ffffff` |
| Tile corner radius | 7 / 32 of the tile width (about 22%). The in-app rail logo is 22px with a 5px radius |
| C stroke | Arc of radius 7.5 on a 32 grid, stroke 3.4, round caps, opening to the right |
| Browser / PWA theme colour | `#121417` |
| PWA background | `#ffffff` |

Logo SVG ([assets/favicon.svg](assets/favicon.svg)):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#121417"/>
  <path d="M22.3 10.7A7.5 7.5 0 1 0 22.3 21.3" fill="none" stroke="#ffffff"
        stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

In dark mode the tile inverts: a light tile (`#f1f3f5`) with a dark C (`#121417`).

App icons: `assets/favicon.svg`, `assets/icon-192.png`, `assets/icon-512.png`, `assets/apple-touch-icon.png`.

---

## 2. Colour

### 2.1 Core brand colours

| Role | Hex | Use |
|---|---|---|
| Ink | `#121417` | Primary text, primary buttons, logo tile |
| White | `#ffffff` | Page and cards (light) |
| Accent (Cronelo blue) | `#418dab` | Default task colour, progress bars, accent details |
| Accent tint | `#e6f2f7` | Accent backgrounds |
| Focus | `#4790ad` | Focus rings and selected outlines |
| Focus glow | `rgba(71,144,173,.18)` | 3px halo around focused inputs |
| Link | `#3f86a3` (hover `#1f4b5f`) | Links |
| Phase purple | `#a596ea` | Default phase colour |
| Phase text | `#2d2560` | Phase names |
| Milestone orange | `#d4802c` | Milestones |
| Milestone tint | `#fbeedd` | Milestone backgrounds |
| Success | `#2fa36b` | Success states |
| Danger | `#c4403a` (strong `#b4382f`) | Delete and error states |

### 2.2 Theme colours (light / dark)

The interface is built on neutral surfaces, lines and text that switch with the theme.

| Token | Light | Dark | Use |
|---|---|---|---|
| Page | `#ffffff` | `#131619` | App background |
| Raised | `#ffffff` | `#181b1f` | Dialogs, menus, buttons |
| Surface, soft | `#fafbfc` | `#15181b` | Panels and side areas |
| Surface, mid | `#f2f4f6` | `#22262b` | Hover and selected fills |
| Surface, strong | `#e6edf2` | `#262b31` | Pressed and active fills |
| Line, faint | `#eceff2` | `#2b3036` | Dividers |
| Line | `#dde1e6` | `#2b3036` | Borders on buttons and inputs |
| Line, strong | `#a9b1ba` | `#5a6169` | Emphasised edges |
| Text, primary | `#121417` | `#f1f3f5` | Headings and body |
| Text, secondary | `#4a5159` | `#aab1b9` | Labels |
| Text, muted | `#6b727b` | `#8a919a` | Hints and metadata |
| Accent text | `#2f6f89` | `#8fcbe2` | Accent-coloured text |
| Accent surface | `#eef5f8` | `#1d3440` | Selected / highlighted rows |
| Phase text | `#2d2560` | `#c9c1f5` | Phase names |
| Danger surface | `#fdf0ef` | `#3a1c1a` | Error backgrounds |
| Danger text | `#b4382f` | `#f0a39d` | Error text |
| Shadow | `rgba(20,30,40,.08)` | `rgba(0,0,0,.3)` | Soft shadows |
| Shadow, strong | `rgba(20,30,40,.16)` | `rgba(0,0,0,.5)` | Menus and popovers |

### 2.3 Neutral grey scale

Named by lightness (0 black, 1000 white). Cool greys with a slight blue lean.

| Token | Hex | Token | Hex |
|---|---|---|---|
| grey-80 | `#121417` | grey-857 | `#d5dae0` |
| grey-90 | `#14171a` | grey-884 | `#dde1e6` |
| grey-124 | `#1b1f24` | grey-904 | `#e3e6ea` |
| grey-182 | `#2a2e33` | grey-916 | `#e6e9ed` |
| grey-255 | `#3a4048` | grey-931 | `#e9eef2` |
| grey-320 | `#4a5159` | grey-937 | `#eceff2` |
| grey-451 | `#6b727b` | grey-945 | `#eef1f4` |
| grey-514 | `#7b828b` | grey-951 | `#f0f2f5` |
| grey-633 | `#9aa1a9` | grey-955 | `#f1f3f6` |
| grey-696 | `#a9b1ba` | grey-965 | `#f4f6f8` |
| grey-714 | `#b0b5bc` | grey-969 | `#f5f7f9` |
| grey-790 | `#c3c9d0` | grey-971 | `#f6f7f9` |
| grey-829 | `#cdd3da` | grey-984 | `#fafbfc` |
| grey-853 | `#d3d9e0` | | |

### 2.4 Task and phase colours

The colours people can pick for tasks, phases and tags. Blue is the task default and light purple (`#a596ea`) the phase default.

| Name | Hex |
|---|---|
| Blue (default) | `#418dab` |
| Teal | `#2f9585` |
| Green | `#4f9a3a` |
| Gold | `#b8860b` |
| Orange | `#dd6f2c` |
| Red | `#cf4646` |
| Pink | `#cf4d8a` |
| Purple | `#8458e0` |
| Slate | `#66727f` |

Subtasks use a lighter blue: line `#8cc3da`, fill `#cbe5f1`, text `#173a4b`.

### 2.5 Avatar colours

Given to people in turn as they are added, with white initials:

`#dfae2f` · `#de4f87` · `#e57f3a` · `#8b5cf0` · `#2f9585` · `#418dab` · `#cf4646` · `#4f9a3a`

### 2.6 Status colours

Pill badges with a small dot in the text colour.

| Status | Light background / text | Dark background / text |
|---|---|---|
| Not started | `#eef1f4` / `#4a5159` | `#22262b` / `#aab1b9` |
| In progress | `#e3eefb` / `#2c64b3` | `#1b2a40` / `#86b4ef` |
| Done | `#e2f4ea` / `#23824f` | `#17301f` / `#7fd0a1` |
| Milestone | `#fbeedd` / `#b0621d` | `#35260f` / `#f0b06c` |

Finished rows in the list: a faint green wash (light: Done green mixed 55% into white; dark: `#141d19`).

---

## 3. Typography

| Family | Use | Weights | Files |
|---|---|---|---|
| **Inter** | All interface text | 400, 500, 600, 700 (800 for the logo letter) | `assets/fonts/inter-latin.woff2`, `inter-latin-ext.woff2` |
| **JetBrains Mono** | Dates, times, numbers, percentages, keyboard shortcuts, tag pills | 400, 500 | `assets/fonts/jetbrains-mono-latin.woff2` |

Both are self-hosted variable fonts (Latin only), with `font-display: swap`. Fallbacks: `Inter, system-ui, sans-serif` and `"JetBrains Mono", monospace`.

### Type scale

The interface uses small type. 12px is the body size.

| Role | Size / weight | Notes |
|---|---|---|
| Page and dialog titles | 14 to 15px / 600 | |
| Section headings | 12 to 13px / 600 | |
| Body, inputs, dialogs | 12px / 400 | |
| Buttons | 11.5px / 500 (primary: 600) | |
| Table cells, bars, menus | 11.5px / 400 to 500 | |
| Small labels, badges | 10.5px / 500 | |
| Column headings, overlines | 9.5 to 10.5px / 600 to 700, UPPERCASE | Letter spacing .05em to .07em |
| Dates and numbers | 10 to 10.5px JetBrains Mono / 400 to 500 | |
| Tiny counts | 8.5 to 9px | |

Body text is antialiased (`-webkit-font-smoothing: antialiased`).

---

## 4. Spacing

A loose 2px base, mostly in steps of 2 and 4. Gaps are usually 6, 8 or 10px.

| Step | px | Typical use |
|---|---|---|
| xxs | 2 | Icon nudges, tight groups |
| xs | 4 | Menu inner padding, small gaps |
| sm | 6 | Default gap inside buttons and toolbars |
| md | 8 | Gap between controls, horizontal padding on pills |
| lg | 10 to 12 | Card and row padding (`10px 12px`) |
| xl | 14 to 16 | Dialog sections (`14px 16px`) |
| 2xl | 20 | Space around the main panel |
| 3xl | 24 to 28 | Empty states and sign-in card |

Common paddings:

- Button: `0 10px` (primary `0 13px`)
- Menu: `4px` around, items `0 8px` to `0 9px`
- Status pill: `0 8px`
- Timeline bar: `0 2px 0 8px`

---

## 5. Sizes

| Element | Height |
|---|---|
| Buttons, inputs, selects | 30px (compact 26 to 28px) |
| Menu items | 26 to 28px |
| List and timeline rows | 34px |
| Timeline bars | 20px |
| Status pills | 19px |
| Avatars | 16 to 22px circles |
| Rail logo | 22px |
| Icons | 14px in buttons, 16px in the rail |

---

## 6. Corner radius

Soft but not round. 7px is the signature radius.

| Radius | Use |
|---|---|
| 1.5 to 3px | Tiny marks, progress bars, checkboxes |
| 4 to 5px | Timeline bars, small chips, logo tile (22px) |
| 6px | Menu items, small buttons |
| **7px** | **Buttons, inputs, selects (the default)** |
| 8px | Dropdown menus and popovers |
| 9px | Main panel |
| 10px | Status pills, cards |
| 12 to 14px | Dialogs and the sign-in card |
| 50% | Avatars, dots, phase rings |

---

## 7. Borders, lines and shadows

- **Borders:** always 1px, in the Line colours. Focus outlines are 2px in Focus blue.
- **Focus ring (inputs):** `0 0 0 3px rgba(71,144,173,.18)` with a Focus-blue border.
- **Focus ring (swatches, avatars):** `0 0 0 2px <background>, 0 0 0 3.5px #4790ad`.
- **Subtle lift:** `0 1px 2px rgba(20,30,40,.05)`.
- **Menu / popover:** `0 8px 24px rgba(20,30,40,.12), 0 1px 3px rgba(20,30,40,.08)`.
- **Large popover:** `0 12px 32px var(--shadow-strong), 0 1px 3px var(--shadow)`.
- **Dialog:** `0 24px 60px rgba(20,30,40,.18), 0 2px 6px rgba(20,30,40,.08)`.

Shadows are cool-tinted (`rgb(20,30,40)`) in light mode and plain black in dark mode.

---

## 8. Motion

Quick and quiet.

| What | Timing |
|---|---|
| Hover fills and borders | `.12s` |
| Small transforms, fades | `.12s` to `.2s` |
| Width changes (progress, panels) | `.15s` to `.18s ease` |
| Highlighting a newly added row | 2.2s fade from accent surface |

---

## 9. Components at a glance

| Component | Recipe |
|---|---|
| Primary button | 30px high, `0 13px` padding, 7px radius, ink fill, white text, Inter 600 11.5px. Hover `#2a2e33` |
| Secondary button | 30px high, `0 10px` padding, 7px radius, 1px `#dde1e6` border, raised fill, Inter 500 11.5px. Hover `#f6f7f9` |
| Dropdown menu | 4px padding, 8px radius, raised fill, 1px line border, menu shadow |
| Dialog | Max 500px wide, 12px radius, raised fill, dialog shadow, 12px body text |
| Status pill | 19px high, `0 8px` padding, 10px radius, Inter 500 10.5px, 5px dot |
| Main panel | 1px `#e2e6eb` border, 9px radius, 20px side margin |
| List header row | Phase rows in light grey `#f5f7f9`, milestone rows darker `#f0f2f5`, phase names uppercase 700 10.5px |

---

## 10. Icons

[Lucide](https://lucide.dev) line icons: 24 grid, 2px stroke, round caps and joins, drawn in `currentColor`.

---

## 11. Breakpoints

| Width | Change |
|---|---|
| ≤ 980px | Tablet layout |
| ≤ 760px | Phone layout |
| ≤ 420px | Small phones |
| `pointer: coarse` | Larger touch targets |
| `hover: none` | Hover-only controls always shown |

Respects iPhone safe areas (`env(safe-area-inset-*)`). A print stylesheet is included.

---

## 12. Dark mode principles

- Near-black, slightly blue page (`#131619`), never pure black.
- Text is soft white (`#f1f3f5`), never pure white.
- Coloured fills are dark and desaturated (`#17301f` rather than a bright green), with lighter pastel text on top.
- Tints such as finished rows stay as faint against dark as they are against white in light mode.
- The logo tile inverts to light.
