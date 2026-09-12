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
- **Column widths.** Prose and thread cap at **880px**. The instrument sections (log field, candidates, picked title, receipts) cap at **1000px**. The ledger and the log table run the full content column (1264px at a 1440px viewport). **v5.3: You is one column at 720px and the memory has no columns of its own** — the three-column memory and the four-column people ledger are gone with the essay.
- **Phone (390px)** — `design/boards-v5/Shell-phone.dc.html` for the shell, a deviation elsewhere. Rules: the rail becomes a 44px top bar (wordmark left; on Ask, signed in, a `chats` label and a `+` pushed right — no hamburger, no account) plus the bottom tab bar of three 54px cells; sessions open as a sheet from `chats`. Gutter drops to 16px, section gap to 28px. Every list row becomes two lines at 52px (`.row` carries this itself under `max-width: 767px`, which is also what makes the controls inside a row big enough to hit; `.row-fig`, `.row-tight`, `.row-pick` and `.row-tall` keep their own heights): line one is poster-mark + title + year, line two is the mono meta (`3h ago · liked · film · 157m`), or the note if there is one. A tonight pick becomes a block: poster and reason on top, Play full-width at 44px below. (v5.3: the memory is one column at every width, so there is nothing to collapse; a claim's marks wrap under its text.) Ledger rows keep 24px with a 96px label column and a 40px figure column. Bubbles cap at 86% and the composer is pinned with `env(safe-area-inset-bottom)` added to its bottom pad. Nothing horizontal scrolls except the log table, which scrolls inside its own container.

## Layouts

Every screen is `232px | 1fr`: the rail, then one content column with the composer pinned at its bottom (Log and You carry their own controls instead). There is no second panel and no resident canvas — the sigma brain, `/brain` and its search box were deleted in v5.

### You (v5)

**You (v5.3) below supersedes this section's layout, memory and numbers block**; the header, the `dropped` line and Later are unchanged and still described here.

The receipt, and nothing else (SPEC v5 → You page). Everything that was plumbing moved to **Settings (v5)**; tonight moved into Ask's empty state; recently logged and the charts are the Log page's. Three sections, `38px` apart (`28px` on a phone), no accent anywhere on the screen.

```
┌──────────┬──────────────────────────────────────────────────────────────┐
│ headshot │ what I know about you   rewritten 3h ago            edit ─── │
│          │ you are a movies guy, full stop — tv is 12% of what you …    │
│ log      │ the through-line is Star Wars, all of it. …                  │
│ ask      │ ──────────────────────────────────────────────────────────── │
│ you      │ numbers   everything Letterboxd never gave you               │
│          │ 130 titles, 222 hours. 113 films, 17 shows. mostly 2000s …   │
│          │ who you keep watching                                        │
│          │ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢                                      │
│          │ Nolan  Lucas  Damon  …                                       │
│          │ 8      8      6                                              │
│          │ by decade                                                    │
│          │ 2010s  22 ██████████                                         │
│          │ 2000s  18 ████████▎                                          │
│          │ ──────────────────────────────────────────────────────────── │
│          │ later   6 saved                              the whole list ─│
│ jake  ⚙  │ ▌ Andrei Rublev              1966              seen it       │
└──────────┴──────────────────────────────────────────────────────────────┘
```

Order is fixed: memory, numbers, later. Rules that matter:

- **Memory.** `.t-prose` through `MemoryProse`, `rewritten 3h ago` as `.t-meta` beside the heading, `edit` a `.t-link` pushed right with `margin-left:auto`. `edit` writes the pinned block only — the lines the rewrite copies through verbatim — and the same block has a roomier editor in Settings. The memory section has **no** rule under its header: it is the page's opening and needs no seam.
- **What the rewrite dropped (v5.2).** When `GET /api/taste/memory` carries a non-empty `dropped`, one `.t-meta` line sits under the memory header: `no longer in your log: **The Wire** and **Heat**` — lowercase-led like every other meta line, the titles the only thing in it at `--ink`, at most three named and then `and 2 more`. Beside it a `.t-link` `ok` which PUTs `{ dismissDropped: true }` and hides the line for good. It is a statement, not a toast: no fill, no icon, no timer. The line is `droppedLine` / `droppedParts` in `memoryDropped.ts`, tested.
- **One numbers sentence.** Everything the ledger used to say about totals is one line of `.t-prose`: `130 titles, 222 hours. 113 films, 17 shows. mostly 2000s and 2010s.` Terse, lowercase, no exclamation, three clauses at most, and a decade is only named when more than one title sits in it. The rule is `numbersSentence` in `numbersRules.ts` and it is tested, not eyeballed. **No tiles, no headline numbers, no charts** — the per-month and genre blocks are gone with the route's `months` and `genres`.
- **People row.** The top twelve, as one row of 52px faces with the name at 12.5px `--ink-dim` and the count in mono `--ink-ghost` under it. No bars: the order is the ranking, and a bar under a face would rank the same fact twice. It scrolls inside its own container on a narrow column rather than wrapping into a wall — the one place other than the log table where anything scrolls sideways.
- **Decades ledger.** The board's `.row-fig` form, unchanged: `108px 52px minmax(0,1fr)` gap 14 — label, figure, bar, the bar's width the datum and its alpha the rank. Top six. The label is mono, because a decade is a figure.
- **Later.** The `want` rows, newest first, `.row` at 38px: 22px poster mark, title, year, and one quiet `seen it` (`.t-link`) which writes `{ state: "seen" }` through the same `POST /api/taste/log` every other write goes through. The header's `the whole list` opens the Log on its `want` chip. No `remove`: unlisting something is a state, and the Log is where states are changed.
- **Signed out** it is the landing: one 26px first-person sentence, one `.t-meta` line, `Sign in` as a `.btn-outline`. Nothing else.

### You (v5.3)

v5.3 replaces the essay. The memory is claims with evidence, and the page is **one column at 720px** — the Ask width — with no two-column flow anywhere, on any viewport.

```
┌──────────┬──────────────────────────────────────────────────────────────┐
│ headshot │ what I know about you   rewritten 3h ago            edit ─── │
│          │ no longer in your log: The Wire and Heat               ok ── │
│          │ you like a slow build and a long memory.                     │
│          │                                                              │
│ log      │ crime with a long fuse        ▯ ▯ ▯          not me          │
│ ask      │                              9.9 10  9                      │
│ you      │ you finish what Fincher starts ▯ ▯                           │
│          │                               9  8.5                        │
│          │ romantic comedy       avoid   ▯ ▯            not me          │
│          │                               3  4                          │
│          │ 130 titles, 222 hours. 113 films, 17 shows. mostly 2000s …   │
│          │ ──────────────────────────────────────────────────────────── │
│          │ right now                                                    │
│          │ ▌ Severance                                    s2 · 3 eps    │
│          │ ──────────────────────────────────────────────────────────── │
│          │ later   6 saved                              the whole list ─│
│          │ ▌ Andrei Rublev              1966              seen it       │
│          │ ──────────────────────────────────────────────────────────── │
│          │ in your words                                    all notes ──│
│          │ the best hour of television anyone has shot                  │
│ jake  ⚙  │ The Leftovers                                                │
└──────────┴──────────────────────────────────────────────────────────────┘
```

Order is fixed: **the sentence, the claims, the numbers line, right now, later, in your words.** Rules that matter:

- **The sentence.** One line, 17px Geist at `--ink`, line-height 1.5. No bold, no name, no figure — it is the five-second answer and a number in it would send you reading instead. When the rewrite has not produced claims yet, the old `markdown` stands in, stripped of its headings and its `**`, as plain `.t-prose` paragraphs; with neither, one line: `nothing yet. log a few things, or tell the chat what you love.`
- **A claim row.** No rule between rows, 12px apart. Left: the text at 14.5px, `--ink` for a `love` and `--ink-dim` for an `avoid`, cut to twelve words (`truncateClaim`); an `avoid` carries the mono word `avoid` beside it as `.t-meta`, and that tag is the only thing that marks polarity — there is no colour on this page. Right: three to five marks, ordered by the score the log holds for them, best first (`orderEvidence`, cap 5). A title is a `.poster-mark poster-mark-md` (30 × 45); a person is `.poster-mark poster-mark-face` (30 × 30, square, the people-row crop) so a headshot is not forced into a poster. Under each mark its score, mono `tnum` at 11.5px `--ink-ghost` through `formatScore` — nothing when the row carries no score. Every mark opens the drawer. On a phone the marks wrap onto their own line under the text.
- **not me.** A `.t-link` in a `.tap` at the end of the row, hidden until the row is hovered or focused (`.claim-row .row-reveal`) and **always visible under `@media (hover: none)`** — a touch screen never hovers and would otherwise have no way to reject a claim. It removes the row on the spot and PUTs `{ rejectClaim: id }`; the rewrite makes it permanent, and the rejected text never comes back.
- **The numbers line.** `numbersSentence`, unchanged, as the last `.t-prose` line of the claims section — it is one sentence about the log, so it sits with the other sentences. **The people row and the decades ledger are gone** with `ledger.ts`: a claim with five posters under it ranks the same facts and says where they came from.
- **right now.** The series you are part-way through, from the rows and never from the model: `season` is set and the row is neither `want` nor `unseen`, most recently touched first, six at most (`rightNowRows`). A `.row`: poster mark, title, then mono `s2 · 3 eps` pushed right — the episode count is dropped when it is zero. The whole section, header included, is absent when nothing is running.
- **later.** Unchanged from v5: the `want` rows, `seen it` per row, `the whole list` into the Log's `want` chip.
- **in your words.** The pinned lines first, each one a `.t-note` quote, then the newest six log rows that carry a note: the note as a `.t-note` quote with the title under it as `.t-meta`, the whole thing clickable into the drawer. `all notes` opens the Log on its new `noted` chip. Absent when there is neither a pinned line nor a note.
- **What changed from v5.** Out: `MemoryProse` on this page and the three-column flow, the people row, the decades ledger, `ledger.ts`. In: the sentence, the claim rows, `right now`, `in your words`, and a 720px column. Kept exactly as they were: the header with `rewritten Nm ago` and `edit`, the `dropped` line with `ok`, and Later.

### Settings (v5)

`/settings`, reached from the account row at the bottom of the rail and from nowhere else. It keeps the rail — it is a place inside the product, not a modal — but nothing in the rail is lit, because you are not in Log, Ask or You (`AppShell`, `surface={null}`). Column caps at 880px; sections separate by the page's own rhythm, a `.section-head` with one hairline under it and then rows.

1. **account** — the email as one 38px row, then `Sign out` as a `.btn-outline` and `delete account` as a `.t-link`. Deleting asks once: the link becomes `delete everything?` at `--danger` with a `.t-meta` aside (`the log, the memory and the chats. no undo.`) and only the second click calls `DELETE /api/me`; then the client signs out and lands on `/`. Blurring puts it back. This and the rail's `×` are the only two places the danger ink appears, and it is text — never a filled surface.
2. **services** — the checklist as it was on You: 38px rows, the name, `on` / `off` as a `.t-link`, saved on tap. A Save button for six words is chrome. The list caps at **420px**, not the section's 880: a one-word name and a two-letter state read as one row only while they are near each other, and the count in the header (`4 of 12`) waits until there is a list to count.
3. **imports** — the username first and the file second, because that is the order of effort. `letterboxd` is a 46px field drawn exactly like the log field (mono `>`, one `--line-input` hairline), `Import` as a `.btn-outline`, and one `.t-meta` line beside it carrying the whole progress report: `importing…` / `done. 412 titles.` / `that profile is private. export the CSV instead.` / `no profile by that name.` The CSV control is revealed by that line, or by the `.t-link` `use the CSV export instead`; under it the Netflix and IMDb rows, unchanged.
4. **in your words** — the pinned block, one textarea on a `--line-note` underline with `Save`, the same PUT as You's `edit`. It is here as well as there because this is where you would come to write a paragraph rather than a line.

### Welcome (v5)

`/welcome/services` → `/welcome/letterboxd` → `/welcome/catch-up` → `/`. Under a minute is the specification, so the whole of onboarding is three pages of one column each, and **no step carries more than one line of copy**.

- No rail: there is nothing to navigate to yet. The wordmark sits top-left at 14/700 and nothing else is in the chrome — the sign-in grammar.
- One column at 560px (**420px** for the deck — that is the deck's own width, so the header, the card and `skip` share one left edge; a wider column would leave the centred card sitting off the axis of everything above it), a `.t-title` header, a `.t-meta` `step 2 of 3` pushed right on the same baseline, then the step's own control, then `skip` as a `.t-link`. No progress bar, no illustration, no "Welcome back".
- The column is **centred in the page**, the way sign-in's is — onboarding uses the sign-in grammar, and a step is one short column, not a header with a screenful of air under it.
- `skip` goes exactly where `next` goes — skipping a step is finishing it with nothing — and the order, the hrefs and the label are `welcomeModel.ts`, tested.
- Step 2 says `importing in the background. carry on.` and hands over a `Next`: the crawl is not something to watch.
- Step 3 is the catch-up deck component the Log page opens inline, reused and never forked.
- Getting there: sign-in's `next` for a fresh account, or the shell noticing on `/` that a signed-in user has an empty log and no services. That sends them once and remembers it in `localStorage` under `headshot:welcomed` — the rule is `shouldWelcome`, also tested. There is no `/onboarding` any more.

### The log table

The Log page's table, the one place a figure still gets a column of its own. **The charts are gone** (SPEC v5 → Delete list): there is no Numbers page, no per-month bars, no genre block and no `all of it` link — You says the totals in one sentence and this table says the rest.

- `.row` at 38px: poster, title, year, kind, score, date, runtime, folding to two lines on a phone. A 24px `.t-sub` header row. Chips above it for the state, the score and the kind, one at a time, plus a text filter; `.t-meta` `115 rows · 8 shown` pushed right. Arriving from You's Later opens it on the `want` chip. No zebra striping, no row borders, no pagination chrome — it scrolls in its own container.
- **Scores are written with one decimal, and only when there is one** (v5.1): `9.7` keeps its tenth, `8` stays a bare `8` — never `8.0`. One helper, `formatScore` in `src/components/log/scoreRules.ts`, is what every score on every screen goes through: the log table, the drawer's line, the receipts, the You rows. The row of ten stays ten whole cells — a tap is a tap — and a decimal value lights the cell it is nearest to (9.7 lights the 10) with the exact figure set in mono beside the row. Someone who means 9.7 types it into the small tenths field next to the ten, which is offered in the log field and the drawer and nowhere else.

**Log field (v5.3).** The field is labelled: a `.t-sub` line above it, `log something you just watched`, and the placeholder is `The title, then a score` — without them the field reads as a search box, which is the one thing it is not. The mono `>` and the `↑↓ to pick · ⏎ to open` hint stay. Once a title is picked, the rating step becomes a **block** (`.log-block`: `--bg-elev` fill, 1px `--line`, 12px radius, 18px padding) — the one filled box on the page, because rating is a step and not a loose row: `.poster-mark-md`, the title at 16px/600, `year · kind · runtime` (the runtime only when the log already knows it — the candidate payload carries none), the row of ten with the tenths field, `want` / `seen, not rated`, the season row, the note field, then `log it` and `cancel`. After a write the block collapses, the field clears and takes focus back, and one `.t-meta` line sits under it for ten seconds: `logged Heat 9 · undo`, the score through `formatScore` or the state word. `undo` DELETEs the row and the line becomes `undone` for two seconds. The steps and their durations are `logFieldState.ts` (idle → picked → logged → idle), tested.

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

**Remove from log (v5.2).** Under the `want` / `seen` links, and only when the title actually has a row, one `.t-link` `remove from log` in a `.tap`. It is irreversible — the row, its logging episodes and what the memory said about the title all go — so it asks once, the Settings two-step exactly: the word becomes `remove?` at `--danger` with a `.t-meta` aside (`the row and what I said about it. no undo.`) and only the second click calls `DELETE /api/taste/log { imdbId }`; blurring puts it back. On success the drawer's own state falls to "not logged" (the row of ten clears, the taste line goes) and `logBus` is bumped so the Log and You re-read. The words and the two-step are `removeState.ts`, pure and tested; this is the third and last place the danger ink appears.

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
3. **Sessions live under Ask, and only when Ask is the surface**, indented to a 28px inset so the indent says whose they are: first a `new chat` row (28px, a 12px `+`, `--ink`), then one dim group header `chats` (Geist 13, `--ink-faint`, sentence case), then the threads as 28px `.session-row`s — Geist 13 at `--ink-dim`, the open one `--ink` 500, one line, truncating. The open one is whichever thread the column is showing, including the one a new chat has just been given. Hover reveals `rename` and `×` (`.row-reveal`); a double click renames in place. No timestamp column, no second line. Signed-out threads are never listed.
   - **Deviation** — the revealed controls are `display: none` until wanted rather than faded, so the title gets the whole row instead of being squeezed by two invisible buttons, and under `@media (hover: none)` they are simply always there: a touch screen never hovers, and rename and delete are otherwise unreachable on a phone.
   - **Deviation** — deleting a chat is irreversible and has no undo, so the `×` asks once: it becomes `delete?` at `--danger` and only the second click commits (leaving the row, or blurring, puts it back). This is the one place the danger ink appears.
4. **Account footer** pinned with `margin-top: auto` over one `--line` hairline: a 32px `.rail-row` with the email in `.t-meta` at `--ink-faint`, truncating, and the 16px sliders glyph at `--ink-ghost` pushed right. Clicking it opens a `.panel` with `Settings` and `Sign out`. That hairline and the rail's own border are the only two lines in the sidebar.
5. **Signed out** the rail is two rows: `ask` and `sign in`. Nothing else, no session list, and **no account footer** — a second `sign in` under the first one is the same control twice.
6. **Phone.** The rail is not the phone sheet. The three sections are the bottom tab bar and the wordmark is in the top bar, so `chats` opens a sheet carrying only `new chat`, the `chats` header, the sessions and the account footer (**deviation** — the phone board has no account anywhere, and signing out has to be reachable).

No Tonight item, no Later item, no taste map, no `/brain` link, no collapsed rail, no `115 · 202h` line.

### Ask (v5)

Source: `design/boards-v5/Shell.dc.html`, `Shell-phone.dc.html`. Content padding `22px 34px 32px` (16px gutters on a phone) with **one centred 720px column** inside it — the thread and the composer share that width.

- No thread header: the sidebar carries the title. The column starts with 28px of air, then the message stack at `gap: 14px`.
- Only what you said is a bubble (`.bubble-you`, hugging the right). The reply is `.reply`: plain prose across the full column, no fill, no cap, Geist 15 at 1.6 (Jake, 2026-09-12: "the agent should just be responding in the chat, not in a bubble, like Claude or ChatGPT"). `.bubble-them` is retired. The receipts ledger, the face grid and the path graphic sit under the bubble with the 2px inset, inside the same assistant row. Follow-ups are a `.chip` row, and chips read like every other label here — sentence case, lowercase-leading (`what else is like Heat?`). The model capitalises its suggestions, so the client lowers the opening word when it is one of the words a question starts with, and leaves a chip that opens on a name alone.
- **Receipts, deviation.** The board draws a poster ledger under the answer (title, year, rating, why it counted). We only ever state what the message itself carries — the entities the agent put on the brain and which taste tools actually returned — so the line under `what that came from` is one `.t-meta` row at the receipt's 32px (`from your log · 3 titles · 8 people`) and there is no row at all when there is nothing honest to say. Inventing provenance to fill the ledger would be worse than the shorter line. The full ledger comes back when the answer carries per-title facts.
- **Composer (v5.1): one tier that grows**, `.composer-lg` — a `--line-input` hairline under it and no fill, no top rule, no box. 56px tall empty (52px on a phone) and it grows with the text, one line at a time, to six lines on a laptop and four on a phone; past that it scrolls inside itself, and it drops back to one line the moment a message is sent. Focus deepens the hairline over 120ms — the only focus signal it gets. **Deviation**: the brief said `--line-strong`, but at 0.16 that is fainter than the resting `--line-input` at 0.22, so focus would have dimmed the line; it goes to `--ink-faint` instead, the next step up. A mono `>` at 15px `--ink-ghost` in front, Geist 15 text, and at the right end a 32px control: an ink arrow glyph (inline SVG, no icon library) at `--ink` when there is something to send, `--ink-ghost` and inert when the box is empty, and a filled stop square while a turn is running — tapping it stops the turn. The `⏎` hint is gone; the arrow says it. Enter sends, Shift+Enter is a newline, and an Enter that belongs to an IME composition is left alone. The box is disabled while a send is in flight. Pinned at the bottom of the column, 32px under it on a laptop and 12px on a phone, where the tab bar sits under it and is the thing that carries `env(safe-area-inset-bottom)`, so the composer must not add it a second time. Placeholder: `ask anything, or log what you just watched`. The rules — `keyAction`, `rowsFor`, `sendState` — are pure, in `src/components/chat/composerRules.ts`.
- **The empty state of a new chat is the tonight opener**, computed on demand: one `.bubble-them` with the line the server wrote (`tonight: **X** on hbo max, because …`, names linked), then — left-aligned at the 2px inset — the 34×51 poster mark, one `.btn-play` carrying the service (`Play on HBO Max`; `.btn-quiet` `Where to watch` when there is no service, and the same quiet `Where to watch` opening the title's drawer when there is no link at all — the row always has one thing to do) and a mono `.t-meta` `2012 · film · hbo max · already paid for`. That Play is the one accent in the view. On a phone the pick becomes a block: poster and meta on top, Play full width at 44px. While it is being computed the column says `finding one for tonight…` in `.t-meta`; with nothing to pick, `.t-prose` `log a few things and I'll have one for tonight.`; signed out, `.t-prose` `ask me who was in what. sign in and I'll know what you've seen.` It is never sent as a message and it disappears with the first turn.

## Components

Class names live in `src/app/globals.css`. Screens compose these with Tailwind for layout only; do not restate a size the class already sets.

- **`.row`** — `display:grid; align-items:center; gap:16px; height:38px; padding-inline:12px; margin-inline:-12px; border-radius:4px;` and `:hover / [aria-selected=true] { background: var(--row-hover) }`. Set `grid-template-columns` per list. **Rows carry no rule between them** — the board stacks them at `gap: 0` with nothing in between; the hairline belongs to the section header. Modifiers: `.row-tight` (32px, gap 14 — receipts), `.row-pick` (42px — candidates), `.row-tall` (68px, gap 18 — tonight), `.row-fig` (24px, gap 14, no inset — ledger).
- **`.poster-mark`** — 22×33, `object-fit: cover`, `display: block`, `--bg-raised` behind it while it loads. No radius, no ring, no border. `.poster-mark-md` 30×45 (a picked or drawer header), `.poster-mark-lg` 34×51 (a tonight pick). Those are the only three sizes outside the swipe deck's 260×390.
- **`.bucket` / `.bucket-on`** — Geist 12.5px, `--ink-dim` 400; `liked` (or whichever bucket is set) takes `.bucket-on`, `--ink` 600. **Deviation**: the brief called for a mono word; board C sets the bucket words in Geist, and mono is reserved for figures, so Geist wins.
- **`.receipt`** — `display:grid; align-items:center; gap:14px; height:32px;` under an answer; a `seen`-only row dims its poster to 0.6.
- **`.bubble` + `.bubble-you` / `.bubble-them`** — radius 10px with the speaker-side bottom corner at 3px; `--bg-raised` / `--bg-elev`; padding `9px 15px` / `14px 18px`; `max-width: 74%`; the agent's bubble is a flex column at `gap: 11px`.
- **`.composer`** — `border-top: 1px var(--line); padding-top: 16px; display:flex; align-items:center; gap:14px;` Inside: mono `>` at 13px `--ink-ghost`, a transparent borderless input at Geist 14 (`--ink` typed, `--ink-faint` placeholder `log something, or just ask`), `.t-meta` `⏎` pushed right. No ring, no fill, no rounded box, no send button.
- **`.composer-lg`** (v5, grown in v5.1) — the Ask composer: `display:flex; align-items:center; gap:14px; min-height:56px; padding-block:8px; border-bottom: 1px var(--line-input); transition: border-color 120ms;` with `:focus-within` taking the border to `--ink-faint` (see the deviation above) (min-height 52 / gap 12 on a phone). No top rule, no fill, no box. Inside: mono `>` at 15px `--ink-ghost`, a transparent borderless auto-growing textarea at Geist 15 / 22px line, and the 32px send-or-stop control pushed right.
- **`.nav-row` / `.session-row` / `.rail-row` / `.tab-cell`** (v5) — the rail's four shapes. `.nav-row` is the 32px section row (`grid 16px minmax(0,1fr)`, gap 11, 12px inset, 4px radius); `.session-row` is the 28px chat row (flex, 28px left inset, 12px right); `.rail-row` is any other 32px row (account footer, a menu item); `.tab-cell` is one 54px cell of the phone bar (column, gap 5). Hover on all three rail shapes is `--row-hover`; `.session-row.is-open` takes the same fill. None of them ever gets a pill, a border or an active bar.
- **`.chip`** — `--bg-elev`, radius 6, padding `8px 14px`, Geist 13 `--ink-dim`; hover lifts to `--bg-raised` / `--ink`. No border, ever.
- **Table** — see The log table. `.row` at 38px, a 24px `.t-sub` header row, no striping, no borders, scrolls in its own container.
- **`.ledger-bar`** — `display:block; height:5px; background: var(--bar)`. `.ledger-bar-strong` (0.55) for the top one or two rows of a block, `.ledger-bar-weak` (0.22) for the tail. Width is the datum. Never a hue, never rounded, never animated on load.
- **`.btn`** — 44px, radius 6, `padding-inline: 22px`, Geist 13.5/600, no shadow, no gradient, 120ms color transition. `.btn-play` (accent fill, `--accent-ink` label) is the only filled accent and appears at most once per view. `.btn-quiet` (transparent, `--line-strong` border, `--ink-dim` 500) is the second and third Play and every secondary action. `.btn-solid` (ink fill, ground label, 14px) is a chosen bucket. `.btn-fill` (`--bg-raised`, `--ink-dim`, 14px/500) is an unchosen bucket. `.btn-outline` (transparent, 26% ink border, `--ink` label, 14px/600, `padding-inline: 26px`) is `log it`, `Send the link`, `Sign in`.
- **Drawer** — `.sheet` ground plus `border-left: 1px var(--line)`, 420px, internal scroll, no radius, no shadow. `.panel` still exists but is now **only** for a floating overlay (the autocomplete popover): `--bg-elev`, 1px `--line`, radius 6, no blur, no shadow. Never wrap page-flow content in it — that is a bordered card.
- **`.caret`** — 8×18 ink block, 1.1s step blink; `.caret-sm` is 8×16 for the note field.
- **`.t-link`** — the only "link-looking" thing outside prose: 12.5px `--ink-dim` with a 1px underline that goes to `--ink` on hover.
- **`.tap`** — **deviation**, no board: 12.5px of text is a fine thing to read and a poor thing to hit. Any `.t-link` that is a control (`edit`, `the whole list`, `seen it`, `skip`, `replace`, `delete account`, a file pick) is wrapped in a `.tap` and the link stays on an inner span, so the underline keeps hugging the words. Under `@media (pointer: coarse)` the wrapper takes `min-height: 44px` with the padding cancelled by an equal negative margin — the hit area grows, the layout does not move. Height only: widening a control would either wrap a section header or push a right-aligned word past the edge of its row, and the axis that actually fails is the 17px one. On a phone `.row` is 52px (see Rhythm → Phone), so a control inside one is already big enough and `.tap` only guards the ones that sit in a header.

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
