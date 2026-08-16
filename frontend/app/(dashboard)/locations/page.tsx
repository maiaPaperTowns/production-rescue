"use client";

import { MapPin, ShieldAlert } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { useProduction } from "@/lib/production-context";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function LocationsPage() {
  const { schedule } = useProduction();
  const { data: locations, loading, error } = useAsync(() => api.listLocations(), []);
  const assignments = schedule?.current_version?.assignments ?? [];

  const scenesByLocation: Record<number, string[]> = {};
  for (const a of assignments) {
    if (a.status === "dropped") continue;
    scenesByLocation[a.location_id] = [...(scenesByLocation[a.location_id] ?? []), a.scene_number];
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every location available to this production.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {locations?.map((loc) => {
            const scenesToday = scenesByLocation[loc.id] ?? [];
            return (
              <Card key={loc.id}>
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 rounded-full bg-gradient-brand p-2 shadow-[var(--glow-primary)]">
                      <MapPin className="size-4 text-white" />
                    </div>
                    <Badge variant="secondary" className="capitalize">{loc.location_type}</Badge>
                  </div>
                  <div>
                    <p className="font-medium leading-snug">{loc.name}</p>
                    <p className="text-xs text-muted-foreground">{loc.address}</p>
                  </div>
                  {loc.permit_required && (
                    <div className="flex items-center gap-1.5 text-xs text-status-at-risk">
                      <ShieldAlert className="size-3.5" />
                      Permit required
                    </div>
                  )}
                  <p className="text-xs pt-1 border-t border-border">
                    {scenesToday.length > 0 ? (
                      <span className="text-status-ready">Scheduled today: SC {scenesToday.join(", SC ")}</span>
                    ) : (
                      <span className="text-muted-foreground">Not used today</span>
                    )}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
