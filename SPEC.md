# Headshot — Spec

> *The shared brain of who was in what with whom.*

Synthesized from a four-round grilling session on 2026-09-10. Every decision below was put to Jake and confirmed; recommendations Jake left unanswered were taken as accepted. Nothing here is assumed silently.

Lineage: the successor to **Cinema Daddy** (`jparker2006/CinemaDaddy`), a stateless tool-use chatbot over TMDB and OMDb. Cinema Daddy answers lookups one API call deep. Headshot answers *relationship* questions that need the whole industry in one graph, and it lets an agent explore, grow, and annotate that graph in public.

---

## Problem Statement

You're watching something and get the itch: *"that guy was in that one thing with that other guy."* Answering it today means three Google searches, two IMDb tabs, and scrolling a filmography. Worse questions ("how is Timothée Chalamet connected to Kevin Bacon?", "who's the bald guy from the Apple show who was also in Parks and Rec?") are effectively unanswerable without a full map of who has worked with whom.

Cinema Daddy can't answer these. It looks things up; it can't traverse. And no live API can run a shortest path across Hollywood.

## Solution

Headshot is a web app with two halves that share one screen:

1. **The brain.** A dark, Obsidian-style force-directed canvas of glowing nodes (people and titles) and edges (credits). It is one global, shared graph that grows every time anyone asks anything. First-time visitors land on a map already lit up by past questions. Every node has a wiki page an agent wrote.
2. **The agent.** A floating chat panel where you ask in plain English. The agent resolves fuzzy descriptions to real entities, runs deterministic graph operations over a precomputed industry graph, crawls live data when the map is missing something, writes what it learned into wiki pages, and narrates the answer. Its work animates on the canvas in real time as it happens.

The Bacon number is always computed, never guessed. The *story* of the path is the model's.

---

## User Stories

### Asking

1. As a visitor, I want to ask "how is A connected to B?" and get the shortest chain of shared credits, so that I can settle the Bacon game instantly.
2. As a visitor, I want to ask "have A and B worked together?" and see every title they share, so that I can confirm a hunch.
3. As a visitor, I want to ask "who was in both X and Y?" and get the people common to two titles, so that I can identify "that guy."
4. As a visitor, I want to describe someone vaguely ("the bald guy from that Apple show with the guy from Parks and Rec") and have the agent figure out who I mean, so that I don't need names to ask.
5. As a visitor, I want the agent to show me its candidate matches on the canvas when it isn't sure who I mean, so that I can click the right one instead of typing a clarification.
6. As a visitor, I want the answer to distinguish the *true* shortest path (which may run through SNL) from the *interesting* path (real collaborations), so that the answer is both correct and worth reading.
7. As a visitor, I want the agent to pick the most narratively interesting path when many shortest paths tie, and tell me why, so that I get a story and not a list.
8. As a visitor, I want to see the alternate tied paths faintly on the canvas, so that I can tell the model chose one rather than there being only one.
9. As a visitor, I want follow-up suggestion chips after every answer, so that I can keep pulling the thread with one click.
10. As a visitor, I want the answer to include posters and one-line bios for the people and titles in the path, so that I recognize faces, not just names.
11. As a visitor, I want to ask about someone obscure who isn't on the map yet and still get an answer, so that the app doesn't dead-end on indie actors.
12. As a visitor, I want my conversation to survive a refresh, so that I don't lose a thread.
13. As a visitor, I want to start a new thread and switch between old ones, so that I can keep separate lines of questioning.

### Watching the brain

14. As a visitor, I want to see the whole shared brain on first load, dimmed and zoomed out, so that I immediately understand this is a living map.
15. As a visitor, I want the current answer's subgraph to light up and pull into focus, so that I can see the answer as shape, not just text.
16. As a visitor, I want to watch the agent's work animate live (candidates appearing, nodes expanding, path hops stepping in one at a time, pages being written), so that I can see it think.
17. As a visitor, I want nodes my session added to glow in a distinct color, so that I can see what I personally contributed to the shared brain.
18. As a returning visitor, I want my earlier contributions to have faded to the shared color, so that the glow always means "new this session."
19. As a visitor, I want to hover a node and see its label and poster thumbnail, so that I can scan the map without clicking.
20. As a visitor, I want to click a node and read its wiki page in a side panel, so that I can learn what the brain knows about it.
21. As a visitor, I want an "ask about this" button on every page that prefills the chat, so that browsing flows into asking.
22. As a visitor, I want to click an edge and see the shared credits it represents, so that I know *why* two nodes are connected.
23. As a visitor, I want to double-click a node to expand it live from TMDB, so that I can grow the brain without typing a question.
24. As a visitor, I want a search box to jump to any node by name, so that I can find a starting point in a big map.
25. As a visitor, I want to drag, pan, and zoom the canvas smoothly even with tens of thousands of nodes, so that browsing feels good.

### Reading pages

26. As a visitor, I want every wiki page to have a structured header (canonical IDs, poster, one-line "known as"), so that the essentials are always present even if the agent hasn't written much.
27. As a visitor, I want the page body to be prose the agent wrote from what it learned, so that pages read like notes, not database dumps.
28. As a visitor, I want a revision log on each page showing which question caused each edit, so that I can see how the brain learned what it knows.
29. As a visitor, I want pages to be read-only for humans, so that the brain stays coherent and agent-authored.

### Operating it

30. As the owner, I want a repeatable script that builds the industry graph from the IMDb datasets and uploads it, so that I can refresh monthly and readers of the Echo post can see the pipeline.
31. As the owner, I want graph builds versioned in storage, so that a bad build can be rolled back.
32. As the owner, I want a per-IP rate limit on questions and expansions, so that one person can't burn the budget.
33. As the owner, I want a global daily question cap that flips the app into browse-only mode with a friendly "resting until tomorrow" message, so that cost has a hard ceiling.
34. As the owner, I want the model ID in a single environment variable, so that I can swap models without a code change.
35. As the owner, I want to seed the brain by running a few hundred real questions through the agent before launch, so that day one already has clusters and pages.
36. As the owner, I want no accounts and no auth, so that the app stays a zero-friction toy.
37. As the owner, I want to write an Echo post about this with screenshots of the brain and a section on the pipeline and agent design, so that the project has an audience.

---

## Implementation Decisions

### Product framing

- **Purpose:** a for-fun showcase of LLM-plus-graphs, built to push the agent hard and to be visibly cool enough for an Echo post. Not a learning-the-algorithms exercise, not a product with billing. Must be genuinely fast and correct: a graph-theory showcase that fakes the graph is disqualifying.
- **Name:** Headshot. Tagline: "the shared brain of who was in what with whom."
- **Relationship to Cinema Daddy:** separate repo, separate app. Backend code may be copied where useful (TMDB client, OMDb error classification, the follow-up-chip pattern). **No UI is copied.** The UI is a fresh design exercise.
- **Query shapes in v1:** path (A to B), co-star check (A and B together), intersection (who was in both X and Y), fuzzy identification (description to entity). Centrality ("who is the center of Hollywood?") and ego exploration ("everyone Wes Anderson keeps casting") are v2.

### The two graphs

There are two graphs and they must never be confused.

**1. The industry graph (precomputed, read-only, in-process).**
- Source: the IMDb non-commercial datasets (name.basics, title.basics, title.principals, title.ratings), refreshed monthly by hand.
- Kept title types: movie, tvSeries, tvMiniSeries, tvMovie. Dropped: tvEpisode, short, video, videoGame, tvSpecial.
- Vote floor: a title needs at least 1,000 IMDb votes to exist in the graph.
- Kept people: anyone with at least one credit on a kept title in category actor, actress, director, or writer. Producers and crew are out.
- Every edge is tagged with a **tier**:
  - **Strong:** movie and miniseries credits; tvMovie credits; series credits only for people in IMDb's principals list for the series (top-billed). Excludes any title whose genres include talk-show, reality, news, or game-show, and any series with more than 200 episodes.
  - **Weak:** everything else that survived the vote floor (guest spots, talk shows, long-running series).
- Packed offline into compact adjacency arrays (CSR-style, integer node IDs, tier bit per edge) plus a node table (IMDb ID, display name, type, year, vote count, top genres). Target size: tens of megabytes.
- Stored in Vercel Blob under a versioned key. Loaded into memory once per function instance at cold start; Fluid Compute instance reuse keeps cold loads rare. Path queries run in-process in milliseconds.
- TMDB IDs are **not** joined in bulk. They are resolved lazily by IMDb ID via TMDB's find endpoint the first time a node is enriched, then cached in the brain.

**2. The brain (shared, mutable, in Postgres).**
- One global graph. No per-user or per-session brains. No auth.
- Contains: every node anyone has ever touched (a subset of the industry graph plus live-discovered nodes not in it), an **overlay** of live-discovered edges, the wiki pages, the revision log, embeddings for the top tier of entities, and session-glow bookkeeping.
- The canvas renders the brain, never the full industry graph.
- Live-discovered overlay edges **do** participate in path finding: the engine merges the overlay into the BFS at query time so obscure actors get real paths through their one big credit. The overlay stays small (thousands of edges).

### Path semantics

- **Tiered BFS.** Run unweighted BFS on the strong tier first. If no path within 6 hops, fall back to the full graph (strong plus weak plus overlay). Report both when they differ: "Bacon number 2 via SNL; the interesting route is 3 via Jackie Brown."
- The reported Bacon number is always the true unweighted shortest distance over the full graph. It is computed, never estimated by the model.
- **LLM-ranked paths.** The engine returns up to 20 tied shortest paths (with title metadata for each hop). The model chooses one for narrative value and explains why. The canvas lights the chosen path and shows the alternates faintly.
- Bidirectional BFS is the expected implementation; this is an implementation detail, not a decision the user needs to see.

### The agent

- **Role:** a full agent with the graph engine as one toolset among several, not a thin router. It decides what to resolve, what to expand, what to write down, and how to explain. The one hard rule: `shortest_path` is deterministic; the agent never invents or approximates a path.
- **Tools (six):**
  1. `find_entities` — fuzzy description or name to candidate node IDs with confidence.
  2. Graph ops — `shortest_path`, `common_neighbors`, `shared_credits` over the industry graph plus overlay.
  3. TMDB live — `tmdb_search`, `tmdb_credits`, `tmdb_person` for anything the industry graph lacks and for enrichment (posters, bios, trivia).
  4. `expand_node` — live-crawl a person's or title's credits from TMDB into the brain, adding nodes and overlay edges.
  5. `write_page` — create or revise an entity's wiki page body.
  6. `read_page` — read what earlier questions already figured out, so the brain compounds.
- **Fuzzy resolution is a hybrid.** First a cheap embedding search over the top tier; if confidence is low, agentic enumeration (the model proposes candidates from its own knowledge, verifies via TMDB credits, intersects). While deciding, candidates are shown on the canvas and the user may click one to disambiguate.
- **Models, via OpenRouter as the single provider:**
  - Agent, page writer, follow-up chips: `deepseek/deepseek-v4.1-flash` (tool calling supported, 1M context, ~$0.15/M in, ~$0.60/M out at time of writing). Model ID lives in one env var so it can be swapped.
  - Embeddings: `openai/text-embedding-3-small` trimmed to 512 dimensions.
  - Embedding scope: the top ~50k people and titles by vote count, embedded from name plus known-for plus a short description. Everything else resolves by exact name match or agentic search. ~50k × 512 dims lands around 100 MB in pgvector.
- **Orchestration:** Vercel AI SDK agent loop (v7 at scaffold time) with multi-step tool calling, streaming tool-call events to the client as typed data parts. No hand-rolled NDJSON protocol this time.

### Wiki pages

- **Header (pipeline-filled, structured):** canonical IMDb ID, TMDB ID (once resolved), type, display name, year, poster URL, one-line "known as."
- **Body:** markdown, agent-authored only. Written and revised by `write_page`.
- **Revision log:** append-only. Each revision records the timestamp, the triggering question, and a diff or full snapshot of the body.
- **No human editing.** No flagging in v1.
- Clicking any node opens its page in the side panel with an "ask about this" button that prefills the chat.

### Canvas

- **Library:** sigma.js on graphology (WebGL rendering, force layout, client-side graph algorithms available).
- **Scale:** whole shared brain visible, dimmed and zoomed out; the current answer's subgraph lit and pulled into focus. Tens of thousands of nodes must stay smooth.
- **Look:** Karpathy LLM-wiki / Obsidian brain: dark field, glowing dots, labels on hover, clusters emerging from the force layout. This is the design exercise; no styles are inherited from Cinema Daddy.
- **Live animation:** the canvas consumes the agent's streamed events. Event vocabulary: `candidates_found`, `node_added`, `edge_added`, `path_hop`, `page_written`, `focus_changed`. Path hops step in one at a time.
- **Interactions:** hover (label plus poster thumbnail); click node (page panel); click edge (shared credits); double-click node (live expand, rate-limited like a question); search box (jump to node); drag/pan/zoom.
- **Session glow:** nodes added this session glow in a distinct color, keyed by a random session-ID cookie. On the next visit they render in the shared color.
- **Chat placement:** floating panel over the canvas.

### Persistence and state

- **Brain:** Postgres with pgvector on **Neon** via the Vercel Marketplace (Supabase rejected: Jake has hit its limits). Env vars and preview branches come from the Marketplace integration.
- **Conversations:** personal and client-side. Thread list and transcripts in localStorage, like Cinema Daddy. The server stores nothing about a person except the session-ID-to-nodes mapping for the glow.
- **Industry graph artifact:** Vercel Blob, versioned keys.

### Cost and abuse

- Vercel Firewall rate limit per IP on questions and expansions.
- Global daily question cap. When tripped, the brain stays fully browsable and the chat panel explains it's resting until tomorrow.
- No sign-in gate.

### Seeding

- Before publishing, run a few hundred curated real questions through the agent so every seeded node has an agent-written page and the canvas has visible clusters. Do **not** pre-seed bare nodes without pages: the brain must not look like it knows things it doesn't.

### Stack and repo

- Location: `~/Desktop/Headshot`.
- pnpm, Next.js 16 App Router, TypeScript strict, ESLint.
- Styling: Tailwind v4 with a hand-written design-token layer. Every visual decision is still made by hand.
- Pipeline: TypeScript with Node streams, in a `scripts` area of the same repo, so the packing code and the runtime loader share types. Runs on Jake's Mac, uploads to Blob, documented for readers.
- Deploy: Vercel, Fluid Compute default runtime, no Edge runtime.

---

## Testing Decisions

Tests exercise external behavior at the highest seam that still runs fast and deterministically. Proposed seams, highest first (confirm these match expectations before implementation):

1. **The graph engine seam (primary).** Given a small hand-built packed graph fixture (a dozen people, a dozen titles, mixed tiers, plus a tiny overlay), assert on `shortest_path`, `common_neighbors`, and `shared_credits` outputs: correct Bacon number, strong-tier-first behavior, fallback to weak tier, overlay edges participating, tied paths enumerated up to the cap. This is where correctness lives and it needs no network or model.
2. **The pipeline seam.** Given a few hundred rows of synthetic IMDb TSV, assert that the packed output has exactly the expected nodes, edges, tiers, and exclusions (vote floor, title types, talk-show genres, 200-episode rule, principals-only series edges).
3. **The agent seam.** With the model mocked to emit a scripted sequence of tool calls, assert that the tool loop dispatches correctly, that the streamed event vocabulary comes out in order, that `shortest_path` results are passed through unmodified (the agent never rewrites a path), and that `write_page` appends to the revision log with the triggering question.
4. **Rate limit and daily cap seam.** Assert browse-only mode engages at the cap and that the canvas endpoints stay available.

Not tested: the canvas rendering itself, the force layout, live OpenRouter or TMDB calls (these get a small manual smoke script instead). Prior art: Cinema Daddy had `npm run typecheck` and no test suite, so there is no existing pattern to follow; the fixture-driven engine tests are the new pattern.

---

## Out of Scope

- Centrality questions and precomputed stats ("who is the center of Hollywood?", Bacon number distributions).
- Ego exploration views ("everyone Wes Anderson keeps casting") as a dedicated UI.
- Accounts, auth, per-user brains, or any server-side conversation storage.
- Human editing or flagging of wiki pages.
- Producers, composers, and crew categories as people.
- Episode-level nodes. Series are single nodes.
- Streaming availability and ratings lookups (Cinema Daddy's territory). If they're ever wanted, the copied TMDB client makes them cheap.
- Bulk TMDB joins in the pipeline.
- Any copied UI from Cinema Daddy.
- Multiple LLM providers or provider fallback. OpenRouter is the one provider.

---

## Further Notes

- **Why the brain is the story.** The precomputed graph makes the app correct; the shared, agent-curated brain makes it interesting. The Echo post's spine is "here's what N questions taught it," with the pipeline and the agent's tool design as the technical sections.
- **On "LLM + graphs" vs pure graph theory.** Jake explicitly does not need this to be pure graph theory. The deterministic core (BFS, tiers, overlay merge) is small and boring on purpose; the model's job is everything around it: resolution, choosing among ties, narration, and curation.
- **Model verification.** `deepseek/deepseek-v4.1-flash` was confirmed to exist on OpenRouter with tool-calling support on 2026-09-10. The OpenRouter embeddings endpoint was confirmed to serve `openai/text-embedding-3-small` (and Voyage 4 Lite as an equal-priced alternative if the OpenAI model ever misbehaves).
- **IMDb license.** The datasets are for personal and non-commercial use. This project is a non-commercial portfolio piece; keep it that way or swap the topology source.
- **Open follow-ups after this spec is confirmed:** issue-tracker setup (`/setup-matt-pocock-skills` per the to-spec skill), repo scaffold, pipeline first, engine second, agent third, canvas last.

---

# v2 — Useful to people searching

Decided in a second grilling on 2026-09-11, after v1 shipped to headshot-hazel.vercel.app. Same rule as v1: every item below was put to Jake and confirmed. v1 sections above remain in force except where this section says otherwise.

## Who it's for, and the one question

- **Audience:** the mid-show itch first (phone in hand, "who is that guy," wants a face and a name in five seconds), the trivia player second. Professionals are a different product.
- **Headline capability:** identification ("who is that guy" from a title plus a vague detail), with "what else was she in" as its natural follow-up. Paths stay the showpiece.
- **Cursor for movies:** every entity mentioned in an answer is a link. Clicking a person or title name anywhere in the chat opens it in the drawer (page plus ego view) without leaving the conversation. This is the interaction model the whole UI serves.

## User stories (v2)

38. As a viewer, I want to describe someone vaguely with the show they were in and get a small grid of faces to pick from, so that I never have to know the name.
39. As a viewer, I want to tap a face and have the answer continue (or the page open, if identifying was the whole question), so that disambiguation is one tap.
40. As a viewer, I want the chain to appear in under a second when I name two people exactly, so that the app feels instant.
41. As a viewer, I want a question I've asked before to come back instantly, so that repeat questions cost nothing.
42. As a viewer, I want every name in an answer to be clickable and open that person or title in the side panel, so that reading and exploring are the same motion.
43. As a viewer, I want to say "show me him on the brain" and have the panel center on that person, so that the graph responds to the conversation.
44. As a viewer, I want to share an answer as a link that shows the chain as an image in iMessage or Slack, so that a good answer travels.
45. As a searcher on Google, I want answer pages to be indexable, so that "how is A connected to B" can land on Headshot.
46. As a viewer, I want "who was in both X and Y" to include guest and recurring cast, not only the top ten, so that the answer is actually right.
47. As a viewer on a phone, I want the faces first and the prose second, with follow-ups in a scroller, so that the answer fits my thumb.
48. As a viewer, I want the right panel to open on the person I asked about, not a hairball, so that the graph is about my question.
49. As the owner, I want the full-cast crawl to be part of the monthly build with cached raw data, so that it's reproducible and cheap to rerun.

## Implementation decisions (v2)

### Data: full casts from TMDB, packed offline
- A second pipeline stage crawls TMDB credits for the top 20,000 titles by IMDb votes (about one call per title at TMDB's rate limit, ten minutes). Raw JSON cached on disk under `data/tmdb/` so reruns are free.
- Results are packed into the same graph file as **weak-tier** edges (they include guest and recurring cast), plus a side table of character names keyed by (person, title). People not in the IMDb graph are added as nodes with their TMDB ids and IMDb ids from external_ids.
- The packed format gains a version bump; the loader keeps reading v1 files. Expected size around 45 MB.
- Character names from the side table replace the runtime roles route for titles in the crawl; the route stays as a fallback for the long tail.
- Episode-level IMDb credits, awards, and box office stay out of scope.

### Identification
- New deterministic tool `find_by_constraints`: input is what the model extracted from the question (titles mentioned, a role hint, era, optional gender), output is up to eight candidates with images and the matching credit and character. The server intersects cast sets across the mentioned titles, then scores by role hint against character names, prominence, and era.
- Mandatory when the question mentions at least one title. With no title, the model resolves the show first, then calls it. Free reasoning through tmdb_search is the last resort.
- Embeddings over the top 50,000 entities (name, known-for, bio, character names) back the tool when constraints are thin, using the pgvector table that already exists.
- **Face grid:** two to eight candidates render as a grid of faces with name and the matching credit, thumb-sized on phone. If the model's answer text after the grid is empty, tapping a face opens that person's page and ego view. Otherwise tapping posts "I mean <name>" as a user turn and the agent continues.

### The fast path (before the model)
- Question shapes: `path`, `costar`, `both`, `known-for`, `identify`. A lightweight classifier (regex over the question plus the resolved entities) assigns a shape when it can.
- When a shape is assigned and every entity resolves exactly and unambiguously, the server computes the deterministic result (tiered paths, shared credits, common neighbors, top credits) and streams the chain or card **before** the agent starts. The agent then runs with the result already in context and narrates without calling the graph tool.
- Ambiguous names (two exact matches with close prominence) fall through to the agent as today.

### Answer store and cache
- Table `answers`: id, short id, slug, shape, resolved entity ids (sorted), question text, chosen path, paths summary, narration, follow-ups, graph build id, session id, public flag, created at.
- Cache key is shape plus sorted entity ids, never the raw text. A hit skips the model entirely and replays the stored answer, including the events that light the panel.
- Staleness: answers carry the graph build id. After a new build ships, cached answers still serve and are recomputed in the background on the next hit.
- Public permalinks only for answers that pass a length cap and a profanity filter on the question; the rest stay private to the session.

### Entity links in answers ("cursor for movies")
- The model keeps emphasizing entity names in its prose. The client resolves emphasized names against the message's touched nodes (the `data-node` parts it already receives) and renders matches as links that open the drawer.
- Unmatched emphasized names resolve on click through the search route (exact match first) before opening.
- The same treatment applies to names in the face grid, the chain, the follow-up chips, and the wiki pages.

### "Show me on the brain"
- New tool `show_on_brain({ imdbId })` emits a `focus-ego` event. The panel switches to that node's ego view and opens its drawer. No path required.

### Permalinks and Open Graph
- URL `/a/<slug>-<shortid>` (e.g. `/a/heath-ledger-to-natalie-portman-7f3k`). The page renders the chain with faces, the narration, follow-ups (linking to their own permalinks once answered), and the ego view of the first person. No composer; an "Ask your own" button.
- Open Graph image rendered server-side (Next image response): posters and arrows on the dark ground, degrees count, wordmark.
- Answer pages are indexable; thread views are not.

### Panel and phone
- Ego view is the default right panel after any answer, centered on the first person in the question, drawer open on their page. Fresh load with no thread shows the whole brain. Focus keeps the whole-brain view as "what everyone has asked."
- Phone: answer-first. The chain is a full-width horizontal strip of faces at the top of each answer, narration below, follow-ups as a horizontal chip scroller, brain behind a header button. Composer pinned at the bottom. Face grids are thumb-sized.

## Testing decisions (v2)
- Pipeline seam extends to the TMDB stage with a fixture of cached credit JSON: packed weak edges, character table, new-person nodes, and v2 format round trip.
- Engine seam: constraint solving over the fixture (intersection, role-hint scoring, era filter).
- Agent seam: fast path emits chain before any model call; cache hit replays without a model call; `show_on_brain` emits the focus event; face-grid decision rule (empty answer text → page, otherwise user turn).
- Route seam: permalink page renders from a stored answer; OG image route returns an image for a stored answer; private answers are not served publicly.
- Client: entity-link resolution is a pure function over message parts, unit-tested.

## Build order
A. Fast path, answer store, cache, entity links, `show_on_brain`.
B. TMDB full-cast crawl, packed format v2, `find_by_constraints`, embeddings, face grid.
C. Permalinks and Open Graph images.
D. Ego view by default and the phone layout.

## Out of scope (v2)
Accounts, episode-level credits, awards and box office data, recommendations, any editing of pages by humans, a mobile app.

# v3 — Tonight (the taste agent)

Decided in a third grilling on 2026-09-11 (three rounds; the full question-and-answer record is in `grilling/2026-09-11-taste-agent.md`). v1 and v2 remain in force except where this section says otherwise. One rule changes: **accounts exist now**, for the private taste graph only. The shared brain stays public and anonymous.

## The problem and the solution

Someone with three subscriptions and a free evening cannot decide what to watch. The existing answers are a wall (streaming rows tuned to keep you on that service) or a blank box (a chat model that knows neither what you have seen nor what you pay for). Tonight is an agent that holds a private taste graph of you, sits on Headshot's industry graph and shared brain, knows which services you have, decides with you, and opens the thing.

Why it beats Google or a chat prompt: the credit graph is computed, never recalled; it acts (Play opens the service you already pay for); and it remembers you. Every pick is explained by a real fact in the graph, not vibes.

## Who it's for

Jake first, then a few friends, then the market. TV and movies are equal; Jake watches more TV. Laptop and phone both complete.

## User stories (v3)

50. As a viewer, I want to open the app at 9pm and see three picks for tonight with a Play button, so that deciding takes under a minute.
51. As a viewer, I want each pick to say why in one line that is actually true ("the editor of two things you five-starred"), so that I trust it more than a row on Netflix.
52. As a viewer, I want to tell it which services I pay for once, so that it never recommends something I would have to buy unless nothing else fits.
53. As a viewer, I want to upload my Letterboxd export and have it know what I have seen and rated, so that I do not start from zero.
54. As a viewer, I want a fast swipe deck of posters (seen and liked, seen and meh, never seen, want to see) at onboarding and a few each day, so that teaching it feels like a game and not a form.
55. As a viewer, I want it to keep working while I am asleep and have a fresh deck and picks ready in the morning, so that it feels like an agent rather than a search box.
56. As a viewer, I want to say "one more episode of X" and have that count as tonight's answer, so that TV is first-class.
57. As a viewer, I want to see my taste as a map, me in the middle, the people and titles I rated around me, so that I can see who I actually keep watching.
58. As a viewer, I want the chat to already know all of this when I talk to it, so that "would I like Heat" gets a real answer.
59. As a viewer, I want everything it learns to be explicit and reversible (undo a swipe, delete my import), so that it never feels like surveillance.
60. As the owner, I want the design to be something people want to look at, Cursor-grade restraint, so that the product is used for its own sake.

## Implementation decisions (v3)

### Accounts
- Neon Auth, magic-link email, no passwords, no third-party identity vendor. Sign-in appears only at the first swipe or the first "I watched it", never on the landing page. Headshot's shared brain, threads, and permalinks keep working signed out.

### Taste store (Postgres, per user id)
- `watched`: user, title imdb id, rating in four buckets (liked / meh / never seen / want to see; Letterboxd stars map onto liked and meh), when, source (letterboxd / swipe / chat), plus for series: season marked and an episode counter from "one more episode" taps.
- `services`: user, TMDB provider ids, region.
- `taste`: user, one 512-dim vector recomputed nightly from rated titles (weighted by rating), plus a derived-facts JSON: favorite people by count with their roles, eras, average runtime finished, genres avoided.
- Nothing else is stored about a user. Delete account deletes all three.

### Letterboxd import
- CSV export upload (ratings, watched, watchlist). Matched to the graph by title plus year; a review screen shows the ten worst matches for confirmation. Re-upload replaces. No account link, no scraping.

### Services
- A one-time checklist of providers (TMDB watch-provider ids for the user's region). No scraping of streaming accounts; their algorithms are not observable and their terms forbid it. YouTube history via Google Takeout is v4.

### The pick engine (deterministic first, model last)
- Candidates: unseen titles available on the user's services (TMDB discover by provider, recent and trending), plus graph neighbors of the user's liked titles (same director or writer, three or more shared cast).
- Score: cosine to the taste vector, plus graph proximity, minus a penalty for titles swiped away, filtered by tonight's runtime and energy when given.
- The model never chooses from the catalog. It writes the one reason line for each of the top three and swaps a pick on request through chat.
- **Reason rule:** every pick carries exactly one reason and it must be a real graph fact (shared person, same writer, your third title by X). No graph reason, no deck slot.
- TV: "one more episode of X" is a legitimate pick when a series is marked watching.

### The overnight run
- Vercel cron around 4am for every user active in the last 30 days: refresh availability on their services, rescore, write a deck of eight for the swipe surface and three picks for tonight, one cheap model call for the reason lines. Picks are stored, so opening the app is instant.

### Home screen
- Chat composer on top. The agent's opening message is already there: tonight's three picks as cards with Play, the deck below. The screen "starts on chat" and is the 9pm moment at once. Headshot's paths, identification, and the shared brain remain reachable from the same chat; the taste agent calls them as tools.

### Play
- JustWatch deep links from TMDB watch providers (web URLs; phones hand off to the installed app). If a title is on none of the user's services, show the rent or buy price rather than hiding it. Controlling a TV is out of scope.

### Swipe deck
- Onboarding: fifty titles chosen for coverage (eras, genres, TV and film), skippable after twenty. Daily: eight. Four actions, undo always. Explicit signals only: nothing the user did not tap changes taste.

### Taste map
- The user's private ego graph on the existing sigma canvas: the user at the center, rated people and titles as rings colored by rating, the industry graph faint behind. Second tab.

### Onboarding order
- Services (six taps) → Letterboxd upload or skip → swipe deck → first three picks. Under three minutes.

### Design
- A design system doc (`DESIGN.md`) is written before any v3 code: palette, type, spacing, motion rules, and the three core layouts (home, title, taste map). Reference set: Cursor's product design (restraint, near-monochrome, one accent, generous space, sharp type, motion only with meaning) and Ryu's work. Built through the gstack design skills against that doc. Anti-references: streaming-service poster walls, SaaS card grids, gamified streaks.

## Testing decisions (v3)
- Taste seam: pick engine is a pure function over (taste vector, watched set, candidate set, filters); fixture-driven tests for scoring, penalties, runtime and energy filters, and the reason rule (a pick without a graph reason is rejected).
- Import seam: Letterboxd CSV fixtures → matched rows, worst-match ordering, re-upload replaces.
- Store seam: the three taste tables join the brain conformance suite (memory and PGlite).
- Cron seam: the overnight job over a fixture user produces a stored deck and picks with no model call except reasons (mocked).
- Route seam: unauthenticated requests to taste routes are refused; Headshot routes stay open.
- Client: swipe reducer with undo is a pure function, unit-tested.

## Build order
Design doc first, then: A) auth, taste store, Letterboxd import, services checklist. B) pick engine, home screen with Play. C) swipe deck, nightly cron. D) taste map, design pass over every screen.

## Out of scope (v3)
Scraping streaming accounts, YouTube history (v4), TV control, social or multiplayer picks (later), episode-level tracking beyond the counter, any implicit taste signals.
