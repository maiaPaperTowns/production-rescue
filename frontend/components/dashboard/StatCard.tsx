import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <Card className="py-0">
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p
            className={cn(
              "mt-2 text-2xl font-semibold tabular-nums tracking-tight",
              tone === "warning" && "text-status-at-risk",
              tone === "danger" && "text-status-blocked"
            )}
          >
            {value}
          </p>
          {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
        </div>
        <div className="rounded-md bg-muted p-2 shrink-0">
          <Icon className="size-4 text-muted-foreground" strokeWidth={2} />
        </div>
      </CardContent>
    </Card>
  );
}
