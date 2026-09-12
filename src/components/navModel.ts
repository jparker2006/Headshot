/**
 * The sidebar's nav model, kept pure so the shape SPEC v5 asked for is a test
 * rather than a screenshot: three sections — Log (the product), Ask (the
 * interface to it), You (the receipt) — the session list under Ask and only
 * under Ask, and the account row at the bottom. Nothing else is in the rail.
 *
 * Labels are lowercase: board C sets every rail item in sentence case
 * (DESIGN.md → Sidebar (v5), Copy).
 */

/** Where the shell is. v5 has exactly three; a thread is part of `ask`. */
export type Surface = "log" | "ask" | "you";

/** The sections the rail lists, in board order. */
export const SECTIONS = ["log", "ask", "you"] as const;
export type Section = (typeof SECTIONS)[number];

/** A rail row is a section, or — signed out — the way in. */
export type NavKey = Section | "sign-in";

export interface NavItem {
  key: NavKey;
  label: string;
  active: boolean;
}

export type AccountKind = "loading" | "signed-in" | "signed-out";

export interface AccountModel {
  kind: AccountKind;
  /** What the row reads: the email when we have one, otherwise "sign in". */
  label: string;
  /** The menu behind the row. Signed out there is no menu, only sign-in. */
  menu: ("settings" | "sign-out")[];
}

/**
 * The rail's rows. Signed in: log / ask / you. Signed out there is no log and
 * no you — only Ask (trivia works for everyone) and the way in (SPEC v5 →
 * "Signed out: Ask and Sign in only").
 */
export function navItems(surface: Surface | null, signedIn: boolean): NavItem[] {
  if (!signedIn) {
    return [
      { key: "ask", label: "ask", active: surface === "ask" },
      { key: "sign-in", label: "sign in", active: false },
    ];
  }
  return SECTIONS.map((key) => ({ key, label: key, active: surface === key }));
}

/**
 * The sessions sit under Ask, indented, and appear only when Ask is the
 * surface — the indent is what says whose they are. Signed-out threads live in
 * localStorage and are never listed (SPEC v5).
 */
export function sessionsShown(surface: Surface | null, signedIn: boolean): boolean {
  return surface === "ask" && signedIn;
}

/** The account row at the bottom: the email, and a menu of Settings / Sign out. */
export function accountModel(user: { email: string | null } | null, loading: boolean): AccountModel {
  if (loading && !user) return { kind: "loading", label: "…", menu: [] };
  if (!user) return { kind: "signed-out", label: "sign in", menu: [] };
  return { kind: "signed-in", label: user.email ?? "signed in", menu: ["settings", "sign-out"] };
}

/**
 * What a session row reads. The server may not have titled a thread yet, and
 * an untitled thread is still a real row — it says so rather than going blank.
 */
export function sessionTitle(title: string | null | undefined): string {
  const t = (title ?? "").trim();
  return t.length > 0 ? t : "new chat";
}
