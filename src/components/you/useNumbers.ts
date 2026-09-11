"use client";
/**
 * One GET of `/api/taste/numbers` for the whole You page. The ledger draws it
 * and `recently logged` borrows the kind, runtime and episode counts it needs
 * for its mono meta column, so the fetch is shared rather than doubled: the
 * route computes the page server-side and this hook only hands it over.
 */
import { useEffect, useState } from "react";
import type { NumbersData, NumbersPerson } from "@/lib/taste/numbers";

/** The route's people carry the face it resolved for them. */
export type PersonWithFace = NumbersPerson & { face: string | null };
export interface NumbersResponse extends Omit<NumbersData, "people"> {
  people: PersonWithFace[];
}

export type NumbersState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "error" }
  | { status: "ready"; data: NumbersResponse };

let inflight: { key: number; promise: Promise<NumbersState> } | null = null;

function load(version: number): Promise<NumbersState> {
  if (inflight && inflight.key === version) return inflight.promise;
  const promise = (async (): Promise<NumbersState> => {
    try {
      const res = await fetch("/api/taste/numbers", { cache: "no-store" });
      if (res.status === 401) return { status: "signed-out" };
      if (!res.ok) return { status: "error" };
      return { status: "ready", data: (await res.json()) as NumbersResponse };
    } catch {
      return { status: "error" };
    }
  })();
  inflight = { key: version, promise };
  return promise;
}

export function useNumbers(version = 0): NumbersState {
  // Keyed by version: a bump throws the old answer away without a second
  // render, so the effect only ever hands the fetch's answer back.
  const [state, setState] = useState<{ key: number; value: NumbersState }>({ key: version, value: { status: "loading" } });
  useEffect(() => {
    let alive = true;
    void load(version).then((s) => alive && setState({ key: version, value: s }));
    return () => {
      alive = false;
    };
  }, [version]);
  return state.key === version ? state.value : { status: "loading" };
}
