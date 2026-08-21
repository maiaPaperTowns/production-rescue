import Link from "next/link";
import { Zap, ArrowRight, ShieldCheck, PlayCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Mascot } from "@/components/brand/Mascot";
import type { AgentRun, Production, ShootingDay } from "@/types";

export function DisruptionHero({
  production,
  currentDay,
  latestRun,
  scheduledCount,
  onReportDisruption,
  onSimulateDemo,
}: {
  production: Production;
  currentDay: ShootingDay;
  latestRun: AgentRun | null;
  scheduledCount: number;
  onReportDisruption: () => void;
  onSimulateDemo: () => void;
}) {
  const isPending = latestRun?.status === "proposed" || latestRun?.status === "running";
  const isResolved = latestRun?.status === "approved";

  const projectLabel = (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2">
      {production.name} &middot; Shooting Day {currentDay.day_number}
    </p>
  );

  if (isPending) {
    const recommended = latestRun!.plans.find((p) => p.recommended) ?? latestRun!.plans[0];
    return (
      <div>
        {projectLabel}
        <div className="rounded-3xl border border-status-at-risk/30 bg-butter/25 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <Mascot pose="warning" size={92} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-status-at-risk">Disruption in progress</p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              {latestRun!.disruption_summary}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              {latestRun!.status === "running"
                ? "Biscuit is analyzing the schedule and generating rescue candidates."
                : recommended
                  ? `A rescue plan is ready: ${recommended.label}. Review it and decide.`
                  : "A rescue plan is ready for review."}
            </p>
          </div>
          {latestRun!.status === "proposed" && (
            <Link href={`/agent-runs/${latestRun!.id}`} className={buttonVariants({ size: "lg", className: "gap-2 shrink-0" })}>
              Review Rescue Plan
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (isResolved) {
    const recommended = latestRun!.plans.find((p) => p.recommended) ?? latestRun!.plans[0];
    return (
      <div>
        {projectLabel}
        <div className="rounded-3xl border border-status-ready/30 bg-mint/30 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <Mascot pose="celebrating" size={92} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-status-ready">Rescue applied</p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              The schedule is back on track.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              {recommended?.impact
                ? `${recommended.impact.scenes_preserved} of ${recommended.impact.scenes_total} scenes preserved, ${recommended.impact.downtime_hours_avoided.toFixed(1)}h downtime avoided.`
                : "The rescue plan was approved and is now active."}
            </p>
          </div>
          <Button size="lg" variant="secondary" className="gap-2 shrink-0" onClick={onReportDisruption}>
            <Zap className="size-4" />
            Report Another Disruption
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {projectLabel}
      <div className="rounded-3xl border border-border bg-surface-lavender/60 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <Mascot pose="idle" size={92} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" />
            All clear
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
            Good morning. {production.name} is on track for Day {currentDay.day_number}.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Production is on track. I&apos;ll watch today&apos;s schedule ({scheduledCount} scenes) and help you adapt
            when something changes.
          </p>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Button size="lg" className="gap-2" onClick={onReportDisruption}>
              <Zap className="size-4" />
              Report a Disruption
            </Button>
            <Button size="lg" variant="ghost" className="gap-2 text-muted-foreground" onClick={onSimulateDemo}>
              <PlayCircle className="size-4" />
              Simulate Demo Emergency
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Weather changed? Actor unavailable? Equipment delayed? Tell Production Rescue what happened.
          </p>
        </div>
      </div>
    </div>
  );
}
