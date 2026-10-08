<?php

namespace App\Http\Controllers;

use App\Models\Arbitrator;
use App\Models\ArbitrationCase;
use App\Models\Document;
use App\Models\DocumentShare;
use App\Models\Party;
use App\Models\DocumentVersion;
use App\Services\AuditService;
use App\Services\CaseAccessService;
use App\Services\CaseTimelineService;
use App\Services\DocumentAiService;
use App\Support\Ids;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DocumentController extends Controller
{
    // Only formats AAK actually expects for scanned dispute documents.
    private const ALLOWED_MIME_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    public function store(Request $request): JsonResponse
    {
        if (! $request->hasFile('file')) {
            return response()->json(['error' => 'A file is required'], 400);
        }
        $file = $request->file('file');
        // Captured now, before move() - afterwards the UploadedFile still
        // points at the original tmp path, which by then no longer exists,
        // and a later getMimeType() call throws instead of returning it.
        $mimeType = $file->getMimeType();
        if (! $file->isValid() || ! in_array($mimeType, self::ALLOWED_MIME_TYPES, true)) {
            return response()->json(['error' => 'Unsupported file type'], 400);
        }

        try {
            $data = $request->validate([
                'caseId' => ['required', 'integer', 'min:1'],
                'documentType' => ['required', 'in:contract_copy,evidence,submission_agreement,correspondence,award,id_kyc,other'],
                'visibility' => ['nullable', 'in:staff_arbitrator,shared_all_parties,uploader_only'],
            ]);
        } catch (ValidationException) {
            return response()->json(['error' => 'caseId and documentType are required'], 400);
        }

        $user = Auth::user();
        if (! CaseAccessService::canAccess($data['caseId'], $user)) {
            return response()->json(['error' => 'Case not found'], 404);
        }

        // Only staff/arbitrator may choose to widen visibility beyond the
        // default - enforced here, not trusted from the client for party uploads.
        $isStaffOrArbitrator = $user->role !== 'party';
        $visibility = $isStaffOrArbitrator ? ($data['visibility'] ?? 'staff_arbitrator') : 'uploader_only';

        // Never trust the original filename for the stored path - avoids
        // path traversal and collisions. The original name is kept
        // separately in the documents.file_name DB column for display only.
        $storedName = Str::uuid()->toString().'.'.$file->getClientOriginalExtension();
        $destination = config('app.document_storage_path');
        if (! is_dir($destination)) {
            mkdir($destination, 0755, true);
        }
        $file->move($destination, $storedName);
        $absolutePath = $destination.DIRECTORY_SEPARATOR.$storedName;
        $checksum = hash_file('sha256', $absolutePath);

        $document = Document::create([
            'case_id' => $data['caseId'],
            'uploaded_by' => $user->id,
            'document_type' => $data['documentType'],
            'visibility' => $visibility,
            'file_name' => $file->getClientOriginalName(),
            'storage_path' => $storedName,
            'mime_type' => $mimeType,
            'file_size' => filesize($absolutePath),
            'checksum_sha256' => $checksum,
            'scan_status' => 'pending',
        ]);
        // public_id is a DB-generated default (uuid()) - the in-memory model
        // doesn't know it until we re-read the row, and without this the API
        // response below would hand back publicId: null for a document that
        // very much has one, making it unreachable by the caller right after upload.
        $document->refresh();

        AuditService::log($user->id, 'document_uploaded', 'document', $document->id, ['caseId' => $data['caseId'], 'documentType' => $data['documentType']], $request->ip());
        CaseTimelineService::log(
            (int) $data['caseId'], 'document_uploaded', $user->id,
            "Document uploaded: {$document->file_name}",
            referenceType: 'document', referenceId: (int) $document->id,
        );

        // Best-effort AI assist: only worth scanning documents that actually
        // describe the dispute, and only while assignment is still
        // undecided - a scan after that point can't change who gets picked.
        $caseDefiningTypes = ['submission_agreement', 'contract_copy', 'evidence'];
        $preAssignmentStatuses = ['intake', 'pending_agreement', 'pending_assignment'];
        if (in_array($data['documentType'], $caseDefiningTypes, true) && DocumentAiService::isConfigured()) {
            $case = ArbitrationCase::find($data['caseId']);
            if ($case && in_array($case->status, $preAssignmentStatuses, true)) {
                DocumentAiService::scanAndSuggest($document, $case);
            }
        }

        return response()->json([
            'publicId' => $document->public_id,
            'fileName' => $document->file_name,
            'documentType' => $document->document_type,
            'visibility' => $document->visibility,
            'createdAt' => $document->created_at,
        ], 201);
    }

    /**
     * Uploads a new version of an existing document. The live `documents`
     * row stays the current pointer (same public_id, so existing
     * links/shares never break) - its current file info is archived into
     * document_versions first, then overwritten in place with the new file.
     */
    public function storeVersion(Request $request, string $publicId): JsonResponse
    {
        $document = Document::where('public_id', $publicId)->first();
        if (! $document) {
            return response()->json(['error' => 'Document not found'], 404);
        }

        $user = Auth::user();
        if (! $this->canView($document, $user)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        if (! $request->hasFile('file')) {
            return response()->json(['error' => 'A file is required'], 400);
        }
        $file = $request->file('file');
        $mimeType = $file->getMimeType();
        if (! $file->isValid() || ! in_array($mimeType, self::ALLOWED_MIME_TYPES, true)) {
            return response()->json(['error' => 'Unsupported file type'], 400);
        }

        try {
            $data = $request->validate(['changeReason' => ['nullable', 'string', 'max:500']]);
        } catch (ValidationException) {
            $data = ['changeReason' => null];
        }

        $storedName = Str::uuid()->toString().'.'.$file->getClientOriginalExtension();
        $destination = config('app.document_storage_path');
        $file->move($destination, $storedName);
        $absolutePath = $destination.DIRECTORY_SEPARATOR.$storedName;
        $checksum = hash_file('sha256', $absolutePath);
        $newFileSize = filesize($absolutePath);

        DocumentVersion::create([
            'document_id' => $document->id,
            'version_number' => $document->version,
            'storage_path' => $document->storage_path,
            'checksum_sha256' => $document->checksum_sha256,
            'file_size' => $document->file_size,
            'uploaded_by' => $document->uploaded_by,
            'uploaded_at' => $document->created_at,
            'change_reason' => null,
        ]);

        $oldAbsolutePath = $destination.DIRECTORY_SEPARATOR.$document->storage_path;

        $document->update([
            'storage_path' => $storedName,
            'mime_type' => $mimeType,
            'file_size' => $newFileSize,
            'checksum_sha256' => $checksum,
            'version' => $document->version + 1,
            'scan_status' => 'pending',
        ]);

        if (is_file($oldAbsolutePath)) {
            unlink($oldAbsolutePath);
        }

        AuditService::log($user->id, 'document_version_uploaded', 'document', $document->id, ['version' => $document->version], $request->ip());
        CaseTimelineService::log(
            (int) $document->case_id, 'document_version_uploaded', $user->id,
            "New version (v{$document->version}) uploaded: {$document->file_name}",
            $data['changeReason'], referenceType: 'document', referenceId: (int) $document->id,
        );

        return response()->json([
            'publicId' => $document->public_id,
            'fileName' => $document->file_name,
            'version' => $document->version,
        ]);
    }

    private function canView(Document $document, $user): bool
    {
        if ($user->isStaff()) {
            return true;
        }

        if ($user->role === 'arbitrator') {
            if ($document->visibility === 'uploader_only') {
                return false;
            }
            $arbitrator = Arbitrator::where('user_id', $user->id)->first();
            if (! $arbitrator) {
                return false;
            }

            return $arbitrator->assignments()->where('case_id', $document->case_id)->exists();
        }

        // role === 'party'
        $party = Party::where('user_id', $user->id)->first();
        if (! $party) {
            return false;
        }
        if ((int) $document->uploaded_by === (int) $user->id) {
            return true;
        }

        $explicitlyShared = DocumentShare::where('document_id', $document->id)->where('party_id', $party->id)->exists();
        if ($explicitlyShared) {
            return true;
        }

        if ($document->visibility === 'shared_all_parties') {
            return $party->cases()->where('cases.id', $document->case_id)->exists();
        }

        return false;
    }

    /**
     * Documents for one case (?caseId=), or - with no caseId - the full
     * register across every case the current user can access (staff: all;
     * arbitrator: their assigned cases; party: their own cases), for the
     * Document register screen. Either way, results are filtered
     * per-document by canView(). ?q= matches file name (FULLTEXT, natural
     * language) - applied before the canView filter, same as every other
     * scope here.
     */
    public function index(Request $request): JsonResponse
    {
        $caseIdParam = $request->query('caseId');
        $user = Auth::user();

        if ($caseIdParam !== null) {
            $caseId = Ids::parse($caseIdParam);
            if ($caseId === null) {
                return response()->json(['error' => 'Invalid caseId'], 400);
            }
            if (! CaseAccessService::canAccess($caseId, $user)) {
                return response()->json(['error' => 'Case not found'], 404);
            }
            $caseIds = [$caseId];
        } else {
            $caseIds = CaseAccessService::accessibleCaseIds($user);
        }

        $query = Document::whereIn('case_id', $caseIds)->with('case:id,case_number');

        if ($q = $request->query('q')) {
            $query->whereFullText('file_name', $q);
        }

        $documents = $query->orderByDesc('created_at')
            ->limit(500)
            ->get();

        return response()->json(
            $documents->filter(fn (Document $d) => $this->canView($d, $user))
                ->map(fn (Document $d) => [
                    'publicId' => $d->public_id,
                    'fileName' => $d->file_name,
                    'documentType' => $d->document_type,
                    'visibility' => $d->visibility,
                    'uploadedBy' => $d->uploaded_by,
                    'scanStatus' => $d->scan_status,
                    'version' => $d->version,
                    'createdAt' => $d->created_at,
                    'caseId' => $d->case->id,
                    'caseNumber' => $d->case->case_number,
                ])->values()
        );
    }

    public function show(Request $request, string $publicId)
    {
        $document = Document::where('public_id', $publicId)->first();
        if (! $document) {
            return response()->json(['error' => 'Document not found'], 404);
        }

        $user = Auth::user();
        if (! $this->canView($document, $user)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $absolutePath = config('app.document_storage_path').DIRECTORY_SEPARATOR.$document->storage_path;
        if (! is_file($absolutePath)) {
            return response()->json(['error' => 'File is no longer available'], 410);
        }

        AuditService::log($user->id, 'document_downloaded', 'document', $document->id, null, $request->ip());

        return response()->download($absolutePath, $document->file_name);
    }
}
