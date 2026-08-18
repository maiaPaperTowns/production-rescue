"use client";

import { useState } from "react";
import { Search, Bell, ChevronDown, Menu, Settings } from "lucide-react";
import Link from "next/link";
import { useAsync } from "@/hooks/useAsync";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useProduction } from "@/lib/production-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ProductionLogo } from "@/components/brand/ProductionLogo";
import { SidebarNavLinks, SidebarProductionStatus } from "@/components/dashboard/Sidebar";

export function TopBar() {
  const { loading } = useProduction();
  const { data: runs } = useAsync(() => api.listAgentRuns({ limit: 10 }), []);
  const pendingCount = runs?.filter((r) => r.status === "proposed").length ?? 0;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (loading) {
    return (
      <header className="h-16 shrink-0 border-b border-border flex items-center px-6">
        <Skeleton className="h-9 w-80 rounded-full" />
      </header>
    );
  }

  return (
    <header className="h-16 shrink-0 border-b border-border flex items-center justify-between gap-4 px-4 sm:px-6 bg-background">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="size-4.5" />
        </Button>
        <SheetContent side="left" className="w-3/4 max-w-xs flex flex-col p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex items-center px-5 h-16 shrink-0">
            <ProductionLogo size={30} />
          </div>
          <SidebarNavLinks onNavigate={() => setMobileNavOpen(false)} />
          <div className="px-3 pb-3">
            <Link
              href="/settings"
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-primary"
            >
              <Settings className="size-4" strokeWidth={2} />
              Settings
            </Link>
          </div>
          <SidebarProductionStatus />
        </SheetContent>
      </Sheet>
      <div className="relative w-full max-w-sm hidden sm:block">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search scenes, people, locations..."
          className="w-full h-10 rounded-full border border-border bg-card pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <button className="relative flex items-center justify-center size-9 rounded-full hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
          <Bell className="size-4.5" />
          {pendingCount > 0 && (
            <span className="absolute top-1 right-1.5 flex items-center justify-center min-w-3.5 h-3.5 rounded-full bg-[#F2A950] text-[9px] font-bold text-white px-0.5">
              {pendingCount}
            </span>
          )}
        </button>
        <button className="flex items-center gap-2.5 rounded-full pl-1 pr-2 py-1 hover:bg-secondary transition-colors">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">ML</AvatarFallback>
          </Avatar>
          <span className="text-left leading-tight hidden sm:block">
            <span className="block text-xs font-semibold text-foreground">Maia Le</span>
            <span className="block text-[11px] text-muted-foreground">Production Manager</span>
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
