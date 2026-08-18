"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MapPin, ShieldAlert, X } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { useProduction } from "@/lib/production-context";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddLocationDialog } from "@/components/setup/AddLocationDialog";

export default function LocationsPage() {
  const { schedule } = useProduction();
  const { data: locations, loading, error, refetch } = useAsync(() => api.listLocations(), []);
  const assignments = schedule?.current_version?.assignments ?? [];
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const scenesByLocation: Record<number, string[]> = {};
  for (const a of assignments) {
    if (a.status === "dropped") continue;
    scenesByLocation[a.location_id] = [...(scenesByLocation[a.location_id] ?? []), a.scene_number];
  }

  async function handleDelete(id: number, name: string) {
    setDeletingId(id);
    try {
      await api.deleteLocation(id);
      toast.success(`${name} removed`);
      refetch();
    } catch (err) {
      toast.error("Could not remove location", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every location available to this production.</p>
        </div>
        <AddLocationDialog onCreated={refetch} />
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
              <Card key={loc.id} className="group/loc relative">
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 rounded-full bg-gradient-brand p-2 shadow-[var(--glow-primary)]">
                      <MapPin className="size-4 text-white" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="capitalize">{loc.location_type}</Badge>
                      <Button
                        variant="ghost" size="icon-xs"
                        className="opacity-0 group-hover/loc:opacity-100 text-muted-foreground hover:text-destructive"
                        disabled={deletingId === loc.id}
                        onClick={() => handleDelete(loc.id, loc.name)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
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
          {locations?.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <MapPin className="size-8 mb-2" />
              <p className="text-sm">No locations yet. Add your first one above.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
