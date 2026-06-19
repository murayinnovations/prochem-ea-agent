"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatSheet } from "@/components/chat/chat-sheet";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/",          label: "Overview",  icon: LayoutDashboard },
  { href: "/brands",    label: "Brands",    icon: Package },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/invoices",  label: "Invoices",  icon: FileText },
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
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive(href, pathname)
                    ? "bg-amber-500/10 text-amber-300"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-3 border-t border-white/10 px-4 py-4">
        <p className="text-[11px] text-slate-500">Last sync: {lastSync}</p>
        <ChatSheet />
      </div>
    </div>
  );
}
