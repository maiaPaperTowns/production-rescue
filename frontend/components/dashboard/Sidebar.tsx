"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  CalendarDays,
  Waypoints,
  Users,
  MapPin,
  Camera,
  Sparkles,
  FileChartColumn,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductionLogo } from "@/components/brand/ProductionLogo";
import { useProduction } from "@/lib/production-context";
import { useAsync } from "@/hooks/useAsync";
import { api } from "@/lib/api";

export const NAV_ITEMS = [
  { href: "/", label: "Home", icon: House },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/production-map", label: "Production Map", icon: Waypoints },
  { href: "/cast", label: "People", icon: Users },
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/equipment", label: "Equipment", icon: Camera },
  { href: "/agent-runs", label: "AI Assistant", icon: Sparkles, badge: true },
  { href: "/analytics", label: "Reports", icon: FileChartColumn },
];

const NAV_SECTIONS = [
  { label: "Operations", hrefs: ["/", "/schedule", "/production-map"] },
  { label: "Resources", hrefs: ["/cast", "/locations", "/equipment"] },
  { label: "Intelligence", hrefs: ["/agent-runs", "/analytics"] },
];

export function SidebarNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: runs } = useAsync(() => api.listAgentRuns({ limit: 10 }), []);
  const pendingCount = runs?.filter((r) => r.status === "proposed").length ?? 0;

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="space-y-0.5">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            {section.label}
          </p>
          {section.hrefs.map((href) => {
            const item = NAV_ITEMS.find((i) => i.href === href)!;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            const showBadge = (item.badge || item.href === "/") && pendingCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-primary"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-primary"
                )}
              >
                <Icon className="size-4" strokeWidth={2} />
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full bg-[#F2A950] text-[10px] font-semibold text-white">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function SidebarProductionStatus() {
  const { production, currentDay } = useProduction();
  if (!production || !currentDay) return null;
  return (
    <div className="mx-3 mb-3 rounded-[14px] bg-secondary px-3.5 py-3">
      <p className="text-sm font-semibold text-primary truncate">{production.name}</p>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-1.5 rounded-full bg-status-ready" />
        Day {currentDay.day_number} of {production.total_shooting_days}
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center px-5 h-16">
        <ProductionLogo size={30} />
      </div>
      <SidebarNavLinks />
      <div className="px-3 pb-3">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-primary"
        >
          <Settings className="size-4" strokeWidth={2} />
          Settings
        </Link>
      </div>
      <SidebarProductionStatus />
    </aside>
  );
}
