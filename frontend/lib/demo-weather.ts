/**
 * Isolated demo-data adapter. Production Rescue has no real weather feed
 * (no partner API for it), so this generates a deterministic, date-seeded
 * forecast for display purposes only. Nothing outside this file should
 * fabricate weather data; every consumer imports from here.
 */

export interface DayForecast {
  label: string;
  condition: "sunny" | "cloudy" | "rain" | "storm";
  high: number;
  low: number;
}

export interface WeatherForecast {
  today: DayForecast;
  upcoming: DayForecast[];
}

const CONDITIONS: DayForecast["condition"][] = ["sunny", "cloudy", "rain", "storm"];

function seededIndex(seed: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % mod;
}

function forecastFor(dateISO: string, dayOffset: number): DayForecast {
  const seed = `${dateISO}:${dayOffset}`;
  const condition = CONDITIONS[seededIndex(seed, CONDITIONS.length)];
  const base = 62 + seededIndex(seed + ":base", 20);
  const date = new Date(dateISO + "T00:00:00");
  date.setDate(date.getDate() + dayOffset);
  return {
    label: dayOffset === 0 ? "Today" : date.toLocaleDateString("en-US", { weekday: "short" }),
    condition,
    high: base,
    low: base - 12,
  };
}

/**
 * `forceStorm` lets the caller reflect a real, currently-active weather
 * disruption (from an actual AgentRun) instead of the seeded placeholder,
 * so the card never contradicts real data when a storm was actually reported.
 */
export function getDemoWeather(dateISO: string, forceStorm = false): WeatherForecast {
  const today = forceStorm
    ? { ...forecastFor(dateISO, 0), condition: "storm" as const }
    : forecastFor(dateISO, 0);
  return {
    today,
    upcoming: [1, 2, 3].map((offset) => forecastFor(dateISO, offset)),
  };
}
