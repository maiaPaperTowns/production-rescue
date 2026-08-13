export type SceneDisplayStatus = "ready" | "at_risk" | "blocked" | "completed";

export function assignmentDisplayStatus(status: string): SceneDisplayStatus {
  switch (status) {
    case "dropped":
      return "blocked";
    case "delayed":
      return "at_risk";
    default:
      return "ready";
  }
}

export const sceneStatusMeta: Record<SceneDisplayStatus, { label: string; dot: string; text: string; bg: string; border: string }> = {
  ready: {
    label: "Ready",
    dot: "bg-status-ready",
    text: "text-status-ready",
    bg: "bg-status-ready/10",
    border: "border-status-ready/30",
  },
  at_risk: {
    label: "At Risk",
    dot: "bg-status-at-risk",
    text: "text-status-at-risk",
    bg: "bg-status-at-risk/10",
    border: "border-status-at-risk/30",
  },
  blocked: {
    label: "Blocked",
    dot: "bg-status-blocked",
    text: "text-status-blocked",
    bg: "bg-status-blocked/10",
    border: "border-status-blocked/30",
  },
  completed: {
    label: "Completed",
    dot: "bg-status-completed",
    text: "text-status-completed",
    bg: "bg-status-completed/10",
    border: "border-status-completed/30",
  },
};

export function dayStatusMeta(status: string): { label: string; dot: string } {
  switch (status) {
    case "at_risk":
      return { label: "Production At Risk", dot: "bg-status-at-risk" };
    case "blocked":
      return { label: "Production Blocked", dot: "bg-status-blocked" };
    default:
      return { label: "Production On Track", dot: "bg-status-ready" };
  }
}

export const disruptionTypeMeta: Record<string, { label: string; icon: string }> = {
  weather: { label: "Weather", icon: "⛈" },
  actor_availability: { label: "Cast", icon: "🎭" },
  equipment_delay: { label: "Equipment", icon: "🎥" },
  location_unavailable: { label: "Location", icon: "📍" },
};
