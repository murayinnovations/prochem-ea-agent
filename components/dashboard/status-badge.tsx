import type { ReactElement } from "react";
import { cn } from "@/lib/utils";

type StatusVariant = "open" | "closed" | "cancelled" | "active" | "inactive" | "overdue";

const VARIANT_STYLES: Record<StatusVariant, string> = {
  open:      "bg-blue-50 text-blue-700 ring-blue-200",
  closed:    "bg-slate-100 text-slate-600 ring-slate-200",
  cancelled: "bg-red-50 text-red-600 ring-red-200",
  active:    "bg-emerald-50 text-emerald-700 ring-emerald-200",
  inactive:  "bg-slate-100 text-slate-500 ring-slate-200",
  overdue:   "bg-amber-50 text-amber-700 ring-amber-200",
};

const VARIANT_LABELS: Record<StatusVariant, string> = {
  open:      "Open",
  closed:    "Closed",
  cancelled: "Cancelled",
  active:    "Active",
  inactive:  "Inactive",
  overdue:   "Overdue",
};

interface StatusBadgeProps {
  variant: StatusVariant;
  label?: string;
  className?: string;
}

export function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        VARIANT_STYLES[variant],
        className,
      )}
    >
      {label ?? VARIANT_LABELS[variant]}
    </span>
  );
}

export function invoiceStatusBadge(docStatus: string | null): ReactElement {
  if (docStatus === "O") return <StatusBadge variant="open" />;
  if (docStatus === "C") return <StatusBadge variant="closed" />;
  return <StatusBadge variant="cancelled" />;
}
