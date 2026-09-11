# Design research — v4

Written 2026-09-11, before any board, per `SPEC.md` → v4 → Design and `goals/v4.md` Chunk C item 1. Every site below was opened and looked at in a browser, not recalled. Two were unreachable and are marked.

The brief behind the looking: Headshot is the log with a brain — Letterboxd with TV plus a taste profile — for film-buff friends. The current UI is a generic dark SaaS shell (Linear tokens, bordered cards, mono uppercase labels, stat tiles) and the owner's verdict is that it looks like shit. He wants "cool design like Cursor, Riot, Linear, Arc, Ryu's work", sassy, made for someone who watches movies. Hard constraints on every board: posters are the only color, type carries the personality, the chat reads like messages, no bordered cards, no stat tiles, no mono uppercase labels, one accent doing one job (Play).

---

## 1. cursor.com — the product pages

A warm near-black ground (a brown-black, not a blue-black), cream text, and a single small wordmark. The hero is two lines of a neutral grotesk at a modest size with tight tracking and no marketing adjectives; the pill buttons are the only filled shapes on the page. Zero borders anywhere — regions are separated by ground shifts and space.
**Take:** the warm black. A blue-black reads as SaaS; a brown-black reads as a room with the lights off, which is what a movie app should feel like. Also: one filled pill on the whole screen.
**Avoid:** their hero device mock. Headshot has no device to show; the content is the hero.

## 2. cursor.com/changelog — the entry rhythm

Each release is `Sep 10, 2026 · Changelog` in small dim text, then the title in a large tight grotesk, then a full-bleed image, then prose. No card, no border, no badge, no version chip. Entries are separated by a huge vertical gap and nothing else.
**Take:** the meta-line-above-headline rhythm, verbatim, for "recently logged" — `1 hour ago · liked` over **Heat**, and the note under it as prose.
**Avoid:** the full-bleed image per entry; at eight logged rows that becomes a poster wall, which the constraint forbids.

## 3. linear.app — the homepage

Almost everything on the page is a rendering of the product itself: real issue rows, real activity lines, real avatars. The copy is short and declarative ("Purpose-built", "Designed for speed") and set in a neutral sans at a smallish size against near-black, with rows separated by 1px lines at maybe 6% white.
**Take:** the confidence to show the actual data as the design. Headshot's You page is already a list of real rows; it doesn't need a chrome around it.
**Avoid:** literally this — it is exactly the shell Headshot already wears and the owner already rejected. Linear's tokens are the thing being replaced, not copied.

## 4. linear.app/changelog — the "Now" page

The page title is the single word **Now** set very large. Below it, a left gutter holds a date and a small colored dot; the right column holds the headline and prose. No card. The dot is the only color on the screen and it marks one thing (the entry marker).
**Take:** the date gutter — a narrow left column of times (`just now`, `1 hour ago`, `3 hours ago`) against a wide right column of titles is the whole "recently logged" section solved, with no table and no stat tiles. And the one-word page title set huge.
**Avoid:** the dot-as-status-color habit. Headshot's four buckets must be words, not colored dots, or the posters stop being the only color.

## 5. arc.net — The Browser Company

The outlier: a bright periwinkle field, a hand-drawn mascot, rounded everything, warm gradient washes, a big friendly serif-ish headline. It is *warm* in a way none of the other software sites are, and the warmth comes from the ground color and the roundness, not from illustration.
**Take:** the permission to make the ground warm rather than neutral, and to let one surface be lighter and softer than the rest. Direction B ("Lobby") takes this as a warm dark ground, not a blue-black.
**Avoid:** everything else. Bright field, mascots, gradients and roundness would drown posters and read as toy, and the owner wants sassy, not cute.

## 6. ryo.lu — Ryo Lu (Cursor's design lead; the "Ryu" reference)

The best thing seen today. A warm near-black page, empty for most of its height, with an enormous personal sentence at the top — *"Ryo is moving to Asia."* — and under it a small line in letter-spaced caps: `LAST SEEN 7 HOURS AGO, AT DIN TAI FUNG (鼎泰豐) IN TAIPEI.` Navigation is tiny underlined monospace links in two low columns: READ JOURNAL / SHOP GARAGE SALE / EXPLORE RYOS, and PAST WORK — CURSOR, NOTION, STRIPE, ASANA. The personality is entirely in the writing and in the size contrast between the statement and the machinery.
**Take:** this *is* the You page. A first-person sentence set huge, the metadata as a quiet status line beneath it, and everything else demoted to small underlined text. It is also where the "sassy" comes from — the voice, not the visuals.
**Avoid:** the near-empty screen. Headshot has real content to show; the restraint is a proportion, not a vacuum.

## 7. vercel.com/geist — the design system

Flat near-black, a strict 1px grid of equal panels, a single monoline icon set, and the accent colors appearing only as a swatch row — i.e. color is *documentation*, never decoration. Type is one family at three sizes, and code is set in Geist Mono at a small size that reads as data, not as style.
**Take:** Geist Mono used strictly for numbers and identifiers (years, counts, hours, runtimes) at a small optical size, so that data reads as data without ever becoming a mono uppercase label.
**Avoid:** the panel grid. Equal bordered panels are stat tiles with a different name, and they are explicitly out.

## 8. raycast.com — the launcher

Pure black, a very large tight-tracked sans headline centered, a two-line dim subhead, and then a real macOS screenshot with its own menu bar visible. The product UI shown is *dense* — tight row heights, small type, keyboard hints — and the marketing page's roominess exists to make that density look intentional.
**Take:** the density itself, for Direction C. A cinephile's log is a dense object; tight row rhythm with a small type scale is a legitimate personality, not a failure to add whitespace.
**Avoid:** black-black. At #000 posters bloom and look cheap; a poster-first product needs a ground just off black.

## 9. letterboxd.com — the film page (the competitor to beat)

Opened Heat (1995). The page opens with a full-width paid ad for an unrelated film, then the site chrome, then the actual film. Below: a synopsis, a cast list of thirty names as identical grey chips, a rating histogram, and two more ad slots. Colors compete constantly — the green/orange/blue brand dots, the gold star ratings, the red ad artwork, and the poster.
**Take:** the one genuinely good idea — the member's own short note under a logged film is the most human thing on the site. Headshot's `"the diner scene, two pros sizing each other up"` should be treated as the most important line in a log row, not as metadata.
**Avoid:** all of it otherwise. This is the precise failure mode the poster-only-color rule exists to prevent, and it is why "no bordered cards, no chips for everything" is a constraint rather than a preference.

## 10. mubi.com — how film people are designed for

One full-bleed film still fills the viewport, a tight all-caps grotesk sentence sits over it in white — WATCH GREAT CINEMA / CINEMA LIKE NOWHERE ELSE — and there is essentially no other interface. A tiny wordmark, a hamburger, LOG IN. The image supplies 100% of the color; the type supplies 100% of the voice.
**Take:** the ratio. Type and image, nothing in between. Direction A commits to this.
**Avoid:** the full-bleed still. Headshot is a log, not a storefront; a hero image would push the actual content below the fold.

## 11. criterionchannel.com — the other film-people reference

Warm sepia-toned photography, a gold accent used for exactly one thing (the subscribe button), a sturdy condensed sans for headlines, and a poster wall that is deliberately *uniform* — same crop, same gap, the artwork itself providing all the variety.
**Take:** gold-on-warm-dark as a single-job accent, and the uniform poster grid where every tile is the same size and the only difference between tiles is the artwork. That is the poster row for Direction B.
**Avoid:** the marketing-funnel structure (hero, price, CTA). And the gold must stay at one button; Criterion lets it creep into headings.

## 12. a24films.com — current film-adjacent work

The films index is a vertical stack of titles — *Tony, Onslaught, Primetime, Misty Green, You Can See Everything, Club Kid* — set in a large tight grotesk with the year as a small superscript beside each, over a full-bleed still that changes as you move down the list. No posters in the list at all; the titles *are* the interface.
**Take:** the title-with-superscript-year list form, used directly for "recently logged" in Direction A, and the idea that a list of films can be typographic rather than a poster grid.
**Avoid:** the email-capture modal on load, and the reliance on hover — a log has to read correctly while completely still.

## Unreachable

- **dribbble.com/search/movie-app** — returned a blank page (bot wall) with no text. Not assessed.
- **riot.wtf** and **ryu.design** — navigation refused by the browser/host. Riot's work is therefore represented second-hand through ryo.lu (Cursor's design lead) and cursor.com's own surfaces, which is the same lineage.

---

## Synthesis

Three things separate every site worth stealing from here from the shell Headshot is wearing. First, none of them draws a box around anything: regions are separated by space, by a ground shift, or by a single hairline used once. Second, each has exactly one loud element, and it is always the content — Mubi's still, A24's title stack, ryo.lu's sentence — with the machinery shrunk to small, dim, quiet text around it. Third, the personality lives in language and in type size contrast, never in color; Criterion's gold and Linear's dot each do one job and stop. That maps cleanly onto the brief: posters are the only color, type carries the personality, and the writing is the product, because the thing Headshot has that Letterboxd does not is a paragraph about you that the machine wrote.

So each board commits to one idea and does not hedge it. **A — Marquee** commits to *the memory is a headline*: Jake's prose is set as display type at reading size, A24's title-and-superscript-year stack carries recently logged, posters are small and precise, and the page has almost no chrome. **B — Lobby** commits to *the shelf*: a warm dark room where uniform posters in strict rows do the looking and the memory is a quieter left column, Criterion's crop discipline with Arc's warmth. **C — Terminal for cinephiles** commits to *the log is an instrument*: Raycast/Geist density, numbers and years in mono at a small optical size, the log table and the Numbers block as the hero, chat as terse bubbles, and the sass in the copy.

Three type pairings, Google Fonts only:

1. **Instrument Serif + Instrument Sans** (Direction A). Instrument Serif is a high-contrast display serif with real editorial swagger at 34px+ and costs nothing in weight; Instrument Sans is its own superfamily companion, so the UI strings underneath sit in the same skeleton instead of arguing with it. The serif signals *writing about film*, which is exactly what the memory prose is, and it is the single cheapest way to stop looking like a SaaS dashboard. (Deliberately not Inter — that face is half of why the current shell reads as generic.)
2. **Archivo + Source Serif 4** (Direction B). Archivo is a sturdy American-grotesk with a genuinely usable condensed axis — it sets film titles tight and dense beside a poster the way a marquee or a Criterion spine does — and Source Serif 4 gives the memory paragraph a warm, readable body voice so the quiet column still feels written by a person, not generated.
3. **Geist + JetBrains Mono** (Direction C). Geist is the sharp neutral sans the density needs, and JetBrains Mono has a large x-height and unambiguous figures that stay legible at 11–12px, which matters when years, episode counts and hours are the hero. Strictly figures and identifiers — never a uppercase label, per the constraint.

One accent across all three, one job: Play. Direction A and C use a warm amber (`#f0b429`-ish); Direction B uses Criterion's deeper gold on the warm ground. Nothing else on any board is colored except a poster.
