import { getIndustryGraph } from "@/lib/graph";
import { getBrain } from "@/lib/brain";
import { renderBrain } from "@/lib/brain/render";
import { readSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const [graph, brain, sessionId] = await Promise.all([getIndustryGraph(), getBrain(), readSessionId()]);
  return Response.json(await renderBrain(graph, brain, sessionId), { headers: { "cache-control": "no-store" } });
}
