<?php

namespace Tests\Feature;

use App\Mail\PasswordResetMail;
use App\Models\PasswordResetToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(array $overrides = []): User
    {
        return User::create(array_merge([
            'email' => 'reset-'.uniqid().'@test.local',
            'password_hash' => Hash::make('OldPassword123!'),
            'role' => 'staff',
            'status' => 'active',
        ], $overrides));
    }

    public function test_request_reset_returns_the_same_generic_message_for_an_unknown_email(): void
    {
        Mail::fake();

        $response = $this->postJson('/api/auth/request-password-reset', ['email' => 'nobody@test.local']);

        $response->assertStatus(200)->assertJsonFragment(['message' => 'If that email is registered, a reset link has been sent.']);
        Mail::assertNothingSent();
    }

    public function test_request_reset_creates_a_token_and_emails_a_known_active_account(): void
    {
        Mail::fake();
        $user = $this->makeUser();

        $this->postJson('/api/auth/request-password-reset', ['email' => $user->email])->assertStatus(200);

        $this->assertDatabaseCount('password_reset_tokens', 1);
        Mail::assertSent(PasswordResetMail::class, fn ($mail) => $mail->hasTo($user->email));
    }

    public function test_reset_rejects_an_invalid_token(): void
    {
        $response = $this->postJson('/api/auth/reset-password', [
            'token' => 'not-a-real-token',
            'newPassword' => 'NewPassword123!',
        ]);

        $response->assertStatus(400);
    }

    public function test_reset_rejects_an_expired_token(): void
    {
        $user = $this->makeUser();
        $token = str_repeat('a', 64);

        PasswordResetToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->subMinute(),
        ]);

        $response = $this->postJson('/api/auth/reset-password', ['token' => $token, 'newPassword' => 'NewPassword123!']);
        $response->assertStatus(400);
    }

    public function test_reset_succeeds_with_a_valid_token_and_the_new_password_logs_in(): void
    {
        $user = $this->makeUser();
        $token = str_repeat('b', 64);

        PasswordResetToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->addHour(),
        ]);

        $this->postJson('/api/auth/reset-password', ['token' => $token, 'newPassword' => 'BrandNewPassword123!'])
            ->assertStatus(200);

        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'OldPassword123!'])->assertStatus(401);
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'BrandNewPassword123!'])->assertStatus(200);
    }

    public function test_reset_cannot_reuse_an_already_used_token(): void
    {
        $user = $this->makeUser();
        $token = str_repeat('c', 64);

        PasswordResetToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->addHour(),
        ]);

        $this->postJson('/api/auth/reset-password', ['token' => $token, 'newPassword' => 'FirstReset123!'])->assertStatus(200);
        $this->postJson('/api/auth/reset-password', ['token' => $token, 'newPassword' => 'SecondReset123!'])->assertStatus(400);
    }
}
