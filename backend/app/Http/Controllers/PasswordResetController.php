<?php

namespace App\Http\Controllers;

use App\Models\ApiToken;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PasswordResetController extends Controller
{
    public function requestLink(Request $request): JsonResponse
    {
        $credentials = $request->validate(['email' => ['required', 'email', 'max:255']]);
        $status = Password::sendResetLink($credentials);

        if ($status === Password::RESET_LINK_SENT || $status === Password::INVALID_USER) {
            return response()->json(['message' => 'If an account exists for that email, a password reset link has been sent.']);
        }

        throw ValidationException::withMessages(['email' => [__($status)]]);
    }

    public function reset(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:10', 'confirmed'],
        ]);

        $status = Password::reset($credentials, function ($user, string $password) {
            $user->forceFill([
                'password' => Hash::make($password),
                'remember_token' => Str::random(60),
            ])->save();
            ApiToken::where('user_id', $user->id)->delete();
            event(new PasswordReset($user));
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => [__($status)]]);
        }

        return response()->json(['message' => 'Your password was reset. Sign in with your new password.']);
    }
}
