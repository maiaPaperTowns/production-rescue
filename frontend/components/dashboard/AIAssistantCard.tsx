"use client";

import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/brand/Mascot";
import type { AgentRun } from "@/types";

export function AIAssistantCard({ latestRun, onAsk }: { latestRun: AgentRun | null; onAsk: (text: string) => void }) {
  const [text, setText] = useState("");

  const checklist =
    latestRun?.status === "approved" && latestRun.plans.find((p) => p.recommended)?.impact
      ? (() => {
          const impact = latestRun.plans.find((p) => p.recommended)!.impact!;
          return [
            `${impact.scenes_preserved} of ${impact.scenes_total} scenes preserved`,
            `${impact.downtime_hours_avoided.toFixed(1)}h downtime avoided`,
          ];
        })()
      : [];

  function submit() {
    if (!text.trim()) return;
    onAsk(text.trim());
    setText("");
  }

  return (
    <Card className="py-0">
      <CardHeader className="pt-5">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Production Rescue AI
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-5 space-y-4">
        <div className="flex items-start gap-3">
          <Mascot pose={latestRun?.status === "approved" ? "celebrating" : "idle"} size={44} className="shrink-0" />
          <div className="rounded-2xl rounded-tl-sm bg-surface-lavender px-3.5 py-2.5 text-sm leading-relaxed">
            {latestRun ? (
              <p>{latestRun.explanation || latestRun.disruption_summary}</p>
            ) : (
              <p>Hi, I&apos;m Biscuit. Tell me what changed on set and I&apos;ll find a rescue plan.</p>
            )}
          </div>
        </div>

        {checklist.length > 0 && (
          <ul className="space-y-1.5 pl-1">
            {checklist.map((item) => (
              <li key={item} className="flex items-center gap-2 text-xs text-foreground/80">
                <CheckCircle2 className="size-3.5 text-status-ready shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <Textarea
            placeholder="Tell Biscuit what changed on set..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="resize-none text-sm"
          />
          <Button size="sm" className="w-full justify-center gap-1.5" disabled={!text.trim()} onClick={submit}>
            <Send className="size-3.5" />
            Report Disruption
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
