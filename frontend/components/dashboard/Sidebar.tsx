"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarClock,
  Waypoints,
  Users,
  MapPin,
  Camera,
  Bot,
  BarChart3,
  Settings,
  Film,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Command Center", icon: LayoutDashboard },
  { href: "/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/production-map", label: "Production Map", icon: Waypoints },
  { href: "/cast", label: "Cast", icon: Users },
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/equipment", label: "Equipment", icon: Camera },
  { href: "/agent-runs", label: "Agent Runs", icon: Bot },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border">
        <Film className="size-5 text-primary" strokeWidth={2.25} />
        <span className="text-sm font-semibold tracking-wide">PRODUCTION RESCUE</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-sidebar-border">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground hover:text-sidebar-accent-foreground"
        >
          <Settings className="size-4" strokeWidth={2} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
