import { CloudLightning, Drama, Video, MapPinOff, Info, type LucideIcon } from "lucide-react";
import type { DisruptionItem } from "@/types";

export interface DisruptionTag {
  icon: LucideIcon;
  label: string;
  detail: string;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Turns one structured disruption item (from /api/disruptions/parse) into a display tag. */
export function disruptionItemTag(item: DisruptionItem): DisruptionTag {
  switch (item.type) {
    case "weather":
      return {
        icon: CloudLightning,
        label: item.condition ? capitalize(item.condition) : "Weather",
        detail:
          item.start_time && item.end_time
            ? `${item.start_time}–${item.end_time}, affects exterior scenes`
            : "Affects exterior scenes",
      };
    case "actor_availability":
      return {
        icon: Drama,
        label: item.actor ?? "Cast",
        detail: item.available_until
          ? `Unavailable after ${item.available_until}`
          : item.available_from
            ? `Unavailable until ${item.available_from}`
            : "Availability changed",
      };
    case "equipment_delay":
      return {
        icon: Video,
        label: item.equipment ?? "Equipment",
        detail: item.available_after ? `Delayed until ${item.available_after}` : "Delayed",
      };
    case "location_unavailable":
      return {
        icon: MapPinOff,
        label: item.location ?? "Location",
        detail:
          item.unavailable_start && item.unavailable_end
            ? `Unavailable ${item.unavailable_start}–${item.unavailable_end}`
            : "Unavailable",
      };
  }
}

const KEYWORD_TAGS: { icon: LucideIcon; label: string; pattern: RegExp }[] = [
  { icon: CloudLightning, label: "Weather", pattern: /storm|thunder|rain|weather|wind/i },
  { icon: Drama, label: "Cast", pattern: /leave|unavailable|actor|cast|actress/i },
  { icon: Video, label: "Equipment", pattern: /camera|equipment|gear|delay(ed)?|drone|rig/i },
  { icon: MapPinOff, label: "Location", pattern: /location|park|stage|street|access|venue/i },
];

/**
 * Best-effort categorization of a free-text disruption summary (the only form
 * an AgentRun persists). Purely a presentational hint over real text already
 * returned by the backend, not a source of new facts.
 */
export function tagsFromSummary(summary: string): { icon: LucideIcon; label: string }[] {
  const seen = new Set<string>();
  const tags: { icon: LucideIcon; label: string }[] = [];
  for (const { icon, label, pattern } of KEYWORD_TAGS) {
    if (pattern.test(summary) && !seen.has(label)) {
      seen.add(label);
      tags.push({ icon, label });
    }
  }
  return tags;
}

/** Single icon + short label to prefix a real change_reason string, e.g. turning
 * "Maya Chen is unavailable for the original 14:00-16:00 slot" into a 🎭 chip. */
export function reasonChip(reason: string): { icon: LucideIcon; label: string } {
  for (const { icon, label, pattern } of KEYWORD_TAGS) {
    if (pattern.test(reason)) return { icon, label };
  }
  return { icon: Info, label: "Reason" };
}
