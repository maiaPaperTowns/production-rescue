"use client";

import { Users } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { useProduction } from "@/lib/production-context";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/format";

export default function CastPage() {
  const { schedule } = useProduction();
  const { data: actors, loading, error } = useAsync(() => api.listActors(), []);
  const assignments = schedule?.current_version?.assignments ?? [];

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

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cast</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every actor attached to this production.</p>
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
              <Card key={actor.id}>
                <CardContent className="flex items-start gap-3">
                  <Avatar className="size-11 ring-2 ring-primary/30">
                    <AvatarFallback className="bg-gradient-brand text-white font-semibold">
                      {actor.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
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
                </CardContent>
              </Card>
            );
          })}
          {actors?.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Users className="size-8 mb-2" />
              <p className="text-sm">No cast members found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
