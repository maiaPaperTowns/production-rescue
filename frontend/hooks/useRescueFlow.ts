"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { AgentRun, ApprovalResult, DisruptionExtractionResult } from "@/types";

export type RescuePhase = "closed" | "input" | "confirming" | "running" | "results" | "decided";
export type ResultsView = "summary" | "review";

const REVEAL_INTERVAL_MS = 160;

/**
 * Drives the disruption-report -> confirm -> analysis -> approval flow.
 * Extracted from a single trigger button so multiple surfaces (the hero CTA,
 * the AI panel's quick-ask input, the plain "Report Disruption" button) can
 * all open the same flow against the same shooting day.
 */
export function useRescueFlow(shootingDayId: number, onScheduleChanged: () => void) {
  const [phase, setPhase] = useState<RescuePhase>("closed");
  const [pendingText, setPendingText] = useState("");
  const [parsed, setParsed] = useState<DisruptionExtractionResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [resultsView, setResultsView] = useState<ResultsView>("summary");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [approveResult, setApproveResult] = useState<ApprovalResult | null>(null);

  function openInput() {
    setPhase("input");
  }

  /** Step 1: parse the raw text into structured disruptions and let the user confirm before running the full analysis. */
  async function submitText(text: string) {
    setPendingText(text);
    setPhase("confirming");
    setParseError(null);
    try {
      const result = await api.parseDisruption(shootingDayId, text);
      setParsed(result);
    } catch (err) {
      setParseError(err instanceof ApiError ? err.message : "Could not read that disruption.");
      setPhase("input");
    }
  }

  function editParsed() {
    setPhase("input");
  }

  /** Step 2: run the actual rescue analysis against the confirmed text. */
  async function confirmParsed() {
    setPhase("running");
    setRevealedCount(0);
    setResultsView("summary");
    setAnalyzeError(null);
    try {
      const result = await api.analyzeRescue(shootingDayId, pendingText);
      setRun(result);
      setSelectedPlanId(result.recommended_schedule_version_id);
    } catch (err) {
      setAnalyzeError(err instanceof ApiError ? err.message : "Rescue analysis failed unexpectedly.");
      setPhase("input");
    }
  }

  /** Demo shortcut: skip the modal and confirmation, go straight from idle to running. */
  async function runDemoEmergency(text: string) {
    setPendingText(text);
    setPhase("running");
    setRevealedCount(0);
    setResultsView("summary");
    setAnalyzeError(null);
    try {
      const result = await api.analyzeRescue(shootingDayId, text);
      setRun(result);
      setSelectedPlanId(result.recommended_schedule_version_id);
    } catch (err) {
      setAnalyzeError(err instanceof ApiError ? err.message : "Rescue analysis failed unexpectedly.");
      setPhase("closed");
    }
  }

  useEffect(() => {
    if (phase !== "running" || !run) return;
    const total = run.actions.length;
    if (total === 0) {
      setPhase("results");
      return;
    }
    const interval = setInterval(() => {
      setRevealedCount((c) => {
        const next = c + 1;
        if (next >= total) {
          clearInterval(interval);
          setTimeout(() => setPhase("results"), 450);
        }
        return next;
      });
    }, REVEAL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase, run]);

  function reset() {
    setPhase("closed");
    setPendingText("");
    setParsed(null);
    setParseError(null);
    setRun(null);
    setRevealedCount(0);
    setResultsView("summary");
    setSelectedPlanId(null);
    setDecision(null);
    setApproveResult(null);
    setAnalyzeError(null);
  }

  function showReview() {
    setResultsView("review");
  }

  async function approve() {
    if (!run || !selectedPlanId) return;
    setDecisionLoading(true);
    try {
      const result = await api.approveRescue(run.id, "Maia Le");
      setApproveResult(result);
      setDecision("approved");
      setPhase("decided");
      onScheduleChanged();
      toast.success("Rescue plan approved", { description: `Schedule version ${result.new_version_number} is now active.` });
    } catch (err) {
      toast.error("Could not approve plan", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setDecisionLoading(false);
    }
  }

  async function reject() {
    if (!run) return;
    setDecisionLoading(true);
    try {
      await api.rejectRescue(run.id, "Maia Le");
      setDecision("rejected");
      setPhase("decided");
      toast.info("Rescue plan rejected", { description: "The original schedule remains active." });
    } catch (err) {
      toast.error("Could not reject plan", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setDecisionLoading(false);
    }
  }

  const selectedPlan = run?.plans.find((p) => p.schedule_version_id === selectedPlanId) ?? null;

  return {
    phase, pendingText, parsed, parseError, run, revealedCount, resultsView, selectedPlanId, setSelectedPlanId,
    analyzeError, decisionLoading, decision, approveResult, selectedPlan,
    openInput, submitText, editParsed, confirmParsed, runDemoEmergency, showReview, reset, approve, reject,
  };
}

export type RescueFlowState = ReturnType<typeof useRescueFlow>;

/** Coarse, backend-derived workflow state for the status bar and any other summary UI. */
export type RescueWorkflowState =
  | "on_track"
  | "reporting"
  | "confirming_disruption"
  | "analyzing"
  | "plan_ready"
  | "approved"
  | "no_feasible_plan";

export function deriveWorkflowState(flow: RescueFlowState, latestRun: AgentRun | null): RescueWorkflowState {
  if (flow.phase === "input") return "reporting";
  if (flow.phase === "confirming") return "confirming_disruption";
  if (flow.phase === "running") return "analyzing";
  if (flow.phase === "decided") return flow.decision === "approved" ? "approved" : "on_track";
  if (flow.phase === "results" && flow.run) {
    return flow.run.status === "infeasible" ? "no_feasible_plan" : "plan_ready";
  }
  if (latestRun?.status === "proposed") return "plan_ready";
  if (latestRun?.status === "running") return "analyzing";
  if (latestRun?.status === "infeasible") return "no_feasible_plan";
  return "on_track";
}
