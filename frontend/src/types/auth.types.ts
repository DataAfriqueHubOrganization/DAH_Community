export type Role = "admin" | "responsable" | "membre" | "candidat" | "visiteur";

export type Poste =
  | "president" | "vp1" | "vp2"
  | "secretaire_general" | "secretaire_general_adj"
  | "tresorier" | "tresorier_adj";

/** Sections de gestion : l'admin les a toutes, les autres celles qu'il leur accorde. */
export type Section =
  | "events" | "members" | "departments" | "news" | "emails"
  | "treasury" | "ranking" | "applications";

export const SECTIONS: Section[] = [
  "events", "members", "departments", "news", "emails", "treasury", "ranking", "applications",
];

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
  /** Sections ouvertes à l'utilisateur (calculées par le serveur ; toutes pour l'admin). */
  sections: Section[];
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

/** Accès à une section de gestion (accordée dans Gestion des accès ; l'admin a tout).
 *  Le serveur fait la même vérification : ceci ne sert qu'à l'affichage. */
export function hasSection(user: Pick<User, "role" | "sections"> | null | undefined, section: Section): boolean {
  if (!user) return false;
  return user.role === "admin" || (user.sections ?? []).includes(section);
}

/** Soumis à cotisation : membres, responsables et membres du bureau. */
export function isContributor(user: Pick<User, "role" | "poste"> | null | undefined): boolean {
  if (!user) return false;
  return user.role === "membre" || user.role === "responsable" || user.poste !== null;
}

export function isAdmin(role: Role): boolean {
  return role === "admin";
}
