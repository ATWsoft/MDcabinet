<?php

declare(strict_types=1);

namespace MDcabinet\Http\Controllers;

use MDcabinet\Core\Auth;
use MDcabinet\Core\Database;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;
use MDcabinet\Core\Validator;
use MDcabinet\Core\Str;
use MDcabinet\Models\Document;
use MDcabinet\Models\Revision;
use MDcabinet\Support\Access;
use MDcabinet\Support\Presenter;

final class DocumentController
{
    public function show(Request $request): Response
    {
        $document = Access::document($request->paramInt('id'));

        return Response::json([
            'document'    => Presenter::document($document),
            'breadcrumbs' => Document::breadcrumbs((int) $document['id']),
        ]);
    }

    public function store(Request $request): Response
    {
        $userId = Auth::idOrFail();

        $data = Validator::check($request->all(), [
            'trayId'   => 'required|int',
            'folderId' => 'nullable|int',
            'title'    => 'required|string|min:1|max:200',
            'content'  => 'nullable|string|raw',
        ]);

        $tray     = Access::tray((int) $data['trayId']);
        $folderId = isset($data['folderId']) && $data['folderId'] !== null ? (int) $data['folderId'] : null;

        if ($folderId !== null) {
            $folder = Access::folder($folderId);
            if ((int) $folder['tray_id'] !== (int) $tray['id']) {
                throw HttpException::badRequest('Zložka patrí do iného šuplíka.');
            }
        }

        $content = (string) ($data['content'] ?? '');

        $id = Document::createWithRevision([
            'tray_id'   => (int) $tray['id'],
            'folder_id' => $folderId,
            'title'     => $data['title'],
            'slug'      => Document::uniqueSlug($data['title'], ['tray_id' => (int) $tray['id']]),
            'content'   => $content,
            'position'  => Document::nextPosition(['tray_id' => (int) $tray['id'], 'folder_id' => $folderId]),
        ], $userId);

        return Response::json(['document' => Presenter::document(Document::find($id) ?? [])], 201);
    }

    /** Uloženie obsahu z editora – vytvorí revíziu, ak sa niečo naozaj zmenilo. */
    public function update(Request $request): Response
    {
        $userId   = Auth::idOrFail();
        $document = Access::document($request->paramInt('id'));

        $data = Validator::check($request->all(), [
            'title'    => 'nullable|string|min:1|max:200',
            'content'  => 'nullable|string|raw',
            'summary'  => 'nullable|string|max:255',
            'isPinned' => 'nullable|bool',
        ]);

        $title   = !empty($data['title']) ? (string) $data['title'] : (string) $document['title'];
        $content = array_key_exists('content', $data) && $data['content'] !== null
            ? (string) $data['content']
            : (string) $document['content'];

        $changed = Document::saveContent($document, $title, $content, $userId, $data['summary'] ?? null);

        $extra = [];
        if ($title !== $document['title']) {
            $extra['slug'] = Document::uniqueSlug($title, ['tray_id' => (int) $document['tray_id']], (int) $document['id']);
        }
        if (array_key_exists('isPinned', $data) && $data['isPinned'] !== null) {
            $extra['is_pinned'] = $data['isPinned'] ? 1 : 0;
        }
        if ($extra !== []) {
            Document::update((int) $document['id'], $extra);
        }

        return Response::json([
            'document'       => Presenter::document(Document::find((int) $document['id']) ?? []),
            'revisionAdded'  => $changed,
        ]);
    }

    /** Presun dokumentu do inej zložky / iného šuplíka. */
    public function move(Request $request): Response
    {
        $document = Access::document($request->paramInt('id'));

        $data = Validator::check($request->all(), [
            'trayId'   => 'nullable|int',
            'folderId' => 'nullable|int',
        ]);

        $trayId = isset($data['trayId']) && $data['trayId'] !== null
            ? (int) $data['trayId']
            : (int) $document['tray_id'];

        $tray     = Access::tray($trayId);
        $folderId = isset($data['folderId']) && $data['folderId'] !== null ? (int) $data['folderId'] : null;

        if ($folderId !== null) {
            $folder = Access::folder($folderId);
            if ((int) $folder['tray_id'] !== (int) $tray['id']) {
                throw HttpException::badRequest('Cieľová zložka nie je v cieľovom šuplíku.');
            }
        }

        Document::update((int) $document['id'], [
            'tray_id'   => (int) $tray['id'],
            'folder_id' => $folderId,
            'slug'      => Document::uniqueSlug((string) $document['title'], ['tray_id' => (int) $tray['id']], (int) $document['id']),
            'position'  => Document::nextPosition(['tray_id' => (int) $tray['id'], 'folder_id' => $folderId]),
        ]);

        return Response::json(['document' => Presenter::document(Document::find((int) $document['id']) ?? [])]);
    }

    public function destroy(Request $request): Response
    {
        $document = Access::document($request->paramInt('id'));
        Document::softDelete((int) $document['id']);

        return Response::json(['ok' => true]);
    }

    public function reorder(Request $request): Response
    {
        $tray = Access::tray($request->int('trayId'));
        $ids  = $request->input('ids', []);

        if (!is_array($ids)) {
            return Response::json(['ok' => false], 422);
        }

        Database::transaction(static function () use ($ids, $tray): void {
            foreach (array_values($ids) as $position => $id) {
                Database::update('documents', ['position' => $position], [
                    'id'      => (int) $id,
                    'tray_id' => (int) $tray['id'],
                ]);
            }
        });

        return Response::json(['ok' => true]);
    }

    // ------------------------------------------------------------ revízie ---

    public function revisions(Request $request): Response
    {
        $document = Access::document($request->paramInt('id'));

        return Response::json([
            'revisions' => array_map(
                [Presenter::class, 'revision'],
                Revision::listForDocument((int) $document['id'])
            ),
        ]);
    }

    public function revision(Request $request): Response
    {
        $document = Access::document($request->paramInt('id'));
        $revision = Revision::findForDocument((int) $document['id'], $request->paramInt('revisionId'));

        if ($revision === null) {
            throw HttpException::notFound('Revízia neexistuje.');
        }

        return Response::json(['revision' => Presenter::revision($revision)]);
    }

    /** Vráti dokument do stavu revízie – ako novú revíziu, história zostáva. */
    public function revert(Request $request): Response
    {
        $userId   = Auth::idOrFail();
        $document = Access::document($request->paramInt('id'));
        $revision = Revision::findForDocument((int) $document['id'], $request->paramInt('revisionId'));

        if ($revision === null) {
            throw HttpException::notFound('Revízia neexistuje.');
        }

        Document::update((int) $document['id'], [
            'title'      => $revision['title'],
            'content'    => $revision['content'],
            'excerpt'    => Str::excerpt((string) $revision['content']),
            'word_count' => Document::wordCount((string) $revision['content']),
            'updated_by' => $userId,
        ]);

        Revision::record(
            (int) $document['id'],
            $userId,
            (string) $revision['title'],
            (string) $revision['content'],
            'revert',
            'Návrat na revíziu #' . $revision['revision_no']
        );

        return Response::json(['document' => Presenter::document(Document::find((int) $document['id']) ?? [])]);
    }
}
