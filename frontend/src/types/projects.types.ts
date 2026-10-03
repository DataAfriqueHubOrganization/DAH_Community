export type ProjectStatus = "idea" | "active" | "paused" | "completed" | "archived";

export interface Project {
  id: number;
  title: string;
  description: string;
  status: ProjectStatus;
  status_display: string;
  owner_id: number | null;
  owner_name: string | null;
  member_names: string[];
  department_id: number | null;
  department_name: string | null;
  deadline: string | null;
  repository_url: string;
  created_at: string;
}

export interface ProjectWritePayload {
  title: string;
  description: string;
  status: ProjectStatus;
  department: number;
  deadline?: string | null;
  repository_url?: string;
  members?: number[];
}

/** « submitted » = À valider, « done » = Validée par le responsable. */
export type ProjectTaskStatus = "todo" | "in_progress" | "submitted" | "done" | "blocked";
/** Statuts modifiables librement ; les autres passent par soumettre / valider. */
export type FreeTaskStatus = "todo" | "in_progress" | "blocked";
export type TaskSize = "small" | "medium" | "large";

export interface ProjectTask {
  id: number;
  project: number;
  project_title: string;
  title: string;
  description: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  due_date: string | null;
  status: ProjectTaskStatus;
  status_display: string;
  size: TaskSize;
  submitted_at: string | null;
  submission_note: string;
  return_reason: string;
  validated_at: string | null;
  validated_by_name: string | null;
  is_outstanding: boolean;
  points_awarded: number | null;
  created_at: string;
}

export interface ProjectTaskWritePayload {
  title: string;
  description?: string;
  assigned_to?: number | null;
  due_date?: string | null;
  status?: FreeTaskStatus;
  size?: TaskSize;
}
