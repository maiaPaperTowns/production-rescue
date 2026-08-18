"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

export function AddActorDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [dayRate, setDayRate] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setName("");
    setRole("");
    setDayRate("");
  }

  async function submit() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await api.createActor({ name: name.trim(), role: role.trim(), day_rate: dayRate ? Number(dayRate) : 0 });
      toast.success(`${name.trim()} added to cast`);
      reset();
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error("Could not add actor", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add Actor
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Actor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="actor-name">Name</Label>
            <Input id="actor-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maya Chen" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="actor-role">Role</Label>
            <Input id="actor-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Lead - Detective Reyes" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="actor-rate">Day rate ($)</Label>
            <Input id="actor-rate" type="number" min={0} value={dayRate} onChange={(e) => setDayRate(e.target.value)} placeholder="15000" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!name.trim() || loading} className="w-full justify-center">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add Actor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
