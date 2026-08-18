"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

export function AddShootingDayDialog({
  productionId,
  suggestedDayNumber,
  onCreated,
}: {
  productionId: number;
  suggestedDayNumber: number;
  onCreated: (newDayId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dayNumber, setDayNumber] = useState(String(suggestedDayNumber));
  const [shootDate, setShootDate] = useState("");
  const [dayStart, setDayStart] = useState("07:00");
  const [dayEnd, setDayEnd] = useState("21:00");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!shootDate || !dayNumber) return;
    setLoading(true);
    try {
      const day = await api.createShootingDay(productionId, {
        day_number: Number(dayNumber), shoot_date: shootDate, day_start: dayStart, day_end: dayEnd,
      });
      toast.success(`Shooting Day ${dayNumber} created`);
      setOpen(false);
      onCreated(day.id);
    } catch (err) {
      toast.error("Could not create shooting day", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setDayNumber(String(suggestedDayNumber)); }}>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" />
        New Shooting Day
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Shooting Day</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="day-number">Day number</Label>
            <Input id="day-number" type="number" min={1} value={dayNumber} onChange={(e) => setDayNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shoot-date">Shoot date</Label>
            <Input id="shoot-date" type="date" value={shootDate} onChange={(e) => setShootDate(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="day-start">Call time</Label>
              <Input id="day-start" type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="day-end">Wrap time</Label>
              <Input id="day-end" type="time" value={dayEnd} onChange={(e) => setDayEnd(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!shootDate || loading} className="w-full justify-center">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
            Create Shooting Day
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
