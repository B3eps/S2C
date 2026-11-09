# S2C design system

Derived from the shipped build. Tokens live in `src/styles/tokens.css`; canvas mirrors live in `src/lib/theme.ts`, and the two must stay in sync.

## World
Performance as a graded certificate. Accounts and reports are ivory label strips, like a graded-coin slab label, sitting on smoked warm-graphite plies. Funding is the moment the label is sealed with a holographic security strip.

## Colour
| Role | Token | Value |
|---|---|---|
| Ground plies | `--ply-0..3` | `#1a1816` `#201e1b` `#292622` `#34302b` |
| Rules | `--rule`, `--rule-strong` | `#37332e`, `#48433c` |
| Ink | `--ink-1..3` | `#ece7dd` `#a9a397` `#938c80` |
| Label stock | `--label`, `--label-ink` | `#ede6d3`, `#1c1a16` |
| Gold foil | `--gold` | `#d9b25c` |
| Long / up | `--up` | `#43c29e` |
| Short / down | `--down` | `#ec7363` |
| Warning | `--warn` | `#f0a24b` |
| Violation stamp | `--stamp` | `#c4412f` |

Rules:
- **Gold** is used only for the S2C hallmark, certification labels and the single primary action on a screen.
- **Selection** (tabs, pressed tools, presets, rail) is ink-1 on ply-3.
- **Positive data** (equity curve, heatmap, goal gauge) is `--up`, never gold.
- **Indicator series** use `SERIES` in `theme.ts`: ivory, amber, desaturated teal and coral, and warm neutrals.
- **Prices are never shown during play.** Price axes and crosshair labels are hidden, and levels read as R, % and $.

## Type
- **Family:** Archivo Variable (self-hosted, `wdth` axis), with tabular numerals everywhere.
- **Label heads:** condensed caps (`font-stretch: 76%`) with 0.06–0.08em tracking.
- **Scale (rem):** 11, 12, 13 (base), 14, 16, 18, 22, 28, 40 (moment titles only).

## Shape and space
- **Spacing:** 4px base scale (`--s-1..10`).
- **Radii:** 2, 3 and 4px. The world is precise, not soft.
- **Panels:** 1px rule plus a faint inset top highlight (the acrylic ply edge).

## Signature components
- **CertLabel** (`components/bits.tsx`): the ivory strip with a cert number, data line and grade slot.
  - Variants: challenge, funded (12px holo strip that follows the pointer) and violated (İHLAL stamp; the label stays on the dashboard, dimmed).
- **Reveal print** (`views/Overlays.tsx`): the session report prints row by row (`printLine`, `steps(12)`).
  - The funding seal reuses the same print, then laminates the holo strip.
- **Order line tags** (`components/ChartPanel.tsx`): draggable SL / TP / entry tags that read in R and $.

## Motion
- **Controls:** 140–220ms with ease-out (`--ease-out`).
- **Big moments:** stepped print (260ms per row), laminate (900ms), stamp impact (380ms, slight overshoot).
- **Chart effects:** a fill ring, a TP/SL sweep along the line, and a new-bar pulse. The bar pulse is suppressed above 4× replay speed.
- `prefers-reduced-motion` collapses all of it.

## Sound
Synthesised live in `lib/sound.ts`, with no sample files:
- one FM "struck gold" bell voice
- a filtered-noise body
- a low thud

Cues: place, fill, TP, SL, warn, violation, funded, payout, print, cancel, optional bar tick.

## Brand assets
`public/brand/s2c-emblem.svg` and `public/brand/s2c-mark.svg` are hand-authored geometry: a cut-corner assay stamp with chamfered letterforms and one oblique stencil cut. The PNGs next to them are rendered from those SVGs by `scripts/render-brand.cjs` (resvg). They are not generated images.
