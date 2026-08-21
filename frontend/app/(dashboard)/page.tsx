"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Users, MapPin, Camera, DollarSign } from "lucide-react";
import { useProduction } from "@/lib/production-context";
import { useRescueFlow } from "@/hooks/useRescueFlow";
import { useAsync } from "@/hooks/useAsync";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DisruptionHero } from "@/components/dashboard/DisruptionHero";
import { WorkflowSteps } from "@/components/dashboard/WorkflowSteps";
import { ScheduleCard } from "@/components/dashboard/ScheduleCard";
import { WeatherCard } from "@/components/dashboard/WeatherCard";
import { AIAssistantCard } from "@/components/dashboard/AIAssistantCard";
import { RescueFlowOverlay } from "@/components/rescue/RescueFlow";
import { DEMO_EMERGENCY_TEXT } from "@/components/rescue/DisruptionInputModal";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Scene } from "@/types";

export default function CommandCenterPage() {
  const { production, currentDay, schedule, loading, error, refresh } = useProduction();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const flow = useRescueFlow(currentDay?.id ?? 0, refresh);
  const { data: runs, refetch: refetchRuns } = useAsync(
    () => (currentDay ? api.listAgentRuns({ shootingDayId: currentDay.id, limit: 5 }) : Promise.resolve([])),
    [currentDay?.id]
  );

  const assignments = schedule?.current_version?.assignments ?? [];
  const scheduledAssignments = assignments.filter((a) => a.status !== "dropped");
  const latestRun = runs && runs.length > 0 ? [...runs].sort((a, b) => b.id - a.id)[0] : null;

  useEffect(() => {
    if (scheduledAssignments.length === 0) {
      setScenes([]);
      return;
    }
    let cancelled = false;
    Promise.all(scheduledAssignments.map((a) => api.getScene(a.scene_id)))
      .then((results) => {
        if (!cancelled) setScenes(results);
      })
      .catch(() => {
        if (!cancelled) setScenes([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule?.current_version?.id]);

  useEffect(() => {
    if (flow.phase === "decided") refetchRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.phase]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !production || !currentDay) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-status-blocked/40 bg-status-blocked/5 p-6 max-w-lg">
          <p className="font-semibold text-status-blocked">Could not load production data</p>
          <p className="mt-1 text-sm text-muted-foreground">{error || "Unknown error"}</p>
        </div>
      </div>
    );
  }

  const distinctActors = new Set(scenes.flatMap((s) => s.cast.map((c) => c.id)));
  const distinctLocations = new Set(scenes.map((s) => s.location.id));
  const distinctEquipment = new Set(scenes.flatMap((s) => s.equipment.map((e) => e.id)));
  const activeWeatherDisruption =
    (latestRun?.status === "proposed" || latestRun?.status === "running") &&
    /storm|rain|weather|thunder/i.test(latestRun.disruption_summary);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <DisruptionHero
        production={production}
        currentDay={currentDay}
        latestRun={latestRun}
        scheduledCount={scheduledAssignments.length}
        onReportDisruption={flow.openInput}
        onSimulateDemo={() => flow.runDemoEmergency(DEMO_EMERGENCY_TEXT)}
      />

      {!latestRun && <WorkflowSteps />}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Scenes Today" value={String(scheduledAssignments.length)} icon={Clapperboard} tone="info" />
        <MetricCard
          label="Cast"
          value={`${distinctActors.size} / ${distinctActors.size}`}
          sublabel="Available"
          icon={Users}
          tone="success"
        />
        <MetricCard label="Locations" value={String(distinctLocations.size)} sublabel="Active" icon={MapPin} tone="neutral" />
        <MetricCard label="Equipment" value={String(distinctEquipment.size)} sublabel="Units booked" icon={Camera} tone="neutral" />
        <MetricCard
          label="Est. Production Cost"
          value={formatCurrency(production.daily_budget)}
          sublabel="per day"
          icon={DollarSign}
          tone="warning"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4 items-start">
        <ScheduleCard shootDate={currentDay.shoot_date} assignments={assignments} />
        <WeatherCard shootDate={currentDay.shoot_date} activeWeatherDisruption={Boolean(activeWeatherDisruption)} />
        <AIAssistantCard latestRun={latestRun} onAsk={flow.submitText} />
      </div>

      <RescueFlowOverlay flow={flow} originalAssignments={assignments} />
    </div>
  );
}
