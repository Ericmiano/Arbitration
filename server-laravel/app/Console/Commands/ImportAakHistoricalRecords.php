<?php

namespace App\Console\Commands;

use App\Models\Arbitrator;
use App\Models\ArbitrationCase;
use App\Models\Assignment;
use App\Models\Party;
use App\Models\User;
use App\Services\SlaService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * One-off dev/test data loader: imports AAK's real panel-of-arbitrators list
 * and historical case register (normalized out of the source .xlsx by a
 * one-time Python pass - see scratchpad/normalize_aak.py from the import
 * session) into this system's schema, for testing against realistic data.
 *
 * Not part of the production data path - nothing else in the app depends on
 * this command existing. Idempotent per case: each imported case gets a
 * deterministic AAK/HIST/{year}/{seq} case_number, so re-running against the
 * same JSON skips cases already present instead of duplicating them.
 */
class ImportAakHistoricalRecords extends Command
{
    protected $signature = 'aak:import-records {path : Path to the normalized JSON produced by normalize_aak.py}';
    protected $description = 'Imports AAK\'s real panel arbitrators and historical case register for test/dev data population';

    public function handle(): int
    {
        $path = $this->argument('path');
        if (! is_file($path)) {
            $this->error("File not found: {$path}");

            return self::FAILURE;
        }

        $data = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
        $admin = User::where('role', 'admin')->first();
        if (! $admin) {
            $this->error('No admin user exists - cannot set created_by/assigned_by.');

            return self::FAILURE;
        }

        $stats = ['arbitrators_created' => 0, 'arbitrators_existing' => 0, 'cases_created' => 0, 'cases_skipped' => 0, 'assignments_created' => 0, 'parties_created' => 0];

        DB::transaction(function () use ($data, $admin, &$stats) {
            $arbitratorMap = $this->importArbitrators($data['arbitrators'], $stats);
            $partyCache = [];
            $closedCounts = [];

            $yearSeq = [];
            foreach ($data['cases'] as $caseData) {
                $year = $caseData['year'];
                $yearSeq[$year] = ($yearSeq[$year] ?? 0) + 1;
                $caseNumber = sprintf('AAK/HIST/%d/%03d', $year, $yearSeq[$year]);

                if (ArbitrationCase::where('case_number', $caseNumber)->exists()) {
                    $stats['cases_skipped']++;

                    continue;
                }

                $this->importCase($caseData, $caseNumber, $admin, $arbitratorMap, $partyCache, $closedCounts, $stats);
            }

            foreach ($closedCounts as $arbitratorId => $count) {
                Arbitrator::where('id', $arbitratorId)->update(['cases_closed_count' => $count]);
            }
        });

        $this->info('Import complete: '.json_encode($stats));

        return self::SUCCESS;
    }

    /** @return array<string, int> full name => arbitrator id */
    private function importArbitrators(array $arbitrators, array &$stats): array
    {
        $map = [];
        $usedEmails = [];

        foreach ($arbitrators as $a) {
            $existing = Arbitrator::where('full_name', $a['fullName'])->first();
            if ($existing) {
                $map[$a['fullName']] = $existing->id;
                $stats['arbitrators_existing']++;

                continue;
            }

            $email = $a['email'] ?: $this->generateEmail($a['fullName'], $usedEmails);
            $email = mb_strtolower(trim($email));
            if (User::where('email', $email)->exists() || in_array($email, $usedEmails, true)) {
                $email = $this->generateEmail($a['fullName'], $usedEmails);
            }
            $usedEmails[] = $email;

            $qualificationYear = $a['qualificationYear'] ?? null;
            $yearsOfPractice = $qualificationYear ? max(0, (int) now()->year - (int) $qualificationYear) : null;
            $joinedAt = $a['joinedAt'] ?? '2015-01-01';

            $bioParts = array_filter([$a['grade'] ?? null]);
            $bio = $bioParts !== [] ? 'AAK grade: '.implode(', ', $bioParts) : null;
            $notes = $a['notes'] ?? null;

            $user = User::create([
                'email' => $email,
                'password_hash' => Hash::make(Str::random(16)),
                'full_name' => $a['fullName'],
                'role' => 'arbitrator',
                'status' => 'active', // login access - independent of panel availability, tracked on Arbitrator::status below
            ]);

            $arbitrator = Arbitrator::create([
                'user_id' => $user->id,
                'full_name' => $a['fullName'],
                'current_position' => $a['profession'] ?? null,
                'years_of_practice' => $yearsOfPractice,
                'phone' => $a['phone'] ? (string) $a['phone'] : null,
                'bio' => $bio,
                'adr_experience_notes' => $notes,
                'status' => in_array($a['status'], ['active', 'inactive', 'suspended'], true) ? $a['status'] : 'active',
                'joined_at' => $joinedAt,
                'aak_membership_no' => $a['membershipNo'] ? (string) $a['membershipNo'] : null,
            ]);

            if (! empty($a['profession'])) {
                $arbitrator->specializations()->create(['specialization' => $a['profession']]);
            }
            if (! empty($a['qualification'])) {
                $arbitrator->qualifications()->create(['qualification' => $a['qualification']]);
            }
            foreach ($a['registrations'] ?? [] as $r) {
                if (! empty($r['body'])) {
                    $arbitrator->registrations()->create(['body' => $r['body'], 'registration_number' => $r['registrationNumber'] ?? null]);
                }
            }

            $map[$a['fullName']] = $arbitrator->id;
            $stats['arbitrators_created']++;
        }

        return $map;
    }

    private function generateEmail(string $fullName, array $usedEmails): string
    {
        $base = Str::slug($fullName) ?: 'arbitrator';
        $email = "{$base}@aak-import.local";
        $i = 2;
        while (User::where('email', $email)->exists() || in_array($email, $usedEmails, true)) {
            $email = "{$base}{$i}@aak-import.local";
            $i++;
        }

        return $email;
    }

    private function findOrCreateParty(?string $name, array &$partyCache, array &$stats): ?Party
    {
        $name = $name ? trim($name) : null;
        if (! $name || mb_strlen($name) < 2) {
            return null;
        }
        $name = mb_substr($name, 0, 255);
        $key = mb_strtolower($name);
        if (isset($partyCache[$key])) {
            return $partyCache[$key];
        }

        $party = Party::where('full_name', $name)->first();
        if (! $party) {
            $isOrganization = (bool) preg_match('/\b(ltd|limited|company|advocates|llp|society|cooperative|co-operative|corporation|bank|group)\b/i', $name);
            $party = Party::create([
                'type' => $isOrganization ? 'organization' : 'individual',
                'full_name' => $name,
            ]);
            $stats['parties_created']++;
        }

        $partyCache[$key] = $party;

        return $party;
    }

    private function importCase(array $c, string $caseNumber, User $admin, array $arbitratorMap, array &$partyCache, array &$closedCounts, array &$stats): void
    {
        $disputeValue = $c['disputeValue'] ?? $c['contractValue'] ?? 100000.0;
        if ($disputeValue <= 0) {
            $disputeValue = 100000.0;
        }
        $slaTier = SlaService::deriveTier((float) $disputeValue, 'KES');
        $filedAt = Carbon::parse($c['filedAt']);
        $dueDate = SlaService::computeDueDate($slaTier, 'KES', $filedAt);

        $determined = ! empty($c['determination']) || ! empty($c['dateDetermined']);
        $hasArbitrator = ! empty($c['arbitratorResolvedName']) && isset($arbitratorMap[$c['arbitratorResolvedName']]);

        $status = $determined ? 'closed' : ($hasArbitrator ? 'ongoing' : 'pending_assignment');
        $concludedAt = null;
        $outcome = null;
        if ($determined) {
            $concludedAt = ! empty($c['dateDetermined']) ? Carbon::parse($c['dateDetermined']) : $filedAt->copy()->addDays(90);
            $detLower = mb_strtolower((string) ($c['determination'] ?? ''));
            $outcome = str_contains($detLower, 'settl') ? 'settled' : (str_contains($detLower, 'withdraw') ? 'withdrawn' : 'award_issued');
        }

        $descriptionParts = array_filter([
            $c['project'] ?? null,
            ! empty($c['partiesText']) ? 'Parties: '.$c['partiesText'] : null,
            ! empty($c['comments']) ? 'Comments: '.$c['comments'] : null,
            ! empty($c['determination']) ? 'Determination: '.$c['determination'] : null,
        ]);
        $description = implode(' | ', $descriptionParts) ?: 'Imported historical AAK case record';

        $case = ArbitrationCase::create([
            'case_number' => $caseNumber,
            'dispute_value' => $disputeValue,
            'currency' => 'KES',
            'category' => $c['category'] ?? 'construction_general',
            'description' => mb_substr($description, 0, 5000),
            'basis' => 'contractual_clause',
            'sla_tier' => $slaTier,
            'due_date' => $dueDate->toDateString(),
            'status' => $status,
            'filed_at' => $filedAt,
            'concluded_at' => $concludedAt,
            'outcome' => $outcome,
            'outcome_detail' => $c['determination'] ?? null,
            'created_by' => $admin->id,
        ]);
        $stats['cases_created']++;

        $claimantParty = $this->findOrCreateParty($c['partyA'] ?? $c['claimant'] ?? $c['applicant'] ?? null, $partyCache, $stats);
        $respondentParty = $this->findOrCreateParty($c['partyB'] ?? null, $partyCache, $stats);
        if ($claimantParty) {
            $case->parties()->attach($claimantParty->id, ['role' => 'claimant']);
        }
        if ($respondentParty && (! $claimantParty || $respondentParty->id !== $claimantParty->id)) {
            $case->parties()->attach($respondentParty->id, ['role' => 'respondent']);
        }

        if ($hasArbitrator) {
            $arbitratorId = $arbitratorMap[$c['arbitratorResolvedName']];
            Assignment::create([
                'case_id' => $case->id,
                'arbitrator_id' => $arbitratorId,
                'assigned_by' => $admin->id,
                'assigned_at' => $filedAt,
                'due_date' => $dueDate->toDateString(),
                'status' => $status === 'closed' ? 'completed' : 'ongoing',
                'completed_at' => $status === 'closed' ? $concludedAt : null,
            ]);
            $stats['assignments_created']++;

            if ($status === 'closed') {
                $closedCounts[$arbitratorId] = ($closedCounts[$arbitratorId] ?? 0) + 1;
            }
        }
    }
}
