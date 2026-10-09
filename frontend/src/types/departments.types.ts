export interface DepartmentMembership {
  id: number;
  user_id: number;
  user_full_name: string;
  user_email: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
}

export interface Department {
  id: number;
  name: string;
  description: string;
  lead_id: number | null;
  lead_name: string | null;
  co_lead_id: number | null;
  co_lead_name: string | null;
  member_count: number;
  can_manage: boolean;
  is_member: boolean;
  created_at: string;
}

export interface DepartmentDetail extends Department {
  memberships: DepartmentMembership[];
  /** Gestionnaires de projets désignés par le responsable. */
  project_managers: { id: number; full_name: string }[];
  /** L'utilisateur peut créer des projets et y affecter des tâches. */
  can_manage_projects: boolean;
}

export interface DepartmentWritePayload {
  name: string;
  description: string;
  lead?: number | null;
  co_lead?: number | null;
}

export interface AddMembershipPayload {
  user_id: number;
  start_date: string;
  end_date?: string;
}

/** Réponse de GET /departments/mine/ — le backend renvoie aussi announcements/
 * sessions/my_tasks (ancien système de to-do département, remplacé par les
 * tâches de projet), volontairement omis ici car plus affichés côté UI. */
export interface MyDepartment {
  department: Department;
  since: string | null;
  can_manage: boolean;
}
