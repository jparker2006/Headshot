# Headshot design system

Written before v3 code, per SPEC.md. Every screen is built against this document. Reference set: Cursor's product surfaces (cursor.com and the editor's chrome) and Ryu's work there. Anti-references: streaming poster walls, SaaS card grids, gamified streaks, purple gradients, rounded cards on rounded cards.

## Shell (revised 2026-09-11, after the "brain shouldn't be half the screen" note)

A 56px rail of icons on the left (Tonight, new question, history popover, taste map, brain, account). One reading column, 760px max, centered. No resident panel: the brain, an ego view, the taste map and the title drawer live in a panel that slides in from the right only when summoned (a name or poster tapped, "show me on the brain", the map or brain icon) and closes with one tap. On a phone the panel is a full-screen sheet. The inline chain graphic is the answer's picture; the canvas is exploration, not the default view.

Tokens moved to a Linear-style luminance scale: `--bg #08090a`, `--bg-elev-solid #0f1011`, `--bg-raised #191a1b`, `--ink #f2f1ec`, `--ink-dim #8a8f98`, `--ink-faint #62666d`, borders at 6% and 12% white. The warm accent stays and does one job (Play, the lit path, a link). Chips are quiet (hairline, 2% white) and only the Play pill is filled.

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
Direction chosen from the mood set (2026-09-11): board A's frame with board B's reason lines.
Laptop: three columns. Left rail (Tonight, taste map, brain, threads, account) 232px, collapsible. Center: the chat. The agent's opening message is already there: three picks as hairline-separated rows, each a small 48×64 poster, the reason line set large (22px, name bold, the rest ink-dim, people and titles as bold links), a mono metadata line (service, year, runtime), a Play pill in accent, and "later" in ink-faint. Beneath, the deck of eight as a compact poster strip with a "later · N" chip beside its label. Composer pinned at the bottom of the center column. Right: the taste map or the brain (520px).
Tonight is the surface and the name. Later is a chip, not a tab: dismissed picks and the imported watchlist land there, and the pick engine draws from it first.
Phone: one column. Picks as a full-width horizontal strip, reason under each, composer pinned at the bottom, brain and map behind header buttons.

### Title
Board: `design/boards/Title.dc.html`. Poster left (168×252, or top on phone), name and year as the headline, one mono facts line (runtime, rating, genres, where it is on your services, rent price if not), the graph reason set large in the reason-line style, then Play in accent with "later" and "seen it" chips and the trailer length. Cast as a face row, with the people already in your taste map ringed in accent. The brain page below with names as links. Right panel: where this title sits in your taste (its people you already like, lit). Nothing in a card; sections separate by space and one hairline.

### Taste map
Board: `design/boards/TasteMap.dc.html`. The sigma canvas, the user at the center as a face, ring 1 the people you keep watching (accent = liked, ink-dim = meh, size by count), ring 2 their titles in title blue, the industry graph faint behind. Rail shows the derived facts (you keep watching, average runtime finished, strongest decade, TV vs film). Filter chips top-right (people, titles, by decade). A single mono legend bottom-left. Clicking anything opens the drawer: the person, the one thing of theirs you have not seen with Play, and how they connect to your other people.
Home board: `design/boards/Main.dc.html`; the unchosen directions stay in `design/boards/` for reference.

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

## v4 note (2026-09-11, session 4)

This document is superseded for v4 by the process in `SPEC.md` → v4 → Design: research note first (`design/research.md`), three boards showing You, a thread and the log field, then this file is rewritten from the winning board. Standing constraints for the boards: posters are the only color; type carries the personality; the chat reads like messages, not documents; no bordered cards, no stat tiles, no mono uppercase labels. The taste map board is retired.
