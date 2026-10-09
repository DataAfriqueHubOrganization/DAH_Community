import { api } from "@/lib/axios";
import type { MemberDepartment } from "@/types/members.types";
import type { Section } from "@/types/auth.types";

export interface AdminUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  role: string;
  poste: string | null;
  department: MemberDepartment | null;
  /** Sections accordées (vide pour l'admin, qui a déjà tout). */
  sections: Section[];
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
}

export interface AdminUserUpdatePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  role?: string;
  poste?: string | null;
  /** Rattache l'utilisateur à ce département (nouvelle adhésion datée d'aujourd'hui),
   * ou le retire de son département actuel si null. Omis = ne pas toucher. */
  department_id?: number | null;
  is_active?: boolean;
  sections?: Section[];
}

interface PaginatedResponse<T> { count: number; results: T[]; next: string | null; previous: string | null; }

export const usersService = {
  list: (params?: Record<string, string>) =>
    api.get<AdminUser[] | PaginatedResponse<AdminUser>>("/auth/users/", { params }),

  update: (id: number, data: AdminUserUpdatePayload) =>
    api.patch<AdminUser>(`/auth/users/${id}/`, data),

  delete: (id: number) => api.delete(`/auth/users/${id}/`),
};
