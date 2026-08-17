<?php
/**
 * MDcabinet – the single entry point of the application.
 * Every request is routed here by .htaccess (except existing files in /assets).
 */

declare(strict_types=1);

require __DIR__ . '/app/bootstrap.php';

use MDcabinet\Core\Auth;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\Lang;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;
use MDcabinet\Core\Router;
use MDcabinet\Http\Controllers\SpaController;

/** @var Router $router */
$router  = require __DIR__ . '/app/routes.php';
$request = Request::capture();

// The SPA sends its active language in X-Locale. Before it knows who is
// signed in, the browser preference decides; English is the fallback.
Lang::use(Lang::resolve(
    $request->header('X-Locale'),
    $request->header('Accept-Language')
));

Auth::start();

try {
    $response = $router->dispatch($request);
} catch (HttpException $e) {
    // An unknown GET path outside the API is a client-side React route,
    // so serve the SPA shell instead of failing.
    if ($e->getStatusCode() === 404 && $request->method === 'GET' && !$request->isApi()) {
        $response = (new SpaController())->index($request);
    } else {
        throw $e;
    }
}

$response
    ->withHeader('X-Content-Type-Options', 'nosniff')
    ->withHeader('X-Frame-Options', 'SAMEORIGIN')
    ->send();
