/**
 * Neon Managed Better Auth, server side. Accounts exist in v3 for the private
 * taste graph only (SPEC v3): Headshot's chat, the shared brain, and the answer
 * permalinks all keep working signed out, so nothing here may ever be required
 * to render a page. Sign-in is opt-in and there is no proxy.ts guarding routes.
 *
 * Magic link only. Passwords are never offered, and there is no fallback to
 * them if the Magic Link plugin is off in the Neon console.
 */
import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";

/** Better Auth refuses a cookie secret shorter than this. */
const MIN_SECRET_LENGTH = 32;

/**
 * True when both env vars are present and usable. False in keyless dev and in
 * tests, where every auth entry point degrades to "signed out" rather than
 * throwing.
 */
export function authConfigured(): boolean {
  return Boolean(
    process.env.NEON_AUTH_BASE_URL && (process.env.NEON_AUTH_COOKIE_SECRET ?? "").length >= MIN_SECRET_LENGTH,
  );
}

let cached: NeonAuth | null | undefined;

/**
 * The process-wide auth instance, or null when unconfigured. Built lazily so
 * that importing this module never throws — a missing env var must degrade to
 * signed out, not take the whole app down.
 */
export function getAuth(): NeonAuth | null {
  if (cached !== undefined) return cached;
  if (!authConfigured()) {
    cached = null;
    return cached;
  }
  try {
    cached = createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL!,
      cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
    });
  } catch (err) {
    console.warn("[auth] createNeonAuth failed; running signed out:", err);
    cached = null;
  }
  return cached;
}

/** The configured instance, or null. Kept as a name for call sites that read better. */
export const auth: NeonAuth | null = getAuth();

/**
 * The signed-in user's id, or null. Never throws: unset env (keyless dev,
 * tests), no session, and an unreachable auth server all mean "signed out".
 * Protected API routes call this themselves and answer 401; nothing redirects.
 */
/** Dev-only: HEADSHOT_DEV_USER=<id> signs every request in as that id (never in production). */
function devUser(): string | null {
  const id = process.env.HEADSHOT_DEV_USER;
  return id && process.env.NODE_ENV !== "production" ? id : null;
}

export async function currentUserId(): Promise<string | null> {
  const dev = devUser();
  if (dev) return dev;
  const instance = getAuth();
  if (!instance) return null;
  try {
    const result = (await instance.getSession()) as { data?: { user?: { id?: string } } | null } | null;
    const id = result?.data?.user?.id;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch (err) {
    console.warn("[auth] getSession failed; treating the request as signed out:", err);
    return null;
  }
}

/** The signed-in user's id and email, or null. Used by the sidebar's account row. */
export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  const dev = devUser();
  if (dev) return { id: dev, email: `${dev}@dev.local` };
  const instance = getAuth();
  if (!instance) return null;
  try {
    const result = (await instance.getSession()) as {
      data?: { user?: { id?: string; email?: string } } | null;
    } | null;
    const user = result?.data?.user;
    if (!user?.id) return null;
    return { id: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
}
