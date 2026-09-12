/**
 * The sidebar's nav model, kept pure so the cuts SPEC v4 asked for are a test
 * rather than a screenshot: log, you, History, account. No New chat, no
 * Tonight, no Later, no taste map, no link to /brain.
 *
 * Three surfaces in the column (SPEC v5): Log — the product, and the landing
 * for anyone signed in — You, and a thread. Labels
 * are lowercase: board C sets every rail item in sentence case (DESIGN.md →
 * Sidebar, Copy).
 */

export type Surface = "log" | "you" | "chat";

/** The sections the rail lists. Chunk C adds Ask and the session list. */
export const SECTIONS = ["log", "you"] as const;
export type Section = (typeof SECTIONS)[number];

export interface NavItem {
  key: Section;
  label: string;
  active: boolean;
}

export type AccountKind = "loading" | "signed-in" | "signed-out";

export interface AccountModel {
  kind: AccountKind;
  /** What the row reads: the email when we have one, otherwise "sign in". */
  label: string;
  /** The menu behind the row. Signed out there is no menu, only sign-in. */
  menu: ("email" | "sign-out")[];
}

/**
 * The whole nav: Log — the product, and where a signed-in person lands — then
 * You. A thread lights neither; `history` still carries that (Chunk C folds
 * the sessions under Ask).
 */
export function navItems(surface: Surface): NavItem[] {
  return SECTIONS.map((key) => ({ key, label: key, active: surface === key }));
}

/** The account row at the bottom. Email and Sign out, nothing else. */
export function accountModel(user: { email: string | null } | null, loading: boolean): AccountModel {
  if (loading && !user) return { kind: "loading", label: "…", menu: [] };
  if (!user) return { kind: "signed-out", label: "sign in", menu: [] };
  return { kind: "signed-in", label: user.email ?? "signed in", menu: ["email", "sign-out"] };
}

/**
 * What the bottom row shows: board C writes the person's name, not their full
 * address ("jake"). The email stays in the menu behind it and in the title.
 */
export function accountName(label: string): string {
  const at = label.indexOf("@");
  return at > 0 ? label.slice(0, at) : label;
}
