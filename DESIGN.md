# Headshot design system — board C, "Terminal for cinephiles"

Rewritten 2026-09-11 (session 4) from the winning board, per `SPEC.md` → "# v4 — You" → Design and `goals/v4.md` Chunk C item 3. The source of truth for every value below is `design/boards-v4/C-You.dc.html`, `C-Thread.dc.html` and `C-Log.dc.html`; the reasoning behind the direction is `design/research.md`. Where a value is not on a board it is marked **deviation** with the reason. Nothing here is inherited from the v3 Linear-style shell — that shell is what this replaces.

Anti-references, standing: bordered cards, stat tiles, uppercase letter-spaced mono labels, colored rating dots, poster walls, gradients, drop shadows, streaks, purple.

## Stance

Density is the personality. A cinephile's log is a dense object — a hundred and fifteen titles, two hundred hours, eight people you keep coming back to — and the honest way to draw it is tight rows, a small type scale and no chrome at all: regions separate by rhythm, by one ground shift, or by a single hairline used once. Posters mark, never shout: a 22px sliver beside a row is enough to recognise a film and small enough that eight in a column never become a wall, and they are the only color on any screen. Mono carries data and only data — years, counts, hours, timestamps, runtimes, imdb ids — at 11.5px where it reads as a readout rather than as styling, and never as a label and never in caps. Geist carries everything a person wrote or would say. One accent, amber, does one job: Play. If a screen has two amber things on it, one of them is a bug.

## Color

Dark, single theme. Four levels of ink on a near-black that is warm-neutral rather than blue.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0d0d0e` | the ground, every page, the drawer |
| `--bg-elev` | `#151517` | the assistant's bubble, follow-up chips, quiet fills |
| `--bg-raised` | `#1c1c1e` | your own bubble, an unchosen bucket button |
| `--line` | `rgba(230,230,227,0.07)` | the only rule: section headers, the rail, the composer |
| `--line-strong` | `rgba(230,230,227,0.16)` | the quiet (non-Play) button border |
| `--line-input` | `rgba(230,230,227,0.22)` | the live log-field underline |
| `--line-note` | `rgba(230,230,227,0.14)` | the optional-note underline |
| `--row-hover` | `rgba(230,230,227,0.05)` | row hover and the selected candidate |
| `--ink` | `#e6e6e3` | titles, figures that matter, what you wrote |
| `--ink-dim` | `#8b8b87` | prose, what the agent says, secondary rows |
| `--ink-faint` | `#62625f` | years in a row, quiet block labels, placeholders |
| `--ink-ghost` | `#3f3f3d` | mono metadata, timestamps, keyboard hints |
| `--accent` | `#f0b429` | one job: Play |
| `--accent-ink` | `#17140b` | the label on the accent fill |
| `--bar` / `--bar-strong` / `--bar-weak` | `rgba(230,230,227,0.30 / 0.55 / 0.22)` | ledger bars — ink at a fixed alpha, never a hue |
| `--person` / `--title` / `--session` | `#ded9c9` / `#7d8cc4` / `#62e6b4` | **canvas only** (the v2 brain graph). Not used on any v4 screen. |
| `--danger` | `#d9705e` | **deviation** — board C has no error color. Text only, on an irreversible action; never a filled surface. |

**Ratings have no color.** The four buckets are words in Geist — `liked` `meh` `want` `seen` — and the only difference between them is weight and ink level: `liked` is `--ink` at 600, everything else is `--ink-dim` at 400. This is the rule that keeps posters the only color on the screen (see `design/research.md` §4 and §9); a colored dot per bucket is exactly the failure mode being avoided.

Other rules: the accent never fills anything except the Play button (and exactly one Play per view — the second and third pick use the quiet button). Loading and error states are ink and words. No gradients on any surface; the one gradient left in the stylesheet is `.field-canvas`, behind the sigma graph. No drop shadows anywhere, no blur, no glass.

## Type

Two families, loaded in `src/app/layout.tsx` with `next/font/google` and exposed as `--font-sans` / `--font-mono` (Tailwind's `font-sans` / `font-mono`):

- **Geist** — prose, titles, buttons, nav, the bucket words. Everything a person wrote or would say.
- **JetBrains Mono** — figures, years, counts, hours, runtimes, timestamps, episode counts, imdb ids, keyboard hints. `tabular-nums` always on. Never a label, never uppercase, never letter-spaced.

The scale, as utility classes in `src/app/globals.css`:

| Class | Family | Size / weight / line-height / tracking | Where |
|---|---|---|---|
| `.t-title` | Geist | 17 / 600 / 1.2 / −0.015em | every section and page heading. Sentence case, lowercase-leading (`recently logged`, `what I know about you`). |
| `.t-sub` | Geist | 13 / 400 / 1.3, `--ink-faint` | the quiet label over a ledger block or a table (`by decade`, `who you keep watching`) |
| `.t-strong` | Geist | 13 / 600 / 1.3, `--ink` | a heading inside a prose column (`what you love`, `notes`) |
| `.t-prose` | Geist | 13.5 / 400 / 1.54, `--ink-dim` | the memory, any paragraph |
| `.t-say` | Geist | 14 / 400 / 1.52, `--ink-dim` | what the agent says, inside a bubble |
| `.t-reason` | Geist | 14.5 / 400 / 1.4, `--ink-dim` | the one graph reason under a pick |
| `.t-note` | Geist | 14.5 / 400 / 1.5, `--ink` | your own line, quoted back. 13px inline when it sits in a log row. |
| `.t-row` | Geist | 14 / 500 / 1.2, `--ink` | the title in a list row |
| `.t-ui` | Geist | 13.5 / 500 / 1.2 | rail items, secondary buttons |
| `.t-meta` | Mono | 11.5 / 400 / 1.3, `--ink-ghost` | timestamps, runtimes, `film · 157m`, `tt0113277`, `⏎` |
| `.t-fig` | Mono | 13.5 / 400 / 1.2, `--ink` | the figure in a ledger row (`99`, `202`, `8`) |
| `.t-input` | Mono | 18 / 400 / 1.2 / −0.01em, `--ink` | what you are typing into the log field |
| `.t-link` | Geist | 12.5 / 400 / 1.3, `--ink-dim`, 1px underline at 40% ink-dim | `edit`, `the whole log`, `all of it` |
| `.bucket` / `.bucket-on` | Geist | 12.5 / 400 `--ink-dim` / 12.5 / 600 `--ink` | the rating word in a row |
| `.chip` | Geist | 13 / 400 / 1.2, `--ink-dim` | follow-ups |
| `.btn` | Geist | 13.5 / 600 (14 / 600 on the bucket and confirm buttons) | every button |

Fixed points that are not in the table: the wordmark is Geist 14 / 700 / −0.02em `--ink`; a year inside a row is `.t-meta` at `--ink-faint` (not ghost) so it sits above the runtime; a season marker (`s1`) is `.t-meta` `--ink-faint` set inline inside the `.t-row` title.

Entity names inside prose and bubbles are `font-weight: 500` at `--ink` and are always links (`.entity-link`) — the "cursor for movies" rule. The link shows a hairline underline on hover only; the accent does not do this job. A bare unlinked name in agent prose is a bug.

**Never** an uppercase tracked label, in either family. Section headings are sentence-case Geist at 17px; block labels are sentence-case Geist at 13px in `--ink-faint`. That is the whole label system.

## Rhythm

- **Grid.** 2px base, 4px preferred. The board's real vocabulary: gaps of 4, 6, 7, 10, 12, 14, 16, 18, 22, 26, 28, 34, 38, 40, 56; row heights of 24, 32, 38, 42, 44, 46, 68.
- **Row heights.** Ledger row 24. Receipt row (under an answer) 32. Log / table / recently-logged row 38. Log-field candidate 42. Tonight pick 68. Every button and input 44–46.
- **Row gaps.** 16 in a 38px row, 14 in a 32px row, 18 in a 68px row, 14 in a ledger row. Rows stack with **zero** gap and **no** rule between them; the only hairline in a section is under its header.
- **Sections.** `gap: 38px` between sections on You, `30px` on Log and Thread. A section header is a baseline row (`gap: 12px`) with a 10px bottom pad and one `--line` rule under it.
- **Rail.** 232px wide (v5), `border-right: 1px var(--line)`, padding `22px 12px 18px 12px`; rows carry their own 12px inset and 4px hover shape, so the rail has no internal gap of its own.
- **Page.** Content padding `22px 34px 40px` (You) / `22px 34px 32px` (Thread, Log). Gutter is therefore 34px on a laptop.
- **Column widths.** Prose and thread cap at **880px**. The instrument sections (log field, candidates, picked title, receipts) cap at **1000px**. The ledger and the log table run the full content column (1264px at a 1440px viewport). The memory is three equal columns with a `0 34px` gap; the people ledger is four equal columns with a `6px 40px` gap.
- **Phone (390px)** — `design/boards-v5/Shell-phone.dc.html` for the shell, a deviation elsewhere. Rules: the rail becomes a 44px top bar (wordmark left; on Ask, signed in, a `chats` label and a `+` pushed right — no hamburger, no account) plus the bottom tab bar of three 54px cells; sessions open as a sheet from `chats`. Gutter drops to 16px, section gap to 28px. Every list row becomes two lines at 52px: line one is poster-mark + title + year, line two is the mono meta (`3h ago · liked · film · 157m`), or the note if there is one. A tonight pick becomes a block: poster and reason on top, Play full-width at 44px below. The memory's three columns become one. Ledger rows keep 24px with a 96px label column and a 40px figure column. Bubbles cap at 86% and the composer is pinned with `env(safe-area-inset-bottom)` added to its bottom pad. Nothing horizontal scrolls except the log table, which scrolls inside its own container.

## Layouts

Every screen is `232px | 1fr`: the rail, then one content column with the composer pinned at its bottom. There is no second panel and no resident canvas.

### You

```
┌──────────┬──────────────────────────────────────────────────────────────┐
│ headshot │ what I know about you   rewritten 3h ago            edit ─── │
│          │ ┌───────────────┬───────────────┬──────────────────────────┐ │
│ you      │ │ what you love │ (continues)   │ right now                │ │
│ history  │ │ prose…        │ what you avoid│ notes                    │ │
│          │ └───────────────┴───────────────┴──────────────────────────┘ │
│          │ ──────────────────────────────────────────────────────────── │
│          │ recently logged   8 of 115                  the whole log ── │
│          │ just now   ▌ Zodiac                 2007  seen  film · 157m  │
│          │ 3h ago     ▌ Heat                   1995  liked "the diner…" │
│          │ ──────────────────────────────────────────────────────────── │
│          │ tonight   3 picks · all already paid for                     │
│          │ ▐▌ The Dark Knight Rises makes it 8 for …   [ Play on Max ]  │
│          │    2012 · 165m · hbo max                                     │
│          │ ──────────────────────────────────────────────────────────── │
│          │ numbers   everything Letterboxd never gave you     all of it │
│          │ what you have watched          by decade                     │
│          │ films   99 ████████▌           2010s  22 ██████████          │
│          │ shows   16 ██                  2000s  18 ████████▎           │
│          │ who you keep watching                                        │
│          │ Nolan 8 ███  Lucas 8 ███  Daniels 7 ██▌  Damon 6 ██          │
│ jake     │ ──────────────────────────────────────────────────────────── │
│ 115·202h │ >  log something, or just ask                              ⏎ │
└──────────┴──────────────────────────────────────────────────────────────┘
```

Order is fixed: memory, recently logged, tonight, numbers, services, imports, later, the swipe button. Rules that matter:

- **Log field.** It is the composer. There is no separate log box at the top of You: one pinned field at the bottom of every page, `> log something, or just ask`, and typing a title opens the log flow described under **Log field** below. (**Deviation** from v4 chunk A, which put the log input at the top of You; board C puts one prompt at the bottom of all three screens and SPEC's "one home and one composer" rule agrees.)
- **Memory.** Three columns of `.t-prose`, `6px` between paragraphs, `.t-strong` headings with `4px` under them and `14px` above a second heading in the same column. `rewritten 3h ago` is `.t-meta` beside the heading; `edit` is a `.t-link` pushed right with `margin-left:auto`. The pinned notes (`"I like movies."`, `"the diner scene…"`) are `.t-note` at `--ink`, quoted, in the third column. The memory section has **no** rule under its header — it is the page's opening and needs no seam.
- **Recently logged.** Ten rows, `.row` at 38px, columns `88px 26px minmax(0,320px) 48px 64px minmax(0,1fr)`. Left gutter is the time (`.t-meta`, `just now` / `1h ago` / `3h ago`) — the Linear "Now" gutter, lifted. Then the 22px poster, the title, the year, the bucket word, then either the mono meta (`film · 157m`, `show · 7 eps`) or, when the entry has a note, the note in Geist 13px `--ink-dim` in quotes. The note beats the metadata; it is the most human line on the page.
- **Tonight.** Header `tonight` + `.t-meta` `3 picks · all already paid for`. Three `.row-tall` at 68px, columns `34px minmax(0,1fr) 178px`, gap 18. Poster 34×51, then the reason (`.t-reason`, one line, names bold and linked) over a `.t-meta` line `2012 · 165m · hbo max`, then a 44px button in a fixed 178px column. **The first pick's button is `.btn-play`; the second and third are `.btn-quiet`.** Exactly one accent on the page. Every pick carries exactly one reason and it is a graph fact (`graphReason`) — no reason, no pick.
- **Numbers ledger.** Two columns, `28px 56px` gap, the third block (`who you keep watching`) spanning both. Each block is a `.t-sub` label over `.row-fig` rows: `108px 52px minmax(0,1fr)` gap 14 — label, figure, bar. The bar is 5px tall, width is the value as a percentage of the block's max, and its alpha ranks it (0.55 / 0.48 / 0.34 / 0.22). The last row of a block may swap the bar for a mono aside (`152 finished end to end · tv is 11% of what you like`). The people block is four columns of `minmax(0,1fr) 30px 72px` gap 10. Labels are Geist except decades, which are figures and therefore mono. **No tiles, no boxes, no headline numbers.** The full page is behind `all of it` (`.t-link`).
- **Services, imports, later.** Same grammar, no new one: a `.section-head`, then rows. Services is a single wrapped line of service names in `.t-prose` with the ones you pay for at `--ink` and the rest at `--ink-ghost` (**deviation** — the board states them as prose in the memory; toggles are rows at 38px: name, then `.t-link` `on` / `off`). Imports is three rows (Letterboxd, Netflix, IMDb), each `name — .t-meta "last imported 3h ago · 412 rows" — .t-link "replace"`. Later is the recently-logged row form with the time gutter replaced by `.t-meta` `added 2d ago`.
- **Swipe button.** One `.btn-quiet` at the end of Later: `Swipe through 30 you have probably seen`. Not a card, not a banner.

### Numbers

Full-width content column, no second rail. Blocks in order: per month, film vs TV, hours, people, decades, genres by bucket, then the log table.

- Every chart is **bars in rows**, the You ledger form at full width: `.t-sub` label, then `.row-fig` rows of `label | figure | bar`. Per-month is the one exception and is a row of 5px-wide vertical bars on a 56px baseline with mono month initials under it at `--ink-ghost`; no axis, no gridlines, no legend, no tooltip chrome beyond a mono readout that replaces the block's `.t-sub` on hover. Hand-drawn SVG, no chart library.
- Liked-vs-meh in the genres block is two bars in the same row, `--bar-strong` over `--bar-weak`, with the two figures in mono separated by a mono `·`. Not two colors.
- **The log table** is `.row` at 38px, columns `88px 26px minmax(0,360px) 48px 64px 96px minmax(0,1fr)`: time, poster, title, year, bucket, source (`log` / `letterboxd` / `netflix` / `imdb`, `.t-meta`), meta-or-note. A header row at 24px of `.t-sub` labels, clickable to sort; the active sort key goes to `--ink` with a mono `↓` after it. Filter is a 46px field with a `--line-input` underline, `>` prompt in mono at `--ink-ghost`, and `.t-meta` `115 rows · 8 shown` pushed right. No zebra striping, no row borders, no pagination chrome — it scrolls.

### Thread

**Ask (v5) below supersedes this section's header, column width and composer**; the bubbles, receipts and follow-ups are unchanged and still described here.

```
│ what do I like?   3h ago · 2 messages                                   │
│ ───────────────────────────────────────────────────────────────────────  │
│                                            ┌───────────────────┐        │
│                                            │ what do I like?   │        │
│                                            └───────────────────┘        │
│ ┌────────────────────────────────────────────────────┐                  │
│ │ you're a movies guy, full stop — TV is like 12% …  │                  │
│ │ the through-line: Star Wars, all of it. …          │                  │
│ └────────────────────────────────────────────────────┘                  │
│ what that came from                                                     │
│ ▌ Heat            1995  liked  your note, 3h ago                        │
│ ▌ The Terminator  1984  liked  1h ago                                   │
│ [ Play Heat ]   your own note is why it came up                         │
│ ( so what should I watch tonight? ) ( what else is like Heat? ) ( log it)│
│ ───────────────────────────────────────────────────────────────────────  │
│ >  log something, or just ask                                         ⏎ │
```

- Header: the thread's own question as `.t-title`, then `.t-meta` `3h ago · 2 messages`, one rule. 28px of air before the first bubble.
- Bubbles: stack `gap: 14px`, column cap 880px. Yours is `.bubble .bubble-you` — `--bg-raised`, radius `10 10 3 10`, padding `9px 15px`, Geist 14 at `--ink`, hugging its text at the right edge. The agent's is `.bubble .bubble-them` — `--bg-elev`, radius `10 10 10 3`, padding `14px 18px`, `max-width: 74%`, paragraphs as `.t-say` with an 11px gap. **Terse:** three short paragraphs, not a document; no headings, no bullet lists, no tables inside a bubble.
- **Receipts.** Under an answer, outside the bubble, left-aligned with a 2px inset: a `.t-sub`-sized line `what that came from` at `--ink-ghost` 12.5px with 6px under it, then `.receipt` rows at 32px, columns `26px minmax(0,260px) 44px 60px minmax(0,1fr)` gap 14 — poster, title, year, bucket, why it counted (`your note, 3h ago`, `george lucas · 8 of your titles`). A row for something you have only `seen` dims its poster to `opacity: 0.6`. This is the ledger form again; it is how an answer shows its work.
- **One playable thing.** A single `.btn-play` under the receipts (`Play Heat`) with a `.t-meta` aside beside it. It is the only accent in the thread.
- **Follow-ups.** `.chip` row, `gap: 9px`, 10px under the Play row. Quiet fill, no border, no pill radius (6px), Geist 13.
- Composer pinned at the bottom, same as everywhere.

### Log field

```
│ log   type it, hit a bucket, add a line if you have one. ten seconds.   │
│ ────────────────────────────────────────────────────────────────────── │
│ >  terminator ▉                                  3 matches · ↑↓ to pick │
│ ▌ The Terminator             1984  film  107m · already liked, 1h ago   │  ← selected
│ ▌ Terminator 2: Judgment Day 1991  film  137m · already liked, 1h ago   │
│ ▌ Fleabag                    2016  show  season 1 [2] · asked once…     │
│                                                                         │
│ ▐▌ Heat   1995 · film · 170m                              tt0113277     │
│ [liked] [ meh ] [ want ] [ seen ]       1 2 3 4                         │
│ #  the diner scene, two pros sizing each other up ▉  optional · verbatim │
│ [ log it ]  ⏎                                                           │
│ ────────────────────────────────────────────────────────────────────── │
│ logging this moves three things                                         │
│ your log            your numbers                what I know about you   │
│ 115 → 116 titles    202h → 205h · 1990s 12 → 13 rewrite queued          │
```

- **The field** is 46px tall with a single `--line-input` underline and no box: a mono `>` at 15px `--ink-ghost`, then `.t-input` (mono 18px), then the 8×18 block `.caret`, then `.t-meta` `3 matches · ↑↓ to pick` pushed right. Max width 1000px.
- **Candidates** start 10px under the field, `.row .row-pick` at 42px, columns `26px minmax(0,340px) 48px 74px minmax(0,1fr)` gap 16 — 22px poster, title, year, kind (`film` / `show`, Geist 12.5 at `--ink-dim`), then mono facts including the honest `already liked, 1h ago`. The selected candidate is `--row-hover` with a 4px radius, reached by the row's own `padding-inline:12px; margin-inline:-12px`. The unselected title sits at `--ink-dim`; the selected one at `--ink` 500. Keyboard first: ↑↓ and ⏎; the mouse is the fallback.
- **A show asks for the season once, inline in its own row** — mono `season` at `--ink-ghost`, then the numbers as mono 12.5 with the chosen one at `--ink` under a 1px underline, then `.t-meta` `· asked once, then never again`.
- **Picked**: a header line — 30×45 poster, name Geist 16/600, `.t-meta` `1995 · film · 170m`, imdb id in `.t-meta` pushed right. Then the **buckets**: four 44px buttons at 6px radius, `liked / meh / want / seen` in that order, the chosen one `.btn-solid` (ink fill, ground text) and the rest `.btn-fill` (`--bg-raised`, `--ink-dim`), with mono `1 2 3 4` 14px to the right of the set. Then the **note**: 42px, `--line-note` underline, mono `#` prompt, Geist 15px `--ink`, `.caret-sm`, `.t-meta` `optional · stored word for word` pushed right. Then `.btn-outline` `log it` with a mono `⏎` beside it.
- **What it moves** is stated plainly under a `--line` rule: `.t-sub` `logging this moves three things`, then three columns of Geist 13.5 `--ink` label over a `.t-meta` delta. Not a toast, not a confetti, not a card.

### Title drawer

**Deviation** — board C has no drawer artboard; this is derived from the Log board's picked-title header and the Thread's receipts.

A region, not a floating card: 420px, right-aligned, `--bg` ground, a single `border-left: 1px var(--line)`, no radius, no shadow, no blur. Slides in with `.sheet` (12px, 180ms); full-screen on a phone. Inside, at 22px / 24px padding:

1. Header row: 30×45 poster, name Geist 16/600, `.t-meta` `1995 · film · 170m`, a 32px close control on the right with a mono `esc` hint. Esc closes.
2. One `.btn-play` (`Play on HBO Max`) and, beside it, the bucket set as `.bucket` words that are clickable — logging from the drawer uses the same four words, not a new control.
3. The graph reason as `.t-reason`, one or two lines, names linked.
4. `who is in it` — `.row` at 38px, columns `minmax(0,1fr) 88px`: name, then `.t-meta` `8 of your titles` (or `first one` when it is new to you). People already in your taste sit at `--ink`; the rest at `--ink-dim`. No faces, no rings, no avatars.
5. `what you said` — the note, `.t-note`, when there is one.

### Sign-in and landing (signed out)

**Deviation** — no board. Both are one centred column, 560px max, on `--bg`, with the wordmark at 14/700 top-left and nothing else in the chrome.

- Landing: one first-person sentence at Geist **26px / 600 / −0.02em / line-height 1.25** at `--ink` (the one size above the board's 18px ceiling; a landing needs a single loud line and `design/research.md` §6 is explicit that the size contrast is where the voice lives). Under it, one `.t-meta` status line (`115 titles · 202 hours · rewritten 3h ago` for the demo, or the product's own one-liner). Then `Sign in` as a `.btn-outline`. Nothing else — no features, no screenshots, no footer.
- Sign-in: the same sentence shrunk to `.t-title`, then the email field drawn exactly like the log field — 46px, `--line-input` underline, mono `>` prompt, Geist 15px, block caret — then `.btn-outline` `Send the link`, then `.t-meta` `we'll email you a link. no password, ever.` After submit the field is replaced by one line of `.t-prose`: `sent. check your email.`
- The trivia chat and `/a/…` answer pages keep working signed out and use the Thread grammar unchanged.

### Catch-up deck (v5)

**Deviation** — no board. Posters are the only color, so here the poster *is* the screen; everything around it stays at the board's scale.

One centred column. The poster at **260×390**, no radius, no shadow, no card behind it. Under it: title `.t-row` at 16px/600, `.t-meta` `1984 · film · 107m`. Under that two `.btn-fill`s at 44px, `seen it` and `not seen`, with mono `s` / `n` hints; `seen it` reveals the row of ten (`ScoreRow`, 44px cells, five-and-five under the poster) and a digit commits and advances; `not seen` commits and advances. Top-right of the column: `.t-meta` `3 / 10`; bottom-left: `.t-link` `undo`, `.t-link` `done for now` (live from the first card). Rounds are ten. A card leaving is a 300ms translate-and-fade — no colored overlay, no stamp, no rotation beyond 2°. Round end shows the memory diff as two `.t-prose` lists, added lines at `--ink` with a mono `+`, removed at `--ink-faint` with a mono `−`, then `ten more` (`.btn-outline`) and `back to the log` (`.t-link`).

### Sidebar (v5)

Source: `design/boards-v5/Shell.dc.html`. 232px, `border-right: 1px var(--line)`, padding `22px 12px 18px 12px`, no background shift — it is the same ground as the page.

1. Wordmark `headshot`, Geist 14 / 700 / −0.02em, `--ink`, with 22px of air under it. No collapse control, no rail, no subtitle.
2. **Three sections and nothing else** — `log`, `ask`, `you`, in that order, gap 2px. Each is a 32px `.nav-row`: a 16px monoline stroke icon (`stroke: currentColor`, width 1.3) then a `.t-ui` label. Active is `--ink`, icon included; inactive `--ink-faint`. Hover is `--row-hover` at 4px. **No pill, no fill, no active bar** — the ink level is the state.
3. **Sessions live under Ask, and only when Ask is the surface**, indented to a 28px inset so the indent says whose they are: first a `new chat` row (28px, a 12px `+`, `--ink`), then one dim group header `chats` (Geist 13, `--ink-faint`, sentence case), then the threads as 28px `.session-row`s — Geist 13 at `--ink-dim`, the open one `--ink` 500, one line, truncating. Hover reveals `rename` and `×`; a double click renames in place. No timestamp column, no second line. Signed-out threads are never listed.
4. **Account footer** pinned with `margin-top: auto` over one `--line` hairline: a 32px `.rail-row` with the email in `.t-meta` at `--ink-faint`, truncating, and the 16px sliders glyph at `--ink-ghost` pushed right. Clicking it opens a `.panel` with `Settings` and `Sign out`. That hairline and the rail's own border are the only two lines in the sidebar.
5. **Signed out** the rail is two rows: `ask` and `sign in`. Nothing else, and no session list.

No Tonight item, no Later item, no taste map, no `/brain` link, no collapsed rail, no `115 · 202h` line.

### Ask (v5)

Source: `design/boards-v5/Shell.dc.html`, `Shell-phone.dc.html`. Content padding `22px 34px 32px` (16px gutters on a phone) with **one centred 720px column** inside it — the thread and the composer share that width.

- No thread header: the sidebar carries the title. The column starts with 28px of air, then the message stack at `gap: 14px`.
- Bubbles are board C's, unchanged: yours `.bubble-you` hugging the right, the agent's `.bubble-them` on the left capped at 74% (86% on a phone). The receipts ledger, the face grid and the path graphic sit under the bubble with the 2px inset, inside the same assistant row. Follow-ups are a `.chip` row.
- **Composer: one tier, 56px** (52px on a phone), the full column, `.composer-lg` — a `--line-input` hairline under it and no fill, no top rule, no box. A mono `>` at 15px `--ink-ghost`, Geist 15 text, a mono `⏎` at 11.5px pushed right, `stop` in its place while a turn is running. Enter sends, Shift+Enter is a newline; there is no send button, no `+`, no model selector. Pinned at the bottom with `env(safe-area-inset-bottom)`. Placeholder: `ask anything, or log what you just watched`.
- **The empty state of a new chat is the tonight opener**, computed on demand: one `.bubble-them` with the line the server wrote (`tonight: **X** on hbo max, because …`, names linked), then — left-aligned at the 2px inset — the 34×51 poster mark, one `.btn-play` carrying the service (`Play on HBO Max`; `.btn-quiet` `Where to watch` when there is no service) and a mono `.t-meta` `2012 · film · hbo max · already paid for`. That Play is the one accent in the view. On a phone the pick becomes a block: poster and meta on top, Play full width at 44px. While it is being computed the column says `finding one for tonight…` in `.t-meta`; with nothing to pick, `.t-prose` `log a few things and I'll have one for tonight.`; signed out, `.t-prose` `ask me who was in what. sign in and I'll know what you've seen.` It is never sent as a message and it disappears with the first turn.

## Components

Class names live in `src/app/globals.css`. Screens compose these with Tailwind for layout only; do not restate a size the class already sets.

- **`.row`** — `display:grid; align-items:center; gap:16px; height:38px; padding-inline:12px; margin-inline:-12px; border-radius:4px;` and `:hover / [aria-selected=true] { background: var(--row-hover) }`. Set `grid-template-columns` per list. **Rows carry no rule between them** — the board stacks them at `gap: 0` with nothing in between; the hairline belongs to the section header. Modifiers: `.row-tight` (32px, gap 14 — receipts), `.row-pick` (42px — candidates), `.row-tall` (68px, gap 18 — tonight), `.row-fig` (24px, gap 14, no inset — ledger).
- **`.poster-mark`** — 22×33, `object-fit: cover`, `display: block`, `--bg-raised` behind it while it loads. No radius, no ring, no border. `.poster-mark-md` 30×45 (a picked or drawer header), `.poster-mark-lg` 34×51 (a tonight pick). Those are the only three sizes outside the swipe deck's 260×390.
- **`.bucket` / `.bucket-on`** — Geist 12.5px, `--ink-dim` 400; `liked` (or whichever bucket is set) takes `.bucket-on`, `--ink` 600. **Deviation**: the brief called for a mono word; board C sets the bucket words in Geist, and mono is reserved for figures, so Geist wins.
- **`.receipt`** — `display:grid; align-items:center; gap:14px; height:32px;` under an answer; a `seen`-only row dims its poster to 0.6.
- **`.bubble` + `.bubble-you` / `.bubble-them`** — radius 10px with the speaker-side bottom corner at 3px; `--bg-raised` / `--bg-elev`; padding `9px 15px` / `14px 18px`; `max-width: 74%`; the agent's bubble is a flex column at `gap: 11px`.
- **`.composer`** — `border-top: 1px var(--line); padding-top: 16px; display:flex; align-items:center; gap:14px;` Inside: mono `>` at 13px `--ink-ghost`, a transparent borderless input at Geist 14 (`--ink` typed, `--ink-faint` placeholder `log something, or just ask`), `.t-meta` `⏎` pushed right. No ring, no fill, no rounded box, no send button.
- **`.composer-lg`** (v5) — the Ask composer: `display:flex; align-items:center; gap:14px; height:56px; border-bottom: 1px var(--line-input);` (52px / gap 12 on a phone). No top rule, no fill, no box, no send button. Inside: mono `>` at 15px `--ink-ghost`, a transparent borderless textarea at Geist 15, `.t-meta` `⏎` (or the `stop` link while a turn runs) pushed right.
- **`.nav-row` / `.session-row` / `.rail-row` / `.tab-cell`** (v5) — the rail's four shapes. `.nav-row` is the 32px section row (`grid 16px minmax(0,1fr)`, gap 11, 12px inset, 4px radius); `.session-row` is the 28px chat row (flex, 28px left inset, 12px right); `.rail-row` is any other 32px row (account footer, a menu item); `.tab-cell` is one 54px cell of the phone bar (column, gap 5). Hover on all three rail shapes is `--row-hover`; `.session-row.is-open` takes the same fill. None of them ever gets a pill, a border or an active bar.
- **`.chip`** — `--bg-elev`, radius 6, padding `8px 14px`, Geist 13 `--ink-dim`; hover lifts to `--bg-raised` / `--ink`. No border, ever.
- **Table** — see Numbers. `.row` at 38px, a 24px `.t-sub` header row, no striping, no borders, scrolls in its own container.
- **`.ledger-bar`** — `display:block; height:5px; background: var(--bar)`. `.ledger-bar-strong` (0.55) for the top one or two rows of a block, `.ledger-bar-weak` (0.22) for the tail. Width is the datum. Never a hue, never rounded, never animated on load.
- **`.btn`** — 44px, radius 6, `padding-inline: 22px`, Geist 13.5/600, no shadow, no gradient, 120ms color transition. `.btn-play` (accent fill, `--accent-ink` label) is the only filled accent and appears at most once per view. `.btn-quiet` (transparent, `--line-strong` border, `--ink-dim` 500) is the second and third Play and every secondary action. `.btn-solid` (ink fill, ground label, 14px) is a chosen bucket. `.btn-fill` (`--bg-raised`, `--ink-dim`, 14px/500) is an unchosen bucket. `.btn-outline` (transparent, 26% ink border, `--ink` label, 14px/600, `padding-inline: 26px`) is `log it`, `Send the link`, `Sign in`.
- **Drawer** — `.sheet` ground plus `border-left: 1px var(--line)`, 420px, internal scroll, no radius, no shadow. `.panel` still exists but is now **only** for a floating overlay (the autocomplete popover): `--bg-elev`, 1px `--line`, radius 6, no blur, no shadow. Never wrap page-flow content in it — that is a bordered card.
- **`.caret`** — 8×18 ink block, 1.1s step blink; `.caret-sm` is 8×16 for the note field.
- **`.t-link`** — the only "link-looking" thing outside prose: 12.5px `--ink-dim` with a 1px underline that goes to `--ink` on hover.

Removed from the system: `.stagger` (density does not arrive in a wave), the panel's blur / shadow / glass, the field vignette on every page, `--accent-soft` and any accent-tinted fill, `--bg-elev-solid`.

## Copy

Terse, sassy, sentence case, first person about you. The voice of `design/research.md` §6: the machine talks about you the way a friend who has read your log would — short, specific, a little rude when the data is funny (`The Godfather was a meh`).

- Headings are lowercase sentence fragments: `recently logged`, `tonight`, `numbers`, `log`, `what I know about you`. Never Title Case, never a noun-phrase label like "Statistics".
- Buttons are verbs: `Play`, `Play on HBO Max`, `log it`, `Send the link`, `Sign in`, `undo`, `skip`, `replace`, `edit`. Capitalise the first word only, and only where the control is a filled or outlined button; inline `.t-link` controls stay lowercase.
- Helper text is one line and tells you the cost: `type it, hit a bucket, add a line if you have one. ten seconds.` / `optional · stored word for word` / `asked once, then never again`.
- Metadata is written the way a terminal would: `film · 157m`, `show · 7 eps`, `2012 · 165m · hbo max`, `115 · 202h`, `8 of 115`, `3 matches · ↑↓ to pick`. Lowercase service names, mono, `·` as the separator.
- Empty states say what to do in one line, in the same voice: `nothing logged yet. type a title below.` Errors say what broke and the next step, no apology, no exclamation mark.
- Never: "Welcome back", "Your Stats", "Insights", "Powered by", emoji, an exclamation mark, a streak.

## Motion

Four things move, and only these:

1. **Hover and focus** — 120ms on color, background-color and border-color. Nothing scales, nothing lifts.
2. **The drawer / phone sheet** — 180ms, 12px from the right, `cubic-bezier(0.2, 0.8, 0.2, 1)` (`.sheet`).
3. **A row arriving** (a new log row, a streamed receipt) — `.rise`, 180ms, 4px, ease-out. Rows that arrive together arrive together; there is no stagger.
4. **A swipe card leaving** — 300ms translate and fade, ≤2° rotation.

The caret blinks at 1.1s in steps. Streaming text does not animate; it appears. Nothing animates on page load. `prefers-reduced-motion: reduce` turns every animation off and every transition to 0ms — already handled in `globals.css`; do not add a transition that escapes it.

## Process

1. Each screen is rebuilt against this document, then the gstack `design-review` skill is run on it before it merges. Every PR touching UI runs it.
2. Every screen is checked at 390px and at 1440px. The board is the 1440px truth; the phone rules in **Rhythm** are the 390px truth.
3. `pnpm typecheck && pnpm lint && pnpm test` green before anything is claimed to work.
4. When a value is not in this document, it comes from `design/boards-v4/C-*.dc.html`. When it is in neither, add it here with a one-line reason rather than inventing it in a component.
