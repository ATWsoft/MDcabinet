<?php
/**
 * MDcabinet – jediný vstupný bod aplikácie.
 * Všetky requesty sem posiela .htaccess (okrem existujúcich súborov v /assets).
 */

declare(strict_types=1);

require __DIR__ . '/app/bootstrap.php';

use MDcabinet\Core\Auth;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;
use MDcabinet\Core\Router;
use MDcabinet\Http\Controllers\SpaController;

/** @var Router $router */
$router  = require __DIR__ . '/app/routes.php';
$request = Request::capture();

Auth::start();

try {
    $response = $router->dispatch($request);
} catch (HttpException $e) {
    // Neznáma GET cesta mimo API = klientská route Reactu → pošli SPA obal.
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
