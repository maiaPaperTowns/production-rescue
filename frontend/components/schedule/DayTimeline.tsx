import { to12h } from "@/lib/format";
import { assignmentDisplayStatus, sceneStatusMeta } from "@/lib/status";
import type { Assignment } from "@/types";
import { cn } from "@/lib/utils";

export function DayTimeline({ assignments, compact }: { assignments: Assignment[]; compact?: boolean }) {
  const sorted = [...assignments].sort((a, b) => {
    if (a.status === "dropped" && b.status !== "dropped") return 1;
    if (b.status === "dropped" && a.status !== "dropped") return -1;
    return a.start.localeCompare(b.start);
  });

  return (
    <div className="relative overflow-x-auto pb-2">
      <div className="flex items-stretch gap-3 min-w-max relative">
        <div className="absolute top-[38px] left-0 right-0 h-px bg-border" />
        {sorted.map((a) => {
          const displayStatus = assignmentDisplayStatus(a.status);
          const meta = sceneStatusMeta[displayStatus];
          return (
            <div key={a.scene_id} className={cn("flex flex-col", compact ? "w-40" : "w-48")}>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {a.status === "dropped" ? "N/A" : to12h(a.start)}
              </span>
              <div className="relative flex items-center py-2">
                <span className={cn("size-2.5 rounded-full ring-4 ring-background z-10", meta.dot)} />
              </div>
              <div
                className={cn(
                  "rounded-lg border p-3 flex-1",
                  meta.border,
                  meta.bg
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">SC {a.scene_number}</span>
                  <span className={cn("text-[10px] font-medium uppercase tracking-wide", meta.text)}>{meta.label}</span>
                </div>
                <p className="mt-1 text-sm font-medium leading-snug line-clamp-2">{a.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.location_name}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
