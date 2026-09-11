"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HeadshotUIMessage, HeadshotDataParts, PathsFound } from "@/lib/agent/events";
import type { BrainStore } from "@/components/canvas/brainStore";
import { Markdown } from "./Markdown";
import { loadMessages, renameThread, saveMessages } from "./threads";

interface Props {
  threadId: string;
  store: BrainStore;
  /** A question another panel wants asked (e.g. "Ask about this"). */
  prefill: { text: string; nonce: number } | null;
  onSelectNode: (imdbId: string) => void;
}

const TOOL_LABELS: Record<string, string> = {
  find_entities: "Resolving names",
  shortest_path: "Searching the graph",
  highlight_path: "Choosing a path",
  common_neighbors: "Finding who's in both",
  shared_credits: "Checking shared credits",
  neighborhood: "Reading credits",
  tmdb_search: "Searching TMDB",
  tmdb_person: "Reading a profile",
  tmdb_title: "Reading a title",
  expand_node: "Expanding the brain",
  read_page: "Reading a page",
  write_page: "Writing a page",
};

const EXAMPLES = [
  "How is Timothée Chalamet connected to Kevin Bacon?",
  "Have Pedro Pascal and Oscar Isaac worked together?",
  "Who was in both Severance and Succession?",
  "The bald guy from the Apple show who was also in Parks and Rec",
];

export function ChatPanel({ threadId, store, prefill, onSelectNode }: Props) {
  const initial = useMemo(() => loadMessages(threadId), [threadId]);
  const [input, setInput] = useState("");
  const [dismissedError, setDismissedError] = useState<Error | null>(null);
  const [seenNonce, setSeenNonce] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, error, stop } = useChat<HeadshotUIMessage>({
    id: threadId,
    messages: initial,
    transport,
    onData: (part) => {
      const type = part.type.replace(/^data-/, "") as keyof HeadshotDataParts;
      store.apply(type, part.data as never);
    },
  });

  // Persist, and name the thread after its first question.
  useEffect(() => {
    if (messages.length === 0) return;
    saveMessages(threadId, messages);
    const first = messages.find((m) => m.role === "user");
    const text = first?.parts.find((p) => p.type === "text");
    if (text && "text" in text) renameThread(threadId, text.text.slice(0, 60));
  }, [messages, threadId]);

  const resting = error && error !== dismissedError ? restingText(error) : null;

  // Adopt a prefilled question from another panel (derived-state pattern, no effect).
  if (prefill && prefill.nonce !== seenNonce) {
    setSeenNonce(prefill.nonce);
    setInput(prefill.text);
    setCollapsed(false);
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  const ask = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setDismissedError(error ?? null);
    store.clearHighlight();
    sendMessage({ text: t });
    setInput("");
  };

  const chips = useMemo(() => followUps(messages), [messages]);

  return (
    <section
      className={`panel pointer-events-auto flex w-[min(560px,calc(100vw-32px))] flex-col overflow-hidden transition-[max-height] duration-300 ${
        collapsed ? "max-h-[58px]" : "max-h-[min(46vh,640px)] sm:max-h-[min(64vh,640px)]"
      }`}
      aria-label="Chat"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] text-ink-dim">
          <span className="inline-block size-2 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
          {busy ? <Thinking /> : <span>Ask the brain</span>}
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-md px-2 py-1 text-[12px] text-ink-dim hover:bg-white/5 hover:text-ink"
          aria-label={collapsed ? "Expand chat" : "Collapse chat"}
        >
          {collapsed ? "Open" : "Hide"}
        </button>
      </header>

      <div ref={listRef} className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="rise space-y-3">
            <p className="text-[15px] leading-snug text-ink">
              That guy. From that thing. With that other guy.
            </p>
            <p className="text-[13px] text-ink-dim">
              Ask about connections between anyone in film and TV. Every answer grows the shared brain behind you.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {EXAMPLES.map((e) => (
                <Chip key={e} onClick={() => ask(e)}>{e}</Chip>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} m={m} onSelectNode={onSelectNode} />
        ))}
        {resting && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-ink">{resting}</p>}
        {!busy && chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <Chip key={c} onClick={() => ask(c)}>{c}</Chip>
            ))}
          </div>
        )}
      </div>

      <form
        className="flex items-end gap-2 border-t border-line px-3 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === "Return") && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          rows={1}
          placeholder="Who was in that one thing with…"
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg bg-white/[0.04] px-3 py-2.5 text-[14px] text-ink outline-none ring-1 ring-line placeholder:text-ink-faint focus:ring-accent/60"
        />
        {busy ? (
          <button type="button" onClick={stop} className="h-10 rounded-lg px-3 text-[13px] text-ink-dim ring-1 ring-line hover:text-ink">
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} className="h-10 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-black disabled:opacity-40">
            Ask
          </button>
        )}
      </form>
    </section>
  );
}

function restingText(error: Error): string {
  const msg = error.message ?? "";
  if (msg.includes("daily_cap")) return "Headshot is resting until tomorrow. The brain is still browsable.";
  if (msg.includes("rate_limited")) return "Easy there. A few questions a minute, please.";
  return msg.slice(0, 200) || "Something went wrong.";
}

function Thinking() {
  return (
    <span className="flex items-center gap-1">
      Thinking
      <span className="thinking-dot">·</span>
      <span className="thinking-dot">·</span>
      <span className="thinking-dot">·</span>
    </span>
  );
}

function Chip({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-left text-[12.5px] text-ink transition hover:border-accent/70 hover:bg-accent/25"
    >
      {children}
    </button>
  );
}

function Message({ m, onSelectNode }: { m: HeadshotUIMessage; onSelectNode: (id: string) => void }) {
  if (m.role === "user") {
    const text = m.parts.filter((p) => p.type === "text").map((p) => ("text" in p ? p.text : "")).join("");
    return (
      <div className="rise flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.07] px-3.5 py-2 text-[14px] text-ink">{text}</p>
      </div>
    );
  }
  return (
    <div className="rise space-y-2">
      {m.parts.map((part, i) => {
        if (part.type === "text") return <Markdown key={i} text={part.text} />;
        if (part.type === "data-paths") return <PathCard key={i} paths={part.data} onSelectNode={onSelectNode} />;
        if (part.type.startsWith("tool-")) {
          const name = part.type.slice(5);
          const state = "state" in part ? String(part.state) : "";
          const done = state.startsWith("output");
          return (
            <p key={i} className="font-mono text-[11.5px] text-ink-faint">
              <span className={done ? "text-ink-faint" : "text-accent"}>→</span> {TOOL_LABELS[name] ?? name}
              {state === "output-error" && <span className="text-danger"> · failed</span>}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}

function PathCard({ paths, onSelectNode }: { paths: PathsFound; onSelectNode: (id: string) => void }) {
  const chosen = paths.full?.paths[0];
  if (!chosen) return <p className="text-[13px] text-ink-dim">No connection found in the graph.</p>;
  const strong = paths.differ ? paths.strong?.paths[0] : null;
  return (
    <div className="rounded-xl border border-line bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-ink-dim">
        <span>Bacon number {paths.baconNumber}</span>
        <span>{paths.full?.paths.length} tied {paths.full?.paths.length === 1 ? "path" : "paths"}</span>
      </div>
      <Chain path={chosen} onSelectNode={onSelectNode} />
      {strong && (
        <div className="mt-3 border-t border-line pt-2">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-ink-dim">Interesting route · {paths.strong?.baconNumber} hops</div>
          <Chain path={strong} onSelectNode={onSelectNode} />
        </div>
      )}
    </div>
  );
}

function Chain({ path, onSelectNode }: { path: { imdbIds: string[]; names: string[] }; onSelectNode: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13.5px]">
      {path.names.map((n, i) => {
        const id = path.imdbIds[i];
        const isTitle = id.startsWith("tt");
        return (
          <span key={id + i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-ink-faint">→</span>}
            <button onClick={() => onSelectNode(id)} className={`hover:underline ${isTitle ? "text-title" : "text-ink"}`}>
              {n}
            </button>
          </span>
        );
      })}
    </div>
  );
}

/** Deterministic follow-ups from the last answer's path, so chips need no extra model call. */
function followUps(messages: HeadshotUIMessage[]): string[] {
  const last = [...messages].reverse().find((m) => m.role === "assistant");
  if (!last) return [];
  const paths = last.parts.find((p) => p.type === "data-paths");
  if (!paths || paths.type !== "data-paths") return [];
  const p = paths.data.full?.paths[0];
  if (!p) return [];
  const chips: string[] = [];
  const titles = p.names.filter((_, i) => p.imdbIds[i].startsWith("tt"));
  const people = p.names.filter((_, i) => p.imdbIds[i].startsWith("nm"));
  if (titles[0]) chips.push(`Who else was in ${titles[0]}?`);
  if (people.length >= 2) chips.push(`What else have ${people[0]} and ${people[people.length - 1]} done?`);
  if (people[people.length - 1] !== "Kevin Bacon") chips.push(`Connect ${people[people.length - 1]} to Kevin Bacon`);
  return chips.slice(0, 3);
}
