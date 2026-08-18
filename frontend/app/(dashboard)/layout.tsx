import { ProductionProvider } from "@/lib/production-context";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductionProvider>
      <DashboardShell>{children}</DashboardShell>
    </ProductionProvider>
  );
}
