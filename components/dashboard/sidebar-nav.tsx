"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  Boxes,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatSheet } from "@/components/chat/chat-sheet";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/",          label: "Overview",  icon: LayoutDashboard },
  { href: "/brands",    label: "Brands",    icon: Package },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/invoices",  label: "Invoices",  icon: FileText },
  { href: "/stock",     label: "Stock",     icon: Boxes },
  { href: "/payables",  label: "Payables",  icon: Wallet },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

interface Props {
  lastSync: string;
}

export function SidebarNav({ lastSync }: Props) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
          Navigation
        </p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href, pathname);
            return (
              <li key={href} className="relative">
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-amber-400" />
                )}
                <Link
                  href={href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active
                        ? "text-amber-400"
                        : "text-slate-500 group-hover:text-slate-300"
                    )}
                  />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3 border-t border-white/[0.06] px-4 py-5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <p className="text-[11px] font-medium text-slate-500">
            Synced {lastSync}
          </p>
        </div>
        <ChatSheet />
      </div>
    </div>
  );
}
