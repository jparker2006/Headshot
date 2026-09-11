# Handoff — board C, "Terminal for cinephiles"

For the agents rebuilding You / Numbers, Thread, Log field + drawer, sign-in, landing, swipe, sidebar. Full spec: `DESIGN.md`. Board source of truth: `design/boards-v4/C-You.dc.html`, `C-Thread.dc.html`, `C-Log.dc.html`. Tokens and classes: `src/app/globals.css`. Fonts: `src/app/layout.tsx`.

## Fonts (already wired — do not re-add)

- **Geist** (`next/font/google`) → `--font-geist-sans` → Tailwind `font-sans`. Prose, titles, buttons, nav, bucket words.
- **JetBrains Mono** (`next/font/google`) → `--font-jetbrains-mono` → Tailwind `font-mono`. Years, counts, hours, runtimes, timestamps, imdb ids, keyboard hints. `tabular-nums` is on in `.t-fig` / `.t-meta` / `.t-input` / `.tnum`.

## The four rules you may not break

1. **No bordered cards.** Nothing in the page flow gets a border or a background box. Regions separate by space, by a ground shift, or by one hairline under a section header. `.panel` exists only for a floating autocomplete popover; the drawer gets one `border-left`.
2. **No stat tiles.** Every number is a row: label, mono figure, `.ledger-bar`. No big-number blocks, no chart library, no legends.
3. **No uppercase tracked labels, in either family.** Section headings are `.t-title` (Geist 17/600, lowercase sentence fragments); block labels are `.t-sub` (Geist 13, `--ink-faint`). Mono is figures only — never a label.
4. **One accent, one job.** `--accent` `#f0b429` appears only as `.btn-play`, and at most once per view. The second and third Play are `.btn-quiet`. Ratings are words (`.bucket` / `.bucket-on`), never colors. Posters are the only color on the screen.

Plus: rows have **no** rule between them; one composer, pinned at the bottom of every page; every entity name in prose is bold-500 and a link (`.entity-link`).

## Tokens

Ground `--bg` `#0d0d0e` · `--bg-elev` `#151517` · `--bg-raised` `#1c1c1e`
Lines `--line` `.07` · `--line-strong` `.16` · `--line-input` `.22` · `--line-note` `.14` · `--row-hover` `.05` (all `rgba(230,230,227,·)`)
Ink `--ink` `#e6e6e3` · `--ink-dim` `#8b8b87` · `--ink-faint` `#62625f` · `--ink-ghost` `#3f3f3d`
Accent `--accent` `#f0b429` · `--accent-ink` `#17140b`
Bars `--bar` `.30` · `--bar-strong` `.55` · `--bar-weak` `.22`
Radius `--radius` 6 · `--radius-row` 4 · `--radius-bubble` 10
Canvas-only (do not use on a v4 screen): `--person`, `--title`, `--session`. Text-only, irreversible actions only: `--danger`.

Tailwind colors available: `bg-bg`, `bg-elev`, `bg-raised`, `text-ink`, `text-ink-dim`, `text-ink-faint`, `text-ink-ghost`, `border-line`, `border-line-strong`, `bg-row-hover`, `text-accent`, `bg-accent`, `text-accent-ink`, `text-danger`, `rounded-panel`.

Gone — do not reference: `--bg-elev-solid`, `--accent-soft`, `.stagger`, the `.panel` blur/shadow, the `.field` vignette (`.field` is now flat; `.field-canvas` keeps the gradient for the sigma graph only).

## Type classes

`.t-title` 17/600/−.015em · `.t-sub` 13 faint · `.t-strong` 13/600 ink · `.t-prose` 13.5/1.54 dim · `.t-say` 14/1.52 dim · `.t-reason` 14.5/1.4 dim · `.t-note` 14.5/1.5 ink · `.t-row` 14/500 ink · `.t-ui` 13.5/500 · `.t-meta` mono 11.5 ghost · `.t-fig` mono 13.5 ink · `.t-input` mono 18/−.01em · `.t-link` 12.5 dim + 1px underline · `.tnum` (mono figures anywhere else).

## Primitives

`.row` (38px grid, gap 16, hover `--row-hover`, 12px inset — set `grid-template-columns` yourself) with `.row-tight` (32, receipts) / `.row-pick` (42, candidates) / `.row-tall` (68, tonight) / `.row-fig` (24, ledger)
`.poster-mark` 22×33 · `.poster-mark-md` 30×45 · `.poster-mark-lg` 34×51
`.bucket` / `.bucket-on` · `.receipt` · `.bubble` + `.bubble-you` / `.bubble-them` · `.chip` · `.ledger-bar` (+`-strong` / `-weak`)
`.btn` + `.btn-play` / `.btn-quiet` / `.btn-solid` / `.btn-fill` / `.btn-outline` (all 44px, radius 6)
`.composer` · `.section-head` · `.caret` / `.caret-sm` · `.sheet` · `.rise` · `.panel` (overlay only) · `.entity-link`

## Measurements you will need

Rail 176px, `padding 22px 0 22px 24px`, gap 26. Content `padding 22px 34px 40px` (You) / `22px 34px 32px` (Thread, Log). Section gap 38 (You) / 30 (Thread, Log). Section header: baseline flex, gap 12, `padding-bottom: 10px`, 1px `--line` under.

Grid templates, verbatim from the board:
- recently logged / log table row: `88px 26px minmax(0,320px) 48px 64px minmax(0,1fr)` gap 16
- tonight pick: `34px minmax(0,1fr) 178px` gap 18, height 68
- ledger row: `108px 52px minmax(0,1fr)` gap 14, height 24; people ledger `minmax(0,1fr) 30px 72px` gap 10 in 4 columns (`gap: 6px 40px`)
- receipt: `26px minmax(0,260px) 44px 60px minmax(0,1fr)` gap 14, height 32
- log candidate: `26px minmax(0,340px) 48px 74px minmax(0,1fr)` gap 16, height 42
- memory: 3 equal columns, `gap: 0 34px`, paragraphs 6px apart

Column caps: prose and thread 880px; log field / candidates / picked / receipts 1000px; ledger and log table run the full content column.

## Before you merge

Run the gstack `design-review` skill on the screen, check it at 390px (phone rules are in `DESIGN.md` → Rhythm) and at 1440px, then `pnpm typecheck && pnpm lint && pnpm test`.
