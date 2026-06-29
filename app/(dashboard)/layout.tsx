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
        {/* Brand mark */}
        <div className="px-5 pt-7 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-xs font-black tracking-tight text-white shadow-lg shadow-amber-500/30">
              PC
            </div>
            <div>
              <p className="text-sm font-extrabold leading-none tracking-tight text-white">
                Prochem
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
                East Africa
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] font-medium text-slate-500">
            Commercial Intelligence
          </p>
        </div>

        {/* Separator */}
        <div className="mx-5 h-px bg-white/[0.06]" />

        {/* Nav + footer (client — needs usePathname) */}
        <SidebarNav lastSync={lastSync} />
      </aside>

      {/* ── Main content ────────────────────────────────────────── */}
      <main className="ml-[260px] flex min-h-screen flex-1 flex-col bg-slate-50">
        <div className="mx-auto w-full max-w-7xl flex-1 p-8">{children}</div>
        <footer className="border-t border-slate-100 bg-white px-8 py-3">
          <p className="text-[11px] text-slate-400">
            Prochem East Africa · Commercial Intelligence Platform ·{" "}
            <span className="text-slate-300">Powered by SAP Business One</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
