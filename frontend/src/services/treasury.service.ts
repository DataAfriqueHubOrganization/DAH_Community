import { api } from "@/lib/axios";
import type {
  CashEntry, CashKind, CashSummary, Contribution, ContributionsOverview, MemberContributions,
  MyContributions, PaymentDeclaration, RecordContributionPayload, ReminderStatus,
} from "@/types/treasury.types";

// Content-Type retiré pour les envois de fichiers : le navigateur pose
// multipart/form-data avec sa frontière.
const MULTIPART = { headers: { "Content-Type": undefined } };

export const treasuryService = {
  /** Le membre connecté : ses mois, son reste dû, son historique. */
  mine: (year?: number) => api.get<MyContributions>("/payments/me/", { params: { year } }),

  /** Le membre déclare un paiement (FormData : period_start, months, method, reference, proof). */
  declare: (data: FormData) => api.post<PaymentDeclaration>("/payments/declarations/", data, MULTIPART),

  declarations: {
    list: (status: "pending" | "approved" | "rejected" = "pending") =>
      api.get<PaymentDeclaration[]>("/payments/declarations/", { params: { status } }),
    approve: (id: number) => api.post<PaymentDeclaration>(`/payments/declarations/${id}/approve/`),
    reject: (id: number, reason: string) => api.post<PaymentDeclaration>(`/payments/declarations/${id}/reject/`, { reason }),
  },

  reminders: {
    status: () => api.get<ReminderStatus>("/payments/reminders/"),
    send: () => api.post<ReminderStatus & { sent: number }>("/payments/reminders/"),
  },

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
    create: (data: FormData) => api.post<CashEntry>("/payments/cash/", data, MULTIPART),
    update: (id: number, data: FormData) => api.patch<CashEntry>(`/payments/cash/${id}/`, data, MULTIPART),
    remove: (id: number) => api.delete(`/payments/cash/${id}/`),
    exportCsv: (year: number) => api.get<Blob>("/payments/cash/export/", { params: { year }, responseType: "blob" }),
  },
};
