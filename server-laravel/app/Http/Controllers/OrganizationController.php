<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class OrganizationController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Organization::orderBy('name')->limit(500)->get());
    }

    public function store(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'registrationNumber' => ['nullable', 'string', 'max:100'],
                'address' => ['nullable', 'string', 'max:500'],
                'sector' => ['nullable', 'string', 'max:150'],
            ]);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->errors()], 400);
        }

        $organization = Organization::create([
            'name' => $data['name'],
            'registration_number' => $data['registrationNumber'] ?? null,
            'address' => $data['address'] ?? null,
            'sector' => $data['sector'] ?? null,
        ]);

        return response()->json($organization, 201);
    }
}
