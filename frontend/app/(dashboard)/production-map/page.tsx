"use client";

import { useProduction } from "@/lib/production-context";
import { useAsync } from "@/hooks/useAsync";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductionMapFlow } from "@/components/production/ProductionMapFlow";

export default function ProductionMapPage() {
  const { currentDay, schedule, loading: productionLoading } = useProduction();
  const assignments = schedule?.current_version?.assignments ?? [];

  const { data: scenes, loading: scenesLoading } = useAsync(async () => {
    if (assignments.length === 0) return [];
    return Promise.all(assignments.map((a) => api.getScene(a.scene_id)));
  }, [schedule?.current_version?.id]);

  const { data: latestRuns } = useAsync(async () => {
    if (!currentDay) return [];
    return api.listAgentRuns({ shootingDayId: currentDay.id, limit: 1 });
  }, [currentDay?.id]);

  const affectedSceneIds = new Set(latestRuns?.[0]?.affected_scene_ids ?? []);
  const loading = productionLoading || scenesLoading;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Production Map</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scenes and every actor, location, and equipment resource they depend on. Nodes glow red when the most
          recent disruption made them infeasible at their original time.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-[600px]" />
      ) : scenes && scenes.length > 0 ? (
        <ProductionMapFlow scenes={scenes} affectedSceneIds={affectedSceneIds} />
      ) : (
        <p className="text-sm text-muted-foreground">No scenes scheduled for today.</p>
      )}
    </div>
  );
}
