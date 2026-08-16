"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Clock3, DollarSign, TrendingUp, Percent } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { disruptionTypeMeta } from "@/lib/status";
import { formatCurrency, formatDateShort } from "@/lib/format";

const CHART_COLOR = "oklch(0.66 0.19 293)";

export default function AnalyticsPage() {
  const { data, loading, error } = useAsync(() => api.getAnalytics(), []);

  const disruptionData = data
    ? Object.entries(data.disruptions_by_type).map(([type, count]) => ({
        name: disruptionTypeMeta[type]?.label ?? type,
        count,
      }))
    : [];

  const hoursSavedData = data
    ? data.hours_saved_series.map((d) => ({ date: formatDateShort(d.date), hours: d.hours_saved }))
    : [];

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Operational impact of Production Rescue across this production.</p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : error || !data ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Rescue Events" value={String(data.rescue_events)} icon={Activity} />
            <StatCard label="Hours Saved" value={`${data.production_hours_saved}`} sublabel="production hours" icon={Clock3} />
            <StatCard label="Cost Avoided" value={formatCurrency(data.estimated_cost_avoided)} icon={DollarSign} />
            <StatCard label="Most Common Disruption" value={disruptionTypeMeta[data.most_common_disruption]?.label ?? data.most_common_disruption} icon={TrendingUp} />
            <StatCard label="Success Rate" value={`${data.rescue_success_rate}%`} sublabel={`avg response ${data.average_response_time_ms} ms`} icon={Percent} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">Disruptions by Type</h2>
                {disruptionData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">No disruptions recorded yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={disruptionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="count" fill={CHART_COLOR} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">Production Hours Saved</h2>
                {hoursSavedData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">No approved rescues yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={hoursSavedData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      />
                      <Line type="monotone" dataKey="hours" stroke={CHART_COLOR} strokeWidth={2.5} dot={{ fill: CHART_COLOR, r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
