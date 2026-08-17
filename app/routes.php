<?php

declare(strict_types=1);

/**
 * All route definitions. Returns a configured router.
 *
 * Convention:
 *   /api/...        – JSON API
 *   /api/public/... – public share links (no sign-in required)
 *   anything else   – the React SPA (handled by the fallback in index.php)
 */

use MDcabinet\Core\Router;
use MDcabinet\Http\Controllers\AdminController;
use MDcabinet\Http\Controllers\AuthController;
use MDcabinet\Http\Controllers\CabinetController;
use MDcabinet\Http\Controllers\DocumentController;
use MDcabinet\Http\Controllers\FileController;
use MDcabinet\Http\Controllers\FolderController;
use MDcabinet\Http\Controllers\SearchController;
use MDcabinet\Http\Controllers\SetupController;
use MDcabinet\Http\Controllers\ShareController;
use MDcabinet\Http\Controllers\SpaController;
use MDcabinet\Http\Controllers\TrayController;
use MDcabinet\Http\Middleware\AuthMiddleware;
use MDcabinet\Http\Middleware\CsrfMiddleware;

$router = new Router();

$router->group('/api', [CsrfMiddleware::class], static function (Router $api): void {

    // ------------------------------------------------------------ installation ---
    $api->get('/setup/status', [SetupController::class, 'status']);
    $api->post('/setup/install', [SetupController::class, 'install']);

    // ---------------------------------------------------------------- accounts ---
    $api->post('/auth/register', [AuthController::class, 'register']);
    $api->post('/auth/login', [AuthController::class, 'login']);
    $api->post('/auth/logout', [AuthController::class, 'logout']);
    $api->get('/auth/me', [AuthController::class, 'me']);

    // ------------------------------------------------------ public share links ---
    $api->get('/public/{token}', [ShareController::class, 'publicShow']);
    $api->post('/public/{token}/unlock', [ShareController::class, 'unlock']);
    $api->get('/public/{token}/documents/{documentId}', [ShareController::class, 'publicDocument']);
    $api->get('/public/{token}/files/{id}', [ShareController::class, 'publicFile']);

    // ------------------------------------------------- signed-in area ---
    $api->group('', [AuthMiddleware::class], static function (Router $r): void {

        $r->put('/auth/profile', [AuthController::class, 'updateProfile']);
        $r->put('/auth/password', [AuthController::class, 'changePassword']);

        // Instance administration (the controller checks the admin role)
        $r->get('/admin/settings', [AdminController::class, 'settings']);
        $r->put('/admin/settings', [AdminController::class, 'updateSettings']);
        $r->post('/admin/registration-code', [AdminController::class, 'suggestCode']);
        $r->get('/admin/migrations', [AdminController::class, 'migrations']);
        $r->post('/admin/migrations', [AdminController::class, 'runMigrations']);

        // Cabinets
        $r->get('/dashboard', [CabinetController::class, 'dashboard']);
        $r->get('/cabinets', [CabinetController::class, 'index']);
        $r->post('/cabinets', [CabinetController::class, 'store']);
        $r->post('/cabinets/reorder', [CabinetController::class, 'reorder']);
        $r->get('/cabinets/{id}', [CabinetController::class, 'show']);
        $r->put('/cabinets/{id}', [CabinetController::class, 'update']);
        $r->delete('/cabinets/{id}', [CabinetController::class, 'destroy']);

        // Trays
        $r->post('/trays', [TrayController::class, 'store']);
        $r->post('/trays/reorder', [TrayController::class, 'reorder']);
        $r->get('/trays/{id}', [TrayController::class, 'show']);
        $r->put('/trays/{id}', [TrayController::class, 'update']);
        $r->delete('/trays/{id}', [TrayController::class, 'destroy']);

        // Folders
        $r->post('/folders', [FolderController::class, 'store']);
        $r->put('/folders/{id}', [FolderController::class, 'update']);
        $r->put('/folders/{id}/move', [FolderController::class, 'move']);
        $r->delete('/folders/{id}', [FolderController::class, 'destroy']);

        // Documents
        $r->post('/documents', [DocumentController::class, 'store']);
        $r->post('/documents/reorder', [DocumentController::class, 'reorder']);
        $r->get('/documents/{id}', [DocumentController::class, 'show']);
        $r->put('/documents/{id}', [DocumentController::class, 'update']);
        $r->put('/documents/{id}/move', [DocumentController::class, 'move']);
        $r->delete('/documents/{id}', [DocumentController::class, 'destroy']);

        // History
        $r->get('/documents/{id}/revisions', [DocumentController::class, 'revisions']);
        $r->get('/documents/{id}/revisions/{revisionId}', [DocumentController::class, 'revision']);
        $r->post('/documents/{id}/revisions/{revisionId}/revert', [DocumentController::class, 'revert']);

        // Search
        $r->get('/search', [SearchController::class, 'search']);

        // Files
        $r->post('/files', [FileController::class, 'upload']);
        $r->get('/files/{id}', [FileController::class, 'serve']);
        $r->delete('/files/{id}', [FileController::class, 'destroy']);

        // Sharing
        $r->get('/shares', [ShareController::class, 'index']);
        $r->post('/shares', [ShareController::class, 'store']);
        $r->delete('/shares/{token}', [ShareController::class, 'destroy']);
    });
});

// Application root – the SPA. Other paths are handled by the fallback in index.php.
$router->get('/', [SpaController::class, 'index']);

return $router;
