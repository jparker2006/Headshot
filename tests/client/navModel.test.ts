import { describe, expect, it } from "vitest";
import { accountModel, navItems, sessionsShown, sessionTitle, type Surface } from "@/components/navModel";

const SURFACES = ["log", "ask", "you"] satisfies Surface[];

describe("sidebar nav model (SPEC v5 sections)", () => {
  it("is Log, Ask, You — three sections and nothing else — on every surface", () => {
    for (const surface of SURFACES) {
      const items = navItems(surface, true);
      expect(items.map((n) => n.key)).toEqual(["log", "ask", "you"]);
      expect(items.map((n) => n.label)).toEqual(["log", "ask", "you"]);
    }
  });

  it("marks exactly the surface you are on", () => {
    expect(navItems("log", true).map((n) => n.active)).toEqual([true, false, false]);
    expect(navItems("ask", true).map((n) => n.active)).toEqual([false, true, false]);
    expect(navItems("you", true).map((n) => n.active)).toEqual([false, false, true]);
  });

  it("signed out is Ask and the way in, nothing else", () => {
    const items = navItems("ask", false);
    expect(items.map((n) => n.key)).toEqual(["ask", "sign-in"]);
    expect(items.map((n) => n.label)).toEqual(["ask", "sign in"]);
    expect(items.find((n) => n.key === "sign-in")!.active).toBe(false);
    expect(items.find((n) => n.key === "ask")!.active).toBe(true);
  });

  it("has no New chat, Tonight, Later, history or taste item left", () => {
    const labels = navItems("log", true).map((n) => n.label.toLowerCase());
    for (const gone of ["new chat", "tonight", "later", "history", "your taste", "services and imports", "chat"]) {
      expect(labels).not.toContain(gone);
    }
  });
});

describe("the session list", () => {
  it("shows under Ask and only under Ask", () => {
    expect(sessionsShown("ask", true)).toBe(true);
    expect(sessionsShown("log", true)).toBe(false);
    expect(sessionsShown("you", true)).toBe(false);
  });

  it("never lists a signed-out person's threads: those stay in localStorage", () => {
    for (const surface of SURFACES) expect(sessionsShown(surface, false)).toBe(false);
  });

  it("calls an untitled thread what it is", () => {
    expect(sessionTitle("what do I like?")).toBe("what do I like?");
    expect(sessionTitle(null)).toBe("new chat");
    expect(sessionTitle("   ")).toBe("new chat");
  });
});

describe("account row", () => {
  it("offers sign-in when signed out, with no menu behind it", () => {
    const account = accountModel(null, false);
    expect(account).toEqual({ kind: "signed-out", label: "sign in", menu: [] });
  });

  it("waits quietly while the session is still loading", () => {
    expect(accountModel(null, true)).toMatchObject({ kind: "loading", menu: [] });
  });

  it("shows the email, with Settings and Sign out behind it", () => {
    expect(accountModel({ email: "a@b.com" }, false)).toEqual({
      kind: "signed-in",
      label: "a@b.com",
      menu: ["settings", "sign-out"],
    });
    expect(accountModel({ email: null }, false).label).toBe("signed in");
  });

  it("keeps a known user through a background refetch", () => {
    expect(accountModel({ email: "a@b.com" }, true).kind).toBe("signed-in");
  });
});
