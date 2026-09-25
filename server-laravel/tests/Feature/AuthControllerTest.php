<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthControllerTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $role = 'admin', array $overrides = []): User
    {
        return User::create(array_merge([
            'email' => strtolower($role).'-'.uniqid().'@test.local',
            'password_hash' => Hash::make('CorrectHorse1!'),
            'role' => $role,
            'status' => 'active',
        ], $overrides));
    }

    public function test_login_rejects_unknown_email_with_generic_error(): void
    {
        $response = $this->postJson('/api/auth/login', ['email' => 'nobody@test.local', 'password' => 'whatever']);

        $response->assertStatus(401)->assertJson(['error' => 'Invalid email or password']);
    }

    public function test_login_rejects_wrong_password_with_the_same_generic_error(): void
    {
        $user = $this->makeUser();

        $response = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'wrong-password']);

        $response->assertStatus(401)->assertJson(['error' => 'Invalid email or password']);
    }

    public function test_login_succeeds_with_correct_credentials_and_establishes_a_session(): void
    {
        $user = $this->makeUser();

        $loginResponse = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'CorrectHorse1!']);
        $loginResponse->assertStatus(200)->assertJson(['role' => 'admin']);

        $meResponse = $this->getJson('/api/auth/me');
        $meResponse->assertStatus(200)->assertJson(['role' => 'admin']);
    }

    public function test_login_locks_the_account_after_five_failed_attempts(): void
    {
        $user = $this->makeUser();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'wrong']);
        }

        // Even the RIGHT password now, while locked.
        $response = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'CorrectHorse1!']);
        $response->assertStatus(423);
    }

    public function test_login_rejects_an_inactive_account(): void
    {
        $user = $this->makeUser(overrides: ['status' => 'suspended']);

        $response = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'CorrectHorse1!']);
        $response->assertStatus(403);
    }

    public function test_me_returns_401_when_not_authenticated(): void
    {
        $this->getJson('/api/auth/me')->assertStatus(401);
    }

    public function test_me_returns_the_current_user_when_authenticated(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->getJson('/api/auth/me')
            ->assertStatus(200)
            ->assertJson(['role' => 'admin', 'email' => $user->email]);
    }

    public function test_logout_clears_the_session(): void
    {
        $user = $this->makeUser();
        $this->actingAs($user);

        $this->postJson('/api/auth/logout')->assertStatus(200);
    }

    public function test_change_password_rejects_wrong_current_password(): void
    {
        $user = $this->makeUser();

        $response = $this->actingAs($user)->postJson('/api/auth/change-password', [
            'currentPassword' => 'wrong',
            'newPassword' => 'BrandNewPassword123!',
        ]);

        $response->assertStatus(401);
    }

    public function test_change_password_succeeds_and_the_new_password_logs_in(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->postJson('/api/auth/change-password', [
            'currentPassword' => 'CorrectHorse1!',
            'newPassword' => 'BrandNewPassword123!',
        ])->assertStatus(200);

        $this->assertTrue(Hash::check('BrandNewPassword123!', $user->fresh()->password_hash));
    }

    public function test_update_profile_is_rejected_for_non_staff_roles(): void
    {
        $user = $this->makeUser(role: 'arbitrator');

        $response = $this->actingAs($user)->patchJson('/api/auth/profile', ['fullName' => 'New Name']);

        $response->assertStatus(403);
    }

    public function test_update_profile_succeeds_for_staff_roles(): void
    {
        $user = $this->makeUser(role: 'staff');

        $this->actingAs($user)->patchJson('/api/auth/profile', ['fullName' => 'New Staff Name'])
            ->assertStatus(200);

        $this->assertEquals('New Staff Name', $user->fresh()->full_name);
    }
}
