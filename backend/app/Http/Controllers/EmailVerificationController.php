<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class EmailVerificationController extends Controller
{
    public function verify(Request $request, int $id, string $hash): RedirectResponse
    {
        $user = User::findOrFail($id);
        abort_unless(hash_equals($hash, sha1($user->getEmailForVerification())), 403, 'This email verification link is invalid.');

        if (! $user->hasVerifiedEmail() && $user->markEmailAsVerified()) {
            event(new Verified($user));
        }

        return redirect()->away(rtrim(config('app.frontend_url'), '/') . '/account?verified=1');
    }

    public function resend(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Your email address is already verified.']);
        }

        $user->sendEmailVerificationNotification();
        return response()->json(['message' => 'A new verification link has been sent to your email address.']);
    }
}
