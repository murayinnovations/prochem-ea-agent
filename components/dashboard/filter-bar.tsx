import type { ReactNode } from "react";

interface FilterBarProps {
  children: ReactNode;
}

export function FilterBar({ children }: FilterBarProps) {
  return (
    <div className="sticky top-0 z-20 -mx-8 mb-6 border-b border-slate-200 bg-white px-8 py-3">
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
