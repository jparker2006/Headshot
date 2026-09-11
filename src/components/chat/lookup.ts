/** Resolve a name to an IMDb id through the search route: exact match first, then the top hit. Shared by the chat and Tonight. */
export async function lookupName(name: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/search?q=${encodeURIComponent(name)}`);
    if (!r.ok) return null;
    const { hits } = (await r.json()) as { hits: { imdbId: string; name: string }[] };
    const exact = hits.find((h) => h.name.toLowerCase() === name.trim().toLowerCase());
    return (exact ?? hits[0])?.imdbId ?? null;
  } catch {
    return null;
  }
}
