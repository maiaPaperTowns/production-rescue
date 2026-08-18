import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { to12h, formatDateShort } from "@/lib/format";
import { assignmentDisplayStatus, sceneStatusMeta } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Assignment } from "@/types";

export function ScheduleCard({ shootDate, assignments }: { shootDate: string; assignments: Assignment[] }) {
  const sorted = [...assignments]
    .filter((a) => a.status !== "dropped")
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 5);

  return (
    <Card className="py-0">
      <CardHeader className="pt-5">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Shooting Schedule &middot; {formatDateShort(shootDate)}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 space-y-1">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No scenes scheduled yet.</p>
        ) : (
          sorted.map((a) => {
            const meta = sceneStatusMeta[assignmentDisplayStatus(a.status)];
            return (
              <div key={a.scene_id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className={cn("size-2 rounded-full shrink-0", meta.dot)} />
                <span className="text-xs font-medium text-muted-foreground tabular-nums w-16 shrink-0">{to12h(a.start)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">SC {a.scene_number} &middot; {a.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.location_name}</p>
                </div>
              </div>
            );
          })
        )}
        <Link
          href="/schedule"
          className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline pt-1"
        >
          View full schedule
          <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
