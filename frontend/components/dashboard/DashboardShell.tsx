"use client";

import { useProduction } from "@/lib/production-context";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { LoadingScreen } from "@/components/brand/LoadingScreen";
import { CreateProductionScreen, CreateFirstShootingDayScreen } from "@/components/setup/ProductionSetupScreen";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { loading, production, noProduction, noShootingDay } = useProduction();

  if (loading && !production && !noProduction && !noShootingDay) {
    return <LoadingScreen />;
  }

  if (noProduction) {
    return <CreateProductionScreen />;
  }

  if (noShootingDay && production) {
    return <CreateFirstShootingDayScreen productionId={production.id} />;
  }

  return (
    <div className="flex flex-1 min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
