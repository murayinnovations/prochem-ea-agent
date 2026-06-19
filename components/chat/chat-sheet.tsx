"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";

interface TextMessage {
  id: string;
  role: Role;
  text: string;
}

interface ToolCallMessage {
  id: string;
  role: "tool";
  name: string;
  input: unknown;
  result?: unknown;
}

type ChatMessage = TextMessage | ToolCallMessage;

// ── Tool call card ────────────────────────────────────────────────────────────

function ToolCard({ msg }: { msg: ToolCallMessage }) {
  const [open, setOpen] = useState(false);
  const label = msg.name.replace(/_/g, " ");
  return (
    <div className="my-1 rounded-md border border-slate-200 bg-slate-50 text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-slate-500 hover:text-slate-700"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span className="font-medium text-slate-600">{label}</span>
        {msg.result === undefined && (
          <Loader2 className="ml-auto h-3 w-3 animate-spin text-slate-400" />
        )}
      </button>
      {open && (
        <div className="border-t border-slate-200 px-3 py-2 font-mono text-[10px] text-slate-500">
          {msg.result !== undefined ? (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap">
              {JSON.stringify(msg.result, null, 2)}
            </pre>
          ) : (
            <pre className="whitespace-pre-wrap text-slate-400">
              {JSON.stringify(msg.input, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "tool") return <ToolCard msg={msg} />;

  const isUser = msg.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-blue-600 text-white"
            : "bg-slate-100 text-slate-800",
        )}
      >
        {msg.text}
      </div>
    </div>
  );
}

// ── Chat panel ────────────────────────────────────────────────────────────────

export function ChatSheet() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setStreaming(true);

    // Add user message
    const userId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: userId, role: "user", text }]);

    // Placeholder for streaming assistant reply
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", text: "" },
    ]);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: { type: string; text?: string; name?: string; input?: unknown; result?: unknown };
          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }

          if (event.type === "text_delta" && event.text) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId && m.role === "assistant"
                  ? { ...m, text: m.text + event.text }
                  : m,
              ),
            );
          } else if (event.type === "tool_use") {
            const toolId = crypto.randomUUID();
            setMessages((prev) => [
              ...prev,
              {
                id: toolId,
                role: "tool" as const,
                name: event.name!,
                input: event.input,
              },
            ]);
          } else if (event.type === "tool_result") {
            // Update the last tool card with its result
            setMessages((prev) => {
              const lastToolIdx = [...prev].reverse().findIndex(
                (m) => m.role === "tool" && m.name === event.name && (m as ToolCallMessage).result === undefined,
              );
              if (lastToolIdx === -1) return prev;
              const realIdx = prev.length - 1 - lastToolIdx;
              return prev.map((m, i) =>
                i === realIdx ? { ...m, result: event.result } : m,
              );
            });
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, text: `Error: ${err instanceof Error ? err.message : String(err)}` }
            : m,
        ),
      );
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Trigger button — styled to match sidebar */}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full justify-start gap-2 border-0 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
      >
        <Sparkles className="h-4 w-4 shrink-0" />
        Ask AI
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-md"
          showCloseButton={false}
        >
          {/* Header */}
          <SheetHeader className="flex-row items-center gap-2 border-b px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <SheetTitle className="text-sm font-semibold">
              Ask AI — Prochem Analytics
            </SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="ml-auto h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
            >
              ✕
            </Button>
          </SheetHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                  <Sparkles className="h-5 w-5 text-blue-500" />
                </div>
                <p className="text-sm font-medium text-slate-700">
                  Ask about commercial performance
                </p>
                <div className="space-y-1.5">
                  {[
                    "How much revenue did we do last week?",
                    "Who are our top 5 customers this month?",
                    "What's our total outstanding AR?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
                {streaming && messages[messages.length - 1]?.role === "assistant" &&
                  (messages[messages.length - 1] as TextMessage).text === "" && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl bg-slate-100 px-4 py-2.5">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      </div>
                    </div>
                  )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about revenue, customers, AR…"
                disabled={streaming}
                className="flex-1 border-slate-200 bg-slate-50 text-sm focus-visible:ring-blue-500"
              />
              <Button
                size="sm"
                onClick={send}
                disabled={!input.trim() || streaming}
                className="shrink-0 bg-blue-600 hover:bg-blue-700"
              >
                {streaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-400">
              Reads live SAP data via Supabase
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
