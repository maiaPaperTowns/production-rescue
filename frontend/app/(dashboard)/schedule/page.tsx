"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useProduction } from "@/lib/production-context";
import { DayTimeline } from "@/components/schedule/DayTimeline";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { to12h } from "@/lib/format";
import { assignmentDisplayStatus, sceneStatusMeta } from "@/lib/status";
import { api, ApiError } from "@/lib/api";
import { AddSceneDialog } from "@/components/setup/AddSceneDialog";
import { AddShootingDayDialog } from "@/components/setup/AddShootingDayDialog";

export default function SchedulePage() {
  const { production, currentDay, schedule, loading, error, refresh } = useProduction();
  const version = schedule?.current_version;
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleDeleteScene(sceneId: number, sceneNumber: string) {
    setDeletingId(sceneId);
    try {
      await api.deleteScene(sceneId);
      toast.success(`Scene ${sceneNumber} removed from today's schedule`);
      refresh();
    } catch (err) {
      toast.error("Could not remove scene", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentDay ? `Shooting Day ${currentDay.day_number}, ${currentDay.shoot_date}` : "Loading..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {version && (
            <Badge className="bg-gradient-brand text-white border-0">
              {version.label || `Version ${version.version_number}`} &middot; {version.status}
            </Badge>
          )}
          {currentDay && <AddSceneDialog shootingDayId={currentDay.id} onCreated={refresh} />}
          {production && (
            <AddShootingDayDialog
              productionId={production.id}
              suggestedDayNumber={(currentDay?.day_number ?? 0) + 1}
              onCreated={refresh}
            />
          )}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : version ? (
        <>
          <Card>
            <CardContent className="pt-2">
              {version.assignments.length > 0 ? (
                <DayTimeline assignments={version.assignments} />
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No scenes yet. Click &ldquo;Add Scene&rdquo; above to start building today&apos;s schedule.
                </p>
              )}
            </CardContent>
          </Card>

          {version.assignments.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Assignment Detail</h2>
              <Card className="py-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scene</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...version.assignments]
                      .sort((a, b) => a.start.localeCompare(b.start))
                      .map((a) => {
                        const meta = sceneStatusMeta[assignmentDisplayStatus(a.status)];
                        return (
                          <TableRow key={a.scene_id} className="group/row">
                            <TableCell className="font-medium">SC {a.scene_number}</TableCell>
                            <TableCell>{a.title}</TableCell>
                            <TableCell className="tabular-nums">
                              {a.status === "dropped" ? "N/A" : `${to12h(a.start)} to ${to12h(a.end)}`}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{a.location_name}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.text}`}>
                                <span className={`size-1.5 rounded-full ${meta.dot}`} />
                                {meta.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-64">{a.change_reason || "None"}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost" size="icon-xs"
                                className="opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive"
                                disabled={deletingId === a.scene_id}
                                onClick={() => handleDeleteScene(a.scene_id, a.scene_number)}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No active schedule for this day.</p>
      )}
    </div>
  );
}
