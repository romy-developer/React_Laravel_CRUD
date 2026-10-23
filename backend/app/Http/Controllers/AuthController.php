<?php

namespace App\Http\Controllers;

use App\Models\ApiToken;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:10', 'confirmed'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'role' => 'customer',
        ]);
        $user->sendEmailVerificationNotification();

        return $this->issueToken($user, 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $validated['email'])->first();
        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => ['These credentials do not match our records.']]);
        }

        return $this->issueToken($user);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->userData($request->user())]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->attributes->get('api_token')?->delete();

        return response()->json(['message' => 'Signed out.']);
    }

    private function issueToken(User $user, int $status = 200): JsonResponse
    {
        $plainTextToken = bin2hex(random_bytes(32));
        ApiToken::create([
            'user_id' => $user->id,
            'name' => 'browser',
            'token_hash' => hash('sha256', $plainTextToken),
            'expires_at' => now()->addDays(30),
        ]);

        return response()->json([
            'data' => $this->userData($user),
            'token' => $plainTextToken,
        ], $status);
    }

    private function userData(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role, 'email_verified' => $user->hasVerifiedEmail()];
    }
}
