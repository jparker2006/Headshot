import { describe, expect, it } from "vitest";
import { accountModel, accountName, navItems, type Surface } from "@/components/navModel";

describe("sidebar nav model (SPEC v4 cuts)", () => {
  it("is exactly You, on both surfaces", () => {
    for (const surface of ["you", "chat"] satisfies Surface[]) {
      const items = navItems(surface);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ key: "you", label: "you" });
    }
  });

  it("marks You active only on the You surface", () => {
    expect(navItems("you")[0].active).toBe(true);
    expect(navItems("chat")[0].active).toBe(false);
  });

  it("has no New chat, Tonight, Later or taste item left", () => {
    const labels = navItems("you").map((n) => n.label.toLowerCase());
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
