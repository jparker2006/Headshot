@AGENTS.md

# Headshot

The shared brain of who was in what with whom. Read `SPEC.md` first; it is the source of truth for every product and architecture decision and was confirmed line by line.

## Layout
- `scripts/build-graph/` — offline pipeline: IMDb TSVs → filtered, tiered, packed adjacency arrays → Vercel Blob (versioned). Runs on a Mac with `pnpm build:graph`. `--tmdb` adds the second stage: TMDB full casts for the top titles, cached under `data/tmdb/`, packed as weak edges plus a character table (format v2; the loader still reads v1).
- `scripts/embed/` — `pnpm embed` embeds the top entities into the brain's pgvector table for the semantic fallback in `find_entities` / `find_by_constraints`.
- `src/lib/graph/` — the in-process industry graph: binary loader, tiered bidirectional BFS, tied-path enumeration, overlay merge. Deterministic, no network, no model. Primary test seam.
- `src/lib/brain/` — Postgres (Neon + pgvector, Drizzle) for the shared brain: touched nodes, overlay edges, wiki pages, revision log, embeddings, session glow.
- `src/lib/tmdb/` — TMDB client (pattern copied from Cinema Daddy, no UI copied).
- `src/lib/agent/` — AI SDK agent loop on OpenRouter; tools under `tools/`. `shortest_path` results pass through unmodified; the agent never invents a path. v2: `fastpath.ts` classifies a question (path / costar / both / known-for / identify) and computes the deterministic result before the model; `answers.ts` keys stored answers by shape + sorted ids and replays hits with no model call; `identify.ts` solves "who is that guy from that show" over full casts; `show_on_brain` emits `focus-ego`.
- `src/lib/answers/` — permalinks `/a/<slug>-<shortid>` for public stored answers and their Open Graph images.
- `src/app/api/chat/` — streaming route; emits typed data parts the canvas animates.
- `src/components/canvas|chat|page/` — sigma.js brain canvas, floating chat panel, wiki page side panel.
- `tests/` — vitest, fixture-driven. Seams (highest first): graph engine (incl. constraint solving and characters), pipeline (incl. the TMDB stage over `tests/fixtures/tmdb`), agent loop with mocked model (fast path, cache replay, show_on_brain, face grid), route (permalinks, OG image, rate-limit cap), client rules (entity links, face-grid tap, ego default).

## Rules
- Two graphs, never confused: the precomputed industry graph (read-only, in memory) and the brain (shared, mutable, in Postgres). The canvas renders the brain only.
- Bacon number is computed, never estimated. Strong tier first, full graph fallback, report both when they differ.
- One provider: OpenRouter. Model IDs live in env vars, never in code.
- No auth, no per-user brains, no server-side conversations. Threads live in localStorage.
- Fresh UI. Do not copy Cinema Daddy styling. Tailwind v4 with a hand-written token layer.
- Node.js runtime (Fluid Compute). Never `runtime = 'edge'`.
- Run `pnpm typecheck && pnpm lint && pnpm test` before claiming anything works.
- Keyless dev: `HEADSHOT_GRAPH_PATH=data/fixture.bin` + `HEADSHOT_MOCK_AGENT=1` in `.env.local` runs the fixture graph with the scripted model in `src/lib/agent/mockModel.ts`. `window.__headshot` exposes sigma and the store in dev for QA. `HEADSHOT_DEV_USER=<id>` signs every request in as that id outside production, so Tonight and the taste routes can be exercised without the magic-link email loop.
- The model is told to wrap every entity name in `**bold**`; the client resolves those against the message's `data-node` parts and renders links that open the drawer ("cursor for movies"). Keep that rule in the system prompt.
- Thread views are `noindex`; only `/a/...` answer pages are indexable.
- Brain tests run against embedded Postgres (PGlite + pgvector) and the memory brain through one shared conformance suite in `tests/brain`.
