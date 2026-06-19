import { cn } from "@/lib/utils";

const ACCENT: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
};

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  accent: "blue" | "green" | "purple" | "orange";
}

export function KpiCard({ title, value, subtitle, accent }: KpiCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white py-5 pr-5 pl-5 ring-1 ring-black/8 shadow-sm">
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1 rounded-l-xl",
          ACCENT[accent]
        )}
      />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-[1.75rem] font-bold leading-none tracking-tight text-slate-900">
        {value}
      </p>
      {subtitle && (
        <p className="mt-1.5 text-xs text-slate-400">{subtitle}</p>
      )}
    </div>
  );
}
