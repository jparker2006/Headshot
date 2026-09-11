"use client";

/**
 * Neon Managed Better Auth, client side. One instance for the whole app; it
 * talks to `/api/auth/[...path]`, which proxies to the Neon Auth server.
 * `createAuthClient()` reads no env, so this is safe in keyless dev — calls
 * simply fail and the sign-in page shows the unconfigured message.
 */
import { createAuthClient } from "@neondatabase/auth/next";

export const authClient = createAuthClient();
