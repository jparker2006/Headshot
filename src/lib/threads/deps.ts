import { currentUserId } from "@/lib/auth/server";
import { createThreadHandlers } from "./routes";
import { getThreadStore } from "./index";

/** The thread handlers wired to production dependencies: the real session and store. */
export const threadHandlers = createThreadHandlers({
  userId: () => currentUserId(),
  store: getThreadStore,
});
