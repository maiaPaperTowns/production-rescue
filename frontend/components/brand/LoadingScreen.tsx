import { Mascot } from "@/components/brand/Mascot";

export function LoadingScreen({ label = "Loading today's production status" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-100 flex flex-col items-center justify-center gap-6 bg-background">
      <div className="animate-bounce [animation-duration:1.6s]">
        <Mascot pose="thinking" size={104} />
      </div>
      <div className="text-center space-y-1.5">
        <p className="font-display text-3xl font-extrabold tracking-tight text-gradient-brand">
          Production Rescue
        </p>
        <p className="text-sm text-muted-foreground">{label}&hellip;</p>
      </div>
    </div>
  );
}
