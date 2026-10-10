import { api } from "@/lib/axios";
import type {
  MailAudiences, MailableMember, MemberEmail, MemberEmailContent, MemberEmailDetail, SendMemberEmailPayload,
} from "@/types/mailing.types";

type Page<T> = { results: T[]; count: number } | T[];

/** Emails de l'administration aux membres (admin uniquement). */
export const mailingService = {
  list: () => api.get<Page<MemberEmail>>("/mailing/emails/", { params: { page_size: 50 } }),

  get: (id: number) => api.get<MemberEmailDetail>(`/mailing/emails/${id}/`),

  send: (data: SendMemberEmailPayload) =>
    api.post<MemberEmail | { test: true; sent: number; email: string }>("/mailing/emails/", data),

  retry: (id: number) => api.post<{ retried: number }>(`/mailing/emails/${id}/retry/`),

  preview: (data: MemberEmailContent) =>
    api.post<{ subject: string; html: string }>("/mailing/emails/preview/", data),

  audiences: () => api.get<MailAudiences>("/mailing/emails/audiences/"),

  searchMembers: (search: string) =>
    api.get<MailableMember[]>("/mailing/emails/members/", { params: { search } }),
};
