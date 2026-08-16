"use client";

import { useProduction } from "@/lib/production-context";
import { dayStatusMeta } from "@/lib/status";
import { Skeleton } from "@/components/ui/skeleton";

export function TopBar() {
  const { production, currentDay, loading } = useProduction();

  if (loading || !production || !currentDay) {
    return (
      <header className="h-14 shrink-0 border-b border-border flex items-center px-6">
        <Skeleton className="h-5 w-64" />
      </header>
    );
  }

  const status = dayStatusMeta(currentDay.status);

  return (
    <header className="h-14 shrink-0 border-b border-border flex items-center justify-between px-6 bg-background/60 backdrop-blur-xl">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-semibold">{production.name}</span>
        <span className="text-muted-foreground">
          Shooting Day {currentDay.day_number} of {production.total_shooting_days}
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-border bg-card/80 backdrop-blur px-3 py-1 text-xs font-medium">
        <span className={`size-1.5 rounded-full ${status.dot} shadow-[0_0_8px_currentColor]`} />
        {status.label}
      </div>
    </header>
  );
}
