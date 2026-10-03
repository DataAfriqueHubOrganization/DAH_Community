export type Role = "admin" | "responsable" | "membre" | "candidat" | "visiteur";

export type Poste =
  | "president" | "vp1" | "vp2"
  | "secretaire_general" | "secretaire_general_adj"
  | "tresorier" | "tresorier_adj";

export interface UserDepartment {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  avatar: string | null;
  role: Role;
  poste: Poste | null;
  department: UserDepartment | null;
  email_verified: boolean;
  created_at: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface RegisterPayload {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  password: string;
  password_confirm: string;
}

export const POSTES: Poste[] = [
  "president", "vp1", "vp2",
  "secretaire_general", "secretaire_general_adj",
  "tresorier", "tresorier_adj",
];

/** Un membre du bureau est quiconque a un poste (Président, VP, ...) ou est admin. */
export function isBureau(user: Pick<User, "role" | "poste"> | null | undefined): boolean {
  if (!user) return false;
  return user.poste !== null || user.role === "admin";
}

/** Trésorerie : trésorier, trésorier adjoint ou admin. */
export function isTreasurer(user: Pick<User, "role" | "poste"> | null | undefined): boolean {
  if (!user) return false;
  return user.role === "admin" || user.poste === "tresorier" || user.poste === "tresorier_adj";
}

/** Soumis à cotisation : membres, responsables et membres du bureau. */
export function isContributor(user: Pick<User, "role" | "poste"> | null | undefined): boolean {
  if (!user) return false;
  return user.role === "membre" || user.role === "responsable" || user.poste !== null;
}

export function isAdmin(role: Role): boolean {
  return role === "admin";
}
