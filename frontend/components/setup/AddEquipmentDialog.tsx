"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

export function AddEquipmentDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await api.createEquipment({ name: name.trim(), category: category.trim() });
      toast.success(`${name.trim()} added`);
      setName("");
      setCategory("");
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error("Could not add equipment", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add Equipment
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Equipment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="eq-name">Name</Label>
            <Input id="eq-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Camera C" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-category">Category</Label>
            <Input id="eq-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="camera" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!name.trim() || loading} className="w-full justify-center">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add Equipment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
