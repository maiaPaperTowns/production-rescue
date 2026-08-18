"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Camera, X } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { useProduction } from "@/lib/production-context";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddEquipmentDialog } from "@/components/setup/AddEquipmentDialog";

export default function EquipmentPage() {
  const { schedule } = useProduction();
  const { data: equipmentList, loading, error, refetch } = useAsync(() => api.listEquipment(), []);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  async function handleDelete(id: number, name: string) {
    setDeletingId(id);
    try {
      await api.deleteEquipment(id);
      toast.success(`${name} removed`);
      refetch();
    } catch (err) {
      toast.error("Could not remove equipment", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipment</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every equipment resource available to this production.</p>
        </div>
        <AddEquipmentDialog onCreated={refetch} />
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
              <Card key={item.id} className="group/eq relative">
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="rounded-full bg-gradient-brand p-2 shadow-[var(--glow-primary)]">
                      <Camera className="size-4 text-white" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="capitalize">{item.category}</Badge>
                      <Button
                        variant="ghost" size="icon-xs"
                        className="opacity-0 group-hover/eq:opacity-100 text-muted-foreground hover:text-destructive"
                        disabled={deletingId === item.id}
                        onClick={() => handleDelete(item.id, item.name)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
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
          {equipmentList?.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Camera className="size-8 mb-2" />
              <p className="text-sm">No equipment yet. Add your first item above.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
