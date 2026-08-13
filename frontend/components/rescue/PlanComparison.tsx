import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import type { Plan } from "@/types";
import { cn } from "@/lib/utils";

export function PlanComparison({
  plans,
  selectedId,
  onSelect,
}: {
  plans: Plan[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {plans.map((plan) => {
        const selected = plan.schedule_version_id === selectedId;
        return (
          <Card
            key={plan.schedule_version_id}
            onClick={() => onSelect(plan.schedule_version_id)}
            className={cn(
              "py-0 cursor-pointer transition-colors",
              selected ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/30"
            )}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{plan.label}</span>
                {plan.recommended && <Badge className="bg-primary/15 text-primary border-0">Recommended</Badge>}
              </div>
              <p className="text-3xl font-semibold tabular-nums tracking-tight">{plan.score}</p>
              <dl className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Downtime</dt>
                  <dd className="tabular-nums">{plan.impact?.downtime_hours_avoided ?? 0} hrs</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Est. cost avoided</dt>
                  <dd className="tabular-nums">{formatCurrency(plan.impact?.estimated_cost_avoided ?? 0)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Scenes completed</dt>
                  <dd className="tabular-nums">
                    {plan.impact?.scenes_preserved ?? plan.assignments.length} / {plan.impact?.scenes_total ?? plan.assignments.length}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
