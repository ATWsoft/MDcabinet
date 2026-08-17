<?php

declare(strict_types=1);

namespace MDcabinet\Http\Controllers;

use MDcabinet\Core\Auth;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\Lang;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;
use MDcabinet\Models\Attachment;
use MDcabinet\Support\Access;

final class FileController
{
    /** Upload from the editor (drag & drop, paste, toolbar button). */
    public function upload(Request $request): Response
    {
        $userId = Auth::idOrFail();

        $file = $_FILES['file'] ?? null;
        if (!is_array($file)) {
            throw HttpException::badRequest(Lang::t('The "file" field is missing.'));
        }

        $documentId = $request->int('documentId') ?: null;
        if ($documentId !== null) {
            Access::document($documentId);
        }

        $attachment = Attachment::store($file, $userId, $documentId);

        return Response::json(['file' => Attachment::toPublic($attachment)], 201);
    }

    /**
     * Serves a file. Uploads live outside the web root and are handed out by
     * PHP, so access can be checked and a planted script can never execute.
     */
    public function serve(Request $request): Response
    {
        $attachment = Attachment::find($request->paramInt('id'));
        if ($attachment === null) {
            throw HttpException::notFound(Lang::t('The file does not exist.'));
        }

        // The author sees the attachment, as does anyone who can read the document.
        if ($attachment['document_id'] !== null) {
            Access::document((int) $attachment['document_id']);
        } elseif ((int) $attachment['user_id'] !== Auth::idOrFail()) {
            throw HttpException::notFound(Lang::t('The file does not exist.'));
        }

        $path = Attachment::absolutePath((string) $attachment['disk_path']);
        $mime = (string) $attachment['mime'];

        // SVG is sent as a download: inline SVG is a common XSS vector.
        $inline = $mime !== 'image/svg+xml';

        return Response::file($path, $mime, (string) $attachment['original_name'], $inline);
    }

    public function destroy(Request $request): Response
    {
        $attachment = Attachment::find($request->paramInt('id'));
        if ($attachment === null) {
            throw HttpException::notFound(Lang::t('The file does not exist.'));
        }

        if ((int) $attachment['user_id'] !== Auth::idOrFail() && !Auth::isAdmin()) {
            throw HttpException::forbidden();
        }

        @unlink(Attachment::absolutePath((string) $attachment['disk_path']));
        Attachment::forceDelete((int) $attachment['id']);

        return Response::json(['ok' => true]);
    }
}
