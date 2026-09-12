"use client";
/**
 * Ask, v5 (`design/boards-v5/Shell.dc.html`, DESIGN.md → Ask (v5)): a centered
 * 720px column in the content pane, message rows at a 14px gap with 28px of
 * air above them, and one 56px composer pinned at the bottom of that same
 * column — a hairline under it, a mono `>` in front of it, a mono `⏎` at its
 * end, and no send button.
 *
 * No thread header: the sidebar carries the title, so the column starts with
 * the conversation. A new chat starts with the tonight opener instead
 * (`NewChatOpener.tsx`) — a client-side empty state that is never sent as a message.
 *
 * Signed in, the chat route stores both sides of every turn itself, so the
 * only thing this has to do is carry `threadId` on the transport and tell the
 * shell when a turn finished. Signed out, threads stay in localStorage.
 */
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HeadshotUIMessage, HeadshotDataParts } from "@/lib/agent/events";
import type { BrainStore } from "@/components/canvas/brainStore";
import { Markdown } from "./Markdown";
import { PathGraphic } from "./PathGraphic";
import { FaceGrid } from "./FaceGrid";
import { NewChatOpener } from "./NewChatOpener";
import { faceTapAction } from "./faceGridRule";
import { lookupName } from "./lookup";
import { loadMessages, renameThread, saveMessages } from "./threads";
import { threadIndex, type EntityIndex } from "./entityLinks";
import { receiptSegments } from "./receipts";

interface Props {
  threadId: string;
  store: BrainStore;
  /** A question another panel wants asked (e.g. "Ask about this"). `send` submits it rather than only filling the box. */
  prefill: { text: string; nonce: number; send?: boolean } | null;
  onSelectNode: (imdbId: string) => void;
  /** Signed in: the server owns the thread and this panel persists nothing locally. */
  signedIn: boolean;
  /** The thread's stored messages, loaded by the shell from `/api/threads/:id`. */
  initialMessages?: HeadshotUIMessage[];
  /** A turn finished: the shell re-reads the session list (title and order move). */
  onTurnFinished?: () => void;
  /** The thread's first question, so an untitled server thread can be named. */
  onFirstQuestion?: (text: string) => void;
  /** Create the thread row before the first turn goes out; awaited, so the route always has one. */
  onBeforeFirstSend?: () => Promise<void>;
}

/** Lowercase, the way every other label on board C reads. The v5 tool set. */
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
  my_profile: "reading what I know about you",
  recall: "searching the record",
  have_i_seen: "checking your log",
  tonight: "finding something for tonight",
  log: "writing to your log",
};

export function ChatPanel({ threadId, store, prefill, onSelectNode, signedIn, initialMessages, onTurnFinished, onFirstQuestion, onBeforeFirstSend }: Props) {
  // Signed in the server is the record; signed out localStorage is.
  const initial = useMemo(() => (signedIn ? (initialMessages ?? []) : loadMessages(threadId)), [signedIn, initialMessages, threadId]);
  const [input, setInput] = useState("");
  const [dismissedError, setDismissedError] = useState<Error | null>(null);
  const [seenNonce, setSeenNonce] = useState<number | null>(null);
  const sentNonce = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const titled = useRef(false);
  const ensured = useRef(false);

  // The thread id rides the body so the route can store the turn against it.
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat", body: { threadId } }), [threadId]);
  const { messages, sendMessage, status, error, stop } = useChat<HeadshotUIMessage>({
    id: threadId,
    messages: initial,
    transport,
    onData: (part) => {
      const type = part.type.replace(/^data-/, "") as keyof HeadshotDataParts;
      store.apply(type, part.data as never);
    },
    // v5: the drawer opens when a name or face is tapped, never on its own
    // (v2's ego-by-default rule served the canvas, which is gone).
    onFinish: () => {
      store.setStatus(null);
      onTurnFinished?.();
    },
    onError: () => store.setStatus(null),
  });

  // Signed out, persist and name the thread here. Signed in, the route does
  // both — writing the same turn to localStorage would be a second record.
  useEffect(() => {
    if (messages.length === 0) return;
    const first = messages.find((m) => m.role === "user");
    const text = first?.parts.find((p) => p.type === "text");
    const question = text && "text" in text ? text.text.slice(0, 60) : null;
    if (signedIn) {
      if (question && !titled.current) {
        titled.current = true;
        onFirstQuestion?.(question);
      }
      return;
    }
    saveMessages(threadId, messages);
    if (question) renameThread(threadId, question);
  }, [messages, threadId, signedIn, onFirstQuestion]);

  const resting = error && error !== dismissedError ? restingText(error) : null;

  // Adopt a prefilled question from another panel (derived-state pattern, no effect).
  // A `send` prefill (the drawer's "ask", /?q=) is left to the effect below
  // instead: sending is a side effect, not a render.
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
      setInput("");
      const send = () => sendMessage({ text: t });
      if (ensured.current || !onBeforeFirstSend) return send();
      ensured.current = true;
      void Promise.resolve(onBeforeFirstSend()).then(send, send);
    },
    [busy, error, sendMessage, store, onBeforeFirstSend],
  );

  // A `send` prefill is asked once, so the thread the drawer just opened starts
  // with the question already in flight. The nonce is remembered in a ref
  // rather than state: re-running must not re-send.
  useEffect(() => {
    if (!prefill?.send || prefill.nonce === sentNonce.current) return;
    sentNonce.current = prefill.nonce;
    ask(prefill.text);
  }, [prefill, ask]);

  const chips = useMemo(() => followUps(messages), [messages]);
  const entities = useMemo(() => threadIndex(messages), [messages]);
  const lookup = useCallback(
    (name: string) => {
      store.setStatus(`Looking up ${name}…`);
      void lookupName(name).then((id) => {
        store.setStatus(id ? null : `No match for ${name}`);
        if (id) onSelectNode(id);
      });
    },
    [store, onSelectNode],
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Ask">
      <div ref={listRef} className="scrollbar-thin flex-1 overflow-y-auto px-4 pt-[22px] md:px-[34px]">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-[14px] pb-[30px] pt-[28px]">
          {messages.length === 0 && <NewChatOpener signedIn={signedIn} onSelectNode={onSelectNode} onLookup={lookup} />}

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
            <div className="scrollbar-none -mx-4 flex flex-nowrap gap-[9px] self-start overflow-x-auto px-4 pb-1 pt-[10px] md:mx-0 md:flex-wrap md:px-0 md:pl-[2px]">
              {chips.map((c) => (
                <button key={c} type="button" onClick={() => ask(c)} className="chip shrink-0 whitespace-nowrap text-left md:shrink md:whitespace-normal">
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* The tab bar sits under this on a phone and it carries
          `env(safe-area-inset-bottom)`; adding it here too would pad twice. */}
      <div className="px-4 pb-[16px] md:px-[34px] md:pb-[32px]">
        <form
          className="composer-lg mx-auto w-full max-w-[720px]"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <span className="font-mono text-[15px] leading-none text-ink-ghost" aria-hidden>
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
            placeholder="ask anything, or log what you just watched"
            className="scrollbar-thin max-h-40 min-h-[22px] flex-1 resize-none border-0 bg-transparent p-0 text-[15px] leading-[1.4] text-ink outline-none placeholder:text-ink-faint"
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

/**
 * Chips are written the way every other label on board C is: sentence case,
 * lowercase-leading (`what else is like Heat?`). The model capitalises its
 * suggestions, so the opening word is lowered — and only when it is one of the
 * words a question starts with, so a chip that opens on a name keeps it.
 */
const OPENERS = new Set([
  "who", "what", "which", "why", "how", "when", "where", "did", "do", "does",
  "is", "are", "was", "were", "can", "should", "would", "will", "have", "has",
  "log", "show", "tell", "find", "play", "ask",
]);

export function chipCase(text: string): string {
  const first = text.split(/\s+/, 1)[0] ?? "";
  return OPENERS.has(first.toLowerCase()) ? text[0].toLowerCase() + text.slice(1) : text;
}

/** Model-suggested follow-ups when present; deterministic ones from the path otherwise. */
function followUps(messages: HeadshotUIMessage[]): string[] {
  const last = [...messages].reverse().find((m) => m.role === "assistant");
  if (!last) return [];
  const suggested = last.parts.find((p) => p.type === "data-followups");
  if (suggested && suggested.type === "data-followups" && suggested.data.questions.length) return suggested.data.questions.map(chipCase);
  const paths = last.parts.find((p) => p.type === "data-paths");
  if (!paths || paths.type !== "data-paths") return [];
  const p = paths.data.full?.paths[0];
  if (!p) return [];
  const chips: string[] = [];
  const titles = p.names.filter((_, i) => p.imdbIds[i].startsWith("tt"));
  const people = p.names.filter((_, i) => p.imdbIds[i].startsWith("nm"));
  if (titles[0]) chips.push(`who else was in ${titles[0]}?`);
  if (people.length >= 2) chips.push(`what else have ${people[0]} and ${people[people.length - 1]} done?`);
  // A middle person on the path is a natural next hop: "who is this?"
  const middle = people.slice(1, -1)[0];
  if (middle) chips.push(`what is ${middle} best known for?`);
  return chips.slice(0, 3);
}
