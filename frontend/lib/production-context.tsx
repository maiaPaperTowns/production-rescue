"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Production, Schedule, ShootingDay } from "@/types";

interface ProductionContextValue {
  production: Production | null;
  currentDay: ShootingDay | null;
  schedule: Schedule | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const ProductionContext = createContext<ProductionContextValue | null>(null);

export function ProductionProvider({ children }: { children: React.ReactNode }) {
  const [production, setProduction] = useState<Production | null>(null);
  const [currentDay, setCurrentDay] = useState<ShootingDay | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const productions = await api.listProductions();
      const prod = productions[0];
      if (!prod) throw new Error("No production found. Has the database been seeded?");
      setProduction(prod);

      const days = await api.listShootingDays(prod.id);
      const day = days.find((d) => d.day_number === prod.current_day_number) ?? days[0];
      if (!day) throw new Error("Production has no shooting days.");
      setCurrentDay(day);

      const sched = await api.getSchedule(day.id);
      setSchedule(sched);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load production data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, tick]);

  return (
    <ProductionContext.Provider
      value={{ production, currentDay, schedule, loading, error, refresh: () => setTick((t) => t + 1) }}
    >
      {children}
    </ProductionContext.Provider>
  );
}

export function useProduction() {
  const ctx = useContext(ProductionContext);
  if (!ctx) throw new Error("useProduction must be used within a ProductionProvider");
  return ctx;
}
