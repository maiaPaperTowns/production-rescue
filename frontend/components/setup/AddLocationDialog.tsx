"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";

export function AddLocationDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("exterior");
  const [address, setAddress] = useState("");
  const [permitRequired, setPermitRequired] = useState(false);
  const [loading, setLoading] = useState(false);

  function reset() {
    setName("");
    setType("exterior");
    setAddress("");
    setPermitRequired(false);
  }

  async function submit() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await api.createLocation({ name: name.trim(), location_type: type, address: address.trim(), permit_required: permitRequired });
      toast.success(`${name.trim()} added`);
      reset();
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error("Could not add location", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add Location
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Location</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="loc-name">Name</Label>
            <Input id="loc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Riverside Park" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v ?? "exterior")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exterior">Exterior</SelectItem>
                <SelectItem value="interior">Interior</SelectItem>
                <SelectItem value="stage">Stage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loc-address">Address</Label>
            <Input id="loc-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Bank St" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={permitRequired} onChange={(e) => setPermitRequired(e.target.checked)} className="size-4 rounded accent-primary" />
            Permit required
          </label>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!name.trim() || loading} className="w-full justify-center">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
