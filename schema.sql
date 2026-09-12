-- AAK Arbitration Case Management System
-- MySQL / MariaDB schema (cPanel-compatible: no extensions beyond stock MySQL 8 / MariaDB 10.x)
--
-- Conventions:
--   - Surrogate BIGINT UNSIGNED AUTO_INCREMENT primary keys for all internal joins (cheap, fast).
--   - Every externally-shareable resource (documents, cases) also carries a random CHAR(36) UUID
--     `public_id`, used in URLs instead of the sequential id, so links/IDs can't be enumerated/guessed.
--   - All FKs `ON DELETE RESTRICT` by default — arbitration records must not silently disappear;
--     deactivate/soft-delete (status flags) instead of deleting rows.
--   - Timestamps are UTC; convert at the presentation layer.

SET NAMES utf8mb4;

-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE users (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    public_id           CHAR(36) NOT NULL DEFAULT (UUID()),
    email               VARCHAR(255) NOT NULL,
    password_hash       VARCHAR(255) NOT NULL,
    role                ENUM('admin', 'registrar', 'staff', 'arbitrator', 'party') NOT NULL,
    status              ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    mfa_secret          VARCHAR(255) NULL,
    mfa_enabled         TINYINT(1) NOT NULL DEFAULT 0,
    failed_login_count  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until        DATETIME NULL,
    last_login_at       DATETIME NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_public_id (public_id)
) ENGINE=InnoDB;

-- ============================================================
-- ORGANIZATIONS & PARTIES
-- ============================================================

CREATE TABLE organizations (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100) NULL,
    address             VARCHAR(500) NULL,
    sector              VARCHAR(150) NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE parties (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             BIGINT UNSIGNED NULL,               -- set once the party has portal login access
    type                ENUM('individual', 'organization') NOT NULL,
    organization_id     BIGINT UNSIGNED NULL,               -- set when type = 'organization'
    full_name           VARCHAR(255) NOT NULL,               -- individual's name, or org contact person
    email               VARCHAR(255) NULL,
    phone               VARCHAR(50) NULL,
    address             VARCHAR(500) NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_parties_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_parties_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_parties_org ON parties(organization_id);

-- ============================================================
-- ARBITRATORS
-- ============================================================

CREATE TABLE arbitrators (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             BIGINT UNSIGNED NOT NULL,
    full_name           VARCHAR(255) NOT NULL,
    credentials         TEXT NULL,                          -- qualifications, bar admissions, etc.
    status              ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    score               DECIMAL(5,2) NOT NULL DEFAULT 70.00, -- neutral baseline until enough history exists
    cases_closed_count  INT UNSIGNED NOT NULL DEFAULT 0,     -- gates when score formula fully kicks in (see app logic)
    score_updated_at    DATETIME NULL,
    joined_at           DATE NOT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_arbitrators_user (user_id),
    CONSTRAINT fk_arbitrators_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE arbitrator_specializations (
    arbitrator_id       BIGINT UNSIGNED NOT NULL,
    specialization      VARCHAR(150) NOT NULL,               -- e.g. 'construction', 'employment', 'commercial'
    PRIMARY KEY (arbitrator_id, specialization),
    CONSTRAINT fk_spec_arbitrator FOREIGN KEY (arbitrator_id) REFERENCES arbitrators(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Declared/known conflicts of interest, checked before assignment.
CREATE TABLE arbitrator_conflicts (
    id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    arbitrator_id           BIGINT UNSIGNED NOT NULL,
    conflicted_party_id     BIGINT UNSIGNED NULL,
    conflicted_organization_id BIGINT UNSIGNED NULL,
    reason                  VARCHAR(500) NOT NULL,
    declared_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at              DATE NULL,                       -- NULL = indefinite
    CONSTRAINT fk_conflict_arbitrator FOREIGN KEY (arbitrator_id) REFERENCES arbitrators(id) ON DELETE CASCADE,
    CONSTRAINT fk_conflict_party FOREIGN KEY (conflicted_party_id) REFERENCES parties(id) ON DELETE CASCADE,
    CONSTRAINT fk_conflict_org FOREIGN KEY (conflicted_organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT chk_conflict_target CHECK (conflicted_party_id IS NOT NULL OR conflicted_organization_id IS NOT NULL)
) ENGINE=InnoDB;

CREATE INDEX idx_conflicts_arbitrator ON arbitrator_conflicts(arbitrator_id);
CREATE INDEX idx_conflicts_party ON arbitrator_conflicts(conflicted_party_id);
CREATE INDEX idx_conflicts_org ON arbitrator_conflicts(conflicted_organization_id);

-- Score history: one row appended each time a case closes and the arbitrator's score is recalculated.
CREATE TABLE arbitrator_score_history (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    arbitrator_id       BIGINT UNSIGNED NOT NULL,
    case_id             BIGINT UNSIGNED NULL,                -- the case that triggered this recalculation
    score               DECIMAL(5,2) NOT NULL,
    timeliness_component DECIMAL(5,2) NOT NULL,
    outcome_component   DECIMAL(5,2) NOT NULL,
    workload_component  DECIMAL(5,2) NOT NULL,
    calculated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_score_arbitrator FOREIGN KEY (arbitrator_id) REFERENCES arbitrators(id) ON DELETE CASCADE,
    CONSTRAINT fk_score_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- PROJECTS & CONTRACTS
-- ============================================================

CREATE TABLE projects (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    description         TEXT NULL,
    sector              VARCHAR(150) NULL,
    value               DECIMAL(18,2) NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    location            VARCHAR(255) NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE contracts (
    id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id              BIGINT UNSIGNED NOT NULL,
    reference_number        VARCHAR(150) NULL,
    execution_date          DATE NULL,
    value                   DECIMAL(18,2) NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'KES',
    has_arbitration_clause  TINYINT(1) NOT NULL DEFAULT 0,
    arbitration_clause_text TEXT NULL,
    governing_law           VARCHAR(150) NULL,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_contracts_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_contracts_project ON contracts(project_id);

CREATE TABLE contract_parties (
    contract_id         BIGINT UNSIGNED NOT NULL,
    party_id            BIGINT UNSIGNED NOT NULL,
    role                VARCHAR(100) NOT NULL,               -- e.g. 'employer', 'contractor'
    PRIMARY KEY (contract_id, party_id),
    CONSTRAINT fk_cp_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
    CONSTRAINT fk_cp_party FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- CASES (DISPUTES)
-- ============================================================

CREATE TABLE cases (
    id                          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    public_id                   CHAR(36) NOT NULL DEFAULT (UUID()),
    case_number                 VARCHAR(50) NOT NULL,        -- e.g. AAK/ARB/2026/0142, generated at creation
    project_id                  BIGINT UNSIGNED NULL,
    contract_id                 BIGINT UNSIGNED NULL,
    dispute_value                DECIMAL(18,2) NOT NULL,
    currency                    CHAR(3) NOT NULL DEFAULT 'KES',
    category                    VARCHAR(100) NOT NULL,        -- 'payment','delay','defects','termination','other'
    description                 TEXT NOT NULL,
    basis                       ENUM('contractual_clause', 'mutual_agreement') NOT NULL,
    submission_agreement_doc_id BIGINT UNSIGNED NULL,         -- required when basis = 'mutual_agreement'
    sla_tier                    ENUM('simple', 'standard', 'complex') NOT NULL,
    due_date                     DATE NULL,                   -- set once assigned; NULL while pending
    status                       ENUM(
                                     'intake',
                                     'pending_agreement',
                                     'pending_assignment',
                                     'assigned',
                                     'ongoing',
                                     'concluded',
                                     'closed',
                                     'withdrawn'
                                 ) NOT NULL DEFAULT 'intake',
    filed_at                    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    concluded_at                 DATETIME NULL,
    outcome                      ENUM('award_issued', 'settled', 'withdrawn') NULL,
    outcome_detail               TEXT NULL,
    award_challenged             TINYINT(1) NULL,             -- updatable after closure if a challenge is later filed
    created_by                  BIGINT UNSIGNED NOT NULL,
    created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cases_number (case_number),
    UNIQUE KEY uq_cases_public_id (public_id),
    CONSTRAINT fk_cases_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
    CONSTRAINT fk_cases_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_cases_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    -- fk_cases_submission_doc added after `documents` table exists (circular reference)
) ENGINE=InnoDB;

CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_due_date ON cases(due_date);
CREATE INDEX idx_cases_project ON cases(project_id);
CREATE INDEX idx_cases_contract ON cases(contract_id);

CREATE TABLE case_parties (
    case_id             BIGINT UNSIGNED NOT NULL,
    party_id            BIGINT UNSIGNED NOT NULL,
    role                ENUM('claimant', 'respondent', 'other') NOT NULL,
    PRIMARY KEY (case_id, party_id),
    CONSTRAINT fk_casep_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_casep_party FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_caseparties_party ON case_parties(party_id);

-- ============================================================
-- ASSIGNMENTS
-- ============================================================

CREATE TABLE assignments (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    case_id             BIGINT UNSIGNED NOT NULL,
    arbitrator_id       BIGINT UNSIGNED NOT NULL,
    assigned_by         BIGINT UNSIGNED NOT NULL,
    assigned_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_date            DATE NOT NULL,                       -- copy of case.due_date at assignment time; extensions update this copy
    status              ENUM('ongoing', 'completed', 'overdue', 'escalated', 'withdrawn', 'reassigned') NOT NULL DEFAULT 'ongoing',
    completed_at        DATETIME NULL,
    withdrawal_reason   VARCHAR(500) NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_assign_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT,
    CONSTRAINT fk_assign_arbitrator FOREIGN KEY (arbitrator_id) REFERENCES arbitrators(id) ON DELETE RESTRICT,
    CONSTRAINT fk_assign_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_assignments_arbitrator ON assignments(arbitrator_id);
CREATE INDEX idx_assignments_case ON assignments(case_id);
CREATE INDEX idx_assignments_status ON assignments(status);
CREATE INDEX idx_assignments_due_date ON assignments(due_date);

CREATE TABLE assignment_extensions (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    assignment_id       BIGINT UNSIGNED NOT NULL,
    requested_by        BIGINT UNSIGNED NOT NULL,
    requested_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason              VARCHAR(500) NOT NULL,
    previous_due_date   DATE NOT NULL,
    new_due_date        DATE NOT NULL,
    status              ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    decided_by          BIGINT UNSIGNED NULL,
    decided_at          DATETIME NULL,
    CONSTRAINT fk_ext_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    CONSTRAINT fk_ext_requester FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_ext_decider FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_extensions_assignment ON assignment_extensions(assignment_id);

-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE TABLE documents (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    public_id           CHAR(36) NOT NULL DEFAULT (UUID()),  -- used in download URLs, never the sequential id
    case_id             BIGINT UNSIGNED NOT NULL,
    uploaded_by         BIGINT UNSIGNED NOT NULL,
    document_type       ENUM(
                            'contract_copy',
                            'evidence',
                            'submission_agreement',
                            'correspondence',
                            'award',
                            'id_kyc',
                            'other'
                        ) NOT NULL,
    visibility          ENUM('staff_arbitrator', 'shared_all_parties', 'uploader_only') NOT NULL DEFAULT 'staff_arbitrator',
    file_name           VARCHAR(255) NOT NULL,
    storage_path        VARCHAR(500) NOT NULL,               -- path on disk OUTSIDE the public web root
    mime_type           VARCHAR(150) NOT NULL,
    file_size           BIGINT UNSIGNED NOT NULL,
    version              INT UNSIGNED NOT NULL DEFAULT 1,
    checksum_sha256     CHAR(64) NOT NULL,
    scan_status         ENUM('pending', 'clean', 'infected') NOT NULL DEFAULT 'pending',
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_documents_public_id (public_id),
    CONSTRAINT fk_documents_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT,
    CONSTRAINT fk_documents_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_documents_case ON documents(case_id);
CREATE INDEX idx_documents_scan_status ON documents(scan_status);

-- One-off exceptions to the `visibility` default, e.g. an arbitrator shares a specific
-- staff-only document with one particular party.
CREATE TABLE document_shares (
    document_id         BIGINT UNSIGNED NOT NULL,
    party_id             BIGINT UNSIGNED NOT NULL,
    granted_by           BIGINT UNSIGNED NOT NULL,
    granted_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (document_id, party_id),
    CONSTRAINT fk_share_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT fk_share_party FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE,
    CONSTRAINT fk_share_grantor FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

ALTER TABLE cases
    ADD CONSTRAINT fk_cases_submission_doc FOREIGN KEY (submission_agreement_doc_id) REFERENCES documents(id) ON DELETE SET NULL;

-- ============================================================
-- SLA CONFIG (kept data-driven rather than hardcoded in application code)
-- ============================================================

CREATE TABLE sla_config (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tier                ENUM('simple', 'standard', 'complex') NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'KES',
    min_value           DECIMAL(18,2) NOT NULL,
    max_value           DECIMAL(18,2) NULL,                  -- NULL = no upper bound
    target_days         SMALLINT UNSIGNED NOT NULL,
    approaching_days_before DECIMAL(5,2) NOT NULL DEFAULT 14,
    escalation_days_after   DECIMAL(5,2) NOT NULL DEFAULT 30,
    UNIQUE KEY uq_sla_tier_currency (tier, currency)
) ENGINE=InnoDB;

INSERT INTO sla_config (tier, currency, min_value, max_value, target_days) VALUES
    ('simple',   'KES', 0,          5000000,    60),
    ('standard', 'KES', 5000000,    50000000,   100),
    ('complex',  'KES', 50000000,   NULL,       180);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             BIGINT UNSIGNED NOT NULL,
    type                VARCHAR(100) NOT NULL,               -- 'case_approaching_due','case_overdue','case_escalated','extension_requested', etc.
    related_entity_type VARCHAR(50) NOT NULL,
    related_entity_id   BIGINT UNSIGNED NOT NULL,
    message             VARCHAR(500) NOT NULL,
    read_at             DATETIME NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read_at);

-- ============================================================
-- AUDIT LOG (append-only; application layer must never UPDATE/DELETE these rows)
-- ============================================================

CREATE TABLE audit_logs (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             BIGINT UNSIGNED NULL,                -- NULL for system/cron-triggered actions
    action               VARCHAR(100) NOT NULL,               -- 'login','view_document','download_document','case_status_change', etc.
    entity_type          VARCHAR(50) NOT NULL,
    entity_id            BIGINT UNSIGNED NOT NULL,
    metadata              JSON NULL,
    ip_address            VARCHAR(45) NULL,
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
