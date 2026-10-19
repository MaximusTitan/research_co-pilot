import { NextResponse } from "next/server";
import { agents, type AgentName } from "@/lib/agents/schemas";
import { runAgent } from "@/lib/server/agents";
import { currentUserId } from "@/lib/supabase/server";

const MAX_BODY_BYTES = 200_000;

function isAgent(name: string): name is AgentName {
  return Object.prototype.hasOwnProperty.call(agents, name);
}

export async function POST(request: Request, ctx: RouteContext<"/api/agents/[agent]">) {
  // The proxy already blocks guests; checking here too keeps the AI agents closed if the matcher ever changes.
  if (!(await currentUserId())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { agent } = await ctx.params;
  if (!isAgent(agent)) return NextResponse.json({ error: "unknown_agent" }, { status: 404 });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await runAgent(agent, body);
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
