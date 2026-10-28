"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { ChatSheet } from "@/components/chat/chat-sheet";
import { Button } from "@/components/ui/button";

interface MobileHeaderProps {
  lastSync: string;
}

export function MobileHeader({ lastSync }: MobileHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Mobile Top Bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-white/10 bg-[#0A1B3D] px-4 text-white shadow-sm lg:hidden">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
            className="h-9 w-9 p-0 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-xs font-black tracking-tight text-white shadow-md shadow-amber-500/30">
              PC
            </div>
            <div>
              <p className="text-sm font-extrabold leading-none tracking-tight text-white">
                Prochem
              </p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
                East Africa
              </p>
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Quick sync dot indicator */}
          <span className="relative flex h-2 w-2" title={`Synced ${lastSync}`}>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>

          <ChatSheet compact />
        </div>
      </header>

      {/* ── Mobile Navigation Drawer ───────────────────────────────────── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="flex h-full w-[280px] max-w-[85vw] flex-col border-r border-white/10 bg-[#0A1B3D] p-0 text-white shadow-2xl"
        >
          {/* Accessible Title */}
          <SheetTitle className="sr-only">Prochem Navigation</SheetTitle>

          {/* Drawer Brand Header */}
          <div className="flex items-center justify-between px-5 pt-6 pb-4">
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="h-8 w-8 p-0 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="px-5 pb-3">
            <p className="text-[11px] font-medium text-slate-500">
              Commercial Intelligence
            </p>
          </div>

          {/* Separator */}
          <div className="mx-5 h-px bg-white/[0.06]" />

          {/* Navigation Links + Sync & AI button at bottom */}
          <SidebarNav lastSync={lastSync} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
