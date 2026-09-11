# Headshot

*The shared brain of who was in what with whom.*

Ask "how is Timothée Chalamet connected to Kevin Bacon?" or "who's the bald guy from the Apple show who was also in Parks and Rec?" and watch an agent resolve, traverse, and narrate the answer on a living graph that every question grows.

See [SPEC.md](./SPEC.md) for the full design. Successor to [Cinema Daddy](https://github.com/jparker2006/CinemaDaddy).

## Stack
Next.js 16 (App Router, Node runtime) · Vercel AI SDK on OpenRouter (DeepSeek V4.1 Flash, text-embedding-3-small) · sigma.js + graphology · Neon Postgres + pgvector via Drizzle · Vercel Blob for the packed IMDb graph.

## Setup
```bash
pnpm install
cp .env.example .env.local   # fill in keys
pnpm build:graph             # downloads IMDb datasets, packs the graph, uploads to Blob
pnpm dev
```

## Scripts
- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm typecheck` · `pnpm lint` · `pnpm test`
- `pnpm build:graph` — offline industry-graph pipeline
- `pnpm db:generate` / `pnpm db:migrate` — Drizzle migrations
