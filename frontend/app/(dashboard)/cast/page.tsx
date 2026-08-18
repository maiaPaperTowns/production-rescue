"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Users, X } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { useProduction } from "@/lib/production-context";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { AddActorDialog } from "@/components/setup/AddActorDialog";

export default function CastPage() {
  const { schedule } = useProduction();
  const { data: actors, loading, error, refetch } = useAsync(() => api.listActors(), []);
  const assignments = schedule?.current_version?.assignments ?? [];
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const sceneNumbersByActor = useAsync(async () => {
    const scheduled = assignments.filter((a) => a.status !== "dropped");
    if (scheduled.length === 0) return {} as Record<number, string[]>;
    const scenes = await Promise.all(scheduled.map((a) => api.getScene(a.scene_id)));
    const map: Record<number, string[]> = {};
    for (const scene of scenes) {
      for (const actor of scene.cast) {
        map[actor.id] = [...(map[actor.id] ?? []), scene.scene_number];
      }
    }
    return map;
  }, [schedule?.current_version?.id]);

  async function handleDelete(id: number, name: string) {
    setDeletingId(id);
    try {
      await api.deleteActor(id);
      toast.success(`${name} removed`);
      refetch();
    } catch (err) {
      toast.error("Could not remove actor", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cast</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every actor attached to this production.</p>
        </div>
        <AddActorDialog onCreated={refetch} />
      </div>

      {loading || sceneNumbersByActor.loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {actors?.map((actor) => {
            const scenesToday = sceneNumbersByActor.data?.[actor.id] ?? [];
            return (
              <Card key={actor.id} className="group/actor relative">
                <CardContent className="flex items-start gap-3">
                  <Avatar className="size-11 ring-2 ring-primary/30">
                    <AvatarFallback className="bg-gradient-brand text-white font-semibold">
                      {actor.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug truncate">{actor.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{actor.role || "Cast"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(actor.day_rate)} / day</p>
                    <p className="mt-1.5 text-xs">
                      {scenesToday.length > 0 ? (
                        <span className="text-status-ready">
                          Scheduled today: SC {scenesToday.join(", SC ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not scheduled today</span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost" size="icon-xs"
                    className="opacity-0 group-hover/actor:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                    disabled={deletingId === actor.id}
                    onClick={() => handleDelete(actor.id, actor.name)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {actors?.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Users className="size-8 mb-2" />
              <p className="text-sm">No cast members yet. Add your first one above.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
