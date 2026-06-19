"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

function escapeCell(val: unknown): string {
  const s = val == null ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => escapeCell(row[h])).join(","));
  return [headers.join(","), ...rows].join("\r\n");
}

interface ExportCsvButtonProps {
  getData: () => Record<string, unknown>[];
  filename?: string;
}

export function ExportCsvButton({ getData, filename = "export.csv" }: ExportCsvButtonProps) {
  function handleClick() {
    const csv = toCSV(getData());
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <Download className="mr-1.5 h-3.5 w-3.5" />
      Export CSV
    </Button>
  );
}
