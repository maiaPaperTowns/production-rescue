import { MessageSquareText, Sparkles, GitCompare, ShieldCheck, ArrowRight } from "lucide-react";

const STEPS = [
  { icon: MessageSquareText, title: "Report", detail: "Tell us what changed" },
  { icon: Sparkles, title: "Rescue analyzes", detail: "Cast · Locations · Weather · Gear" },
  { icon: GitCompare, title: "Review", detail: "Compare rescue options" },
  { icon: ShieldCheck, title: "Approve", detail: "You stay in control" },
] as const;

/** Compact one-time explainer, shown only before the user has run their first rescue. */
export function WorkflowSteps() {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
      <div className="flex items-stretch gap-2 overflow-x-auto">
        {STEPS.map((step, i) => (
          <div key={step.title} className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="rounded-full bg-surface-lavender p-2 shrink-0">
                <step.icon className="size-4 text-primary" strokeWidth={2} />
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-foreground">
                  {i + 1}. {step.title}
                </p>
                <p className="text-[11px] text-muted-foreground whitespace-nowrap">{step.detail}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="size-3.5 text-muted-foreground/40 mx-2 shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}
