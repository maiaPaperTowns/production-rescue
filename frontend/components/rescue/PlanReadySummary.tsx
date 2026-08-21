import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mascot } from "@/components/brand/Mascot";
import { formatCurrency } from "@/lib/format";
import type { AgentRun } from "@/types";

export function PlanReadySummary({ run, onReview }: { run: AgentRun; onReview: () => void }) {
  const recommended = run.plans.find((p) => p.recommended) ?? run.plans[0];

  return (
    <div className="max-w-lg mx-auto py-14 px-6 text-center space-y-6">
      <Mascot pose="planReady" size={100} className="mx-auto" />

      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight">I found a conflict-free rescue plan.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          I evaluated {run.candidates_generated} schedule option{run.candidates_generated === 1 ? "" : "s"}.{" "}
          {run.candidates_valid} satisfied every hard production constraint.
        </p>
      </div>

      {recommended && (
        <div className="rounded-2xl border border-primary/20 bg-surface-lavender p-5 text-left space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{recommended.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tabular-nums">{recommended.score}</span>
              <Badge className="bg-primary/15 text-primary border-0">Recommended</Badge>
            </div>
          </div>
          {recommended.impact && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="font-semibold tabular-nums">{recommended.impact.downtime_hours_avoided} hrs</p>
                <p className="text-xs text-muted-foreground">Downtime avoided</p>
              </div>
              <div>
                <p className="font-semibold tabular-nums">{formatCurrency(recommended.impact.estimated_cost_avoided)}</p>
                <p className="text-xs text-muted-foreground">Estimated cost avoided</p>
              </div>
              <div>
                <p className="font-semibold tabular-nums">
                  {recommended.impact.scenes_preserved}/{recommended.impact.scenes_total}
                </p>
                <p className="text-xs text-muted-foreground">Scenes preserved</p>
              </div>
              <div>
                <p className="font-semibold tabular-nums text-status-ready">0</p>
                <p className="text-xs text-muted-foreground">Hard conflicts</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        {run.plans.length > 1 && (
          <Button variant="outline" className="flex-1 justify-center" onClick={onReview}>
            Compare {run.plans.length} Options
          </Button>
        )}
        <Button className="flex-1 justify-center gap-1.5" onClick={onReview}>
          Review {recommended?.label ?? "Plan"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
