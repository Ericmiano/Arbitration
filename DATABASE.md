# The AAK Arbitration database

MySQL 8 / InnoDB, `utf8mb4`/`utf8mb4_unicode_ci` throughout, managed entirely
through Laravel migrations (`server-laravel/database/migrations/`) - there
is no hand-maintained `schema.sql` for this version; the migrations *are*
the schema, in order, each one a single reviewable change with its own
rationale in comments.

34 tables (plus Laravel's own framework tables - sessions, cache, jobs,
migrations - which carry no domain data). At the time of writing: 53 users,
52 arbitrators, 434 parties, 294 cases, 226 assignments, 226 tribunals.

The 10 most recent tables (`case_tribunals` through `deadline_extensions`
below) came from a second, deeper pass: the original design modeled "a case
with an arbitrator, documents and hearings" well, but a real arbitration
platform needs the full procedural record - who was actually appointed and
in what capacity, a defensible conflict-check history, formal filings
distinct from ad-hoc document uploads, and a genuine case timeline. That
pass deliberately stopped at what the audit driving it called P0 -
representatives, exhibit numbering, service-of-process records, and fees
are noted but not built (see "Known gaps").

## Design philosophy

A handful of decisions repeat throughout the schema and are worth stating
once up front, because almost everything else follows from them:

1. **Login identity and domain identity are separate tables.** `users` only
   ever holds "who can log in and as what role" - email, password hash,
   role, lockout state. Every role's *actual* profile lives in its own
   table (`arbitrators`, `parties`) linked back by a nullable/unique
   `user_id`. A party can exist in the system (attached to a case, holding
   documents) for years before ever getting portal access, or never at
   all - staff manage everything on their behalf until `PartyController::invite()`
   deliberately grants a login. This also means deleting a login can never
   accidentally delete the underlying case history: `parties.user_id` is
   `ON DELETE SET NULL`, not cascade.

2. **Never trust a sequential ID where the outside world will see it.**
   `users`, `cases`, and `documents` each carry both an internal
   auto-increment `id` (used for every FK and join) and a `public_id`
   UUID (`CHAR(36) DEFAULT (uuid())`, computed by MySQL itself, not the
   app) used in URLs and API responses. This is why login responses
   return a UUID-looking `id` while `/users/{id}` PATCH calls take a plain
   integer - the two ID spaces are deliberately different, and mixing them
   up is a real bug class this schema was designed to avoid (an early
   version of this codebase leaked full Prisma query text via oversized
   sequential IDs in an error message - see `bootstrap/app.php`'s exception
   handling for the other half of that fix).

3. **Business rules that must never be violated live at the database
   layer, not just in application code.** A `CHECK` constraint
   (`chk_conflict_target`) makes it physically impossible to record an
   `arbitrator_conflicts` row that names neither a party nor an
   organization. Foreign keys are `RESTRICT` by default and `CASCADE`
   only where the child row has no meaning without its parent (e.g.
   `case_parties` cascades when a `case` is deleted; `documents` does
   *not* cascade when a `case` is deleted - a case with documents can't be
   deleted at all without deliberately removing them first).

4. **Status is an enum, and the enum is deliberately small.** `cases`,
   `assignments`, `documents`, `hearings`, `assignment_extensions` all use
   MySQL `ENUM` columns rather than free-text status strings - invalid
   states are rejected at the column level, not just by application
   validation. When a status concept turned out to be wrong (see below),
   the fix was to *remove* values from the enum, not add a parallel column.

5. **Scoring reflects what an arbitrator actually controls.** This is the
   one place domain judgment shaped the schema most visibly - see
   "Scoring" below.

## Domain map

| Group | Tables |
|---|---|
| Identity & access | `users`, `password_reset_tokens` |
| Arbitrator panel | `arbitrators`, `arbitrator_specializations`, `arbitrator_qualifications`, `arbitrator_registrations`, `arbitrator_conflicts`, `arbitrator_score_history` |
| Parties & organizations | `parties`, `organizations` |
| Project/contract context | `projects`, `contracts`, `contract_parties` |
| Case lifecycle | `cases`, `case_parties`, `case_updates`, `case_number_sequences`, `case_status_history`, `case_events` |
| Tribunal | `case_tribunals`, `tribunal_members`, `case_conflict_checks` |
| Arbitration process | `assignments`, `assignment_extensions`, `hearings`, `deadlines`, `deadline_extensions` |
| Filings | `filings`, `filing_documents` |
| Documents | `documents`, `document_shares`, `document_versions` |
| Reference data | `sla_config` |
| System | `notifications`, `audit_logs` |

## Table-by-table

### Identity & access

**`users`** - one row per login, any role. `role` is
`admin|registrar|staff|arbitrator|party`; `admin`/`registrar`/`staff` are
collectively "staff" (`User::isStaff()`). Lockout is columns on the row
itself (`failed_login_count`, `locked_until`), not a separate table - cheap
enough, and it means a lockout check is always exactly one row read. MFA
columns (`mfa_secret`, `mfa_enabled`) exist but nothing in the app turns
them on yet - reserved, not wired.

**`password_reset_tokens`** - `token_hash` (SHA-256 of the actual token,
never the token itself) is unique-indexed and the only way to look a
request up; `used_at` makes a token single-use without deleting the audit
trail of it having existed.

### Arbitrator panel

**`arbitrators`** - the profile: name, AAK membership number, current
position/organization/chapter, `years_of_practice` (professional field
experience, entered once at onboarding), `joined_at` (date they joined the
AAK panel - this is what `years_as_arbitrator` is computed from, kept
deliberately distinct from `years_of_practice`), `score` (decimal, default
70 - see Scoring), `cases_closed_count`, and a `status` enum
(`active|inactive|suspended`) that gates whether they appear in the
assignable pool at all. `FULLTEXT(full_name, current_position, bio,
adr_experience_notes)` backs free-text search; `(status, score)` is
indexed together because "active arbitrators ordered by score" is the
single most-run arbitrator query in the app.

**`arbitrator_specializations`** / **`arbitrator_qualifications`** /
**`arbitrator_registrations`** - each a simple one-to-many
detail table (specialization tags, degree/qualification strings,
professional-body registrations like IQSK/IEK membership numbers).
`arbitrator_specializations` uses a composite primary key
(`arbitrator_id`, `specialization`) instead of a surrogate ID - it's a pure
tag association, so the natural key *is* the row.

**`arbitrator_conflicts`** - a declared conflict of interest, against
either a `party` or an `organization` (the `CHECK` constraint above
enforces "at least one of the two", and the FKs are `CASCADE` since a
conflict record means nothing once the party/org/arbitrator it names is
gone). `ConflictService` reads this table to exclude arbitrators outright
from a case's eligible pool.

**`arbitrator_score_history`** - one append-style row per score
recalculation, keeping `case_id` nullable + `ON DELETE SET NULL` (the
history entry should survive even if the triggering case is later purged,
which nothing currently does, but the schema doesn't assume it never will).

### Parties & organizations

**`parties`** - a person or organization involved in a dispute (claimant,
respondent, or "other"). `type` distinguishes individual vs organization;
`organization_id` links to a shared `organizations` row when several
parties belong to the same company. `FULLTEXT(full_name)` plus an index on
`user_id` (added specifically because every party-role request resolves
through `Party::where('user_id', ...)`, and it had no index at all until a
recent pass caught it).

**`organizations`** - deliberately thin (name, registration number,
address, sector) - it exists so "these five parties are all the same
company" is a real relationship, not a repeated string.

### Project/contract context

**`projects`** / **`contracts`** / **`contract_parties`** - the
underlying construction project and contract a dispute may arise from.
`contracts.has_arbitration_clause` is what `CaseController::store` checks
before letting a case be filed on the `contractual_clause` basis - a
contract without one forces the `mutual_agreement` basis instead, which
requires a signed submission agreement upload before assignment.

### Case lifecycle

**`cases`** - the center of the schema. Beyond the obvious (case number,
category, description, dispute value/currency, `basis`, `sla_tier`), three
things stand out:
- `status` is an 8-value enum spanning the whole lifecycle: `intake` →
  `pending_agreement` (only for `mutual_agreement` cases) or
  `pending_assignment` → `ongoing` → `concluded`/`closed`/`withdrawn`.
  There is deliberately **no** `overdue` or `escalated` value - that
  concept was removed (see `case_updates` below).
- `ai_suggested_category` / `ai_suggested_specializations` (JSON) /
  `ai_scanned_at` - populated best-effort by `DocumentAiService` after an
  early case document is scanned, purely to bias `ArbitratorController::eligible`'s
  ranking. Nullable throughout; the feature no-ops cleanly with no API key
  configured, and nothing else in the schema depends on these ever being set.
- `FULLTEXT(description)` for free-text case search - `case_number` and
  party-name matches in the same search stay `LIKE`, since a leading
  wildcard on a long free-text field is the one that actually can't scale,
  not a short structured code.

**`case_parties`** - the claimant/respondent/other join table, composite
PK (`case_id`, `party_id`) since a party can't hold two roles on the same
case.

**`case_status_history`** - every transition `cases.status` has ever made:
`from_status` (nullable - a case's first row has no prior status),
`to_status`, `changed_by_user_id`, `reason`. Written exclusively through
`CaseTimelineService::statusChanged()`, never directly, so there's one
place that guarantees a status change is always paired with a record of
who made it and when. Historical (imported) cases have **no** rows here -
the source register never recorded that history, and fabricating
transition dates would misrepresent real cases; only their transitions
*going forward* get recorded.

**`case_events`** - the procedural timeline a case detail screen actually
renders: `event_type` (free string - `case_filed`, `arbitrator_appointed`,
`filing_submitted`, `deadline_created`, ... - deliberately not an enum,
since this vocabulary keeps growing and none of it needs database-level
rejection of an unrecognized value), `title`/`description` for display,
and a loose `reference_type`/`reference_id` pointer (same pattern as
`audit_logs`, not a real FK) back to whatever triggered it. Every status
change also produces one of these (via the same `CaseTimelineService`
call), so the timeline and the structured status history never drift
apart. Distinct from `case_updates` on purpose (see below) and from
`audit_logs` (system/security history keyed by arbitrary entity, not a
per-case narrative).

**`case_updates`** - append-only progress notes an arbitrator (or staff)
posts against an ongoing case. This table **is the replacement** for
automatic deadline-based overdue tracking: AAK's own experience is that a
case running long is often outside the arbitrator's control (party delays,
case complexity), so the schema stopped trying to infer "late" from dates
alone. Instead, `cases:remind-updates` (a daily scheduled command) reads
this table to nudge an arbitrator once a case goes quiet, and separately
flags genuinely stale cases to staff - without ever touching the case's
status or the arbitrator's score directly.

**`case_number_sequences`** - one row per year, `next_sequence` incremented
under `SELECT ... FOR UPDATE`. This exists specifically to make
`AAK/ARB/2026/0001`-style case numbers impossible to hand out twice under
concurrent intake - an earlier version computed the next number as
`COUNT(*) + 1`, which is fine until two staff submit at the same instant.

### Tribunal

This is the legal/procedural record of who is actually deciding a case -
distinct from `assignments` below, which is kept exactly as it was (the
administrative workload/scoring record `ScoringService` and
`ReportController` already depend on) and now gets populated *alongside*
these tables rather than being the only record of an appointment.

**`case_tribunals`** - `tribunal_type` (`sole` or a 3-seat `panel`),
`status` (`forming` → `constituted` → `dissolved`). A case can have
several of these over its life - if a sole arbitrator withdraws, that
tribunal dissolves and a new one is constituted for their replacement -
but only one is ever active (not dissolved) at a time.

**`tribunal_members`** - one arbitrator's seat: `role`
(`sole_arbitrator`/`co_arbitrator`/`chairperson`), `status` spanning the
full lifecycle a real appointment can take (`nominated` → `appointed` →
`accepted`, or `challenged`/`recused`/`withdrawn`/`removed`/`replaced`),
and `replaced_member_id` (self-referencing) linking a replacement back to
the specific seat they filled - so one seat's full membership history
stays traceable across withdrawals. Every currently-ongoing case that
existed before this table did has one backfilled here (`sole`,
`constituted`, dated from its `assignments` row's real `assigned_at`) -
otherwise those cases could never be concluded again, since concluding a
case requires a constituted tribunal to exist.

**`case_conflict_checks`** - a defensible record that a *specific*
arbitrator was checked against a *specific* case - not just that they
hold a standing conflict somewhere (`arbitrator_conflicts`). Written once
per appointment decision (inside `TribunalController::addMember()`,
right where `ConflictService::check()` already ran), never for every
arbitrator an eligibility list happens to render. `result` is
`cleared`/`potential_conflict`/`confirmed_conflict`; `disclosure`/
`resolution` exist for staff to record how a potential conflict was
handled, separate from the automated check itself.

### Arbitration process

**`assignments`** - links an arbitrator to a case, kept for
scoring/workload purposes. `status` is
`ongoing|completed|withdrawn|reassigned` - again, no `overdue`/`escalated`
values, for the same reason as `cases.status`. `due_date` is a *copy* of
the case's due date at assignment time, not a live reference - an
approved extension updates this copy without touching the case row, so a
case's original due date and its currently-operative one can both be
inspected independently. `(arbitrator_id, status)` is indexed together for
"this arbitrator's currently-ongoing assignments," which is read on nearly
every arbitrator-facing screen.

**`assignment_extensions`** - a due-date-change request/decision record
for an arbitrator's own case deadline, never mutates `assignments.due_date`
directly until `status = approved`.

**`hearings`** - scheduled sessions against a case, `mode` (`in_person` /
`virtual`) plus a single `venue_or_link` field that means either a
physical address or a video-call URL depending on mode, rather than two
mostly-empty columns.

**`deadlines`** / **`deadline_extensions`** - a *general* procedural
deadline (filing due, evidence due, award due, hearing prep, ...),
deliberately separate from `assignments.due_date` - that one stays
specifically "when is the arbitrator's case due," this is anything else
with a due date, optionally tied to a `tribunal_member_id` or `party_id`.
`deadline_type` is a free string, same reasoning as `case_events.event_type`.
`deadline_extensions` mirrors `assignment_extensions`' own
request/approve/reject shape exactly, just generalized to any deadline.

### Filings

**`filings`** - a formal procedural submission (e.g. "Respondent's
Statement of Defence") as its own object, distinct from the plain
document uploads making it up. `party_id` points straight at `parties`
rather than the `case_parties` pivot, since `case_parties` has no
surrogate id (composite PK on `case_id`+`party_id`) and `filings` already
carries `case_id`, so the pair identifies the same participation without
needing one. Optional by design: an ID/KYC scan or ordinary correspondence
never needs to be wrapped in a filing - `/documents` upload keeps working
completely unchanged for anything that isn't a formal submission.

**`filing_documents`** - the join table gathering a filing's main
document with its exhibits, `document_role` (free string, e.g.
"main"/"exhibit") plus `sort_order` for display order.

### Documents

**`documents`** - `storage_path` is a random UUID-derived filename, never
the original upload name (kept separately in `file_name`, display-only) -
this is a path-traversal/collision defense, and the file itself lives
outside any web-servable directory entirely (`DOCUMENT_STORAGE_PATH`,
served only through an authenticated download route). `checksum_sha256`
is computed at upload time as a tamper/corruption check. `visibility`
(`staff_arbitrator|shared_all_parties|uploader_only`) plus the separate
`document_shares` join table give two independent sharing mechanisms: a
blanket visibility level, and per-party explicit grants on top of it.
`FULLTEXT(file_name)` for the document register's search.

**`document_shares`** - composite PK (`document_id`, `party_id`); a
specific party has been explicitly handed access to a specific document,
independent of that document's general `visibility`.

**`document_versions`** - a superseded version, archived here the moment
a newer one replaces it. The live `documents` row always stays the
*current* version under its same `public_id` (so existing links/shares to
it never break) - uploading a new version copies the row's current file
info into `document_versions` first, then overwrites it in place with the
new file and bumps `version`.

### Reference data

**`sla_config`** - the only table meant to be edited directly by an admin
rather than through case-by-case application logic: dispute-value bands
per currency (`simple` <5M KES / `standard` 5–50M / `complex` 50M+), each
with a `target_days` used to compute a case's due date at assignment time.
Unique on `(tier, currency)` so a currency can't have two conflicting bands
for the same tier.

### System

**`notifications`** - in-app notifications, `(user_id, read_at)` indexed
for "this user's unread" (the single most common notification query), plus
a separate `created_at` index added for an eventual retention/pruning job -
nothing currently deletes old notifications, and this table has no
built-in bound on its growth (see "Known gaps" below).

**`audit_logs`** - **append-only by convention** (`AuditLog`'s own comment
says so explicitly) - `entity_type` + `entity_id` is a polymorphic
reference (not a real FK, since it can point at a case, document,
arbitrator, user, or anything else), indexed for "everything that happened
to this entity," plus separately by `user_id` and `created_at`. `metadata`
is a `JSON` column (MySQL enforces `json_valid()` on write) for
free-form per-action detail. Nothing at the database level currently
*prevents* an UPDATE or DELETE against this table - it's convention +
code discipline, not a hard guarantee (see "Known gaps").

## How it works: a case's life through the schema

1. **Intake** - staff creates a `cases` row (`status = intake` or
   `pending_agreement`/`pending_assignment` depending on `basis`),
   `CaseNumberService` reserves the next number atomically, `case_parties`
   rows link the claimant/respondent, and `CaseTimelineService` writes the
   case's first `case_status_history` + `case_events` rows.
2. **Agreement** (mutual_agreement cases only) - a `documents` row
   (`document_type = submission_agreement`) gets uploaded and confirmed,
   flipping the case to `pending_assignment`.
3. **Tribunal formation** - either staff or the case's own linked party
   opens a `case_tribunals` row (sole or panel) and appoints its seat(s)
   one at a time via `TribunalController::addMember()` - each appointment
   re-checks `ConflictService` (excluding anyone with an
   `arbitrator_conflicts` row against this case's parties/orgs), always
   logging a `case_conflict_checks` row either way, and creates the
   matching `assignments` row for scoring/workload. Once every seat is
   filled, the tribunal is `constituted`, the case moves to `ongoing`, and
   `due_date` is computed from `sla_config`.
4. **Ongoing** - `case_updates` rows accumulate; `hearings` and
   `deadlines` get scheduled; `assignment_extensions`/`deadline_extensions`
   can push a due date forward with staff approval; a member can be
   withdrawn/recused/removed and a replacement appointed
   (`replaced_member_id` links the two); formal submissions become
   `filings` grouping their `documents` via `filing_documents`; every
   procedural moment writes a `case_events` row (and, where the case's
   status itself changed, a matching `case_status_history` row too), plus
   an `audit_logs` row and, where relevant, a `notifications` row for
   whoever has a stake.
5. **Completion** - `TribunalController::conclude()` marks the tribunal
   `dissolved`, every active member's `assignments` row `completed`, and
   calls `ScoringService::recalculate()` (locked per-arbitrator, see
   Concurrency below) for **every** member - a panel decides collectively,
   so all of them get scored, not just one arbitrator. Each recalculation
   writes one `arbitrator_score_history` row and updates that arbitrator's
   displayed `score`/`cases_closed_count`. The `cases` row itself moves to
   `concluded`/`closed` with an `outcome`.

## Access control, as the schema sees it

There is no per-row ACL table - access is derived from the shape of the
data itself, checked in `CaseAccessService`/`ArbitratorController`/`DocumentController`:
- **Staff** (`admin`/`registrar`/`staff`) see everything.
- **Arbitrator**: `arbitrators.user_id = <session user>`, then only cases
  reachable via that arbitrator's `assignments` rows.
- **Party**: `parties.user_id = <session user>`, then only cases reachable
  via that party's `case_parties` rows (plus explicit `document_shares`
  grants for documents outside a case's blanket visibility).

This is why `parties.user_id` and `arbitrators.user_id` being properly
indexed matters as much as any case-table index - they're on the
authorization hot path of nearly every request a non-staff account makes.

## Scoring, mechanically

`arbitrators.score` (displayed) is a rolling average of the last 10
`arbitrator_score_history.score` values once an arbitrator has 3+ closed
cases (before that, a neutral 70 baseline - too little history to be
meaningful). Each history row is itself a weighted blend:
**Responsiveness 45%** (did they keep posting `case_updates` at a
reasonable cadence, not "did the case finish on time" - see the
`case_updates` section above for why), **Outcome 40%** (award upheld vs.
challenged vs. settled vs. withdrawn), **Workload 15%** (completed vs.
withdrawn/reassigned ratio).

## Search infrastructure

Four `FULLTEXT` indexes (`cases.description`, `arbitrators(full_name,
current_position, bio, adr_experience_notes)`, `parties.full_name`,
`documents.file_name`), each queried via Laravel's `whereFullText()` in
natural-language mode, each exposed as a `?q=` parameter on its
controller's `index()`. Structured, short, or exact-match fields
(`case_number`, membership numbers, emails, phone numbers) stay plain
equality/`LIKE` lookups - a wildcard `LIKE` only actually threatens to
scale badly on long free-text fields, which is exactly where each fulltext
index was added and nowhere else.

## Concurrency & atomicity

Two places do a real read-modify-write against a shared counter, and both
are now lock-guarded inside a transaction rather than relying on timing:
- `CaseNumberService::generate()` - `case_number_sequences`, `SELECT ...
  FOR UPDATE` per year.
- `ScoringService::recalculate()` - the specific `arbitrators` row,
  `lockForUpdate()`, for the duration of the recalculation.

Both were fixed together because they're the same bug shape: a value read
in one request, then written back after other work, with no lock in
between - safe until two requests happen to land at the same instant, at
which point one update silently loses.

## Production-readiness measures already in place

- Every foreign key has a matching index (Laravel does this automatically
  via `constrained()`), plus targeted composite indexes tied to real
  queries (`arbitrators(status, score)`, `assignments(arbitrator_id,
  status)`, `users(role, status)`) rather than speculative ones.
- `utf8mb4`/InnoDB/strict-mode throughout - full Unicode support (accented
  names, etc.), real transactional integrity, no silent data truncation.
- A `CHECK` constraint where application-only validation wasn't good
  enough (`arbitrator_conflicts`).
- `server-laravel/scripts/backup-db.sh` - nightly `mysqldump
  --single-transaction` (consistent snapshot without locking tables) +
  uploaded-document archive, 14-day local rotation, optional off-site copy.

## Known, deliberate gaps

Not oversights - things looked at and consciously left for a later,
explicit decision rather than guessed at:

- **No DB-level audit-log immutability.** `audit_logs` is append-only by
  convention and code discipline, not by a `BEFORE UPDATE/DELETE` trigger
  that would make it provably tamper-proof. Worth doing if/when audit
  integrity needs to be defensible to a third party, not just internally trusted.
- **No retention/archival policy.** `audit_logs` and `notifications` grow
  without bound - nothing prunes either. This is a policy question
  (arbitration records often carry a legally-required minimum retention)
  before it's a technical one.
- **Single-tenant.** Nothing in the schema scopes data by organization/tenant
  - every table assumes one AAK-shaped institution. Deliberately not
  addressed yet, per the "sell this in future, but that comes last"
  instruction it was built under.
- **Party name de-duplication.** The historical case-register import
  produced some near-duplicate party spellings (data-entry variance in the
  source spreadsheet, e.g. minor punctuation differences on the same
  company). Nothing merges these automatically - flagged, not silently fixed.
- **No formal nomination/accept-decline step.** `tribunal_members.status`
  models the full real-world lifecycle (`nominated` → `appointed` →
  `accepted`, or `challenged`/`recused`), but today's appointment flow
  goes straight to `appointed` with `accepted_at` set immediately - there's
  no arbitrator-facing "here's a nomination, accept or decline" screen
  yet. The schema doesn't need to change to add one later.
- **No procedural-order or exhibit-numbering objects.** `case_events` can
  represent "Procedural Order No. 1 issued" as an event, but there's no
  first-class `procedural_orders` table with its own order numbering, and
  `filing_documents` has no exhibit-numbering scheme (C-001/R-001 style) -
  both were scoped out of the first procedural-record pass as P1/P2, not
  P0.
- **No representatives/advocates table.** A case party's advocate or
  authorized representative isn't modeled separately yet - `parties` is
  still the only participant type on a case, which understates who's
  actually acting for a party in a real matter.
- **~~Frontend integration is partial~~ - resolved.** Filings, deadlines
  (with extension requests), and document versioning now have real UI
  (`CaseDetail.tsx`'s Filings/Deadlines tabs and the Documents tab's
  "Replace" action), matching the tribunal/panel appointment flow's
  Arbitrator tab. Every backend surface built in the procedural-record
  pass now has a frontend screen.
