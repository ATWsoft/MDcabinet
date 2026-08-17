<?php

declare(strict_types=1);

namespace MDcabinet\Http\Middleware;

use MDcabinet\Core\Auth;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\Lang;
use MDcabinet\Core\Middleware;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;

/**
 * Writing requests must carry X-CSRF-Token. The token is issued by
 * /api/auth/me and sent by the frontend with every POST/PUT/PATCH/DELETE.
 */
final class CsrfMiddleware implements Middleware
{
    private const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

    public function handle(Request $request): ?Response
    {
        if (in_array($request->method, self::SAFE_METHODS, true)) {
            return null;
        }

        // A guest has nothing to protect yet (sign-in and registration have
        // their own rate limits).
        if (!Auth::check()) {
            return null;
        }

        $token = $request->header('X-CSRF-Token') ?? $request->string('_csrf');

        if (!Auth::verifyCsrf($token)) {
            // Deliberately 403 and not 419: some Apache setups on shared
            // hosting rewrite non-standard status codes to 500. The frontend
            // recognises this case through errors.csrf and refreshes the token.
            throw new HttpException(
                403,
                Lang::t('Session expired, reload the page and try again.'),
                ['csrf' => 'expired']
            );
        }

        return null;
    }
}
