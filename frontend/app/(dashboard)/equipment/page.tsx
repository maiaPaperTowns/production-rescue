"use client";

import { Camera } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { useProduction } from "@/lib/production-context";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function EquipmentPage() {
  const { schedule } = useProduction();
  const { data: equipmentList, loading, error } = useAsync(() => api.listEquipment(), []);

  const sceneNumbersByEquipment = useAsync(async () => {
    const assignments = (schedule?.current_version?.assignments ?? []).filter((a) => a.status !== "dropped");
    if (assignments.length === 0) return {} as Record<number, string[]>;
    const scenes = await Promise.all(assignments.map((a) => api.getScene(a.scene_id)));
    const map: Record<number, string[]> = {};
    for (const scene of scenes) {
      for (const item of scene.equipment) {
        map[item.id] = [...(map[item.id] ?? []), scene.scene_number];
      }
    }
    return map;
  }, [schedule?.current_version?.id]);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equipment</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every equipment resource available to this production.</p>
      </div>

      {loading || sceneNumbersByEquipment.loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {equipmentList?.map((item) => {
            const scenesToday = sceneNumbersByEquipment.data?.[item.id] ?? [];
            return (
              <Card key={item.id}>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="rounded-full bg-gradient-brand p-2 shadow-[var(--glow-primary)]">
                      <Camera className="size-4 text-white" />
                    </div>
                    <Badge variant="secondary" className="capitalize">{item.category}</Badge>
                  </div>
                  <p className="font-medium leading-snug">{item.name}</p>
                  <p className="text-xs">
                    {scenesToday.length > 0 ? (
                      <span className="text-status-ready">SC {scenesToday.join(", SC ")}</span>
                    ) : (
                      <span className="text-muted-foreground">Not booked today</span>
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
