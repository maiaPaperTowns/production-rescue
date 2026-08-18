export interface Production {
  id: number;
  name: string;
  total_shooting_days: number;
  current_day_number: number;
  daily_budget: number;
}

export interface ShootingDay {
  id: number;
  production_id: number;
  day_number: number;
  shoot_date: string;
  day_start: string;
  day_end: string;
  status: string;
}

export interface Actor {
  id: number;
  name: string;
  role: string;
  day_rate: number;
}

export interface LocationResource {
  id: number;
  name: string;
  location_type: string;
  address: string;
  permit_required: boolean;
}

export interface Equipment {
  id: number;
  name: string;
  category: string;
}

export interface Scene {
  id: number;
  scene_number: string;
  title: string;
  int_ext: "INT" | "EXT";
  duration_min: number;
  original_start: string;
  original_end: string;
  weather_requirement: string | null;
  daylight_required: boolean;
  priority: number;
  location: LocationResource;
  cast: Actor[];
  equipment: Equipment[];
  depends_on: string[];
}

export interface Assignment {
  scene_id: number;
  scene_number: string;
  title: string;
  start: string;
  end: string;
  location_id: number;
  location_name: string;
  status: "scheduled" | "delayed" | "dropped";
  change_reason: string;
}

export interface ScheduleVersion {
  id: number;
  version_number: number;
  status: "ACTIVE" | "PROPOSED" | "APPROVED" | "REJECTED";
  label: string;
  score: number;
  is_current: boolean;
  created_by: string;
  created_at: string;
  assignments: Assignment[];
}

export interface Schedule {
  shooting_day_id: number;
  day_number: number;
  shoot_date: string;
  status: string;
  current_version: ScheduleVersion | null;
}

export interface DisruptionItem {
  type: "weather" | "actor_availability" | "equipment_delay" | "location_unavailable";
  condition?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  affects?: string[];
  actor?: string | null;
  available_until?: string | null;
  available_from?: string | null;
  equipment?: string | null;
  available_after?: string | null;
  location?: string | null;
  unavailable_start?: string | null;
  unavailable_end?: string | null;
}

export interface DisruptionExtractionResult {
  disruptions: DisruptionItem[];
  summary: string;
  source: "gemini" | "mock";
}

export interface AgentAction {
  seq: number;
  tool_name: string;
  summary: string;
  timestamp: string;
}

export interface Impact {
  downtime_hours_avoided: number;
  scenes_saved: number;
  scenes_preserved: number;
  scenes_total: number;
  scenes_delayed: number;
  changed_call_times: number;
  company_moves_change: number;
  overtime_change_minutes: number;
  estimated_cost_avoided: number;
}

export interface Plan {
  schedule_version_id: number;
  label: string;
  score: number;
  recommended: boolean;
  assignments: Assignment[];
  dropped_scenes: string[];
  impact: Impact | null;
}

export type AgentRunStatus = "running" | "proposed" | "approved" | "rejected" | "infeasible" | "failed";

export interface AgentRun {
  id: number;
  shooting_day_id: number;
  status: AgentRunStatus;
  disruption_summary: string;
  candidates_generated: number;
  candidates_valid: number;
  explanation: string;
  blocking_constraints: string[];
  affected_scene_ids: number[];
  execution_ms: number;
  started_at: string;
  completed_at: string | null;
  recommended_schedule_version_id: number | null;
  plans: Plan[];
  actions: AgentAction[];
}

export interface ApprovalResult {
  schedule_version_id: number;
  new_version_number: number;
  assignments_updated: number;
  status: string;
}

export interface ProductionCreateInput {
  name: string;
  total_shooting_days: number;
  daily_budget: number;
}

export interface ShootingDayCreateInput {
  day_number: number;
  shoot_date: string;
  day_start?: string;
  day_end?: string;
}

export interface ActorCreateInput {
  name: string;
  role?: string;
  day_rate?: number;
}

export interface LocationCreateInput {
  name: string;
  location_type?: string;
  address?: string;
  permit_required?: boolean;
}

export interface EquipmentCreateInput {
  name: string;
  category?: string;
}

export interface SceneCreateInput {
  scene_number: string;
  title: string;
  int_ext: "INT" | "EXT";
  location_id: number;
  start: string;
  end: string;
  weather_requirement?: string | null;
  daylight_required?: boolean;
  priority?: number;
  actor_ids?: number[];
  equipment_ids?: number[];
  depends_on_scene_ids?: number[];
}

export interface Analytics {
  rescue_events: number;
  production_hours_saved: number;
  estimated_cost_avoided: number;
  most_common_disruption: string;
  average_response_time_ms: number;
  rescue_success_rate: number;
  disruptions_by_type: Record<string, number>;
  hours_saved_series: { date: string; hours_saved: number }[];
}
