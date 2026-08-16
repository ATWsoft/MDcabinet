<?php

declare(strict_types=1);

namespace MDcabinet\Http\Middleware;

use MDcabinet\Core\Auth;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\Middleware;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;

final class AuthMiddleware implements Middleware
{
    public function handle(Request $request): ?Response
    {
        if (!Auth::check()) {
            throw HttpException::unauthorized();
        }

        return null;
    }
}
