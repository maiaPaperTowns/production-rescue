import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE_STYLES = {
  neutral: { bg: "bg-card", ring: "border-border", chip: "bg-primary", value: "text-foreground" },
  info: { bg: "bg-surface-lavender", ring: "border-transparent", chip: "bg-primary", value: "text-primary" },
  success: { bg: "bg-mint/40", ring: "border-transparent", chip: "bg-status-ready", value: "text-status-ready" },
  warning: { bg: "bg-butter/35", ring: "border-transparent", chip: "bg-status-at-risk", value: "text-status-at-risk" },
  danger: { bg: "bg-coral/20", ring: "border-transparent", chip: "bg-status-blocked", value: "text-status-blocked" },
} as const;

export function MetricCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
  tone?: keyof typeof TONE_STYLES;
}) {
  const s = TONE_STYLES[tone];
  return (
    <div className={cn("rounded-2xl border p-4 flex items-start justify-between gap-3", s.bg, s.ring)}>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums tracking-tight", s.value)}>{value}</p>
        {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
      </div>
      <div className={cn("rounded-full p-2 shrink-0", s.chip)}>
        <Icon className="size-4 text-white" strokeWidth={2} />
      </div>
    </div>
  );
}
