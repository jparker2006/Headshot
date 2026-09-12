import type { AgentContext } from "../context";
import { graphTools } from "./graph";
import { entityTools } from "./entities";
import { tmdbTools } from "./tmdb";
import { brainTools } from "./brain";

/** Pages are written by the turn's page job (`pages.ts`), never by the model; only reading stays in the chat loop. */
function chatBrainTools(ctx: AgentContext) {
  const { read_page } = brainTools(ctx);
  return { read_page };
}
import { tasteTools } from "./taste";

export function headshotTools(ctx: AgentContext) {
  return { ...entityTools(ctx), ...graphTools(ctx), ...tmdbTools(ctx), ...chatBrainTools(ctx), ...tasteTools(ctx) };
}

export type HeadshotTools = ReturnType<typeof headshotTools>;
