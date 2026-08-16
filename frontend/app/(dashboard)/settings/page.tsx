"use client";

import { useProduction } from "@/lib/production-context";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const { production, loading } = useProduction();

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Production and integration configuration.</p>
      </div>

      {loading ? (
        <Skeleton className="h-40" />
      ) : (
        <Card>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Production</p>
              <p className="mt-1 text-sm">{production?.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Shooting Days</p>
              <p className="mt-1 text-sm">{production?.total_shooting_days}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Daily Budget</p>
              <p className="mt-1 text-sm">${production?.daily_budget.toLocaleString()}</p>
            </div>
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              AI and partner integration credentials are configured server-side via environment variables and are
              never exposed to this dashboard.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
