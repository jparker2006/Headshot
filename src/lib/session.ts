import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./limits";

/** The anonymous session id from the cookie, if any. Only used for the glow. */
export async function readSessionId(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}
