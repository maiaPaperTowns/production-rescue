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
  /** True only for the genuine cold-start case: no production exists yet. */
  noProduction: boolean;
  /** True when a production exists but has no shooting days yet. */
  noShootingDay: boolean;
  refresh: () => void;
}

const ProductionContext = createContext<ProductionContextValue | null>(null);

export function ProductionProvider({ children }: { children: React.ReactNode }) {
  const [production, setProduction] = useState<Production | null>(null);
  const [currentDay, setCurrentDay] = useState<ShootingDay | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noProduction, setNoProduction] = useState(false);
  const [noShootingDay, setNoShootingDay] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoProduction(false);
    setNoShootingDay(false);
    try {
      const productions = await api.listProductions();
      const prod = productions[0];
      if (!prod) {
        setNoProduction(true);
        return;
      }
      setProduction(prod);

      const days = await api.listShootingDays(prod.id);
      const day = days.find((d) => d.day_number === prod.current_day_number) ?? days[0];
      if (!day) {
        setNoShootingDay(true);
        return;
      }
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
      value={{ production, currentDay, schedule, loading, error, noProduction, noShootingDay, refresh: () => setTick((t) => t + 1) }}
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
