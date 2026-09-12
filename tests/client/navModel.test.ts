import { describe, expect, it } from "vitest";
import { accountModel, accountName, navItems, type Surface } from "@/components/navModel";

describe("sidebar nav model (SPEC v5 sections)", () => {
  it("is Log then You, on every surface", () => {
    for (const surface of ["log", "you", "chat"] satisfies Surface[]) {
      const items = navItems(surface);
      expect(items.map((n) => n.key)).toEqual(["log", "you"]);
      expect(items.map((n) => n.label)).toEqual(["log", "you"]);
    }
  });

  it("marks a section active only on its own surface, and a thread lights neither", () => {
    expect(navItems("log").map((n) => n.active)).toEqual([true, false]);
    expect(navItems("you").map((n) => n.active)).toEqual([false, true]);
    expect(navItems("chat").map((n) => n.active)).toEqual([false, false]);
  });

  it("has no New chat, Tonight, Later or taste item left", () => {
    const labels = navItems("log").map((n) => n.label.toLowerCase());
    for (const gone of ["new chat", "tonight", "later", "your taste", "services and imports"]) {
      expect(labels).not.toContain(gone);
    }
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

  it("shows the email and nothing but Sign out when signed in", () => {
    expect(accountModel({ email: "a@b.com" }, false)).toEqual({
      kind: "signed-in",
      label: "a@b.com",
      menu: ["email", "sign-out"],
    });
    expect(accountModel({ email: null }, false).label).toBe("signed in");
  });

  it("keeps a known user through a background refetch", () => {
    expect(accountModel({ email: "a@b.com" }, true).kind).toBe("signed-in");
  });
});

describe("the name the bottom row shows", () => {
  it("is the person, not their whole address", () => {
    expect(accountName("jake@example.com")).toBe("jake");
    expect(accountName("sign in")).toBe("sign in");
    expect(accountName("…")).toBe("…");
  });
});
