<?php

namespace App\Http\Controllers;

use App\Models\Party;
use App\Models\User;
use App\Support\Ids;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PartyController extends Controller
{
    /** ?q= matches full name (FULLTEXT, natural language) or exact email/phone. */
    public function index(Request $request): JsonResponse
    {
        $query = Party::with('organization:id,name')->orderBy('full_name')->limit(500);

        if ($q = $request->query('q')) {
            $query->where(function ($inner) use ($q) {
                $inner->whereFullText('full_name', $q)
                    ->orWhere('email', $q)
                    ->orWhere('phone', $q);
            });
        }

        return response()->json($query->get());
    }

    /**
     * Creates a party record for intake purposes. This does NOT create a
     * portal login (parties.user_id stays null) - that's a separate,
     * deliberate step (see invite()) once AAK wants to grant a party
     * document-viewing access to the system.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'type' => ['required', 'in:individual,organization'],
                'organizationId' => ['nullable', 'integer', 'min:1'],
                'fullName' => ['required', 'string', 'max:255'],
                'email' => ['nullable', 'email'],
                'phone' => ['nullable', 'string', 'max:50'],
                'address' => ['nullable', 'string', 'max:500'],
            ]);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->errors()], 400);
        }

        if ($data['type'] === 'organization' && empty($data['organizationId'])) {
            return response()->json(['error' => 'organizationId is required when type is organization'], 400);
        }

        $party = Party::create([
            'type' => $data['type'],
            'organization_id' => $data['type'] === 'organization' ? $data['organizationId'] : null,
            'full_name' => $data['fullName'],
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'address' => $data['address'] ?? null,
        ]);

        return response()->json($party, 201);
    }

    /**
     * Grants a party portal access - creates their login (role='party') and
     * links it to the existing party record, so they can log in to view
     * their own case(s) and documents shared with them. A party created
     * purely for record-keeping (staff manage everything on their behalf)
     * never needs this.
     */
    public function invite(Request $request, string $partyId): JsonResponse
    {
        $id = Ids::parse($partyId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid party id'], 400);
        }

        try {
            $data = $request->validate(['email' => ['required', 'email']]);
        } catch (ValidationException) {
            return response()->json(['error' => 'A valid email is required'], 400);
        }

        $party = Party::find($id);
        if (! $party) {
            return response()->json(['error' => 'Party not found'], 404);
        }
        if ($party->user_id) {
            return response()->json(['error' => 'Party already has portal access'], 409);
        }

        if (User::where('email', $data['email'])->exists()) {
            return response()->json(['error' => 'A user with this email already exists'], 409);
        }

        $temporaryPassword = Str::random(12);

        DB::transaction(function () use ($data, $temporaryPassword, $party) {
            $user = User::create([
                'email' => $data['email'],
                'password_hash' => Hash::make($temporaryPassword),
                'role' => 'party',
                'status' => 'active',
            ]);
            $party->update(['user_id' => $user->id]);
        });

        return response()->json(['message' => 'Portal access granted', 'temporaryPassword' => $temporaryPassword], 201);
    }
}
