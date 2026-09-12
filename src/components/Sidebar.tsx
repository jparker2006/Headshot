"use client";
/**
 * The rail, v5 (DESIGN.md → Sidebar (v5), `design/boards-v5/Shell.dc.html`):
 * 232px on the same ground as the page, one hairline on the right, padding
 * 22/12/18/12. Wordmark, then three 32px section rows — `log` / `ask` / `you`
 * — where the ink level *is* the state (no pill, no fill, no active bar), then
 * the sessions indented under Ask and only under Ask, then the account row
 * pinned to the bottom over one hairline.
 *
 * Signed out there is no log and no you: the rail is `ask` and the way in.
 * Signed-out threads live in localStorage and are never listed (SPEC v5).
 *
 * What the rail contains is decided in `navModel.ts` so the cuts are testable.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SectionIcon, PlusIcon, SettingsIcon } from "./navIcons";
import { requireSignIn, signOut, useSessionUser } from "./auth/SignInGate";
import { accountModel, navItems, sessionsShown, sessionTitle, type Section, type Surface } from "./navModel";

export type { Surface };

export interface SessionItem {
  id: string;
  title: string | null;
}

interface Props {
  /** Null on a page that is none of the three sections (`/settings`). */
  surface: Surface | null;
  /** The signed-in person's threads, newest updated first. Empty signed out. */
  sessions: SessionItem[];
  activeId: string | null;
  onNavigate: (section: Section) => void;
  onNewChat: () => void;
  onSelectThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
  onDeleteThread: (id: string) => void;
  /**
   * `sheet` is the phone's `chats` panel. The three sections are the bottom
   * tab bar there and the wordmark is in the top bar, so the sheet carries
   * only what the phone board asks it to: the chats.
   */
  variant?: "rail" | "sheet";
}

export function Sidebar({ surface, sessions, activeId, onNavigate, onNewChat, onSelectThread, onRenameThread, onDeleteThread, variant = "rail" }: Props) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const { user, loading } = useSessionUser();
  const signedIn = Boolean(user);

  const nav = navItems(surface, signedIn);
  const account = accountModel(user, loading);
  const signIn = () => requireSignIn(typeof window === "undefined" ? "/" : window.location.pathname);
  const sheet = variant === "sheet";
  // The sheet is opened from `chats`, so it lists chats whatever the shell
  // thinks the surface is; the rail shows them under Ask and only there.
  const showSessions = sheet ? signedIn : sessionsShown(surface, signedIn);

  return (
    // 232px is the rail; as a phone sheet it takes the width it is given.
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-line bg-bg px-[12px] pb-[18px] pt-[22px] md:w-[232px]" aria-label="Sidebar">
      {!sheet && (
        <>
          <button
            onClick={() => onNavigate(signedIn ? "log" : "ask")}
            className="mb-[22px] px-[12px] text-left text-[14px] font-bold leading-none tracking-[-0.02em] text-ink"
          >
            headshot
          </button>

          <nav className="flex flex-col gap-[2px]" aria-label="Sections">
            {nav.map((n) => (
              <button
                key={n.key}
                onClick={() => (n.key === "sign-in" ? signIn() : onNavigate(n.key as Section))}
                className={`nav-row text-left ${n.active ? "text-ink" : "text-ink-faint hover:text-ink"}`}
              >
                <SectionIcon name={n.key} />
                <span className="t-ui truncate">{n.label}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      {showSessions && (
        <>
          <button onClick={onNewChat} className={`session-row gap-[9px] text-ink ${sheet ? "" : "mt-[6px]"}`}>
            <PlusIcon />
            <span className="truncate text-[13px] leading-none">new chat</span>
          </button>

          <span className="mb-[4px] mt-[12px] px-[12px] pl-[28px] text-[13px] leading-[20px] text-ink-faint">chats</span>

          <nav className="scrollbar-thin -mr-[4px] flex min-h-0 flex-1 flex-col overflow-y-auto pr-[4px]" aria-label="Chats">
            {sessions.length === 0 && <span className="t-meta px-[12px] pl-[28px]">nothing asked yet</span>}
            {sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                active={s.id === activeId && surface === "ask"}
                editing={editing === s.id}
                onEdit={() => setEditing(s.id)}
                onEndEdit={(title) => {
                  setEditing(null);
                  const next = title.trim();
                  if (next && next !== sessionTitle(s.title)) onRenameThread(s.id, next);
                }}
                onOpen={() => onSelectThread(s.id)}
                onDelete={() => onDeleteThread(s.id)}
              />
            ))}
          </nav>
        </>
      )}

      {/* Signed out the rail is `ask` and `sign in` and nothing else — a second
          way in at the bottom would be the same control twice. */}
      <div className={`relative mt-auto border-t border-line pt-[12px] ${account.kind === "signed-out" ? "hidden" : ""}`}>
        {menu && signedIn && (
          <div className="panel absolute bottom-full left-0 mb-[10px] w-[188px] p-[8px]" role="menu">
            <Link href="/settings" className="rail-row t-ui text-ink-dim transition-colors duration-[120ms] hover:text-ink" onClick={() => setMenu(false)}>
              Settings
            </Link>
            <button onClick={() => void signOut()} className="rail-row t-ui w-full text-left text-ink-dim transition-colors duration-[120ms] hover:text-ink">
              Sign out
            </button>
          </div>
        )}
        <button
          onClick={() => (signedIn ? setMenu((m) => !m) : signIn())}
          className="rail-row w-full text-left text-ink-faint transition-colors duration-[120ms] hover:text-ink"
          title={account.label}
          aria-haspopup={signedIn ? "menu" : undefined}
          aria-expanded={menu}
        >
          <span className="t-meta min-w-0 flex-1 truncate text-ink-faint">{account.label}</span>
          <span className="shrink-0 text-ink-ghost">
            <SettingsIcon />
          </span>
        </button>
      </div>
    </aside>
  );
}

/**
 * One session: 28px, one line, truncating. Hover reveals `rename` and `×`
 * (`.row-reveal` takes them out of flow until then, so the title gets the whole
 * row, and a touch screen — which never hovers — simply always has them); a
 * double click renames in place, which is what everyone already tries.
 *
 * Deleting a chat cannot be undone, so it asks once: the `×` becomes `delete?`
 * at `--danger` and only the second click commits (DESIGN.md → Color, the one
 * place the danger ink is allowed).
 */
function SessionRow({
  session,
  active,
  editing,
  onEdit,
  onEndEdit,
  onOpen,
  onDelete,
}: {
  session: SessionItem;
  active: boolean;
  editing: boolean;
  onEdit: () => void;
  onEndEdit: (title: string) => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const title = sessionTitle(session.title);
  const [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  if (editing) {
    return (
      <div className="session-row">
        <input
          ref={ref}
          defaultValue={title}
          aria-label="Rename chat"
          onBlur={(e) => onEndEdit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEndEdit((e.target as HTMLInputElement).value);
            if (e.key === "Escape") onEndEdit(title);
          }}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] leading-none text-ink outline-none"
        />
      </div>
    );
  }

  return (
    <div className={`session-row ${active ? "is-open" : ""}`} onMouseLeave={() => setConfirm(false)}>
      <button
        onClick={onOpen}
        onDoubleClick={onEdit}
        className={`min-w-0 flex-1 truncate text-left text-[13px] leading-none transition-colors duration-[120ms] ${active ? "font-medium text-ink" : "text-ink-dim hover:text-ink"}`}
        title={title}
      >
        {title}
      </button>
      <button onClick={onEdit} className="row-reveal t-meta shrink-0 hover:text-ink" aria-label={`Rename ${title}`}>
        rename
      </button>
      <button
        onClick={() => (confirm ? onDelete() : setConfirm(true))}
        onBlur={() => setConfirm(false)}
        className={`row-reveal t-meta -mx-[4px] shrink-0 justify-center px-[4px] ${confirm ? "text-danger" : "hover:text-ink"}`}
        aria-label={confirm ? `Delete ${title} for good` : `Delete ${title}`}
      >
        {confirm ? "delete?" : "×"}
      </button>
    </div>
  );
}
