# Headshot design system

Written before v3 code, per SPEC.md. Every screen is built against this document. Reference set: Cursor's product surfaces (cursor.com and the editor's chrome) and Ryu's work there. Anti-references: streaming poster walls, SaaS card grids, gamified streaks, purple gradients, rounded cards on rounded cards.

## Stance

Restraint. The picture (a face, a poster, the chain) is the only loud thing on the screen. Everything else recedes: near-monochrome surfaces, one warm accent used for one purpose, type that is sharp rather than friendly, space instead of borders. Motion only when it carries meaning (a path lighting, a card leaving the deck), never as decoration. The interface stays sparse until more information makes the current decision easier.

## Color

Dark-first, single theme for now (the field behind the brain is part of the identity).

| Token | Value | Use |
|---|---|---|
| `--bg` | `#07080c` | the field |
| `--bg-elev` | `#0e1017` (86% over the field for panels) | panels, drawer, composer |
| `--line` | `rgba(255,255,255,0.08)` | hairlines; the only borders allowed |
| `--ink` | `#e9e6dc` | primary text, warm not white |
| `--ink-dim` | `#8b909e` | secondary text |
| `--ink-faint` | `#4d515c` | labels, metadata |
| `--accent` | `#f4b63f` | one job: the thing you can act on (Play, the lit path, a link) |
| `--person` | `#ded9c9` | people on the canvas |
| `--title` | `#7d8cc4` | titles on the canvas |
| `--session` | `#62e6b4` | "yours" on the brain |

Rules: the accent never fills large areas except the Play button. Semantic states (error, loading) use ink tones and text, not new hues. No gradients on surfaces; the only gradient is the vignette behind the canvas.

## Type

- Display and UI: Geist Sans. Headlines at 26/32px, weight 600, tight tracking, `text-wrap: balance`.
- Body: Geist Sans 14.5px, line-height 1.55, measure 62ch max.
- Data and labels: Geist Mono 11px, uppercase labels with 0.08em tracking, `tabular-nums` for counts and years.
- Names of people and titles are always bold and always links (the cursor-for-movies rule). A bare name is a bug.

## Space and shape

- 4px grid. Panel padding 16, section gap 24, page gutter 20 (phone) / 40 (laptop).
- Radius: 14px for panels and posters, 999 for chips and buttons. Nothing else is rounded.
- Borders are hairlines from `--line`, used to separate regions, never to outline items in a list. Lists separate by space.
- Shadows only as glow on the accent (`0 0 12px var(--accent)`), never as drop shadows on surfaces.

## Motion

- 120ms for hover and focus, 380ms per path hop, 300ms for a card leaving the deck. Ease-out everywhere.
- `prefers-reduced-motion` turns every transition into an instant state change.
- Nothing animates on page load except the path if an answer is streaming.

## The three core layouts

### Home (the 9pm moment, also the chat)
Laptop: three columns. Left rail (threads, taste map tab, account) 240px, collapsible. Center: the chat. The agent's opening message is already there: three pick cards in a row (poster 3:4, name, one reason line, a Play button in accent, a dismiss action in ink-faint), then the deck of eight as a compact poster strip beneath. Composer pinned at the bottom of the center column. Right: the brain or the taste map (46%).
Phone: one column. Picks as a full-width horizontal strip, reason under each, composer pinned at the bottom, brain and map behind header buttons.

### Title
Poster left (or top on phone), name and year as the headline, one line of facts in mono (runtime, rating, where it is on your services), Play in accent, then "why this" (the graph reason, with the people and titles as links), then the trailer, then cast as a face row, then the wiki page. Nothing in a card; sections separate by space and one hairline.

### Taste map
The sigma canvas, the user at the center as a face, rings of rated people and titles colored by rating bucket, the industry graph faint behind. A single mono legend bottom-left. Clicking anything opens the title layout in the drawer.

## Components

- Chip: pill, hairline border, accent tint at 18% on hover; text 12.5px.
- Poster card: 3:4 image, name below at 12.5px semibold, one line of metadata in ink-dim, a 1px accent ring when actionable.
- Face: circle on the canvas, 3:4 rounded rectangle everywhere else.
- Reason line: 12px ink-dim, names bold and linked, never longer than one line on laptop.
- Composer: 44px min height, hairline ring, accent ring on focus, Ask in accent.
- Drawer: right-aligned panel, 380px, hairline, scrolls internally; the page beneath never scrolls sideways.

## Copy

Plain, quick, a friend on the couch (see `src/lib/agent/system.md`). Buttons say the verb: Play, Ask, Skip. Empty states say what to do in one line. Errors say what broke and the next step, no apology.

## Process

1. Mood set: I propose three reference boards (Cursor chrome, Ryu's typographic work, one film-poster study) and Jake reacts before any screen is built.
2. Each layout is built once as static HTML against this doc (gstack `design-html`), reviewed (`design-review`), then ported to components.
3. Every PR touching UI runs the design review skill before merge.
