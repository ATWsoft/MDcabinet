<?php

declare(strict_types=1);

namespace MDcabinet\Http\Controllers;

use MDcabinet\Core\Auth;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;
use MDcabinet\Models\Attachment;
use MDcabinet\Support\Access;

final class FileController
{
    /** Upload z editora (drag & drop, vloženie zo schránky, tlačidlo). */
    public function upload(Request $request): Response
    {
        $userId = Auth::idOrFail();

        $file = $_FILES['file'] ?? null;
        if (!is_array($file)) {
            throw HttpException::badRequest('Chýba súbor v poli "file".');
        }

        $documentId = $request->int('documentId') ?: null;
        if ($documentId !== null) {
            Access::document($documentId);
        }

        $attachment = Attachment::store($file, $userId, $documentId);

        return Response::json(['file' => Attachment::toPublic($attachment)], 201);
    }

    /**
     * Servovanie súboru. Uploady ležia mimo webrootu, takže ich vydáva PHP –
     * vďaka tomu sa dá kontrolovať prístup a nedá sa spustiť podstrčený skript.
     */
    public function serve(Request $request): Response
    {
        $attachment = Attachment::find($request->paramInt('id'));
        if ($attachment === null) {
            throw HttpException::notFound('Súbor neexistuje.');
        }

        // Prílohu vidí jej autor alebo ktokoľvek s prístupom k dokumentu.
        if ($attachment['document_id'] !== null) {
            Access::document((int) $attachment['document_id']);
        } elseif ((int) $attachment['user_id'] !== Auth::idOrFail()) {
            throw HttpException::notFound('Súbor neexistuje.');
        }

        $path = Attachment::absolutePath((string) $attachment['disk_path']);
        $mime = (string) $attachment['mime'];

        // SVG servujeme na stiahnutie – inline SVG je vektor pre XSS.
        $inline = $mime !== 'image/svg+xml';

        return Response::file($path, $mime, (string) $attachment['original_name'], $inline);
    }

    public function destroy(Request $request): Response
    {
        $attachment = Attachment::find($request->paramInt('id'));
        if ($attachment === null) {
            throw HttpException::notFound('Súbor neexistuje.');
        }

        if ((int) $attachment['user_id'] !== Auth::idOrFail() && !Auth::isAdmin()) {
            throw HttpException::forbidden();
        }

        @unlink(Attachment::absolutePath((string) $attachment['disk_path']));
        Attachment::forceDelete((int) $attachment['id']);

        return Response::json(['ok' => true]);
    }
}
