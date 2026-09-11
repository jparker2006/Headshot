# Headshot

*The shared brain of who was in what with whom.*

Live: https://headshot-hazel.vercel.app

Ask "how is Timothée Chalamet connected to Kevin Bacon?" or "who's the bald guy from the Apple show who was also in Parks and Rec?" and watch an agent resolve, traverse, and narrate the answer on a living graph that every question grows.

See [SPEC.md](./SPEC.md) for the full design. Successor to [Cinema Daddy](https://github.com/jparker2006/CinemaDaddy).

## Stack
Next.js 16 (App Router, Node runtime) · Vercel AI SDK on OpenRouter (DeepSeek V4.1 Flash, text-embedding-3-small) · sigma.js + graphology · Neon Postgres + pgvector via Drizzle · Vercel Blob for the packed IMDb graph.

## Run it in two minutes, no keys
```bash
pnpm install
pnpm build:graph --input tests/fixtures/imdb --out data/fixture.bin   # tiny synthetic graph
printf 'HEADSHOT_GRAPH_PATH=data/fixture.bin\nHEADSHOT_MOCK_AGENT=1\n' > .env.local
pnpm dev
```
Then ask "Connect Jane Doe to Kevin Bacon". The scripted mock agent walks the real tool loop (resolve → shortest_path → highlight_path → write_page → narrate) and the canvas animates it. In-memory brain, no database.

## Run it for real
```bash
cp .env.example .env.local   # OPENROUTER_API_KEY, TMDB_BEARER_TOKEN, DATABASE_URL (Neon, pgvector), BLOB_READ_WRITE_TOKEN
pnpm build:graph --upload --tmdb   # downloads the IMDb datasets (~1 GB), crawls TMDB full casts for the top 20,000 titles (cached under data/tmdb, resumable), packs the graph, uploads a versioned build to Blob
pnpm db:migrate                    # creates the brain tables (and the vector extension)
pnpm embed                         # embeds the top 50,000 entities into pgvector for the semantic fallback
pnpm dev
```
Set `HEADSHOT_GRAPH_URL` to the Blob URL the pipeline prints. Remove `HEADSHOT_MOCK_AGENT` to use the real model.

## How it works
- **Industry graph** (`src/lib/graph`): the IMDb datasets filtered (vote floor, title types, talk shows and 200+-episode series demoted to a weak tier) and packed into CSR adjacency arrays. Loaded once per process. Tiered BFS: strong tier first, full graph for the true Bacon number, up to 20 tied paths.
- **Brain** (`src/lib/brain`): Postgres via Drizzle. Every node anyone touched, live-discovered overlay edges (which the engine merges into path finding), agent-written wiki pages with a revision log keyed by the triggering question, and session attribution for the glow.
- **Agent** (`src/lib/agent`): AI SDK tool loop on OpenRouter. Tools: `find_entities`, `find_by_constraints`, `shortest_path`, `highlight_path`, `common_neighbors`, `shared_credits`, `neighborhood`, `show_on_brain`, `tmdb_search`, `tmdb_person`, `tmdb_title`, `expand_node`, `read_page`, `write_page`. Canvas events stream as typed data parts.
- **Fast path** (`src/lib/agent/fastpath.ts`): a regex classifier assigns a shape (path, costar, both, known-for, identify) and, when every name resolves exactly, the server computes the result and streams the chain before the model starts; the model only narrates.
- **Answer store** (`answers` table): every deterministic answer is stored keyed by shape + sorted entity ids. A repeat question replays the stored events, narration and follow-ups with no model call. Stale answers (older graph build) still serve and recompute in the background. Clean, short questions get a public permalink at `/a/<slug>-<shortid>` with a server-rendered Open Graph image.
- **Identification** (`src/lib/agent/identify.ts`): "who is that guy from that show" intersects full casts across the titles mentioned and scores by role hint against character names, prominence and era. Two to eight candidates render as a grid of faces; tapping one opens the page or continues the answer with "I mean <name>". Embeddings back it when no name matches.
- **Cursor for movies**: every bold name in an answer or a page is a link that opens that person or title in the drawer, resolved from the message's own node events (search fallback on click). "Show me X on the brain" centers the ego view on X.
- **After the answer**: a cheap second model call writes or revises wiki pages for the entities the answer was about (`src/lib/agent/pages.ts`, run via `waitUntil`), and another suggests three follow-up questions streamed as a `data-followups` part.
- **Pages** (`/api/page/:id`): brain page plus TMDB extras: rating, runtime, tagline, overview, trailer embed, where to watch (region from `STREAMING_REGION`, default US), bio and birthplace for people.
- **Canvas** (`src/components/canvas`): sigma.js + graphology + ForceAtlas2. The whole-brain view lights the chosen path while an answer streams; afterwards the panel centers on the first person in the question (ego view with headshots on the first ring, drawer open). On a phone the answer comes first and the brain sits behind the header button.

## Tonight (v3)
Sign in with a magic link (Neon Managed Better Auth; enable the Magic Link plugin and trusted domains in the Neon console), tell it which services you pay for, upload your Letterboxd export or swipe fifty posters, and the home screen opens on three picks for tonight with one real graph reason each and a Play button into the service. A nightly cron (`/api/cron/tonight`, `CRON_SECRET`) refreshes every active user's picks and deck. The taste map (sidebar) is your private ego graph on the same canvas.

Env: `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (32+ chars), `CRON_SECRET`. Dev: `HEADSHOT_DEV_USER=<id>` signs every request in as that id outside production.

## API
- `POST /api/chat` — the agent (UI message stream)
- `GET /api/brain` — snapshot for the canvas
- `GET /api/page/:imdbId` — a node's page and neighborhood
- `GET /api/search?q=` — name search
- `POST /api/expand` — double-click expand
- `GET /api/tonight` · `POST /api/tonight/refresh` — the picks (sign-in required)
- `GET/PUT /api/taste/services` · `POST /api/taste/import` · `GET /api/taste/deck` · `POST /api/taste/swipe` · `POST /api/taste/later` · `GET /api/taste/map`
- `GET /api/cron/tonight` — the overnight run (bearer `CRON_SECRET`)
- `GET /a/<slug>-<shortid>` — permalink for a public answer (indexable; `/opengraph-image` beneath it renders the share card)

## Scripts
- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm typecheck` · `pnpm lint` · `pnpm test`
- `pnpm build:graph` — offline industry-graph pipeline (`--tmdb` for the full-cast stage, `--tmdb-titles`, `--tmdb-cache`, `--tmdb-concurrency`)
- `pnpm embed` — entity embeddings into pgvector (`--top`, `--batch`, `--concurrency`)
- `pnpm db:generate` / `pnpm db:migrate` — Drizzle migrations
