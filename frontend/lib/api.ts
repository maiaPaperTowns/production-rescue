import type {
  Actor,
  ActorCreateInput,
  Analytics,
  AgentRun,
  ApprovalResult,
  DisruptionExtractionResult,
  Equipment,
  EquipmentCreateInput,
  LocationCreateInput,
  LocationResource,
  Plan,
  Production,
  ProductionCreateInput,
  Schedule,
  Scene,
  SceneCreateInput,
  ShootingDay,
  ShootingDayCreateInput,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Could not reach the Production Rescue backend. Is the API server running?");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ? (typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail)) : detail;
    } catch {
      // response wasn't JSON; keep statusText
    }
    throw new ApiError(res.status, detail);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  listProductions: () => request<Production[]>("/api/productions"),
  getProduction: (id: number) => request<Production>(`/api/productions/${id}`),
  createProduction: (payload: ProductionCreateInput) =>
    request<Production>("/api/productions", { method: "POST", body: JSON.stringify(payload) }),
  listShootingDays: (productionId: number) => request<ShootingDay[]>(`/api/productions/${productionId}/shooting-days`),
  createShootingDay: (productionId: number, payload: ShootingDayCreateInput) =>
    request<ShootingDay>(`/api/productions/${productionId}/shooting-days`, { method: "POST", body: JSON.stringify(payload) }),

  getSchedule: (shootingDayId: number) => request<Schedule>(`/api/shooting-days/${shootingDayId}/schedule`),
  getScene: (sceneId: number) => request<Scene>(`/api/scenes/${sceneId}`),
  createScene: (shootingDayId: number, payload: SceneCreateInput) =>
    request<Scene>(`/api/shooting-days/${shootingDayId}/scenes`, { method: "POST", body: JSON.stringify(payload) }),
  deleteScene: (sceneId: number) => request<void>(`/api/scenes/${sceneId}`, { method: "DELETE" }),

  listActors: () => request<Actor[]>("/api/actors"),
  createActor: (payload: ActorCreateInput) => request<Actor>("/api/actors", { method: "POST", body: JSON.stringify(payload) }),
  deleteActor: (id: number) => request<void>(`/api/actors/${id}`, { method: "DELETE" }),

  listLocations: () => request<LocationResource[]>("/api/locations"),
  createLocation: (payload: LocationCreateInput) =>
    request<LocationResource>("/api/locations", { method: "POST", body: JSON.stringify(payload) }),
  deleteLocation: (id: number) => request<void>(`/api/locations/${id}`, { method: "DELETE" }),

  listEquipment: () => request<Equipment[]>("/api/equipment"),
  createEquipment: (payload: EquipmentCreateInput) =>
    request<Equipment>("/api/equipment", { method: "POST", body: JSON.stringify(payload) }),
  deleteEquipment: (id: number) => request<void>(`/api/equipment/${id}`, { method: "DELETE" }),

  parseDisruption: (shootingDayId: number, rawText: string) =>
    request<DisruptionExtractionResult>("/api/disruptions/parse", {
      method: "POST",
      body: JSON.stringify({ shooting_day_id: shootingDayId, raw_text: rawText }),
    }),

  analyzeRescue: (shootingDayId: number, rawText: string) =>
    request<AgentRun>("/api/rescue/analyze", {
      method: "POST",
      body: JSON.stringify({ shooting_day_id: shootingDayId, raw_text: rawText }),
    }),

  getAgentRun: (runId: number) => request<AgentRun>(`/api/agent-runs/${runId}`),
  listAgentRuns: (params?: { shootingDayId?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.shootingDayId) q.set("shooting_day_id", String(params.shootingDayId));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<AgentRun[]>(`/api/agent-runs${qs ? `?${qs}` : ""}`);
  },
  getAlternatives: (runId: number) => request<Plan[]>(`/api/rescue/${runId}/alternatives`),
  approveRescue: (runId: number, decidedBy: string, notes = "") =>
    request<ApprovalResult>(`/api/rescue/${runId}/approve`, {
      method: "POST",
      body: JSON.stringify({ decided_by: decidedBy, notes }),
    }),
  rejectRescue: (runId: number, decidedBy: string, notes = "") =>
    request<ApprovalResult>(`/api/rescue/${runId}/reject`, {
      method: "POST",
      body: JSON.stringify({ decided_by: decidedBy, notes }),
    }),

  getAnalytics: () => request<Analytics>("/api/analytics"),
};

export function agentRunEventsUrl(runId: number) {
  return `${API_BASE}/api/agent-runs/${runId}/events`;
}
