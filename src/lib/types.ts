export interface Member {
  id: string;
  name: string;
  branch: string;
  active: boolean;
  start_date: string;
  anonymous: boolean;
  credit_balance: number;
  created_at: string;
}

export interface MemberRate {
  id: string;
  member_id: string;
  rate: number;
  effective_from: string;
  source: "global" | "override";
  created_at: string;
}

export interface Payment {
  id: string;
  member_id: string;
  amount: number;
  date_paid: string;
  months_covered: number;
  credit_used: number;
  credit_remainder: number;
  note: string | null;
  created_at: string;
}

export interface MonthlyChecklist {
  id: string;
  member_id: string;
  month: string;
  paid: boolean;
  payment_id: string | null;
}

export interface AccessCode {
  id: string;
  code: string;
  label: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Admin {
  id: string;
  email: string;
  password_hash: string;
  role: "super" | "admin";
  must_reset_password: boolean;
  created_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  event_type: string;
  actor_id: string | null;
  actor_role: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Report {
  id: string;
  month: string;
  generated_at: string;
  pdf_url: string | null;
  text_summary: string | null;
  triggered_by: string | null;
}

export interface GlobalRateHistory {
  id: string;
  rate: number;
  effective_from: string;
  set_by: string | null;
  created_at: string;
}

/** Data bundle for monthly contribution PDF reports (pdf-lib). */
export type ReportData = {
  month: Date;
  generatedAt: Date;
  totalCollectedThisMonth: number;
  totalCollectedAllTime: number;
  totalOutstanding: number;
  monthlyTrend: Array<{ month: string; amount: number }>;
  topBehindMembers: Array<{
    displayName: string;
    amountBehind: number;
    monthsBehind: number;
  }>;
  members: Array<{
    displayName: string;
    branch: string;
    anonymous: boolean;
    totalPaid: number;
    balance: number;
    paidThisMonth: boolean;
    amountPaidThisMonth: number;
    status: string;
  }>;
};
