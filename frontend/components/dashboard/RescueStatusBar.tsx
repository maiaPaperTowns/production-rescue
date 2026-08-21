import Link from "next/link";
import { Circle, Sparkles, Zap, CheckCircle2, AlertOctagon, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { tagsFromSummary } from "@/lib/disruption-tags";
import type { RescueWorkflowState } from "@/hooks/useRescueFlow";
import type { AgentRun } from "@/types";
import { cn } from "@/lib/utils";

const STAGES = ["Parse", "Dependencies", "Alternatives", "Recommendation"] as const;

function analyzingStage(fraction: number): number {
  if (fraction < 0.25) return 0;
  if (fraction < 0.6) return 1;
  if (fraction < 0.85) return 2;
  return 3;
}

export function RescueStatusBar({
  state,
  latestRun,
  onReportDisruption,
  analyzingFraction = 0,
}: {
  state: RescueWorkflowState;
  latestRun: AgentRun | null;
  onReportDisruption: () => void;
  analyzingFraction?: number;
}) {
  if (state === "on_track") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm">
        <span className="flex items-center gap-2 font-medium text-status-ready">
          <Circle className="size-2.5 fill-current" />
          Production On Track
        </span>
        <button onClick={onReportDisruption} className="flex items-center gap-1 text-primary font-medium hover:underline">
          Report a Disruption
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    );
  }

  if (state === "analyzing") {
    const active = analyzingStage(analyzingFraction);
    return (
      <div className="rounded-2xl border border-border bg-surface-lavender px-4 py-3 text-sm space-y-2">
        <span className="flex items-center gap-2 font-medium text-primary">
          <Sparkles className="size-4 mascot-pulse" />
          Production Rescue is analyzing the disruption...
        </span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {STAGES.map((stage, i) => (
            <span key={stage} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex items-center gap-1",
                  i < active && "text-status-ready",
                  i === active && "text-primary font-semibold"
                )}
              >
                {i < active ? <CheckCircle2 className="size-3" /> : <Circle className={cn("size-2", i === active && "fill-current")} />}
                {stage}
              </span>
              {i < STAGES.length - 1 && <ArrowRight className="size-3 text-muted-foreground/50" />}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (state === "plan_ready" && latestRun) {
    const tags = tagsFromSummary(latestRun.disruption_summary);
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-status-at-risk/30 bg-butter/25 px-4 py-3 text-sm">
        <span className="min-w-0">
          <span className="flex items-center gap-2 font-semibold text-status-at-risk">
            <Zap className="size-4" />
            Rescue Plan Ready
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground truncate">
            {Math.max(tags.length, 1)} disruption{tags.length === 1 ? "" : "s"} affected {latestRun.affected_scene_ids.length} scene
            {latestRun.affected_scene_ids.length === 1 ? "" : "s"}.
          </span>
        </span>
        <Link
          href={`/agent-runs/${latestRun.id}`}
          className={buttonVariants({ size: "sm", className: "shrink-0" })}
        >
          Review Rescue Plan
        </Link>
      </div>
    );
  }

  if (state === "no_feasible_plan" && latestRun) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-status-blocked/30 bg-coral/10 px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-semibold text-status-blocked">
          <AlertOctagon className="size-4" />
          No conflict-free plan found
        </span>
        <Link href={`/agent-runs/${latestRun.id}`} className={buttonVariants({ size: "sm", variant: "outline", className: "shrink-0" })}>
          Review Details
        </Link>
      </div>
    );
  }

  if (state === "approved" && latestRun) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-status-ready/30 bg-mint/25 px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-semibold text-status-ready">
          <CheckCircle2 className="size-4" />
          Rescue Plan Approved
        </span>
        <Link href={`/agent-runs/${latestRun.id}`} className={buttonVariants({ size: "sm", variant: "outline", className: "shrink-0" })}>
          View Changes
        </Link>
      </div>
    );
  }

  return null;
}
