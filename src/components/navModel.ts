/**
 * The sidebar's nav model, kept pure so the cuts SPEC v4 asked for are a test
 * rather than a screenshot: You, History, account. No New chat, no Tonight, no
 * Later, no taste map, no link to /brain.
 *
 * There are exactly two surfaces in the column — You (home) and a thread —
 * because everything else either lives inside You or has been retired.
 */

export type Surface = "you" | "chat";

export interface NavItem {
  key: "you";
  label: string;
  active: boolean;
}

export type AccountKind = "loading" | "signed-in" | "signed-out";

export interface AccountModel {
  kind: AccountKind;
  /** What the row reads: the email when we have one, otherwise "Sign in". */
  label: string;
  /** The menu behind the row. Signed out there is no menu, only sign-in. */
  menu: ("email" | "sign-out")[];
}

/** The whole nav: one item, You, active on the You surface. */
export function navItems(surface: Surface): NavItem[] {
  return [{ key: "you", label: "You", active: surface === "you" }];
}

/** The account row at the bottom. Email and Sign out, nothing else. */
export function accountModel(user: { email: string | null } | null, loading: boolean): AccountModel {
  if (loading && !user) return { kind: "loading", label: "…", menu: [] };
  if (!user) return { kind: "signed-out", label: "Sign in", menu: [] };
  return { kind: "signed-in", label: user.email ?? "Signed in", menu: ["email", "sign-out"] };
}
