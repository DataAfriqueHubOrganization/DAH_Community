import { api } from "@/lib/axios";
import type {
  CashEntry, CashKind, CashSummary, Contribution, ContributionsOverview, MemberContributions,
  MyContributions, RecordContributionPayload,
} from "@/types/treasury.types";

export const treasuryService = {
  /** Le membre connecté : ses mois, son reste dû, son historique. */
  mine: (year?: number) => api.get<MyContributions>("/payments/me/", { params: { year } }),

  contributions: {
    /** Trésorerie : situation de chaque membre sur l'année. */
    overview: (year?: number) => api.get<ContributionsOverview>("/payments/contributions/", { params: { year } }),
    member: (userId: number, year?: number) =>
      api.get<MemberContributions>(`/payments/contributions/members/${userId}/`, { params: { year } }),
    record: (data: RecordContributionPayload) => api.post<Contribution>("/payments/contributions/", data),
    remove: (id: number) => api.delete(`/payments/contributions/${id}/`),
  },

  cash: {
    list: (params: { year?: number; kind?: CashKind | ""; category?: string }) =>
      api.get<CashEntry[]>("/payments/cash/", { params }),
    summary: (year?: number) => api.get<CashSummary>("/payments/cash/summary/", { params: { year } }),
    /** FormData : le justificatif est un fichier. */
    // Content-Type retiré : le navigateur pose multipart/form-data avec sa frontière.
    create: (data: FormData) =>
      api.post<CashEntry>("/payments/cash/", data, { headers: { "Content-Type": undefined } }),
    update: (id: number, data: FormData) =>
      api.patch<CashEntry>(`/payments/cash/${id}/`, data, { headers: { "Content-Type": undefined } }),
    remove: (id: number) => api.delete(`/payments/cash/${id}/`),
    exportCsv: (year: number) => api.get<Blob>("/payments/cash/export/", { params: { year }, responseType: "blob" }),
  },
};
