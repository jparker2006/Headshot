"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HeadshotUIMessage, HeadshotDataParts } from "@/lib/agent/events";
import type { BrainStore } from "@/components/canvas/brainStore";
import { Markdown } from "./Markdown";
import { PathGraphic } from "./PathGraphic";
import { FaceGrid } from "./FaceGrid";
import { faceTapAction } from "./faceGridRule";
import { egoDefaultFor, egoDelayMs } from "./egoDefault";
import { TonightPanel } from "@/components/tonight/TonightPanel";
import { lookupName } from "./lookup";
import { loadMessages, renameThread, saveMessages } from "./threads";
import { threadIndex, type EntityIndex } from "./entityLinks";

interface Props {
  threadId: string;
  store: BrainStore;
  /** A question another panel wants asked (e.g. "Ask about this"). */
  prefill: { text: string; nonce: number } | null;
  onSelectNode: (imdbId: string) => void;
}

const TOOL_LABELS: Record<string, string> = {
  find_entities: "Resolving names",
  find_by_constraints: "Matching the description",
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
  show_on_brain: "Centering the brain",
};

const EXAMPLES = [
  "How is Timothée Chalamet connected to Meryl Streep?",
  "Have Pedro Pascal and Oscar Isaac worked together?",
  "Who was in both Severance and Succession?",
  "The bald guy from the Apple show who was also in Parks and Rec",
  "Connect Zendaya to Al Pacino",
];

export function ChatPanel({ threadId, store, prefill, onSelectNode }: Props) {
  const initial = useMemo(() => loadMessages(threadId), [threadId]);
  const [input, setInput] = useState("");
  const [dismissedError, setDismissedError] = useState<Error | null>(null);
  const [seenNonce, setSeenNonce] = useState<number | null>(null);
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
    onFinish: ({ message, isAbort }) => {
      store.setStatus(null);
      if (isAbort) return;
      // Ego view by default: after the path animation, center the panel on the first person.
      const center = egoDefaultFor(message.parts);
      if (center) setTimeout(() => store.requestEgo(center, { reveal: false }), egoDelayMs(message.parts));
    },
    onError: () => store.setStatus(null),
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
  const entities = useMemo(() => threadIndex(messages), [messages]);
  const lookup = (name: string) => {
    store.setStatus(`Looking up ${name}…`);
    void lookupName(name).then((id) => {
      store.setStatus(id ? null : `No match for ${name}`);
      if (id) onSelectNode(id);
    });
  };

  return (
    <section className="flex h-full min-w-0 flex-col" aria-label="Chat">
      <div ref={listRef} className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[720px] px-5 py-6">
          {messages.length === 0 && (
            <div className="rise flex min-h-[50vh] flex-col justify-end space-y-6 pb-6">
              <TonightPanel
                onSelectNode={onSelectNode}
                onAsk={ask}
                onLater={(imdbId) => {
                  void fetch("/api/taste/later", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ imdbId }) }).catch(() => {});
                }}
              />
              <div className="space-y-3 border-t border-line pt-5">
                <p className="text-[13px] text-ink-dim">or ask the brain anything about who was in what with whom.</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((e) => (
                    <Chip key={e} onClick={() => ask(e)}>{e}</Chip>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="space-y-6">
            {messages.map((m) => (
              <Message key={m.id} m={m} onSelectNode={onSelectNode} entities={entities} onLookup={lookup} onAsk={ask} />
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-[13px] text-ink-dim">
                <span className="inline-block size-2 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
                <Thinking />
              </div>
            )}
            {resting && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-ink">{resting}</p>}
            {!busy && chips.length > 0 && (
              <div className="scrollbar-thin -mx-5 flex flex-nowrap gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
                {chips.map((c) => (
                  <Chip key={c} onClick={() => ask(c)} scroll>
                    {c}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-line bg-bg/80 backdrop-blur">
        <form
          className="mx-auto flex w-full max-w-[720px] items-end gap-2 px-5 py-4"
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
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl bg-white/[0.04] px-4 py-3 text-[14.5px] text-ink outline-none ring-1 ring-line placeholder:text-ink-faint focus:ring-accent/60"
          />
          {busy ? (
            <button type="button" onClick={stop} className="h-11 rounded-xl px-4 text-[13px] text-ink-dim ring-1 ring-line hover:text-ink">
              Stop
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="h-11 rounded-xl bg-accent px-4 text-[13px] font-semibold text-black disabled:opacity-40">
              Ask
            </button>
          )}
        </form>
      </div>
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

function Chip({ children, onClick, scroll = false }: { children: string; onClick: () => void; scroll?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-left text-[12.5px] text-ink transition hover:border-accent/70 hover:bg-accent/25 ${
        scroll ? "shrink-0 whitespace-nowrap md:shrink md:whitespace-normal" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Message({
  m,
  onSelectNode,
  entities,
  onLookup,
  onAsk,
}: {
  m: HeadshotUIMessage;
  onSelectNode: (id: string) => void;
  entities: EntityIndex;
  onLookup: (name: string) => void;
  onAsk: (text: string) => void;
}) {
  if (m.role === "user") {
    const text = m.parts.filter((p) => p.type === "text").map((p) => ("text" in p ? p.text : "")).join("");
    return (
      <div className="rise flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.07] px-3.5 py-2 text-[14px] text-ink">{text}</p>
      </div>
    );
  }
  const chosen = m.parts.find((p) => p.type === "data-chosen");
  const stored = m.parts.find((p) => p.type === "data-answer");
  const share = stored && stored.type === "data-answer" && stored.data.public ? `/a/${stored.data.slug}-${stored.data.id}` : null;
  return (
    <div className="rise space-y-2">
      {m.parts.map((part, i) => {
        if (part.type === "text") return <Markdown key={i} text={part.text} entities={entities} onSelectNode={onSelectNode} onLookup={onLookup} />;
        if (part.type === "data-faces") return <FaceGrid key={i} faces={part.data} tap={faceTapAction(m.parts, i)} onSelectNode={onSelectNode} onAsk={onAsk} />;
        if (part.type === "data-paths")
          return <PathGraphic key={i} paths={part.data} chosen={chosen?.type === "data-chosen" ? chosen.data : null} onSelectNode={onSelectNode} />;
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
      {share && <ShareLink href={share} />}
    </div>
  );
}

function ShareLink({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 text-[11.5px] text-ink-faint">
      <a href={href} target="_blank" rel="noopener" className="hover:text-ink">
        Share this answer ↗
      </a>
      <button
        type="button"
        className="hover:text-ink"
        onClick={() => {
          navigator.clipboard?.writeText(`${window.location.origin}${href}`).then(() => setCopied(true)).catch(() => {});
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

/** Model-suggested follow-ups when present; deterministic ones from the path otherwise. */
function followUps(messages: HeadshotUIMessage[]): string[] {
  const last = [...messages].reverse().find((m) => m.role === "assistant");
  if (!last) return [];
  const suggested = last.parts.find((p) => p.type === "data-followups");
  if (suggested && suggested.type === "data-followups" && suggested.data.questions.length) return suggested.data.questions;
  const paths = last.parts.find((p) => p.type === "data-paths");
  if (!paths || paths.type !== "data-paths") return [];
  const p = paths.data.full?.paths[0];
  if (!p) return [];
  const chips: string[] = [];
  const titles = p.names.filter((_, i) => p.imdbIds[i].startsWith("tt"));
  const people = p.names.filter((_, i) => p.imdbIds[i].startsWith("nm"));
  if (titles[0]) chips.push(`Who else was in ${titles[0]}?`);
  if (people.length >= 2) chips.push(`What else have ${people[0]} and ${people[people.length - 1]} done?`);
  // A middle person on the path is a natural next hop: "who is this?"
  const middle = people.slice(1, -1)[0];
  if (middle) chips.push(`What is ${middle} best known for?`);
  return chips.slice(0, 3);
}
