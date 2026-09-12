"use client";
/**
 * The phone's nav (`design/boards-v5/Shell-phone.dc.html`): three 54px cells
 * over one hairline — 19px icon, 11.5px label, active `--ink`, inactive
 * `--ink-faint` — with the safe area added under it. The old `you` / `history`
 * text tabs are gone; sessions live inside Ask, behind the top bar's `chats`.
 *
 * Signed out it is the same bar with the two rows the rail has: `ask` and the
 * way in (`navModel.ts`).
 */
import { SectionIcon } from "./navIcons";
import { requireSignIn, useSessionUser } from "./auth/SignInGate";
import { navItems, type Section, type Surface } from "./navModel";

export function TabBar({ surface, onNavigate }: { surface: Surface; onNavigate: (section: Section) => void }) {
  const { user } = useSessionUser();
  const items = navItems(surface, Boolean(user));
  return (
    <nav
      className="grid shrink-0 border-t border-line pb-[max(10px,env(safe-area-inset-bottom))] md:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      aria-label="Sections"
    >
      {items.map((n) => (
        <button
          key={n.key}
          onClick={() => (n.key === "sign-in" ? requireSignIn(window.location.pathname) : onNavigate(n.key as Section))}
          className={`tab-cell ${n.active ? "text-ink" : "text-ink-faint"}`}
          aria-current={n.active ? "page" : undefined}
        >
          <SectionIcon name={n.key} size={19} />
          <span className={`text-[11.5px] leading-none ${n.active ? "font-medium" : ""}`}>{n.label}</span>
        </button>
      ))}
    </nav>
  );
}
