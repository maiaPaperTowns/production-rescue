import { ProductionProvider } from "@/lib/production-context";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductionProvider>
      <div className="flex flex-1 min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </ProductionProvider>
  );
}
