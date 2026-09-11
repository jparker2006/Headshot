/**
 * Play goes into the service, not to a "where to watch" page. TMDB gives us
 * which services carry a title but not their internal ids, so each link lands
 * on the service's own search for the title, one tap from the player. Per-
 * service title ids (true one-tap) can replace these as we collect them.
 */
export function serviceDeepLink(providerId: number, name: string, year?: number | null): string | null {
  const q = encodeURIComponent(name);
  const qy = encodeURIComponent(year ? `${name} ${year}` : name);
  switch (providerId) {
    case 8: // Netflix
      return `https://www.netflix.com/search?q=${q}`;
    case 9: // Prime Video
      return `https://www.amazon.com/s?k=${q}&i=instant-video`;
    case 1899: // Max
      return `https://play.max.com/search?q=${q}`;
    case 337: // Disney+
      return `https://www.disneyplus.com/search/${q}`;
    case 15: // Hulu
      return `https://www.hulu.com/search?q=${q}`;
    case 350: // Apple TV+
      return `https://tv.apple.com/search?term=${q}`;
    case 2616: // Paramount+
    case 531:
    case 2303:
      return `https://www.paramountplus.com/search/?q=${q}`;
    case 386: // Peacock
      return `https://www.peacocktv.com/search?q=${q}`;
    case 258: // Criterion Channel
      return `https://www.criterionchannel.com/search?q=${q}`;
    case 11: // Mubi
      return `https://mubi.com/en/search/films?query=${q}`;
    case 73: // Tubi
      return `https://tubitv.com/search/${q}`;
    case 192: // YouTube
      return `https://www.youtube.com/results?search_query=${qy}`;
    default:
      return null;
  }
}
