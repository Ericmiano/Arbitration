export type Role = 'admin' | 'registrar' | 'staff' | 'arbitrator' | 'party';

export interface SessionUser {
  id: number;
  role: Role;
  fullName: string;
  email: string;
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

/**
 * A case's party, as Eloquent's belongsToMany actually serializes it: the
 * party itself, with the pivot (case_id/party_id/role) nested inside -
 * this is the party record, not a join-row wrapping one.
 */
export interface CaseParty {
  id: string;
  full_name: string;
  pivot: {
    case_id: string;
    party_id: string;
    role: 'claimant' | 'respondent' | 'other';
  };
}

export interface AssignmentSummary {
  id: string;
  case_id: string;
  arbitrator_id: string;
  status: string;
  due_date: string;
  arbitrator: { id: string; full_name: string };
}

/** Shape returned by GET /arbitrators/:id - assignments joined to their case, not the arbitrator. */
export interface ArbitratorAssignment {
  id: string;
  case_id: string;
  status: string;
  assigned_at: string;
  due_date: string;
  case: { id: string; case_number: string; status: string; outcome: string | null };
}

export type TribunalType = 'sole' | 'panel';
export type TribunalStatus = 'forming' | 'constituted' | 'dissolved';
export type TribunalMemberRole = 'sole_arbitrator' | 'co_arbitrator' | 'chairperson';
export type TribunalMemberStatus =
  | 'nominated'
  | 'appointed'
  | 'accepted'
  | 'challenged'
  | 'recused'
  | 'withdrawn'
  | 'removed'
  | 'replaced';

export interface TribunalMember {
  id: string;
  tribunal_id: string;
  arbitrator_id: string;
  role: TribunalMemberRole;
  status: TribunalMemberStatus;
  notes: string | null;
  replaced_member_id: string | null;
  arbitrator: { id: string; full_name: string };
}

export interface Tribunal {
  id: string;
  case_id: string;
  tribunal_type: TribunalType;
  status: TribunalStatus;
  constituted_at: string | null;
  dissolved_at: string | null;
  members: TribunalMember[];
}

export interface CaseEvent {
  id: string;
  event_type: string;
  event_at: string;
  title: string;
  description: string | null;
  actor: { id: string; full_name: string; email: string } | null;
}

export type FilingStatus = 'submitted' | 'accepted' | 'rejected';

export interface Filing {
  id: string;
  case_id: string;
  party_id: string | null;
  filing_type: string;
  title: string;
  description: string | null;
  submitted_at: string;
  status: FilingStatus;
  accepted_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  party: { id: string; full_name: string } | null;
  documents: Array<{ id: string; public_id: string; file_name: string; document_type: string }>;
}

export type DeadlineStatus = 'pending' | 'completed' | 'waived' | 'extended' | 'cancelled';

export interface DeadlineExtensionRequest {
  id: string;
  deadline_id: string;
  original_due_at: string;
  requested_due_at: string;
  reason: string;
  decision: 'pending' | 'approved' | 'rejected';
}

export interface Deadline {
  id: string;
  case_id: string;
  tribunal_member_id: string | null;
  party_id: string | null;
  deadline_type: string;
  title: string;
  description: string | null;
  due_at: string;
  status: DeadlineStatus;
  completed_at: string | null;
  extensions: DeadlineExtensionRequest[];
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
  parties: CaseParty[];
  assignments: AssignmentSummary[];
  /** The tribunal currently forming/constituted for this case, if any - at most one element. */
  active_tribunal: Tribunal[];
  project: { id: string; name: string; location: string | null } | null;
}

export interface Arbitrator {
  id: string;
  user_id: string;
  full_name: string;
  aak_membership_no: string | null;
  current_position: string | null;
  current_organization: string | null;
  aak_chapter: string | null;
  years_of_practice: number | null;
  /** Years on the AAK arbitrator panel (since joined_at) - distinct from years_of_practice, which is general field experience. Always present (server-computed, defaults to 0). */
  years_as_arbitrator: number;
  phone: string | null;
  bio: string | null;
  adr_experience_notes: string | null;
  status: 'active' | 'inactive' | 'suspended';
  score: string;
  cases_closed_count: number;
  specializations: { specialization: string }[];
  qualifications?: { id: string; qualification: string }[];
  registrations?: { id: string; body: string; registration_number: string | null }[];
  conflicts?: { id: string; reason: string; expires_at: string | null }[];
  /** Bare shape from GET /arbitrators (list) - use ArbitratorProfile for GET /arbitrators/:id. */
  assignments?: Array<{ id: string; case_id: string; status: string; due_date: string }>;
  priorEngagementFlags?: Array<{ caseId: number; caseNumber: string; partyId: number }>;
}

/** GET /arbitrators/:id - the profile view, with assignments joined to their case. */
export type ArbitratorProfile = Omit<Arbitrator, 'assignments'> & {
  assignments: ArbitratorAssignment[];
};

export interface DocumentSummary {
  publicId: string;
  fileName: string;
  documentType: string;
  visibility: string;
  uploadedBy: string;
  scanStatus: string;
  version: number;
  createdAt: string;
  /** Present when listed via the cross-case register (no caseId filter). */
  caseId?: string;
  caseNumber?: string;
}

export interface Hearing {
  id: string;
  case_id: string;
  scheduled_at: string;
  mode: 'in_person' | 'virtual';
  venue_or_link: string;
  agenda: string | null;
  required_documents: string | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'postponed';
  case: { id: string; case_number: string };
}

export interface AuditLogEntry {
  id: string;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  read_at: string | null;
  created_at: string;
}
