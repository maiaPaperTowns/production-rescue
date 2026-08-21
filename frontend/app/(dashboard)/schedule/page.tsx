"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { X, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { useProduction } from "@/lib/production-context";
import { useAsync } from "@/hooks/useAsync";
import { useRescueFlow, deriveWorkflowState } from "@/hooks/useRescueFlow";
import { DayTimeline } from "@/components/schedule/DayTimeline";
import { RescueStatusBar } from "@/components/dashboard/RescueStatusBar";
import { RescueFlowOverlay } from "@/components/rescue/RescueFlow";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { to12h } from "@/lib/format";
import { assignmentDisplayStatus, sceneStatusMeta } from "@/lib/status";
import { reasonChip, tagsFromSummary } from "@/lib/disruption-tags";
import { api, ApiError } from "@/lib/api";
import { AddSceneDialog } from "@/components/setup/AddSceneDialog";
import { AddShootingDayDialog } from "@/components/setup/AddShootingDayDialog";
import { cn } from "@/lib/utils";

export default function SchedulePage() {
  const { production, currentDay, schedule, loading, error, refresh } = useProduction();
  const version = schedule?.current_version;
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"current" | "original">("current");
  const flow = useRescueFlow(currentDay?.id ?? 0, refresh);

  const { data: versions } = useAsync(
    () => (currentDay ? api.listScheduleVersions(currentDay.id) : Promise.resolve([])),
    [currentDay?.id]
  );
  const { data: runs } = useAsync(
    () => (currentDay ? api.listAgentRuns({ shootingDayId: currentDay.id, limit: 10 }) : Promise.resolve([])),
    [currentDay?.id]
  );
  const latestRun = runs && runs.length > 0 ? [...runs].sort((a, b) => b.id - a.id)[0] : null;
  const triggeringRun = runs?.find((r) => r.status === "approved" && r.recommended_schedule_version_id === version?.id) ?? null;
  const originalVersion = versions?.find((v) => v.version_number === 1) ?? null;
  const isRescued = Boolean(version && originalVersion && version.id !== originalVersion.id);

  const changedCount = useMemo(() => {
    if (!version || !originalVersion) return 0;
    let count = 0;
    for (const a of version.assignments) {
      const orig = originalVersion.assignments.find((o) => o.scene_id === a.scene_id);
      if (!orig || orig.start !== a.start || a.status === "dropped") count++;
    }
    return count;
  }, [version, originalVersion]);

  const displayedVersion = viewMode === "original" && originalVersion ? originalVersion : version;
  const workflowState = deriveWorkflowState(flow, latestRun);

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
    <div className="p-6 space-y-6 max-w-5xl">
      <RescueStatusBar state={workflowState} latestRun={latestRun} onReportDisruption={flow.openInput} />

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active Schedule</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            {isRescued ? `Rescue Plan ${version?.label || ""}` : "Original Production Plan"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shooting Day {currentDay?.day_number}, {currentDay?.shoot_date}
          </p>
          {isRescued && triggeringRun && (
            <div className="mt-2 flex items-center gap-3 flex-wrap text-xs">
              <span className="flex items-center gap-1 font-medium text-status-ready">
                <CheckCircle2 className="size-3.5" />
                Approved {new Date((triggeringRun.completed_at ?? triggeringRun.started_at) + "Z").toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
              {tagsFromSummary(triggeringRun.disruption_summary).map((t) => (
                <span key={t.label} className="flex items-center gap-1 text-muted-foreground">
                  <t.icon className="size-3.5" />
                  {t.label}
                </span>
              ))}
              <Link href={`/agent-runs/${triggeringRun.id}`} className="flex items-center gap-1 text-primary font-medium hover:underline">
                View rescue decision
                <ArrowRight className="size-3" />
              </Link>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={flow.openInput}>
            <Zap className="size-3.5" />
            Report Disruption
          </Button>
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

      {isRescued && originalVersion && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-sm">
            <button
              onClick={() => setViewMode("current")}
              className={cn("rounded-full px-3 py-1 font-medium transition-colors", viewMode === "current" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Current Schedule
            </button>
            <button
              onClick={() => setViewMode("original")}
              className={cn("rounded-full px-3 py-1 font-medium transition-colors", viewMode === "original" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Original Plan
            </button>
          </div>
          <span className="text-xs text-muted-foreground">
            {changedCount} scene{changedCount === 1 ? "" : "s"} changed from the original plan.
          </span>
          {triggeringRun && (
            <Link href={`/agent-runs/${triggeringRun.id}`} className={cn("text-xs font-medium text-primary hover:underline")}>
              Compare Changes
            </Link>
          )}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-64" />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : displayedVersion ? (
        <>
          <Card>
            <CardContent className="pt-2">
              {displayedVersion.assignments.length > 0 ? (
                <DayTimeline assignments={displayedVersion.assignments} />
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No scenes yet. Click &ldquo;Add Scene&rdquo; above to start building today&apos;s schedule.
                </p>
              )}
            </CardContent>
          </Card>

          {displayedVersion.assignments.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Assignment Detail</h2>
              <Card className="py-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scene</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Why It Changed</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...displayedVersion.assignments]
                      .sort((a, b) => a.start.localeCompare(b.start))
                      .map((a) => {
                        const meta = sceneStatusMeta[assignmentDisplayStatus(a.status)];
                        const chip = a.change_reason ? reasonChip(a.change_reason) : null;
                        const ChipIcon = chip?.icon;
                        return (
                          <TableRow key={a.scene_id} className="group/row">
                            <TableCell className="font-medium">
                              SC {a.scene_number}
                              <span className="block text-xs font-normal text-muted-foreground">{a.title}</span>
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {a.status === "dropped" ? "N/A" : `${to12h(a.start)} – ${to12h(a.end)}`}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{a.location_name}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.text}`}>
                                <span className={`size-1.5 rounded-full ${meta.dot}`} />
                                {meta.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-64">
                              {chip && ChipIcon ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <ChipIcon className="size-3.5 text-primary shrink-0" />
                                  {a.change_reason}
                                </span>
                              ) : (
                                "None"
                              )}
                            </TableCell>
                            <TableCell>
                              {viewMode === "current" && (
                                <Button
                                  variant="ghost" size="icon-xs"
                                  className="opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive"
                                  disabled={deletingId === a.scene_id}
                                  onClick={() => handleDeleteScene(a.scene_id, a.scene_number)}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              )}
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

      <RescueFlowOverlay flow={flow} originalAssignments={originalVersion?.assignments ?? version?.assignments ?? []} />
    </div>
  );
}
