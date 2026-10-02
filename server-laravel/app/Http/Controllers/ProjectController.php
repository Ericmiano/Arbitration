<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Support\Ids;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ProjectController extends Controller
{
    public function index(): JsonResponse
    {
        $projects = Project::with('contracts:id,project_id,reference_number,has_arbitration_clause')
            ->orderBy('name')->limit(500)->get();

        return response()->json($projects);
    }

    public function store(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'description' => ['nullable', 'string'],
                'sector' => ['nullable', 'string', 'max:150'],
                'value' => ['nullable', 'numeric', 'gt:0'],
                'currency' => ['nullable', 'string', 'size:3'],
                'location' => ['nullable', 'string', 'max:255'],
            ]);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->errors()], 400);
        }

        $project = Project::create([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'sector' => $data['sector'] ?? null,
            'value' => $data['value'] ?? null,
            'currency' => $data['currency'] ?? 'KES',
            'location' => $data['location'] ?? null,
        ]);

        return response()->json($project, 201);
    }

    public function storeContract(Request $request, string $projectId): JsonResponse
    {
        $id = Ids::parse($projectId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid project id'], 400);
        }

        try {
            $data = $request->validate([
                'referenceNumber' => ['nullable', 'string', 'max:150'],
                'executionDate' => ['nullable', 'date'],
                'value' => ['nullable', 'numeric', 'gt:0'],
                'currency' => ['nullable', 'string', 'size:3'],
                'hasArbitrationClause' => ['nullable', 'boolean'],
                'arbitrationClauseText' => ['nullable', 'string'],
                'governingLaw' => ['nullable', 'string', 'max:150'],
                'parties' => ['required', 'array', 'min:2'],
                'parties.*.partyId' => ['required', 'integer', 'min:1'],
                'parties.*.role' => ['required', 'string', 'max:100'],
            ]);
        } catch (ValidationException) {
            return response()->json(['error' => 'Invalid request'], 400);
        }

        $project = Project::find($id);
        if (! $project) {
            return response()->json(['error' => 'Project not found'], 404);
        }

        $contract = $project->contracts()->create([
            'reference_number' => $data['referenceNumber'] ?? null,
            'execution_date' => $data['executionDate'] ?? null,
            'value' => $data['value'] ?? null,
            'currency' => $data['currency'] ?? 'KES',
            'has_arbitration_clause' => $data['hasArbitrationClause'] ?? false,
            'arbitration_clause_text' => $data['arbitrationClauseText'] ?? null,
            'governing_law' => $data['governingLaw'] ?? null,
        ]);

        foreach ($data['parties'] as $p) {
            $contract->parties()->attach($p['partyId'], ['role' => $p['role']]);
        }

        return response()->json($contract->load('parties'), 201);
    }
}
