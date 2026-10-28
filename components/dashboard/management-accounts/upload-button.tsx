"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; fileName: string }
  | { status: "success"; fileName: string; periodLabel: string | null }
  | { status: "error"; fileName: string; message: string };

const TOAST_AUTO_DISMISS_MS = 6000;

export function ManagementAccountsUploadButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });

  useEffect(() => {
    if (state.status !== "success" && state.status !== "error") return;
    const t = setTimeout(() => setState({ status: "idle" }), TOAST_AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [state.status]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    setState({ status: "uploading", fileName: file.name });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/management-accounts/upload", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as { data: { periodLabel: string | null } | null; error: string | null };

      if (!res.ok || json.error) {
        setState({ status: "error", fileName: file.name, message: json.error ?? "Upload failed." });
        return;
      }

      setState({ status: "success", fileName: file.name, periodLabel: json.data?.periodLabel ?? null });
      router.refresh();
    } catch (err) {
      setState({
        status: "error",
        fileName: file.name,
        message: err instanceof Error ? err.message : "Upload failed.",
      });
    }
  }

  const uploading = state.status === "uploading";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFile}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="mr-1.5 h-3.5 w-3.5" />
        )}
        {uploading ? "Uploading…" : "Upload"}
      </Button>

      {(state.status === "success" || state.status === "error") && (
        <div
          role="status"
          className={cn(
            "fixed bottom-4 left-4 right-4 z-50 flex sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm items-start gap-3 rounded-xl border p-4 shadow-lg",
            state.status === "success"
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50",
          )}
        >
          {state.status === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          )}
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-medium", state.status === "success" ? "text-emerald-900" : "text-red-900")}>
              {state.status === "success"
                ? `${state.periodLabel ?? "Upload"} saved`
                : "Upload failed"}
            </p>
            <p className={cn("mt-0.5 truncate text-xs", state.status === "success" ? "text-emerald-700" : "text-red-700")}>
              {state.status === "success" ? state.fileName : state.message}
            </p>
          </div>
          <button
            onClick={() => setState({ status: "idle" })}
            className="shrink-0 text-slate-400 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
