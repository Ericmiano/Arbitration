export type Role = 'admin' | 'registrar' | 'staff' | 'arbitrator' | 'party';

export interface SessionUser {
  id: number;
  role: Role;
}

export interface Party {
  id: string;
  full_name: string;
  type: 'individual' | 'organization';
  email: string | null;
  phone: string | null;
  organizations?: { id: string; name: string } | null;
  user_id: string | null;
}

export interface Organization {
  id: string;
  name: string;
  sector: string | null;
}

export interface Project {
  id: string;
  name: string;
  sector: string | null;
  value: string | null;
  currency: string;
  contracts?: Contract[];
}

export interface Contract {
  id: string;
  project_id: string;
  reference_number: string | null;
  has_arbitration_clause: boolean;
}

export type CaseStatus =
  | 'intake'
  | 'pending_agreement'
  | 'pending_assignment'
  | 'assigned'
  | 'ongoing'
  | 'concluded'
  | 'closed'
  | 'withdrawn';

export interface CaseParty {
  case_id: string;
  party_id: string;
  role: 'claimant' | 'respondent' | 'other';
  parties: { id: string; full_name: string };
}

export interface AssignmentSummary {
  id: string;
  case_id: string;
  arbitrator_id: string;
  status: string;
  due_date: string;
  arbitrators: { id: string; full_name: string };
}

export interface Case {
  id: string;
  public_id: string;
  case_number: string;
  dispute_value: string;
  currency: string;
  category: string;
  description: string;
  basis: 'contractual_clause' | 'mutual_agreement';
  sla_tier: 'simple' | 'standard' | 'complex';
  due_date: string | null;
  status: CaseStatus;
  filed_at: string;
  concluded_at: string | null;
  outcome: string | null;
  outcome_detail: string | null;
  award_challenged: boolean | null;
  case_parties: CaseParty[];
  assignments: AssignmentSummary[];
  projects: { id: string; name: string } | null;
}

export interface Arbitrator {
  id: string;
  user_id: string;
  full_name: string;
  status: 'active' | 'inactive' | 'suspended';
  score: string;
  cases_closed_count: number;
  arbitrator_specializations: { specialization: string }[];
  priorEngagementFlags?: Array<{ caseId: number; caseNumber: string; partyId: number }>;
}

export interface DocumentSummary {
  publicId: string;
  fileName: string;
  documentType: string;
  visibility: string;
  uploadedBy: string;
  scanStatus: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  read_at: string | null;
  created_at: string;
}
