import { threadHandlers } from "@/lib/threads/deps";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/api/threads/[id]">): Promise<Response> {
  return threadHandlers.get(req, (await ctx.params).id);
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/threads/[id]">): Promise<Response> {
  return threadHandlers.rename(req, (await ctx.params).id);
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/threads/[id]">): Promise<Response> {
  return threadHandlers.remove(req, (await ctx.params).id);
}
