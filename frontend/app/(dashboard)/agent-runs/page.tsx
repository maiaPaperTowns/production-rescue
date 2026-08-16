"use client";

import Link from "next/link";
import { Bot, ArrowRight } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, timeAgo } from "@/lib/format";

const STATUS_TONE: Record<string, string> = {
  proposed: "bg-status-at-risk/15 text-status-at-risk",
  approved: "bg-status-ready/15 text-status-ready",
  rejected: "bg-muted text-muted-foreground",
  infeasible: "bg-status-blocked/15 text-status-blocked",
  running: "bg-primary/15 text-primary",
  failed: "bg-status-blocked/15 text-status-blocked",
};

export default function AgentRunsPage() {
  const { data: runs, loading, error } = useAsync(() => api.listAgentRuns({ limit: 50 }), []);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agent Runs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every rescue analysis Production Rescue has run, with the full tool-call trace and decision outcome.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : runs?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
          <Bot className="size-8 mb-2" />
          <p className="text-sm">No rescue runs yet. Report a disruption from the Command Center to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs?.map((run) => {
            const recommended = run.plans.find((p) => p.recommended) ?? run.plans[0];
            return (
              <Link key={run.id} href={`/agent-runs/${run.id}`}>
                <Card className="hover:ring-primary/30 transition-all cursor-pointer">
                  <CardContent className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Rescue #{run.id}</span>
                        <Badge className={`border-0 ${STATUS_TONE[run.status] ?? ""}`}>{run.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground max-w-xl">{run.disruption_summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {run.actions.length} agent actions, {run.candidates_generated} candidate schedules,{" "}
                        {run.candidates_valid} valid, {run.execution_ms} ms, {timeAgo(run.started_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">
                        {recommended ? `${recommended.label} ${run.status === "approved" ? "approved" : "recommended"}` : "No plan"}
                      </p>
                      {recommended?.impact && (
                        <p className="text-xs text-status-ready mt-0.5">
                          {formatCurrency(recommended.impact.estimated_cost_avoided)} cost avoided
                        </p>
                      )}
                      <div className="flex items-center justify-end gap-1 text-xs text-primary mt-1">
                        View details <ArrowRight className="size-3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
