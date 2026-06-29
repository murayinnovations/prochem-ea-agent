"use client";

import React from "react";
import { cn } from "@/lib/utils";

// Lightweight markdown renderer covering the patterns the agent actually emits:
// **bold**, *italic*, `code`, # headings, | tables |, - bullet lists, paragraphs.
// Keeps the chat sheet dependency-free.

function inlineRender(text: string): React.ReactNode[] {
  // Split on **bold**, *italic*, and `code` markers.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="rounded bg-slate-200 px-1 py-0.5 font-mono text-xs text-slate-800">{part.slice(1, -1)}</code>;
    return part;
  });
}

function renderTable(block: string): React.ReactNode {
  const rows = block.trim().split("\n").filter((r) => r.trim().startsWith("|"));
  if (rows.length < 2) return null;

  const parseCells = (row: string) =>
    row.split("|").slice(1, -1).map((c) => c.trim());

  const headers = parseCells(rows[0]);
  // rows[1] is the separator line (|---|---|), skip it
  const bodyRows = rows.slice(2);

  return (
    <div className="my-2 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">
                {inlineRender(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri} className={cn("border-t border-slate-100", ri % 2 === 1 && "bg-slate-50/50")}>
              {parseCells(row).map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                  {inlineRender(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderBlock(block: string, idx: number): React.ReactNode {
  const trimmed = block.trim();
  if (!trimmed) return null;

  // Heading: # / ## / ###
  const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const text = headingMatch[2];
    const cls = level === 1
      ? "mt-3 mb-1 text-base font-bold text-slate-900"
      : level === 2
        ? "mt-2 mb-1 text-sm font-semibold text-slate-800"
        : "mt-2 mb-0.5 text-sm font-medium text-slate-700";
    return <p key={idx} className={cls}>{inlineRender(text)}</p>;
  }

  // Table block: lines that start with |
  if (trimmed.split("\n").some((l) => l.trim().startsWith("|"))) {
    return <React.Fragment key={idx}>{renderTable(trimmed)}</React.Fragment>;
  }

  // Bullet list: lines starting with - or *
  const lines = trimmed.split("\n");
  if (lines.every((l) => /^[-*]\s/.test(l.trim()) || l.trim() === "")) {
    return (
      <ul key={idx} className="my-1.5 space-y-0.5 pl-4">
        {lines.filter((l) => l.trim()).map((l, li) => (
          <li key={li} className="list-disc text-slate-700">
            {inlineRender(l.replace(/^[-*]\s/, ""))}
          </li>
        ))}
      </ul>
    );
  }

  // Horizontal rule
  if (/^---+$/.test(trimmed)) {
    return <hr key={idx} className="my-2 border-slate-200" />;
  }

  // Plain paragraph (handles inline formatting)
  return (
    <p key={idx} className="text-slate-800 leading-relaxed">
      {lines.map((line, li) => (
        <React.Fragment key={li}>
          {inlineRender(line)}
          {li < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </p>
  );
}

export function Markdown({ content }: { content: string }) {
  // Split into blocks on blank lines, but keep table rows together.
  const blocks = content.split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm">
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}
