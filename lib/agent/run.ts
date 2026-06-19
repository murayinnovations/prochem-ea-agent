/**
 * Agent run loop. Streams text deltas + tool use events.
 * Used by both /api/chat and /api/briefing.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { toolSchemas, getToolsForAnthropic, createToolHandlers } from "./tools";
import { CHAT_SYSTEM, BRIEFING_SYSTEM } from "./prompts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

type Mode = "chat" | "briefing";

export interface RunOptions {
  mode: Mode;
  messages: Anthropic.MessageParam[];
  db: SupabaseClient<Database>;
  maxIterations?: number;
  onEvent?: (e: AgentEvent) => void;
}

export type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; name: string; input: unknown }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "done"; usage: Anthropic.Usage };

export async function runAgent(opts: RunOptions): Promise<{
  finalMessage: Anthropic.Message;
  conversation: Anthropic.MessageParam[];
}> {
  const { mode, db, maxIterations = 8, onEvent } = opts;
  const handlers = createToolHandlers(db);
  const tools = getToolsForAnthropic();

  // Sonnet for chat (fast, cheap), Opus for scheduled briefings (deep)
  const model = mode === "briefing" ? "claude-opus-4-7" : "claude-sonnet-4-6";
  const today = new Date().toISOString().split("T")[0];
  const baseSystem = mode === "briefing" ? BRIEFING_SYSTEM : CHAT_SYSTEM;
  const system = `Today is ${today}.\n\n${baseSystem}`;

  const conversation: Anthropic.MessageParam[] = [...opts.messages];

  for (let i = 0; i < maxIterations; i++) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: mode === "briefing" ? 4096 : 2048,
      system,
      tools,
      messages: conversation,
    });

    // Append assistant turn
    conversation.push({ role: "assistant", content: response.content });

    // Emit text blocks
    for (const block of response.content) {
      if (block.type === "text") {
        onEvent?.({ type: "text_delta", text: block.text });
      }
    }

    if (response.stop_reason !== "tool_use") {
      onEvent?.({ type: "done", usage: response.usage });
      return { finalMessage: response, conversation };
    }

    // Execute tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      onEvent?.({ type: "tool_use", name: block.name, input: block.input });

      try {
        const schema = toolSchemas[block.name as keyof typeof toolSchemas];
        const parsed = schema.parse(block.input);
        const handler = (handlers as Record<string, (a: unknown) => Promise<unknown>>)[
          block.name
        ];
        if (!handler) throw new Error(`Unknown tool: ${block.name}`);

        const result = await handler(parsed);
        onEvent?.({ type: "tool_result", name: block.name, result });

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        const message = err instanceof z.ZodError ? err.message : String(err);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Error: ${message}`,
          is_error: true,
        });
      }
    }

    conversation.push({ role: "user", content: toolResults });
  }

  throw new Error(`Agent exceeded max iterations (${maxIterations})`);
}
