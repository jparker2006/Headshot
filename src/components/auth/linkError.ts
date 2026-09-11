/**
 * Magic-link failures. A link can only be spent once and mail clients (and
 * corporate link scanners) open it before the person does, so "invalid or
 * expired" is the common case, not an edge case — the sign-in page says so
 * plainly and offers a fresh one. Better Auth spells the reason
 * INVALID_TOKEN / EXPIRED_TOKEN; we also send our own `invalid_link`, so the
 * test is a shape rather than an exact code.
 */
export function isSpentLink(error: string | null | undefined): boolean {
  if (!error) return false;
  return /invalid|expired|token|used/i.test(error);
}
