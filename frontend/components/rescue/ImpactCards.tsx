import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { Impact } from "@/types";
import { cn } from "@/lib/utils";

export function ImpactCards({ impact }: { impact: Impact }) {
  const cards = [
    { value: `${impact.downtime_hours_avoided} hrs`, label: "Downtime Avoided" },
    { value: formatCurrency(impact.estimated_cost_avoided), label: "Estimated Cost Avoided" },
    { value: `${impact.scenes_preserved} / ${impact.scenes_total}`, label: "Scenes Preserved" },
    { value: `${0}`, label: "Hard Conflicts", tone: "ok" as const },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="py-0">
          <CardContent className="p-4 text-center">
            <p className={cn("text-2xl font-semibold tabular-nums tracking-tight", c.tone === "ok" && "text-status-ready")}>
              {c.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{c.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
