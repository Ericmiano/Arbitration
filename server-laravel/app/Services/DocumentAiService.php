<?php

namespace App\Services;

use App\Models\ArbitrationCase;
use App\Models\ArbitratorSpecialization;
use App\Models\Document;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Smalot\PdfParser\Parser;

/**
 * Best-effort AI assist for case assignment: scans an early case document
 * (submission agreement / contract / evidence) and suggests a case category
 * and matching arbitrator specialization tags, which ArbitratorController's
 * eligible() then uses to flag likely-good matches. Never authoritative and
 * never blocks the upload it's attached to - a missing API key, a parse
 * failure, or an API error all just mean no suggestion gets stored.
 */
class DocumentAiService
{
    private const MAX_CHARS = 12000;

    public static function isConfigured(): bool
    {
        return (bool) config('services.anthropic.key');
    }

    public static function scanAndSuggest(Document $document, ArbitrationCase $case): void
    {
        if (! self::isConfigured()) {
            return;
        }

        try {
            $text = self::extractText($document);
            if ($text === null || trim($text) === '') {
                return;
            }

            $knownSpecializations = ArbitratorSpecialization::distinct()->pluck('specialization')->all();
            $suggestion = self::classify($text, $knownSpecializations);
            if ($suggestion === null) {
                return;
            }

            $case->update([
                'ai_suggested_category' => $suggestion['category'],
                'ai_suggested_specializations' => $suggestion['specializations'],
                'ai_scanned_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('DocumentAiService: scan failed', ['document_id' => $document->id, 'error' => $e->getMessage()]);
        }
    }

    private static function extractText(Document $document): ?string
    {
        $absolutePath = config('app.document_storage_path').DIRECTORY_SEPARATOR.$document->storage_path;
        if (! is_file($absolutePath)) {
            return null;
        }

        if ($document->mime_type === 'application/pdf') {
            $pdf = (new Parser)->parseFile($absolutePath);

            return mb_substr($pdf->getText(), 0, self::MAX_CHARS);
        }

        if (str_starts_with($document->mime_type, 'text/')) {
            return mb_substr(file_get_contents($absolutePath), 0, self::MAX_CHARS);
        }

        // Scanned images and .doc/.docx aren't extracted - no reliable,
        // dependency-free text layer to pull from those here.
        return null;
    }

    private static function classify(string $text, array $knownSpecializations): ?array
    {
        $taxonomy = $knownSpecializations !== []
            ? implode(', ', $knownSpecializations)
            : 'construction, commercial, engineering, quantity surveying, architecture, project management';

        $prompt = "You are helping an arbitration registrar classify a dispute case from its submitted document text, "
            ."in order to suggest which arbitrators are a good specialization match. Known arbitrator specialization "
            ."tags: {$taxonomy}.\n\nRespond with ONLY a JSON object, no prose, shaped exactly like:\n"
            .'{"category": "short case category label", "specializations": ["one or more of the known tags that best match, or a close new one if none fit"]}'
            ."\n\nDocument text:\n{$text}";

        $response = Http::withHeaders([
            'x-api-key' => config('services.anthropic.key'),
            'anthropic-version' => '2023-06-01',
            'content-type' => 'application/json',
        ])->timeout(30)->post('https://api.anthropic.com/v1/messages', [
            'model' => config('services.anthropic.model'),
            'max_tokens' => 300,
            'messages' => [['role' => 'user', 'content' => $prompt]],
        ]);

        if (! $response->successful()) {
            Log::warning('DocumentAiService: Anthropic API error', ['status' => $response->status(), 'body' => $response->body()]);

            return null;
        }

        $content = $response->json('content.0.text');
        if (! is_string($content)) {
            return null;
        }

        $parsed = json_decode(trim($content), true);
        if (! is_array($parsed)) {
            return null;
        }

        return [
            'category' => is_string($parsed['category'] ?? null) ? mb_substr($parsed['category'], 0, 100) : null,
            'specializations' => is_array($parsed['specializations'] ?? null)
                ? array_values(array_filter(array_map('strval', $parsed['specializations'])))
                : [],
        ];
    }
}
