"use client";
/**
 * Conversations are personal and live only in this browser. The server stores
 * nothing about a thread. Mirrors Cinema Daddy's localStorage approach.
 */
import { useSyncExternalStore } from "react";
import type { HeadshotUIMessage } from "@/lib/agent/events";

const INDEX_KEY = "headshot:threads";
const THREAD_KEY = (id: string) => `headshot:thread:${id}`;
const SOFT_CAP = 3_000_000; // ~3 MB per thread before we trim oldest turns

export interface ThreadMeta {
  id: string;
  title: string;
  createdAt: string;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function listThreads(): ThreadMeta[] {
  return safe(() => JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]") as ThreadMeta[], []);
}

// ---- subscription so components re-render when the thread index changes ----
const listeners = new Set<() => void>();
let cached: ThreadMeta[] = [];
let cachedJson = "";
function notify() {
  for (const fn of listeners) fn();
}
function snapshot(): ThreadMeta[] {
  const json = safe(() => localStorage.getItem(INDEX_KEY) ?? "[]", "[]");
  if (json !== cachedJson) {
    cachedJson = json;
    cached = safe(() => JSON.parse(json) as ThreadMeta[], []);
  }
  return cached;
}
const EMPTY: ThreadMeta[] = [];
export function subscribeThreads(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function useThreads(): ThreadMeta[] {
  return useSyncExternalStore(subscribeThreads, snapshot, () => EMPTY);
}

export function createThread(id: string = crypto.randomUUID()): ThreadMeta {
  const meta: ThreadMeta = { id, title: "New thread", createdAt: new Date().toISOString() };
  safe(() => localStorage.setItem(INDEX_KEY, JSON.stringify([meta, ...listThreads()])), undefined);
  notify();
  return meta;
}

export function renameThread(id: string, title: string) {
  safe(() => {
    const threads = listThreads().map((t) => (t.id === id ? { ...t, title } : t));
    localStorage.setItem(INDEX_KEY, JSON.stringify(threads));
  }, undefined);
  notify();
}

export function deleteThread(id: string) {
  safe(() => {
    localStorage.setItem(INDEX_KEY, JSON.stringify(listThreads().filter((t) => t.id !== id)));
    localStorage.removeItem(THREAD_KEY(id));
  }, undefined);
  notify();
}

export function loadMessages(id: string): HeadshotUIMessage[] {
  return safe(() => JSON.parse(localStorage.getItem(THREAD_KEY(id)) ?? "[]") as HeadshotUIMessage[], []);
}

export function saveMessages(id: string, messages: HeadshotUIMessage[]) {
  safe(() => {
    let msgs = messages;
    let json = JSON.stringify(msgs);
    while (json.length > SOFT_CAP && msgs.length > 2) {
      msgs = msgs.slice(2);
      json = JSON.stringify(msgs);
    }
    localStorage.setItem(THREAD_KEY(id), json);
  }, undefined);
}
