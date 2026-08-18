"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { AgentRun } from "@/types";

export type RescuePhase = "closed" | "input" | "running" | "results" | "decided";

const REVEAL_INTERVAL_MS = 160;

/**
 * Drives the disruption-report -> analysis -> approval flow. Extracted from a
 * single trigger button so multiple surfaces (the hero CTA, the AI panel's
 * quick-ask input, the plain "Report Disruption" button) can all open the
 * same flow against the same shooting day.
 */
export function useRescueFlow(shootingDayId: number, onScheduleChanged: () => void) {
  const [phase, setPhase] = useState<RescuePhase>("closed");
  const [run, setRun] = useState<AgentRun | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);

  function openInput() {
    setPhase("input");
  }

  async function submitText(text: string) {
    setPhase("running");
    setRevealedCount(0);
    setAnalyzeError(null);
    try {
      const result = await api.analyzeRescue(shootingDayId, text);
      setRun(result);
      setSelectedPlanId(result.recommended_schedule_version_id);
    } catch (err) {
      setAnalyzeError(err instanceof ApiError ? err.message : "Rescue analysis failed unexpectedly.");
      setPhase("input");
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
    setRun(null);
    setRevealedCount(0);
    setSelectedPlanId(null);
    setDecision(null);
    setAnalyzeError(null);
  }

  async function approve() {
    if (!run || !selectedPlanId) return;
    setDecisionLoading(true);
    try {
      await api.approveRescue(run.id, "Maia Le");
      setDecision("approved");
      setPhase("decided");
      onScheduleChanged();
      toast.success("Rescue plan approved", { description: "Schedule updated and decision recorded in the audit log." });
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
    phase, run, revealedCount, selectedPlanId, setSelectedPlanId, analyzeError, decisionLoading, decision,
    selectedPlan, openInput, submitText, reset, approve, reject,
  };
}

export type RescueFlowState = ReturnType<typeof useRescueFlow>;
