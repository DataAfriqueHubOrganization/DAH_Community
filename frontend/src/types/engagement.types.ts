export type PeriodType = "month" | "quarter" | "year";

export interface Period {
  type: PeriodType;
  start: string;
  end: string; // exclusif
}

export type PointSource = "task" | "checkin" | "adjustment";

export interface PointEntry {
  id: number;
  label: string;
  points: number;
  source: PointSource;
  awarded_at: string;
  on_time: boolean | null;
}

export type CheckInStatus = "pending" | "submitted" | "confirmed" | "cancelled";
export type CriterionKey = "participation" | "follow_up" | "quality" | "teamwork" | "initiative";
export type Scores = Record<CriterionKey, number>;
export const CRITERIA: CriterionKey[] = ["participation", "follow_up", "quality", "teamwork", "initiative"];

/** Vue du membre : jamais les scores finaux ni les points. */
export interface CheckInMember {
  id: number;
  department_name: string;
  /** Mois évalué (1er du mois) — null pour d'anciens points d'étape. */
  period_start: string | null;
  period_label: string;
  due_date: string | null;
  status: CheckInStatus;
  self_scores: Partial<Scores>;
  improve_self: string;
  department_help: string;
  remark: string;
  submitted_at: string | null;
  feedback: string;
  confirmed_at: string | null;
  created_at: string;
}

export interface CheckInManager extends Omit<CheckInMember, "feedback"> {
  department: number;
  member_id: number;
  member_name: string;
  launched_by_name: string | null;
  final_scores: Partial<Scores>;
  feedback: string;
  points: number | null;
  confirmed_by_name: string | null;
}

export type CheckInDetail =
  | (CheckInMember & { viewer: "member" })
  | (CheckInManager & { viewer: "manager" });

export interface MyPoints {
  period: Period;
  total: number;
  entries: PointEntry[];
  monthly: { month: number; total: number }[];
  checkins: CheckInMember[];
  awards: { kind: AwardKind; period_start: string }[];
}

export interface RankingRow {
  rank: number;
  user_id: number;
  full_name: string;
  avatar: string | null;
  department_name: string | null;
  total: number;
  task_points: number;
  checkin_points: number;
  adjustment_points: number;
  tasks_validated: number;
  on_time_rate: number | null;
}

export type AwardKind = "month" | "year";

export interface Award {
  id: number;
  user: number;
  user_name: string;
  kind: AwardKind;
  period_start: string;
  note: string;
  created_at: string;
}

/** Meilleur membre d'un département sur la période (vue communauté). */
export interface DepartmentLeader {
  department_id: number;
  department_name: string;
  user_id: number;
  full_name: string;
  avatar: string | null;
  total: number;
  tied: boolean;
}

export interface Ranking {
  period: Period;
  department: { id: number; name: string } | null;
  scopes: { global: boolean; departments: { id: number; name: string }[] };
  rows: RankingRow[];
  department_leaders: DepartmentLeader[];
  awards: Award[];
}
