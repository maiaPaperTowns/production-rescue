"use client";

import { X, Zap, CheckCircle2, ThumbsDown, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { DisruptionInputModal } from "@/components/rescue/DisruptionInputModal";
import { AgentActivityTimeline } from "@/components/agents/AgentActivityTimeline";
import { BeforeAfterPanel } from "@/components/rescue/BeforeAfterPanel";
import { ImpactCards } from "@/components/rescue/ImpactCards";
import { PlanComparison } from "@/components/rescue/PlanComparison";
import { ParsedDisruptionReview } from "@/components/rescue/ParsedDisruptionReview";
import { PlanReadySummary } from "@/components/rescue/PlanReadySummary";
import { Mascot } from "@/components/brand/Mascot";
import { useRescueFlow, type RescueFlowState } from "@/hooks/useRescueFlow";
import type { Assignment } from "@/types";

/**
 * Full-screen overlay (input modal + confirm/running/results/decided panel)
 * for a rescue flow driven by useRescueFlow. Mount this once per page
 * alongside whichever trigger(s) call flow.openInput() / flow.submitText().
 */
export function RescueFlowOverlay({ flow, originalAssignments }: {
  flow: RescueFlowState;
  originalAssignments: Assignment[];
}) {
  const {
    phase, run, revealedCount, resultsView, selectedPlanId, setSelectedPlanId,
    analyzeError, parsed, parseError, decisionLoading, decision, approveResult, selectedPlan,
  } = flow;

  return (
    <>
      <DisruptionInputModal
        open={phase === "input"}
        onOpenChange={(o) => !o && flow.reset()}
        onSubmit={flow.submitText}
        errorMessage={analyzeError || parseError}
      />

      {(phase === "confirming" || phase === "running" || phase === "results" || phase === "decided") && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between h-14 shrink-0 border-b border-border px-6">
            <span className="text-sm font-semibold">
              {phase === "confirming" ? "Confirm Disruption" : "Rescue Analysis"}
            </span>
            {phase !== "running" && (
              <Button variant="ghost" size="icon" onClick={flow.reset}>
                <X className="size-4" />
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {phase === "confirming" &&
              (parsed ? (
                <ParsedDisruptionReview parsed={parsed} onConfirm={flow.confirmParsed} onEdit={flow.editParsed} />
              ) : (
                <div className="py-24 flex justify-center">
                  <Mascot pose="listening" size={64} />
                </div>
              ))}

            {phase === "running" && (
              <div className="py-16 px-6">
                {run ? (
                  <AgentActivityTimeline actions={run.actions} revealedCount={revealedCount} />
                ) : (
                  <div className="max-w-xl mx-auto flex items-center gap-3">
                    <Mascot pose="analyzing" size={44} />
                    <div>
                      <h2 className="font-display text-xl font-bold tracking-tight">
                        I&apos;m checking the production plan.
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Cross-checking cast, locations, equipment, and weather against today&apos;s schedule.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {phase === "results" && run && resultsView === "summary" && (
              <PlanReadySummary run={run} onReview={flow.showReview} />
            )}

            {((phase === "results" && resultsView === "review") || phase === "decided") && run && (
              <div className="max-w-5xl mx-auto px-6 py-8 space-y-8 pb-28">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Disruption reported</p>
                    <p className="mt-1 text-lg font-medium">{run.disruption_summary}</p>
                  </div>
                  {phase === "results" && (
                    <Button variant="ghost" size="sm" className="gap-1.5 shrink-0" onClick={() => flow.showReview()}>
                      <ArrowLeft className="size-3.5" />
                      Back to summary
                    </Button>
                  )}
                </div>

                {run.status === "infeasible" ? (
                  <div className="rounded-lg border border-status-blocked/40 bg-status-blocked/5 p-5 space-y-3">
                    <p className="font-semibold text-status-blocked">I couldn&apos;t find a conflict-free plan.</p>
                    <p className="text-sm text-muted-foreground">{run.explanation}</p>
                    {run.blocking_constraints.length > 0 && (
                      <>
                        <p className="text-sm font-medium">Here&apos;s what&apos;s blocking production:</p>
                        <ul className="text-sm list-disc pl-5 space-y-1 text-muted-foreground">
                          {run.blocking_constraints.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ) : selectedPlan ? (
                  <Tabs defaultValue="plan">
                    <TabsList>
                      <TabsTrigger value="plan">Before / After</TabsTrigger>
                      <TabsTrigger value="alternatives">Alternatives ({run.plans.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="plan" className="space-y-8 pt-4">
                      <BeforeAfterPanel
                        original={originalAssignments}
                        proposed={selectedPlan}
                        affectedSceneIds={run.affected_scene_ids}
                      />
                      {selectedPlan.impact && (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Impact Summary</p>
                          <ImpactCards impact={selectedPlan.impact} />
                        </div>
                      )}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this works</p>
                        <p className="text-sm leading-relaxed text-foreground/90">{run.explanation}</p>
                      </div>
                    </TabsContent>
                    <TabsContent value="alternatives" className="pt-4 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Rather than a single arbitrary answer, Production Rescue evaluates every feasible schedule
                        and ranks the top candidates.
                      </p>
                      <PlanComparison plans={run.plans} selectedId={selectedPlanId} onSelect={setSelectedPlanId} />
                    </TabsContent>
                  </Tabs>
                ) : null}

                {phase === "decided" && decision && (
                  <div className="rounded-lg border border-status-ready/40 bg-status-ready/5 p-5 flex items-start gap-3">
                    <Mascot pose="celebrating" size={44} className="shrink-0" />
                    <div className="text-sm space-y-2">
                      <p className="font-semibold text-base">
                        {decision === "approved" ? "We're rolling. 🎬" : "Rescue plan rejected"}
                      </p>
                      {decision === "approved" && approveResult ? (
                        <ul className="space-y-1 text-muted-foreground">
                          <li className="flex items-center gap-1.5">
                            <CheckCircle2 className="size-3.5 text-status-ready shrink-0" />
                            Schedule version {approveResult.new_version_number} created
                          </li>
                          <li className="flex items-center gap-1.5">
                            <CheckCircle2 className="size-3.5 text-status-ready shrink-0" />
                            {approveResult.assignments_updated} scene assignment{approveResult.assignments_updated === 1 ? "" : "s"} updated
                          </li>
                          <li className="flex items-center gap-1.5">
                            <CheckCircle2 className="size-3.5 text-status-ready shrink-0" />
                            Decision added to the audit log
                          </li>
                        </ul>
                      ) : (
                        <p className="text-muted-foreground">
                          The original schedule remains active. Decision recorded in the audit log.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {phase === "results" && resultsView === "review" && run && run.status !== "infeasible" && (
            <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur px-6 py-4">
              <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4 text-primary shrink-0" />
                  Nothing changes until you approve it.
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" onClick={flow.reject} disabled={decisionLoading} className="gap-2">
                    <ThumbsDown className="size-4" />
                    Reject
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                  <Button onClick={flow.approve} disabled={decisionLoading} className="gap-2">
                    {decisionLoading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Approve Rescue Plan
                  </Button>
                </div>
              </div>
            </div>
          )}

          {phase === "decided" && (
            <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur px-6 py-4">
              <div className="max-w-5xl mx-auto flex justify-end">
                <Button onClick={flow.reset}>Done</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Simple standalone trigger + overlay, for pages that only need one entry point. */
export function RescueButton({ shootingDayId, originalAssignments, onScheduleChanged }: {
  shootingDayId: number;
  originalAssignments: Assignment[];
  onScheduleChanged: () => void;
}) {
  const flow = useRescueFlow(shootingDayId, onScheduleChanged);

  return (
    <>
      <Button size="lg" className="gap-2" onClick={flow.openInput}>
        <Zap className="size-4" />
        Report Disruption
      </Button>
      <RescueFlowOverlay flow={flow} originalAssignments={originalAssignments} />
    </>
  );
}
