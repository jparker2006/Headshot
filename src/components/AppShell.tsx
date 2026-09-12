"use client";
/**
 * The shell around a page that is not one of the three surfaces — today that
 * is `/settings`. Same rail, same phone bars, same 34px gutter; nothing in the
 * rail is lit, because you are not in Log, Ask or You (DESIGN.md → Sidebar
 * (v5)). The sessions are hidden for the same reason, so this rail's chat
 * callbacks only ever have to get you back to Ask.
 *
 * `HeadshotApp` keeps its own shell: it owns the drawer, the threads and the
 * composer, none of which a settings page has any business holding.
 */
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { type Section } from "./navModel";

/** `/` carries the surface it should land on; Log is the bare route. */
export function surfaceHref(section: Section): string {
  return section === "log" ? "/" : `/?surface=${section}`;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const go = (section: Section) => router.push(surfaceHref(section));

  const railProps = {
    surface: null,
    sessions: [],
    activeId: null,
    onNavigate: go,
    onNewChat: () => router.push(surfaceHref("ask")),
    onSelectThread: () => router.push(surfaceHref("ask")),
    onRenameThread: () => {},
    onDeleteThread: () => {},
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg">
      <div className="hidden h-full md:block">
        <Sidebar {...railProps} />
      </div>

      <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-clip">
        <div className="flex h-[44px] shrink-0 items-center border-b border-line px-4 md:hidden">
          <button onClick={() => router.push("/")} className="flex h-[44px] items-center text-[14px] font-bold leading-none tracking-[-0.02em] text-ink">
            headshot
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="w-full px-4 pb-[40px] pt-[22px] md:px-[34px]">{children}</div>
        </div>
        <TabBar surface={null} onNavigate={go} />
      </main>
    </div>
  );
}
