import { AlertTriangle, ArrowRight, Ban } from "lucide-react";
import { to12h } from "@/lib/format";
import type { Assignment, Plan } from "@/types";
import { cn } from "@/lib/utils";

function OriginalCard({ assignment, flagReason }: { assignment: Assignment; flagReason: string | null }) {
  return (
    <div className={cn("rounded-lg border p-3", flagReason ? "border-status-blocked/40 bg-status-blocked/5" : "border-border")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">SC {assignment.scene_number}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{to12h(assignment.start)}</span>
      </div>
      <p className="mt-1 text-sm font-medium leading-snug">{assignment.title}</p>
      <p className="text-xs text-muted-foreground">{assignment.location_name}</p>
      {flagReason && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-status-blocked">
          <AlertTriangle className="size-3.5 mt-0.5 shrink-0" strokeWidth={2} />
          <span>{flagReason}</span>
        </div>
      )}
    </div>
  );
}

function RescueCard({ assignment, movedFrom }: { assignment: Assignment; movedFrom: string | null }) {
  return (
    <div className="rounded-lg border border-status-ready/30 bg-status-ready/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">SC {assignment.scene_number}</span>
        {movedFrom ? (
          <span className="flex items-center gap-1 text-xs tabular-nums font-medium text-status-ready">
            {to12h(movedFrom)} <ArrowRight className="size-3" /> {to12h(assignment.start)}
          </span>
        ) : (
          <span className="text-xs tabular-nums text-muted-foreground">{to12h(assignment.start)}</span>
        )}
      </div>
      <p className="mt-1 text-sm font-medium leading-snug">{assignment.title}</p>
      <p className="text-xs text-muted-foreground">{assignment.location_name}</p>
      {assignment.change_reason && (
        <p className="mt-2 text-xs text-muted-foreground border-t border-border pt-2">
          <span className="font-medium text-foreground">Reason: </span>
          {assignment.change_reason}
        </p>
      )}
    </div>
  );
}

export function BeforeAfterPanel({
  original,
  proposed,
  affectedSceneIds,
}: {
  original: Assignment[];
  proposed: Plan;
  affectedSceneIds: number[];
}) {
  const droppedNumbers = new Set(proposed.dropped_scenes);
  const affectedIds = new Set(affectedSceneIds);
  const sortedOriginal = [...original].sort((a, b) => a.start.localeCompare(b.start));
  const sortedProposed = [...proposed.assignments].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Original Plan</p>
        <div className="space-y-2.5">
          {sortedOriginal.map((a) => {
            const proposedMatch = proposed.assignments.find((p) => p.scene_id === a.scene_id);
            const isDropped = droppedNumbers.has(a.scene_number);
            const isAffected = affectedIds.has(a.scene_id);
            const reason = isDropped
              ? "Could not be scheduled today given current constraints"
              : isAffected
                ? proposedMatch?.change_reason || "No longer feasible at its original time"
                : null;
            return <OriginalCard key={a.scene_id} assignment={a} flagReason={reason} />;
          })}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Rescue Plan ({proposed.label})</p>
        <div className="space-y-2.5">
          {sortedProposed.map((a) => {
            const orig = original.find((o) => o.scene_id === a.scene_id);
            const movedFrom = orig && orig.start !== a.start ? orig.start : null;
            return <RescueCard key={a.scene_id} assignment={a} movedFrom={movedFrom} />;
          })}
          {proposed.dropped_scenes.length > 0 && (
            <div className="rounded-lg border border-dashed border-status-blocked/40 p-3 flex items-start gap-2">
              <Ban className="size-4 mt-0.5 shrink-0 text-status-blocked" strokeWidth={2} />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  Scene{proposed.dropped_scenes.length > 1 ? "s" : ""} {proposed.dropped_scenes.join(", ")}
                </span>{" "}
                could not be fit into today — recommend moving to another shooting day.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
