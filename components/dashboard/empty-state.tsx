import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  heading?: string;
  body?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  heading = "No results found",
  body = "Try adjusting your filters.",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-700">{heading}</p>
      {body && <p className="mt-1 text-sm text-slate-400">{body}</p>}
    </div>
  );
}
