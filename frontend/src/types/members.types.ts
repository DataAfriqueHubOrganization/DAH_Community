export interface MemberExperience {
  id: number;
  title: string;
  company: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string;
}

export interface MemberCertification {
  id: number;
  title: string;
  issuer: string;
  issued_date: string;
  credential_url: string;
}

export type SocialPlatform = "twitter" | "facebook" | "instagram" | "youtube" | "tiktok" | "telegram" | "whatsapp" | "other";

export interface SocialLink {
  id: number;
  platform: SocialPlatform;
  url: string;
}

export interface MemberDepartment {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
}

export interface MemberListItem {
  id: number;
  user_id: number;
  slug: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar: string | null;
  role: string;
  poste: string | null;
  is_active: boolean;
  skills: string[];
  member_number: string | null;
  department: MemberDepartment | null;
}

export interface MemberProfile {
  id: number;
  slug: string;
  bio: string;
  skills: string[];
  github_url: string;
  linkedin_url: string;
  website_url: string;
  cv: string | null;
  is_public: boolean;
  member_number: string | null;
  created_at: string;
  updated_at: string;
  user_email: string;
  user_first_name: string;
  user_last_name: string;
  user_avatar: string | null;
  user_role: string;
  experiences: MemberExperience[];
  certifications: MemberCertification[];
  social_links: SocialLink[];
}

export interface PublicMemberListItem {
  slug: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
  role: string;
  poste: string | null;
  skills: string[];
  current_job: { title: string; company: string } | null;
  department: MemberDepartment | null;
}

export interface PublicProfileDepartment {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
}

export interface PublicProfile {
  slug: string;
  bio: string;
  skills: string[];
  github_url: string;
  linkedin_url: string;
  website_url: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
  role: string;
  poste: string | null;
  department: PublicProfileDepartment | null;
  experiences: MemberExperience[];
  certifications: MemberCertification[];
  /** Distinctions « Membre du mois / de l'année ». */
  awards?: { kind: "month" | "year"; period_start: string }[];
}

export interface MemberProfileUpdatePayload {
  bio?: string;
  skills?: string[];
  github_url?: string;
  linkedin_url?: string;
  website_url?: string;
  is_public?: boolean;
}
