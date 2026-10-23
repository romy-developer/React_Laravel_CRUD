<?php

namespace App\Http\Middleware;

use App\Models\ApiToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    public function handle(Request $request, Closure $next, string $optional = 'false'): Response
    {
        $plainTextToken = $request->bearerToken();
        if (! $plainTextToken) {
            if (filter_var($optional, FILTER_VALIDATE_BOOLEAN)) {
                return $next($request);
            }
            return response()->json(['message' => 'Authentication is required.'], 401);
        }

        $token = ApiToken::with('user')->where('token_hash', hash('sha256', $plainTextToken))->first();
        if (! $token || ($token->expires_at && $token->expires_at->isPast())) {
            $token?->delete();
            return response()->json(['message' => 'Your session has expired. Please sign in again.'], 401);
        }

        $token->forceFill(['last_used_at' => now()])->save();
        $request->attributes->set('api_token', $token);
        $request->setUserResolver(fn () => $token->user);

        return $next($request);
    }
}
