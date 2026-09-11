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
