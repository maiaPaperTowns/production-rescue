"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Zap, CloudLightning, Drama, Video, MapPinOff } from "lucide-react";

const DEMO_EMERGENCY_TEXT =
  "Thunderstorms are expected 11am-5pm and Maya must leave by 2pm. Camera B delivery is delayed until 3pm.";

const SHORTCUTS: { label: string; icon: React.ElementType; text: string }[] = [
  { label: "Thunderstorm", icon: CloudLightning, text: "Thunderstorms are expected this afternoon, from 11am to 5pm." },
  { label: "Actor unavailable", icon: Drama, text: "Our lead actor Maya needs to leave the set by 2pm today." },
  { label: "Equipment delayed", icon: Video, text: "Camera B's delivery has been delayed and won't arrive until 3pm." },
  { label: "Location lost", icon: MapPinOff, text: "We've lost access to Riverside Park for today's shoot." },
];

export function DisruptionInputModal({
  open,
  onOpenChange,
  onSubmit,
  errorMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (text: string) => void;
  errorMessage?: string | null;
}) {
  const [text, setText] = useState("");

  function submit(value: string) {
    if (!value.trim()) return;
    onSubmit(value.trim());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>What&apos;s changed?</DialogTitle>
          <DialogDescription>
            Tell Production Rescue what happened. It will identify affected scenes and propose a rescue plan for
            today&apos;s shoot.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          placeholder="Tell Production Rescue what happened..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          autoFocus
        />
        {errorMessage && (
          <p className="text-sm text-destructive">{errorMessage} Your message was preserved, try again.</p>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Demo shortcuts</p>
          <div className="flex flex-wrap gap-2">
            {SHORTCUTS.map((s) => (
              <Button key={s.label} type="button" variant="outline" size="sm" onClick={() => setText(s.text)}>
                <s.icon className="size-3.5" />
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2 sm:gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-center border border-dashed border-primary/40"
            onClick={() => submit(DEMO_EMERGENCY_TEXT)}
          >
            <Zap className="size-4" />
            Simulate Demo Emergency
          </Button>
          <Button type="button" className="w-full justify-center" disabled={!text.trim()} onClick={() => submit(text)}>
            Analyze Disruption
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
