"use client";

import type { AgentInput, AgentName, AgentOutput } from "../agents/schemas";

export type AgentCallResult<A extends AgentName> =
  | { ok: true; mode: "ai" | "offline"; data: AgentOutput<A> }
  | { ok: false };

/** Calls a Research Co-Pilot agent. Never throws: callers show a friendly message instead. */
export async function callAgent<A extends AgentName>(name: A, input: AgentInput<A>): Promise<AgentCallResult<A>> {
  try {
    const res = await fetch(`/api/agents/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as { mode: "ai" | "offline"; data: AgentOutput<A> };
    return { ok: true, mode: json.mode, data: json.data };
  } catch {
    return { ok: false };
  }
}
