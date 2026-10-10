export type Audience = "selection" | "all" | "bureau" | "leads" | "department" | "newsletter";
export type MailTemplate = "annonce" | "convocation" | "volontaires" | "felicitations" | "libre";

export interface MailableMember {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  poste: string | null;
}

export interface MailQuota {
  limit: number;
  sent_today: number;
  remaining: number;
}

export interface MailAudiences {
  groups: Record<"all" | "bureau" | "leads", number>;
  departments: { id: number; name: string; count: number }[];
  /** Abonnés actifs à la newsletter. */
  newsletter: number;
  quota: MailQuota;
}

export interface MemberEmailContent {
  subject: string;
  body: string;
  cta_label: string;
  cta_url: string;
}

export interface SendMemberEmailPayload extends MemberEmailContent {
  template: MailTemplate | "";
  audience: Audience;
  department?: number | null;
  user_ids?: number[];
  test?: boolean;
}

export interface MemberEmail {
  id: number;
  subject: string;
  template: MailTemplate | "";
  audience: Audience;
  audience_label: string;
  sent_by_name: string | null;
  created_at: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

export interface MemberEmailRecipient {
  id: number;
  address: string;
  first_name: string;
  last_name: string;
  status: "pending" | "sent" | "failed";
  error: string;
  sent_at: string | null;
}

export interface MemberEmailDetail extends MemberEmail, MemberEmailContent {
  recipients: MemberEmailRecipient[];
}
