<?php

declare(strict_types=1);

namespace MDcabinet\Http\Middleware;

use MDcabinet\Core\Auth;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\Middleware;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;

/**
 * Zapisovacie požiadavky musia niesť X-CSRF-Token. Token vydáva /api/auth/me
 * a /api/auth/csrf; frontend ho posiela pri každom POST/PUT/PATCH/DELETE.
 */
final class CsrfMiddleware implements Middleware
{
    private const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

    public function handle(Request $request): ?Response
    {
        if (in_array($request->method, self::SAFE_METHODS, true)) {
            return null;
        }

        // Neprihlásený používateľ ešte nemá čo chrániť (login/register majú vlastný rate limit).
        if (!Auth::check()) {
            return null;
        }

        $token = $request->header('X-CSRF-Token') ?? $request->string('_csrf');

        if (!Auth::verifyCsrf($token)) {
            // Zámerne 403 a nie 419: neštandardné stavové kódy niektoré Apache
            // konfigurácie na zdieľaných hostingoch prepisujú na 500.
            // Frontend rozpozná tento prípad podľa errors.csrf a obnoví token.
            throw new HttpException(
                403,
                'Platnosť relácie vypršala, obnov stránku a skús to znova.',
                ['csrf' => 'expired']
            );
        }

        return null;
    }
}
