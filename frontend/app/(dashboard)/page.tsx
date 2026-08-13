"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Users, MapPin, Camera, DollarSign } from "lucide-react";
import { useProduction } from "@/lib/production-context";
import { StatCard } from "@/components/dashboard/StatCard";
import { DayTimeline } from "@/components/schedule/DayTimeline";
import { RescueButton } from "@/components/rescue/RescueFlow";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Scene } from "@/types";

export default function CommandCenterPage() {
  const { production, currentDay, schedule, loading, error, refresh } = useProduction();
  const [scenes, setScenes] = useState<Scene[]>([]);

  const assignments = schedule?.current_version?.assignments ?? [];

  useEffect(() => {
    if (assignments.length === 0) {
      setScenes([]);
      return;
    }
    let cancelled = false;
    Promise.all(assignments.map((a) => api.getScene(a.scene_id)))
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

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-96" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-48" />
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

  return (
    <div className="p-6 space-y-8 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Good morning. Here&apos;s today&apos;s production status.</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shooting Day {currentDay.day_number} of {production.total_shooting_days} — {currentDay.shoot_date}
          </p>
        </div>
        <RescueButton
          shootingDayId={currentDay.id}
          originalAssignments={assignments}
          onScheduleChanged={refresh}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Scenes Today" value={String(assignments.length)} icon={Clapperboard} />
        <StatCard
          label="Cast"
          value={`${distinctActors.size} / ${distinctActors.size}`}
          sublabel="Available"
          icon={Users}
        />
        <StatCard label="Locations" value={String(distinctLocations.size)} sublabel="Active" icon={MapPin} />
        <StatCard label="Equipment" value={String(distinctEquipment.size)} sublabel="Units booked" icon={Camera} />
        <StatCard
          label="Est. Production Cost"
          value={formatCurrency(production.daily_budget)}
          sublabel="per day"
          icon={DollarSign}
        />
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Today&apos;s Shooting Schedule
        </h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scenes scheduled for today.</p>
        ) : (
          <DayTimeline assignments={assignments} />
        )}
      </div>
    </div>
  );
}
