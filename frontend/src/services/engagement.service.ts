import { api } from "@/lib/axios";
import type {
  AwardKind, CheckInDetail, CheckInManager, MyPoints, PeriodType, Ranking, Scores,
} from "@/types/engagement.types";

interface PeriodParams {
  period: PeriodType;
  date?: string; // YYYY-MM-DD, n'importe quel jour de la période
  department?: number;
}

export const engagementService = {
  /** Classement : responsables (leur département) et bureau (communauté). */
  ranking: (params: PeriodParams) => api.get<Ranking>("/engagement/ranking/", { params }),

  /** Mes points : total, historique, totaux mensuels — sans classement. */
  myPoints: (params: Omit<PeriodParams, "department">) => api.get<MyPoints>("/engagement/me/", { params }),

  checkins: {
    list: (departmentId: number) =>
      api.get<CheckInManager[]>("/engagement/checkins/", { params: { department: departmentId } }),
    get: (id: number | string) => api.get<CheckInDetail>(`/engagement/checkins/${id}/`),
    /** month : n'importe quel jour du mois évalué (YYYY-MM-DD). */
    launch: (data: { department: number; members: number[]; month: string; due_date?: string | null }) =>
      api.post<{ created: number; skipped: number }>("/engagement/checkins/", data),
    submit: (id: number, data: { self_scores: Scores; improve_self: string; department_help: string; remark?: string }) =>
      api.post<CheckInDetail>(`/engagement/checkins/${id}/submit/`, data),
    confirm: (id: number, data: { final_scores: Scores; feedback: string }) =>
      api.post<CheckInDetail>(`/engagement/checkins/${id}/confirm/`, data),
    cancel: (id: number) => api.post<CheckInDetail>(`/engagement/checkins/${id}/cancel/`),
    /** Relance par email les points d'étape « à remplir » du mois. */
    remind: (data: { department: number; month: string }) =>
      api.post<{ reminded: number }>("/engagement/checkins/remind/", data),
  },

  awards: {
    designate: (data: { user: number; kind: AwardKind; date: string; note?: string }) =>
      api.post("/engagement/awards/", data),
    remove: (id: number) => api.delete(`/engagement/awards/${id}/`),
  },

  adjust: (data: { user: number; points: number; reason: string; department?: number | null }) =>
    api.post("/engagement/adjustments/", data),
};
