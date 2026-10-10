import { api } from "@/lib/axios";

export interface NewsletterSubscriber {
  id: number;
  email: string;
  is_active: boolean;
  source: string;
  created_at: string;
  unsubscribed_at: string | null;
}

type Page<T> = { results: T[]; count: number } | T[];

export const newsletterService = {
  /** Formulaire public du pied de page. */
  subscribe: (email: string) => api.post<{ detail: string }>("/mailing/newsletter/subscribe/", { email }),
  /** Lien « Se désabonner » des emails. */
  unsubscribe: (token: string) => api.post<{ detail: string }>("/mailing/newsletter/unsubscribe/", { token }),

  // Gestion (section Emails)
  list: (params: { status?: "active" | "unsubscribed" | ""; search?: string; page?: number }) =>
    api.get<Page<NewsletterSubscriber>>("/mailing/newsletter/subscribers/", { params: { page_size: 50, ...params } }),
  add: (email: string) => api.post<NewsletterSubscriber>("/mailing/newsletter/subscribers/", { email }),
  remove: (id: number) => api.delete(`/mailing/newsletter/subscribers/${id}/`),
  exportCsv: () => api.get<Blob>("/mailing/newsletter/subscribers/export/", { responseType: "blob" }),
};
