"use client";
/**
 * The thread, board C ("Terminal for cinephiles"). DESIGN.md → Thread:
 * a section header carrying the thread's own question, 28px of air, then
 * bubbles at a 880px cap — yours squared off to the right, the agent's to the
 * left — with the receipts line, the follow-up chips and the composer under
 * them. No cards, no accent: the only accent on any screen is Play.
 */
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HeadshotUIMessage, HeadshotDataParts } from "@/lib/agent/events";
import type { BrainStore } from "@/components/canvas/brainStore";
import { Markdown } from "./Markdown";
import { PathGraphic } from "./PathGraphic";
import { FaceGrid } from "./FaceGrid";
import { faceTapAction } from "./faceGridRule";
import { egoDefaultFor, egoDelayMs } from "./egoDefault";
import { lookupName } from "./lookup";
import { loadMessages, renameThread, saveMessages, useThreads } from "./threads";
import { threadIndex, type EntityIndex } from "./entityLinks";
import { receiptSegments } from "./receipts";
import { threadMetaLine } from "./threadMeta";

interface Props {
  threadId: string;
  store: BrainStore;
  /** A question another panel wants asked (e.g. "Ask about this"). `send` submits it rather than only filling the box. */
  prefill: { text: string; nonce: number; send?: boolean } | null;
  onSelectNode: (imdbId: string) => void;
  /** Told whenever the thread has messages, so the shell can mark it as a chat rather than Tonight. */
  onHasMessages?: (has: boolean) => void;
}

/** Lowercase, the way every other label on board C reads. */
const TOOL_LABELS: Record<string, string> = {
  find_entities: "resolving names",
  find_by_constraints: "matching the description",
  shortest_path: "searching the graph",
  highlight_path: "choosing a path",
  common_neighbors: "finding who's in both",
  shared_credits: "checking shared credits",
  neighborhood: "reading credits",
  tmdb_search: "searching tmdb",
  tmdb_person: "reading a profile",
  tmdb_title: "reading a title",
  expand_node: "expanding the brain",
  read_page: "reading a page",
  write_page: "writing a page",
  show_on_brain: "centering the brain",
  my_taste: "reading your log",
  recall: "searching the record",
  have_i_seen: "checking your log",
  tonight_picks: "reading tonight's picks",
  rate: "writing to your log",
  mark_progress: "writing to your log",
};

export function ChatPanel({ threadId, store, prefill, onSelectNode, onHasMessages }: Props) {
  const initial = useMemo(() => loadMessages(threadId), [threadId]);
  const [input, setInput] = useState("");
  const [dismissedError, setDismissedError] = useState<Error | null>(null);
  const [seenNonce, setSeenNonce] = useState<number | null>(null);
  const sentNonce = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const threads = useThreads();
  const meta = threads.find((t) => t.id === threadId) ?? null;

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
    onHasMessages?.(true);
    saveMessages(threadId, messages);
    const first = messages.find((m) => m.role === "user");
    const text = first?.parts.find((p) => p.type === "text");
    if (text && "text" in text) renameThread(threadId, text.text.slice(0, 60));
  }, [messages, threadId, onHasMessages]);

  const resting = error && error !== dismissedError ? restingText(error) : null;

  // Adopt a prefilled question from another panel (derived-state pattern, no effect).
  // A `send` prefill (the You composer, the drawer's "ask", /?q=) is left to
  // the effect below instead: sending is a side effect, not a render.
  if (prefill && prefill.nonce !== seenNonce) {
    setSeenNonce(prefill.nonce);
    if (!prefill.send) setInput(prefill.text);
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  const ask = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t || busy) return;
      setDismissedError(error ?? null);
      store.clearHighlight();
      sendMessage({ text: t });
      setInput("");
    },
    [busy, error, sendMessage, store],
  );

  // A `send` prefill is asked once, so the thread the You composer just opened
  // starts with the question already in flight. The nonce is remembered in a
  // ref rather than state: re-running must not re-send.
  useEffect(() => {
    if (!prefill?.send || prefill.nonce === sentNonce.current) return;
    sentNonce.current = prefill.nonce;
    ask(prefill.text);
  }, [prefill, ask]);

  const chips = useMemo(() => followUps(messages), [messages]);
  const entities = useMemo(() => threadIndex(messages), [messages]);
  const lookup = (name: string) => {
    store.setStatus(`Looking up ${name}…`);
    void lookupName(name).then((id) => {
      store.setStatus(id ? null : `No match for ${name}`);
      if (id) onSelectNode(id);
    });
  };

  const headline = meta && meta.title !== "New thread" ? meta.title : "new thread";
  const metaLine = threadMetaLine(meta?.createdAt, messages.length);

  return (
    <section className="flex h-full min-w-0 flex-col" aria-label="Chat">
      <div className="px-4 pt-[22px] md:px-[34px]">
        <div className="section-head">
          <h1 className="t-title min-w-0 truncate">{headline}</h1>
          {metaLine && <span className="t-meta shrink-0">{metaLine}</span>}
        </div>
      </div>

      <div ref={listRef} className="scrollbar-thin flex-1 overflow-y-auto px-4 md:px-[34px]">
        <div className="flex w-full max-w-[880px] flex-col gap-[14px] pb-[30px] pt-[28px]">
          {messages.length === 0 && <p className="t-prose">nothing asked yet. type a question below.</p>}

          {messages.map((m) => (
            <Message key={m.id} m={m} onSelectNode={onSelectNode} entities={entities} onLookup={lookup} onAsk={ask} />
          ))}

          {busy && (
            <span className="t-meta self-start pl-[2px]">
              thinking
              <span className="thinking-dot"> ·</span>
              <span className="thinking-dot">·</span>
              <span className="thinking-dot">·</span>
            </span>
          )}

          {resting && <p className="self-start text-[13.5px] leading-[1.54] text-ink">{resting}</p>}

          {!busy && chips.length > 0 && (
            <div className="scrollbar-thin -mx-4 flex flex-nowrap gap-[9px] self-start overflow-x-auto px-4 pb-1 pt-[10px] md:mx-0 md:flex-wrap md:px-0 md:pl-[2px]">
              {chips.map((c) => (
                <button key={c} type="button" onClick={() => ask(c)} className="chip shrink-0 whitespace-nowrap text-left md:shrink md:whitespace-normal">
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-[max(32px,env(safe-area-inset-bottom))] md:px-[34px] md:pb-[32px]">
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <span className="font-mono text-[13px] leading-none text-ink-ghost" aria-hidden>
            &gt;
          </span>
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
            aria-label="ask"
            placeholder="log something, or just ask"
            className="scrollbar-thin max-h-40 min-h-[22px] flex-1 resize-none border-0 bg-transparent p-0 text-[14px] leading-[1.5] text-ink outline-none placeholder:text-ink-faint"
          />
          {busy ? (
            <button type="button" onClick={stop} className="t-link ml-auto shrink-0">
              stop
            </button>
          ) : (
            <span className="t-meta ml-auto shrink-0" aria-hidden>
              ⏎
            </span>
          )}
        </form>
      </div>
    </section>
  );
}

function restingText(error: Error): string {
  const msg = error.message ?? "";
  if (msg.includes("daily_cap")) return "out of questions until tomorrow. the brain is still browsable.";
  if (msg.includes("rate_limited")) return "too fast. a few questions a minute.";
  return msg.slice(0, 200) || "that did not go through. ask it again.";
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
    return <p className="rise bubble bubble-you">{text}</p>;
  }

  const chosen = m.parts.find((p) => p.type === "data-chosen");
  const stored = m.parts.find((p) => p.type === "data-answer");
  const share = stored && stored.type === "data-answer" && stored.data.public ? `/a/${stored.data.slug}-${stored.data.id}` : null;
  const receipts = receiptSegments(m.parts);

  // The bubble holds what the agent said; graphics and tool lines break out of
  // it and sit under it with the board's 2px inset, like the receipts do.
  const blocks: React.ReactNode[] = [];
  let bubble: React.ReactNode[] = [];
  const flush = () => {
    if (bubble.length === 0) return;
    blocks.push(
      <div key={`b${blocks.length}`} className="bubble bubble-them">
        {bubble}
      </div>,
    );
    bubble = [];
  };

  m.parts.forEach((part, i) => {
    if (part.type === "text") {
      if (part.text.trim().length === 0) return;
      bubble.push(<Markdown key={i} text={part.text} entities={entities} onSelectNode={onSelectNode} onLookup={onLookup} />);
      return;
    }
    if (part.type === "data-faces") {
      flush();
      blocks.push(
        // `w-full`: the message column is `items-start`, so a fit-content
        // wrapper collapses the row grid's `1fr` credit column to nothing.
        <div key={i} className="w-full self-start pl-[2px]">
          <FaceGrid faces={part.data} tap={faceTapAction(m.parts, i)} onSelectNode={onSelectNode} onAsk={onAsk} />
        </div>,
      );
      return;
    }
    if (part.type === "data-paths") {
      flush();
      blocks.push(
        // `w-full` so the chain's own `overflow-x-auto` has a width to scroll in.
        <div key={i} className="w-full self-start pl-[2px]">
          <PathGraphic paths={part.data} chosen={chosen?.type === "data-chosen" ? chosen.data : null} onSelectNode={onSelectNode} />
        </div>,
      );
      return;
    }
    if (part.type.startsWith("tool-")) {
      const name = part.type.slice(5);
      const state = "state" in part ? String(part.state) : "";
      // Finished tool steps stay out of the way; only the live one and failures show.
      if (state.startsWith("output") && state !== "output-error") return;
      flush();
      blocks.push(
        <span key={i} className="t-meta self-start pl-[2px]">
          {TOOL_LABELS[name] ?? name}
          {state === "output-error" && " · failed"}
        </span>,
      );
    }
  });
  flush();

  return (
    <div className="rise flex flex-col items-start gap-[11px]">
      {blocks}
      {receipts.length > 0 && (
        <div className="flex flex-col self-start pl-[2px]">
          <span className="text-[12.5px] leading-[1.3] text-ink-ghost">what that came from</span>
          <span className="t-meta flex h-[32px] items-center">{receipts.join(" · ")}</span>
        </div>
      )}
      {share && <ShareLink href={share} />}
    </div>
  );
}

function ShareLink({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-[14px] self-start pl-[2px]">
      <a href={href} target="_blank" rel="noopener" className="t-link">
        share this answer
      </a>
      <button
        type="button"
        className="t-link"
        onClick={() => {
          navigator.clipboard?.writeText(`${window.location.origin}${href}`).then(() => setCopied(true)).catch(() => {});
        }}
      >
        {copied ? "copied" : "copy link"}
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
