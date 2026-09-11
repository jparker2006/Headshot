import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

/** Reads cookies on every request, so it can never be prerendered. */
export const dynamic = "force-dynamic";

const handler = getAuth()?.handler() ?? null;

/** Keyless dev and any misconfigured deploy answer honestly instead of 500ing. */
function unconfigured(): Response {
  return Response.json({ error: "auth_unconfigured" }, { status: 503 });
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/auth/[...path]">): Promise<Response> {
  return handler ? handler.GET(req, ctx) : unconfigured();
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/auth/[...path]">): Promise<Response> {
  return handler ? handler.POST(req, ctx) : unconfigured();
}
