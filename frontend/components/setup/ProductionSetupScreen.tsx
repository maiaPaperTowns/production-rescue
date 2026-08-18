"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Rocket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mascot } from "@/components/brand/Mascot";
import { api, ApiError } from "@/lib/api";
import { useProduction } from "@/lib/production-context";
import type { Production } from "@/types";

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <Mascot pose="celebrating" size={88} />
        </div>
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Card className="text-left">
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}

export function CreateProductionScreen() {
  const { refresh } = useProduction();
  const [name, setName] = useState("");
  const [totalDays, setTotalDays] = useState("1");
  const [dailyBudget, setDailyBudget] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const production: Production = await api.createProduction({
        name: name.trim(), total_shooting_days: Number(totalDays) || 1, daily_budget: dailyBudget ? Number(dailyBudget) : 0,
      });
      toast.success(`${production.name} created`);
      refresh();
    } catch (err) {
      toast.error("Could not create production", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title="Welcome to Production Rescue" subtitle="No production exists yet. Start by creating one, you can add cast, locations, equipment, and scenes next.">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="prod-name">Production name</Label>
          <Input id="prod-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Project Aurora" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="prod-days">Total shooting days</Label>
            <Input id="prod-days" type="number" min={1} value={totalDays} onChange={(e) => setTotalDays(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prod-budget">Daily budget ($)</Label>
            <Input id="prod-budget" type="number" min={0} value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} placeholder="120000" />
          </div>
        </div>
        <Button onClick={submit} disabled={!name.trim() || loading} className="w-full justify-center mt-2">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
          Create Production
        </Button>
      </div>
    </Shell>
  );
}

export function CreateFirstShootingDayScreen({ productionId }: { productionId: number }) {
  const { refresh } = useProduction();
  const [shootDate, setShootDate] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!shootDate) return;
    setLoading(true);
    try {
      await api.createShootingDay(productionId, { day_number: 1, shoot_date: shootDate });
      toast.success("Shooting Day 1 created");
      refresh();
    } catch (err) {
      toast.error("Could not create shooting day", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title="Set your first shooting day" subtitle="This production has no shooting days yet. Add one to start building the schedule.">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="first-shoot-date">Shoot date</Label>
          <Input id="first-shoot-date" type="date" value={shootDate} onChange={(e) => setShootDate(e.target.value)} autoFocus />
        </div>
        <Button onClick={submit} disabled={!shootDate || loading} className="w-full justify-center mt-2">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
          Create Shooting Day 1
        </Button>
      </div>
    </Shell>
  );
}
