"use client";

import { useProduction } from "@/lib/production-context";
import { DayTimeline } from "@/components/schedule/DayTimeline";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { to12h } from "@/lib/format";
import { assignmentDisplayStatus, sceneStatusMeta } from "@/lib/status";

export default function SchedulePage() {
  const { currentDay, schedule, loading, error } = useProduction();
  const version = schedule?.current_version;

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentDay ? `Shooting Day ${currentDay.day_number}, ${currentDay.shoot_date}` : "Loading..."}
          </p>
        </div>
        {version && (
          <Badge className="bg-gradient-brand text-white border-0">
            {version.label || `Version ${version.version_number}`} &middot; {version.status}
          </Badge>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : version ? (
        <>
          <Card>
            <CardContent className="pt-2">
              <DayTimeline assignments={version.assignments} />
            </CardContent>
          </Card>

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...version.assignments]
                    .sort((a, b) => a.start.localeCompare(b.start))
                    .map((a) => {
                      const meta = sceneStatusMeta[assignmentDisplayStatus(a.status)];
                      return (
                        <TableRow key={a.scene_id}>
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
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </Card>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No active schedule for this day.</p>
      )}
    </div>
  );
}
