export type MonthStatus = "paid" | "late" | "due" | "upcoming" | "not_due";
export type MemberStatus = "up_to_date" | "late" | "never_paid";
export type PaymentMethod = "cash" | "mobile_money" | "transfer" | "other";

export interface ContributionMonthInfo {
  month: string; // YYYY-MM-01
  status: MonthStatus;
  amount: number;
}

/** Situation d'un membre (calculée côté serveur). */
export interface MemberSituation {
  rate: number;
  joined_month: string;
  months: ContributionMonthInfo[];
  late_months: string[];
  owed: number;
  paid_until: string | null;
  next_unpaid: string;
  status: MemberStatus;
  paid_in_year: number;
  months_paid_in_year: number;
}

export interface Contribution {
  id: number;
  user: number;
  user_name: string;
  period_start: string;
  period_end: string;
  months: number;
  monthly_rate: number;
  amount: number;
  paid_on: string;
  method: PaymentMethod;
  method_display: string;
  reference: string;
  note: string;
  recorded_by_name: string | null;
  points: number;
  created_at: string;
}

export interface MemberContributions extends MemberSituation {
  user_id: number;
  full_name: string;
  year: number;
  points_in_year: number;
  points_per_month: number;
  history: Contribution[];
}

export type MyContributions = ({ liable: true } & MemberContributions) | { liable: false };

export interface ContributionRow extends MemberSituation {
  user_id: number;
  full_name: string;
  email: string;
  avatar: string | null;
  role: string;
  poste: string | null;
  department_name: string | null;
}

export interface ContributionsOverview {
  year: number;
  rows: ContributionRow[];
  collected: number;
  expected_to_date: number;
  recovery_rate: number | null;
  late_count: number;
  late_amount: number;
}

export interface RecordContributionPayload {
  user: number;
  period_start: string; // YYYY-MM
  months: number;
  paid_on: string;
  method: PaymentMethod;
  reference?: string;
  note?: string;
}

export type CashKind = "income" | "expense";
export const INCOME_CATEGORIES = ["contributions", "donations", "sponsorship", "events_income", "other_income"] as const;
export const EXPENSE_CATEGORIES = ["events", "communication", "tools", "logistics", "other_expense"] as const;
export type CashCategory = (typeof INCOME_CATEGORIES)[number] | (typeof EXPENSE_CATEGORIES)[number];

export interface CashEntry {
  id: number;
  kind: CashKind;
  category: CashCategory;
  label: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  reference: string;
  note: string;
  attachment: string | null;
  is_contribution: boolean;
  recorded_by_name: string | null;
  created_at: string;
}

export interface CashSummary {
  year: number;
  balance: number;
  income: number;
  expense: number;
  result: number;
  contributions: number;
  by_month: { month: number; income: number; expense: number }[];
  by_category: { kind: CashKind; category: CashCategory; total: number }[];
}
