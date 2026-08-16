<?php

declare(strict_types=1);

namespace MDcabinet\Http\Controllers;

use MDcabinet\Core\Auth;
use MDcabinet\Core\Database;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\RateLimiter;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;
use MDcabinet\Core\Validator;
use MDcabinet\Models\Attachment;
use MDcabinet\Models\Cabinet;
use MDcabinet\Models\Document;
use MDcabinet\Models\Folder;
use MDcabinet\Models\ShareLink;
use MDcabinet\Models\Tray;
use MDcabinet\Support\Access;
use MDcabinet\Support\Presenter;

/**
 * Verejné read-only odkazy. Prístup k zamknutému odkazu si držíme v session,
 * takže heslo sa zadáva raz.
 */
final class ShareController
{
    private const SESSION_UNLOCKED = 'mdc_share_unlocked';

    // ---------------------------------------------------- správa (prihlásený) ---

    public function index(Request $request): Response
    {
        $type = (string) $request->query('targetType', '');
        $id   = (int) $request->query('targetId', '0');

        if (!in_array($type, ShareLink::TYPES, true) || $id <= 0) {
            throw HttpException::badRequest('Chýba targetType alebo targetId.');
        }

        Access::shareTarget($type, $id);

        return Response::json(['shares' => ShareLink::listForTarget($type, $id, Auth::idOrFail())]);
    }

    public function store(Request $request): Response
    {
        $data = Validator::check($request->all(), [
            'targetType' => 'required|string|in:cabinet,tray,folder,document',
            'targetId'   => 'required|int',
            'password'   => 'nullable|string|min:4|max:100',
            'expiresAt'  => 'nullable|date',
        ]);

        Access::shareTarget((string) $data['targetType'], (int) $data['targetId']);

        $expiresAt = null;
        if (!empty($data['expiresAt'])) {
            $expiresAt = date('Y-m-d H:i:s', (int) strtotime((string) $data['expiresAt']));
        }

        $token = ShareLink::create(
            (string) $data['targetType'],
            (int) $data['targetId'],
            Auth::idOrFail(),
            $data['password'] ?? null,
            $expiresAt
        );

        return Response::json(['share' => ShareLink::toPublic(ShareLink::find($token) ?? [])], 201);
    }

    public function destroy(Request $request): Response
    {
        $deleted = ShareLink::delete((string) $request->param('token'), Auth::idOrFail());

        if ($deleted === 0) {
            throw HttpException::notFound('Odkaz neexistuje.');
        }

        return Response::json(['ok' => true]);
    }

    // ------------------------------------------------------ verejný prístup ---

    public function publicShow(Request $request): Response
    {
        $share = $this->resolve($request, requireUnlocked: false);

        if (ShareLink::needsPassword($share) && !$this->isUnlocked((string) $share['token'])) {
            return Response::json([
                'needsPassword' => true,
                'targetType'    => $share['target_type'],
            ]);
        }

        ShareLink::touch((string) $share['token']);

        return Response::json($this->payload($share));
    }

    public function unlock(Request $request): Response
    {
        $token = (string) $request->param('token');
        RateLimiter::hit('share:' . $token . ':' . $request->ip(), 10, 900);

        $share = $this->resolve($request, requireUnlocked: false);

        if (!ShareLink::needsPassword($share)) {
            return Response::json($this->payload($share));
        }

        if (!password_verify($request->string('password'), (string) $share['password_hash'])) {
            throw HttpException::validation(['password' => 'Nesprávne heslo.']);
        }

        Auth::start();
        $_SESSION[self::SESSION_UNLOCKED][$token] = true;

        ShareLink::touch($token);

        return Response::json($this->payload($share));
    }

    /** Obsah konkrétneho dokumentu v rámci zdieľaného rozsahu. */
    public function publicDocument(Request $request): Response
    {
        $share      = $this->resolve($request);
        $documentId = $request->paramInt('documentId');

        if (!$this->documentInScope($share, $documentId)) {
            throw HttpException::notFound('Dokument nie je súčasťou tohto odkazu.');
        }

        $document = Document::find($documentId);
        if ($document === null) {
            throw HttpException::notFound('Dokument neexistuje.');
        }

        return Response::json([
            'document'    => Presenter::document($document),
            'breadcrumbs' => Document::breadcrumbs($documentId),
        ]);
    }

    /** Obrázky vložené v zdieľanom dokumente. */
    public function publicFile(Request $request): Response
    {
        $share      = $this->resolve($request);
        $attachment = Attachment::find($request->paramInt('id'));

        if ($attachment === null || $attachment['document_id'] === null) {
            throw HttpException::notFound('Súbor neexistuje.');
        }
        if (!$this->documentInScope($share, (int) $attachment['document_id'])) {
            throw HttpException::notFound('Súbor neexistuje.');
        }

        return Response::file(
            Attachment::absolutePath((string) $attachment['disk_path']),
            (string) $attachment['mime'],
            (string) $attachment['original_name'],
            (string) $attachment['mime'] !== 'image/svg+xml'
        );
    }

    // -------------------------------------------------------------- interné ---

    /** @return array<string,mixed> */
    private function resolve(Request $request, bool $requireUnlocked = true): array
    {
        $token = (string) $request->param('token');
        $share = ShareLink::find($token);

        if ($share === null) {
            throw HttpException::notFound('Odkaz neexistuje alebo bol zrušený.');
        }
        if (ShareLink::isExpired($share)) {
            throw new HttpException(410, 'Platnosť odkazu vypršala.');
        }
        if ($requireUnlocked && ShareLink::needsPassword($share) && !$this->isUnlocked($token)) {
            throw HttpException::unauthorized('Odkaz je chránený heslom.');
        }

        return $share;
    }

    private function isUnlocked(string $token): bool
    {
        Auth::start();

        return !empty($_SESSION[self::SESSION_UNLOCKED][$token]);
    }

    /**
     * @param array<string,mixed> $share
     * @return array<string,mixed>
     */
    private function payload(array $share): array
    {
        $type = (string) $share['target_type'];
        $id   = (int) $share['target_id'];

        $base = [
            'needsPassword' => false,
            'targetType'    => $type,
            'sharedAt'      => $share['created_at'],
        ];

        return match ($type) {
            'document' => $base + [
                'document'    => Presenter::document(Document::find($id) ?? []),
                'breadcrumbs' => Document::breadcrumbs($id),
            ],
            'cabinet' => $base + [
                'cabinet' => Presenter::cabinet(Cabinet::tree($id)),
            ],
            'tray' => $base + [
                'tray' => Presenter::tray($this->trayWithContent($id)),
            ],
            'folder' => $base + [
                'folder' => Presenter::folder($this->folderWithContent($id)),
            ],
            default => $base,
        };
    }

    /** @return array<string,mixed> */
    private function trayWithContent(int $trayId): array
    {
        $tray = Tray::find($trayId) ?? [];
        if ($tray === []) {
            throw HttpException::notFound('Šuplík neexistuje.');
        }

        $folders   = Folder::allForTray($trayId);
        $documents = Document::listForTrays([$trayId]);

        $tray['folders']   = Folder::buildTree($folders, $documents);
        $tray['documents'] = array_values(array_filter($documents, static fn ($d) => $d['folder_id'] === null));

        return $tray;
    }

    /** @return array<string,mixed> */
    private function folderWithContent(int $folderId): array
    {
        $folder = Folder::find($folderId);
        if ($folder === null) {
            throw HttpException::notFound('Zložka neexistuje.');
        }

        $all       = Folder::allForTray((int) $folder['tray_id']);
        $documents = Document::listForTrays([(int) $folder['tray_id']]);

        $folder['children']  = Folder::buildTree($all, $documents, $folderId);
        $folder['documents'] = array_values(array_filter($documents, static fn ($d) => $d['folder_id'] === $folderId));

        return $folder;
    }

    /** @param array<string,mixed> $share */
    private function documentInScope(array $share, int $documentId): bool
    {
        $type     = (string) $share['target_type'];
        $targetId = (int) $share['target_id'];

        if ($type === 'document') {
            return $documentId === $targetId;
        }

        $row = Database::fetch(
            'SELECT d.folder_id, d.tray_id, t.cabinet_id
               FROM `documents` d
               JOIN `trays` t ON t.id = d.tray_id
              WHERE d.id = :id AND d.deleted_at IS NULL',
            ['id' => $documentId]
        );

        if ($row === null) {
            return false;
        }

        return match ($type) {
            'cabinet' => (int) $row['cabinet_id'] === $targetId,
            'tray'    => (int) $row['tray_id'] === $targetId,
            'folder'  => $row['folder_id'] !== null
                && Folder::isDescendantOf((int) $row['folder_id'], $targetId),
            default   => false,
        };
    }
}
