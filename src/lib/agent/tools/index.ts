import type { AgentContext } from "../context";
import { graphTools } from "./graph";
import { entityTools } from "./entities";
import { tmdbTools } from "./tmdb";
import { brainTools } from "./brain";
import { tasteTools } from "./taste";

export function headshotTools(ctx: AgentContext) {
  return { ...entityTools(ctx), ...graphTools(ctx), ...tmdbTools(ctx), ...brainTools(ctx), ...tasteTools(ctx) };
}

export type HeadshotTools = ReturnType<typeof headshotTools>;
