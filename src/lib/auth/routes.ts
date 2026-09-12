/**
 * The account route, as a factory over its dependencies — the same seam the
 * taste, tonight and thread routes use, so `tests/route/me.test.ts` can inject
 * a fake session and memory stores.
 *
 * There is one account action and it is destructive: deleting everything
 * Headshot holds about a person. The order matters — the private stores first,
 * the auth row last — so a failure at the auth server never leaves a signed-in
 * account pointing at data that is already gone.
 */
import type { TasteStore } from "@/lib/taste/types";
import type { ThreadStore } from "@/lib/threads/types";

export interface AccountDeps {
  userId: (req: Request) => Promise<string | null>;
  taste: () => Promise<TasteStore>;
  threads: () => Promise<ThreadStore>;
  /**
   * Delete the auth account itself and say what happened. Absent in tests and
   * in keyless dev, where there is no auth server to talk to.
   */
  deleteAuthUser?: () => Promise<"deleted" | "unsupported" | "failed">;
}

const unauthorized = () => Response.json({ error: "sign_in_required" }, { status: 401 });

export function createAccountHandlers(deps: AccountDeps) {
  return {
    /**
     * DELETE /api/me — the delete-account button in Settings. Every per-user
     * table this app owns (watched, services, taste, memory, episodes, crawls,
     * threads and their messages), then the auth account.
     */
    async deleteMe(req: Request): Promise<Response> {
      const userId = await deps.userId(req);
      if (!userId) return unauthorized();
      const [taste, threads] = await Promise.all([deps.taste(), deps.threads()]);
      await taste.deleteUser(userId);
      await threads.deleteUser(userId);
      const account = deps.deleteAuthUser ? await deps.deleteAuthUser() : "unsupported";
      return Response.json({ ok: true, account });
    },
  };
}
