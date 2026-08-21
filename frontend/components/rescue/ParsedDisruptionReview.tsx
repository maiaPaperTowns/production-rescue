import { Pencil, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/brand/Mascot";
import { disruptionItemTag } from "@/lib/disruption-tags";
import type { DisruptionExtractionResult } from "@/types";

export function ParsedDisruptionReview({
  parsed,
  onConfirm,
  onEdit,
}: {
  parsed: DisruptionExtractionResult;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto py-16 px-6 space-y-6">
      <div className="flex items-center gap-3">
        <Mascot pose="listening" size={44} />
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Here&apos;s what I understood</h2>
          <p className="text-sm text-muted-foreground">{parsed.summary}</p>
        </div>
      </div>

      {parsed.disruptions.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-4">
          I couldn&apos;t identify a specific disruption in that. You can still run the analysis, or try rephrasing.
        </p>
      ) : (
        <div className="space-y-2.5">
          {parsed.disruptions.map((item, i) => {
            const tag = disruptionItemTag(item);
            const Icon = tag.icon;
            return (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5">
                <div className="rounded-full bg-surface-lavender p-2 shrink-0">
                  <Icon className="size-4 text-primary" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{tag.label}</p>
                  <p className="text-xs text-muted-foreground">{tag.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="ghost" className="gap-1.5" onClick={onEdit}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <Button className="flex-1 justify-center gap-1.5" onClick={onConfirm}>
          Looks Right, Find Rescue Plan
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
