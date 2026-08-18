import { Sun, Cloud, CloudRain, CloudLightning } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getDemoWeather, type DayForecast } from "@/lib/demo-weather";

const CONDITION_META: Record<DayForecast["condition"], { icon: typeof Sun; label: string; tone: string }> = {
  sunny: { icon: Sun, label: "Clear", tone: "text-status-at-risk" },
  cloudy: { icon: Cloud, label: "Cloudy", tone: "text-muted-foreground" },
  rain: { icon: CloudRain, label: "Rain", tone: "text-brand-blue" },
  storm: { icon: CloudLightning, label: "Storm", tone: "text-status-blocked" },
};

export function WeatherCard({ shootDate, activeWeatherDisruption }: { shootDate: string; activeWeatherDisruption: boolean }) {
  const forecast = getDemoWeather(shootDate, activeWeatherDisruption);
  const meta = CONDITION_META[forecast.today.condition];
  const Icon = meta.icon;

  return (
    <Card className="py-0">
      <CardHeader className="pt-5">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Weather Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-5 space-y-4">
        <div className={cn("rounded-xl p-4 flex items-center gap-3", activeWeatherDisruption ? "bg-coral/15" : "bg-surface-lavender")}>
          <Icon className={cn("size-8", meta.tone)} strokeWidth={1.75} />
          <div>
            <p className="text-2xl font-semibold tabular-nums">{forecast.today.high}&deg;</p>
            <p className="text-xs text-muted-foreground">{meta.label} &middot; low {forecast.today.low}&deg;</p>
          </div>
        </div>
        {activeWeatherDisruption && (
          <p className="text-xs text-status-blocked font-medium">Active weather disruption reported for today&apos;s shoot.</p>
        )}
        <div className="flex items-center justify-between gap-2">
          {forecast.upcoming.map((d) => {
            const m = CONDITION_META[d.condition];
            const DIcon = m.icon;
            return (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1 text-center">
                <span className="text-[11px] text-muted-foreground">{d.label}</span>
                <DIcon className={cn("size-4", m.tone)} strokeWidth={1.75} />
                <span className="text-xs font-medium tabular-nums">{d.high}&deg;</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
