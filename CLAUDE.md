@AGENTS.md

# Headshot

The shared brain of who was in what with whom. Read `SPEC.md` first; it is the source of truth for every product and architecture decision and was confirmed line by line.

## Layout
- `scripts/build-graph/` — offline pipeline: IMDb TSVs → filtered, tiered, packed adjacency arrays → Vercel Blob (versioned). Runs on a Mac with `pnpm build:graph`.
- `src/lib/graph/` — the in-process industry graph: binary loader, tiered bidirectional BFS, tied-path enumeration, overlay merge. Deterministic, no network, no model. Primary test seam.
- `src/lib/brain/` — Postgres (Neon + pgvector, Drizzle) for the shared brain: touched nodes, overlay edges, wiki pages, revision log, embeddings, session glow.
- `src/lib/tmdb/` — TMDB client (pattern copied from Cinema Daddy, no UI copied).
- `src/lib/agent/` — AI SDK agent loop on OpenRouter; six tools under `tools/`. `shortest_path` results pass through unmodified; the agent never invents a path.
- `src/app/api/chat/` — streaming route; emits typed data parts the canvas animates.
- `src/components/canvas|chat|page/` — sigma.js brain canvas, floating chat panel, wiki page side panel.
- `tests/` — vitest, fixture-driven. Seams (highest first): graph engine, pipeline, agent loop with mocked model, rate-limit cap.

## Rules
- Two graphs, never confused: the precomputed industry graph (read-only, in memory) and the brain (shared, mutable, in Postgres). The canvas renders the brain only.
- Bacon number is computed, never estimated. Strong tier first, full graph fallback, report both when they differ.
- One provider: OpenRouter. Model IDs live in env vars, never in code.
- No auth, no per-user brains, no server-side conversations. Threads live in localStorage.
- Fresh UI. Do not copy Cinema Daddy styling. Tailwind v4 with a hand-written token layer.
- Node.js runtime (Fluid Compute). Never `runtime = 'edge'`.
- Run `pnpm typecheck && pnpm test` before claiming anything works.
