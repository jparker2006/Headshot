import { currentUser, currentUserId, deleteAuthUser } from "@/lib/auth/server";
import { createAccountHandlers } from "@/lib/auth/routes";
import { getTasteStore } from "@/lib/taste";
import { getThreadStore } from "@/lib/threads";

export const dynamic = "force-dynamic";

/** The signed-in user as the server sees it (honours the dev override), or null. */
export async function GET(): Promise<Response> {
  return Response.json({ user: await currentUser() });
}

const account = createAccountHandlers({
  userId: () => currentUserId(),
  taste: getTasteStore,
  threads: getThreadStore,
  deleteAuthUser,
});

/** DELETE /api/me — delete account: every table of theirs, then the auth row. */
export const DELETE = account.deleteMe;
