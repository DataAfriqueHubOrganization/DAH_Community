import { api } from "@/lib/axios";
import type {
  ArticleListItem, ArticleDetail, ArticleAdmin, ArticleWritePayload, ArticleCategory,
  ArticleComment, LikeToggleResult,
} from "@/types/blog.types";

export const blogService = {
  list: () => api.get<ArticleListItem[]>("/blog/"),
  get: (slug: string) => api.get<ArticleDetail>(`/blog/${slug}/`),

  categories: {
    list: () => api.get<ArticleCategory[]>("/blog/manage/categories/"),
    create: (name: string) => api.post<ArticleCategory>("/blog/manage/categories/", { name }),
  },

  comments: {
    list: (slug: string) => api.get<ArticleComment[]>(`/blog/${slug}/comments/`),
    create: (slug: string, content: string) =>
      api.post<ArticleComment>(`/blog/${slug}/comments/`, { content }),
    delete: (slug: string, commentId: number) =>
      api.delete(`/blog/${slug}/comments/${commentId}/`),
  },

  likes: {
    toggle: (slug: string) => api.post<LikeToggleResult>(`/blog/${slug}/like/`),
  },

  manage: {
    list: () => api.get<ArticleAdmin[] | { results: ArticleAdmin[] }>("/blog/manage/articles/", { params: { page_size: 100 } }),
    get: (id: number) => api.get<ArticleAdmin>(`/blog/manage/articles/${id}/`),
    create: (data: ArticleWritePayload | FormData) =>
      api.post<ArticleAdmin>("/blog/manage/articles/", data, {
        headers: data instanceof FormData ? { "Content-Type": undefined } : undefined,
      }),
    update: (id: number, data: Partial<ArticleWritePayload> | FormData) =>
      api.patch<ArticleAdmin>(`/blog/manage/articles/${id}/`, data, {
        headers: data instanceof FormData ? { "Content-Type": undefined } : undefined,
      }),
    delete: (id: number) => api.delete(`/blog/manage/articles/${id}/`),
  },
};
