import { currentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** The signed-in user as the server sees it (honours the dev override), or null. */
export async function GET(): Promise<Response> {
  return Response.json({ user: await currentUser() });
}
