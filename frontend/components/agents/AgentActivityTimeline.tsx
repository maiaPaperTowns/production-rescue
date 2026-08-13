"use client";

import { CheckCircle2, Loader2, Bot } from "lucide-react";
import type { AgentAction } from "@/types";
import { cn } from "@/lib/utils";

export function AgentActivityTimeline({ actions, revealedCount }: { actions: AgentAction[]; revealedCount: number }) {
  const visible = actions.slice(0, Math.min(revealedCount + 1, actions.length));

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-2.5 mb-6">
        <Bot className="size-5 text-primary" strokeWidth={2} />
        <h2 className="text-lg font-semibold">Production Rescue is analyzing the situation</h2>
      </div>
      <ol className="space-y-2.5">
        {visible.map((action, i) => {
          const done = i < revealedCount || revealedCount >= actions.length;
          return (
            <li
              key={action.seq}
              className={cn(
                "flex items-start gap-2.5 text-sm rounded-md px-3 py-2 transition-colors",
                done ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {done ? (
                <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-status-ready" strokeWidth={2} />
              ) : (
                <Loader2 className="size-4 mt-0.5 shrink-0 animate-spin text-primary" strokeWidth={2} />
              )}
              <span>{action.summary}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
