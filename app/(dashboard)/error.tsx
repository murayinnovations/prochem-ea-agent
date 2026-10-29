"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Keeps the sidebar usable when a single dashboard page fails to render.
// Production hides the message, so the digest is what to search for in logs.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <h2 className="text-lg font-semibold text-slate-900">This page couldn&apos;t load</h2>
      <p className="max-w-md text-sm text-slate-500">{error.message}</p>
      {error.digest && (
        <p className="font-mono text-xs text-slate-400">Error {error.digest}</p>
      )}
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
