import { TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { createAdminClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createAdminClient();
  const { data: lastSyncRow } = await supabase
    .from("sync_log")
    .select("finished_at")
    .eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastSync = lastSyncRow?.finished_at
    ? format(new Date(lastSyncRow.finished_at as string), "MMM d, HH:mm")
    : "Never";

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col bg-[#0A1B3D]">
        {/* Header block */}
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-white">
              ProChem
            </p>
            <p className="mt-0.5 text-xs leading-tight text-slate-400">
              Commercial Analytics
            </p>
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-white/10" />

        {/* Nav + footer (client — needs usePathname) */}
        <SidebarNav lastSync={lastSync} />
      </aside>

      {/* ── Main content ────────────────────────────────────────── */}
      <main className="ml-[260px] flex min-h-screen flex-1 flex-col bg-slate-50">
        <div className="mx-auto w-full max-w-7xl flex-1 p-8">{children}</div>
        <footer className="border-t border-slate-200 bg-white px-8 py-3 text-xs text-slate-400">
          Prochem East Africa × Muray Innovations ·{" "}
          <em>Powered by SAP Business One</em>
        </footer>
      </main>
    </div>
  );
}
