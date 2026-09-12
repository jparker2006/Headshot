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
- v3 (Tonight): `src/lib/auth/` — Neon Managed Better Auth, magic link only, opt-in (nothing redirects; protected routes answer 401). `src/lib/taste/` — the private per-user store (watched / services / taste / tonight tables on the same Postgres, Memory + Postgres implementations, one conformance suite), Letterboxd import, providers list, the taste map. `src/lib/picks/` — the pick engine (pure; the graph-reason rule lives in `graphReason`), candidate pool (graph walk + TMDB discover), Tonight service and routes, swipe reducer, onboarding deck, nightly cron (`/api/cron/tonight`, scheduled in `vercel.json`, guarded by `CRON_SECRET`). `src/components/tonight/` — the Tonight panel and swipe deck; `src/app/onboarding` and `src/app/auth/sign-in` are the only signed-in pages.
- `src/app/api/chat/` — streaming route; emits typed data parts the canvas animates.
- `src/components/canvas|chat|page/` — sigma.js brain canvas, floating chat panel, wiki page side panel.
- `tests/` — vitest, fixture-driven. Seams (highest first): graph engine (incl. constraint solving and characters), pipeline (incl. the TMDB stage over `tests/fixtures/tmdb`), agent loop with mocked model (fast path, cache replay, show_on_brain, face grid), route (permalinks, OG image, rate-limit cap), client rules (entity links, face-grid tap, ego default).

## Rules
- Two graphs, never confused: the precomputed industry graph (read-only, in memory) and the brain (shared, mutable, in Postgres). The canvas renders the brain only.
- Bacon number is computed, never estimated. Strong tier first, full graph fallback, report both when they differ.
- One provider: OpenRouter. Model IDs live in env vars, never in code.
- The shared brain has no auth and no per-user state; conversations are never stored server-side (threads live in localStorage). Accounts exist only for the v3 taste graph, and every taste row carries a user id. Signed-out Headshot must keep working in full.
- Every pick carries exactly one reason and it must be a real graph fact (`graphReason`); no reason, no pick. Taste signals are explicit only (swipe, import, chat); nothing is inferred from clicks.
- Fresh UI. Do not copy Cinema Daddy styling. Tailwind v4 with a hand-written token layer.
- Node.js runtime (Fluid Compute). Never `runtime = 'edge'`.
- Run `pnpm typecheck && pnpm lint && pnpm test` before claiming anything works.
- Keyless dev: `HEADSHOT_GRAPH_PATH=data/fixture.bin` + `HEADSHOT_MOCK_AGENT=1` in `.env.local` runs the fixture graph with the scripted model in `src/lib/agent/mockModel.ts`. `window.__headshot` exposes sigma and the store in dev for QA. `HEADSHOT_DEV_USER=<id>` signs every request in as that id outside production, so Tonight and the taste routes can be exercised without the magic-link email loop.
- The model is told to wrap every entity name in `**bold**`; the client resolves those against the message's `data-node` parts and renders links that open the drawer ("cursor for movies"). Keep that rule in the system prompt.
- Thread views are `noindex`; only `/a/...` answer pages are indexable.
- Brain tests run against embedded Postgres (PGlite + pgvector) and the memory brain through one shared conformance suite in `tests/brain`.
- v5 (in progress, see SPEC.md "# v5 — Simpler"): three sections (Log, Ask, You), ratings are 1–10 with states rated/want/seen/unseen, signed-in chat threads are stored server-side per user (signed-out ones are not), Tonight is computed on demand (no cron), Letterboxd imports by public-profile crawl with CSV fallback.
