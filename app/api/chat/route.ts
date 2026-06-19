/**
 * POST /api/chat
 *
 * Streams agent responses via Server-Sent Events.
 * Body: { sessionId?: string, message: string }
 */

import { runAgent, type AgentEvent } from "@/lib/agent/run";
import { createServerClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { sessionId, message } = (await req.json()) as {
    sessionId?: string;
    message: string;
  };

  const db = await createServerClient();

  // Load prior messages if continuing a session
  let history: { role: "user" | "assistant"; content: unknown }[] = [];
  if (sessionId) {
    const { data } = await db
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    history = (data ?? []) as typeof history;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      try {
        await runAgent({
          mode: "chat",
          db,
          messages: [
            ...history.map((m) => ({
              role: m.role,
              content: m.content as never,
            })),
            { role: "user", content: message },
          ],
          onEvent: send,
        });
      } catch (err) {
        send({
          type: "text_delta",
          text: `\n\nError: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
