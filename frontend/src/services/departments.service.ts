import { api } from "@/lib/axios";
import type {
  Department, DepartmentDetail, DepartmentWritePayload, AddMembershipPayload, DepartmentMembership,
  MyDepartment,
} from "@/types/departments.types";
import type { MemberListItem } from "@/types/members.types";

export const departmentsService = {
  /** Hors bureau/admin, l'API ne renvoie que le(s) département(s) de l'utilisateur. */
  list: () => api.get<Department[] | { results: Department[] }>("/departments/"),

  /** Tous les départements (id + nom), sans authentification : annuaire public. */
  publicList: () => api.get<Pick<Department, "id" | "name">[]>("/departments/public/"),

  get: (id: number) => api.get<DepartmentDetail>(`/departments/${id}/`),

  searchableMembers: (departmentId: number) =>
    api.get<MemberListItem[]>(`/departments/${departmentId}/searchable-members/`),

  create: (data: DepartmentWritePayload) => api.post<Department>("/departments/", data),

  update: (id: number, data: Partial<DepartmentWritePayload>) =>
    api.patch<Department>(`/departments/${id}/`, data),

  delete: (id: number) => api.delete(`/departments/${id}/`),

  addMember: (departmentId: number, data: AddMembershipPayload) =>
    api.post<DepartmentMembership>(`/departments/${departmentId}/members/`, data),

  endMembership: (departmentId: number, membershipId: number, endDate?: string) =>
    api.post<DepartmentMembership>(
      `/departments/${departmentId}/members/${membershipId}/end/`,
      { end_date: endDate },
    ),

  removeMembership: (departmentId: number, membershipId: number) =>
    api.delete(`/departments/${departmentId}/members/${membershipId}/`),

  mine: () => api.get<MyDepartment | null>("/departments/mine/"),
};
