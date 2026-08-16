"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, ThumbsDown, Loader2 } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentActivityTimeline } from "@/components/agents/AgentActivityTimeline";
import { ImpactCards } from "@/components/rescue/ImpactCards";
import { PlanComparison } from "@/components/rescue/PlanComparison";
import { useProduction } from "@/lib/production-context";
import { to12h, formatCurrency } from "@/lib/format";

export default function AgentRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const runId = Number(id);
  const { data: run, loading, error, refetch } = useAsync(() => api.getAgentRun(runId), [runId]);
  const { refresh: refreshProduction } = useProduction();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);

  const activePlanId = selectedPlanId ?? run?.recommended_schedule_version_id ?? null;
  const activePlan = run?.plans.find((p) => p.schedule_version_id === activePlanId) ?? run?.plans[0] ?? null;

  async function handleApprove() {
    if (!run) return;
    setDecisionLoading(true);
    try {
      await api.approveRescue(run.id, "Assistant Director");
      toast.success("Rescue plan approved", { description: "Schedule updated and decision recorded in the audit log." });
      refreshProduction();
      refetch();
    } catch (err) {
      toast.error("Could not approve plan", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setDecisionLoading(false);
    }
  }

  async function handleReject() {
    if (!run) return;
    setDecisionLoading(true);
    try {
      await api.rejectRescue(run.id, "Assistant Director");
      toast.info("Rescue plan rejected");
      refetch();
    } catch (err) {
      toast.error("Could not reject plan", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setDecisionLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl pb-20">
      <Link href="/agent-runs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Back to Agent Runs
      </Link>

      {loading ? (
        <Skeleton className="h-64" />
      ) : error || !run ? (
        <p className="text-sm text-destructive">{error || "Run not found."}</p>
      ) : (
        <>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">Rescue #{run.id}</h1>
                <Badge className="bg-gradient-brand text-white border-0 capitalize">{run.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{run.disruption_summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(run.started_at + "Z").toLocaleString()} &middot; {run.execution_ms} ms &middot;{" "}
                {run.candidates_generated} candidates generated, {run.candidates_valid} valid
              </p>
            </div>
            {run.status === "proposed" && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={handleReject} disabled={decisionLoading}>
                  <ThumbsDown className="size-4" />
                  Reject
                </Button>
                <Button onClick={handleApprove} disabled={decisionLoading}>
                  {decisionLoading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Approve
                </Button>
              </div>
            )}
          </div>

          {run.status === "infeasible" ? (
            <div className="rounded-lg border border-status-blocked/40 bg-status-blocked/5 p-5 space-y-3">
              <p className="font-semibold text-status-blocked">No conflict-free rescue plan found.</p>
              <p className="text-sm text-muted-foreground">{run.explanation}</p>
              {run.blocking_constraints.length > 0 && (
                <ul className="text-sm list-disc pl-5 space-y-1 text-muted-foreground">
                  {run.blocking_constraints.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              {run.plans.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Candidate Plans</h2>
                  <PlanComparison plans={run.plans} selectedId={activePlanId} onSelect={setSelectedPlanId} />
                </div>
              )}

              {activePlan && (
                <>
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {activePlan.label} Schedule
                    </h2>
                    <Card className="py-0 overflow-hidden">
                      <CardContent className="p-0 divide-y divide-border">
                        {[...activePlan.assignments]
                          .sort((a, b) => a.start.localeCompare(b.start))
                          .map((a) => (
                            <div key={a.scene_id} className="flex items-center justify-between px-4 py-3 text-sm">
                              <div className="min-w-0">
                                <span className="font-medium">SC {a.scene_number}</span>{" "}
                                <span className="text-muted-foreground">{a.title}</span>
                              </div>
                              <span className="tabular-nums text-muted-foreground shrink-0">
                                {to12h(a.start)} to {to12h(a.end)}
                              </span>
                            </div>
                          ))}
                        {activePlan.dropped_scenes.length > 0 && (
                          <div className="px-4 py-3 text-sm text-status-blocked">
                            Moved to another day: SC {activePlan.dropped_scenes.join(", SC ")}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {activePlan.impact && (
                    <div className="space-y-3">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Impact</h2>
                      <ImpactCards impact={activePlan.impact} />
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Why this plan?</h2>
                <p className="text-sm leading-relaxed text-foreground/90">{run.explanation}</p>
              </div>
            </>
          )}

          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Agent Trace</h2>
            <Card>
              <CardContent>
                <AgentActivityTimeline actions={run.actions} revealedCount={run.actions.length} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
