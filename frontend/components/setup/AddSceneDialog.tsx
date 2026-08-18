"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Clapperboard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type { Actor, Equipment, LocationResource } from "@/types";

export function AddSceneDialog({ shootingDayId, onCreated }: { shootingDayId: number; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [actors, setActors] = useState<Actor[]>([]);
  const [locations, setLocations] = useState<LocationResource[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);

  const [sceneNumber, setSceneNumber] = useState("");
  const [title, setTitle] = useState("");
  const [intExt, setIntExt] = useState<"INT" | "EXT">("INT");
  const [locationId, setLocationId] = useState<string>("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [weatherDry, setWeatherDry] = useState(false);
  const [daylightRequired, setDaylightRequired] = useState(false);
  const [priority, setPriority] = useState("3");
  const [castIds, setCastIds] = useState<Set<number>>(new Set());
  const [equipmentIds, setEquipmentIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    Promise.all([api.listActors(), api.listLocations(), api.listEquipment()])
      .then(([a, l, e]) => {
        setActors(a);
        setLocations(l);
        setEquipment(e);
      })
      .catch(() => toast.error("Could not load actors/locations/equipment"));
  }, [open]);

  function toggle(set: Set<number>, id: number, setter: (s: Set<number>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  function reset() {
    setSceneNumber("");
    setTitle("");
    setIntExt("INT");
    setLocationId("");
    setStart("09:00");
    setEnd("10:00");
    setWeatherDry(false);
    setDaylightRequired(false);
    setPriority("3");
    setCastIds(new Set());
    setEquipmentIds(new Set());
  }

  async function submit() {
    if (!sceneNumber.trim() || !title.trim() || !locationId) return;
    setLoading(true);
    try {
      await api.createScene(shootingDayId, {
        scene_number: sceneNumber.trim(), title: title.trim(), int_ext: intExt, location_id: Number(locationId),
        start, end, weather_requirement: weatherDry ? "dry" : null, daylight_required: daylightRequired,
        priority: Number(priority), actor_ids: [...castIds], equipment_ids: [...equipmentIds],
      });
      toast.success(`Scene ${sceneNumber.trim()} added to today's schedule`);
      reset();
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error("Could not add scene", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Clapperboard className="size-4" />
        Add Scene
      </Button>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Scene</DialogTitle>
          <DialogDescription>Adds directly to today&apos;s active shooting schedule.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <Label htmlFor="scene-number">Scene #</Label>
              <Input id="scene-number" value={sceneNumber} onChange={(e) => setSceneNumber(e.target.value)} placeholder="12" autoFocus />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="scene-title">Title</Label>
              <Input id="scene-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Riverside confrontation" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Interior / Exterior</Label>
              <Select value={intExt} onValueChange={(v) => setIntExt((v ?? "INT") as "INT" | "EXT")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INT">Interior</SelectItem>
                  <SelectItem value="EXT">Exterior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={(v) => setLocationId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="scene-start">Start</Label>
              <Input id="scene-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scene-end">End</Label>
              <Input id="scene-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v ?? "3")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((p) => (
                  <SelectItem key={p} value={String(p)}>{p} {p === 5 ? "(critical)" : p === 1 ? "(low)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={weatherDry} onChange={(e) => setWeatherDry(e.target.checked)} className="size-4 rounded accent-primary" />
              Requires dry weather
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={daylightRequired} onChange={(e) => setDaylightRequired(e.target.checked)} className="size-4 rounded accent-primary" />
              Requires daylight
            </label>
          </div>

          <div className="space-y-1.5">
            <Label>Cast</Label>
            <div className="flex flex-wrap gap-1.5">
              {actors.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(castIds, a.id, setCastIds)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    castIds.has(a.id) ? "bg-gradient-brand text-white border-transparent" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {a.name}
                </button>
              ))}
              {actors.length === 0 && <p className="text-xs text-muted-foreground">No actors yet, add some on the Cast page.</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Equipment</Label>
            <div className="flex flex-wrap gap-1.5">
              {equipment.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggle(equipmentIds, e.id, setEquipmentIds)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    equipmentIds.has(e.id) ? "bg-gradient-brand text-white border-transparent" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {e.name}
                </button>
              ))}
              {equipment.length === 0 && <p className="text-xs text-muted-foreground">No equipment yet, add some on the Equipment page.</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!sceneNumber.trim() || !title.trim() || !locationId || loading} className="w-full justify-center">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add Scene
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
