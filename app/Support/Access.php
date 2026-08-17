<?php

declare(strict_types=1);

namespace MDcabinet\Support;

use MDcabinet\Core\Auth;
use MDcabinet\Core\Database;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\Lang;
use MDcabinet\Models\Cabinet;
use MDcabinet\Models\Document;
use MDcabinet\Models\Folder;
use MDcabinet\Models\Tray;

/**
 * The single place that decides "may this user see or change this".
 * In v1 the rule is simple: content belongs to the cabinet's owner.
 */
final class Access
{
    /** @return array<string,mixed> */
    public static function cabinet(int $id, bool $withTrashed = false): array
    {
        $cabinet = Cabinet::find($id, $withTrashed);
        if ($cabinet === null) {
            throw HttpException::notFound(Lang::t('The cabinet does not exist.'));
        }
        self::assertOwner((int) $cabinet['owner_id']);

        return $cabinet;
    }

    /** @return array<string,mixed> */
    public static function tray(int $id, bool $withTrashed = false): array
    {
        $tray = Tray::find($id, $withTrashed);
        if ($tray === null) {
            throw HttpException::notFound(Lang::t('The tray does not exist.'));
        }
        self::cabinet((int) $tray['cabinet_id'], $withTrashed);

        return $tray;
    }

    /** @return array<string,mixed> */
    public static function folder(int $id, bool $withTrashed = false): array
    {
        $folder = Folder::find($id, $withTrashed);
        if ($folder === null) {
            throw HttpException::notFound(Lang::t('The folder does not exist.'));
        }
        self::tray((int) $folder['tray_id'], $withTrashed);

        return $folder;
    }

    /** @return array<string,mixed> */
    public static function document(int $id, bool $withTrashed = false): array
    {
        $document = Document::find($id, $withTrashed);
        if ($document === null) {
            throw HttpException::notFound(Lang::t('The document does not exist.'));
        }
        self::tray((int) $document['tray_id'], $withTrashed);

        return $document;
    }

    /** Does the signed-in user own the target of a share link? */
    public static function shareTarget(string $type, int $id): void
    {
        match ($type) {
            'cabinet'  => self::cabinet($id),
            'tray'     => self::tray($id),
            'folder'   => self::folder($id),
            'document' => self::document($id),
            default    => throw HttpException::badRequest(Lang::t('Unknown target type.')),
        };
    }

    /** Owner of a share target – used when rendering the public view. */
    public static function ownerOfShareTarget(string $type, int $id): ?int
    {
        $sql = match ($type) {
            'cabinet'  => 'SELECT owner_id FROM cabinets WHERE id = :id',
            'tray'     => 'SELECT c.owner_id FROM trays t JOIN cabinets c ON c.id = t.cabinet_id WHERE t.id = :id',
            'folder'   => 'SELECT c.owner_id FROM folders f
                             JOIN trays t ON t.id = f.tray_id
                             JOIN cabinets c ON c.id = t.cabinet_id WHERE f.id = :id',
            'document' => 'SELECT c.owner_id FROM documents d
                             JOIN trays t ON t.id = d.tray_id
                             JOIN cabinets c ON c.id = t.cabinet_id WHERE d.id = :id',
            default    => null,
        };

        if ($sql === null) {
            return null;
        }

        $value = Database::scalar($sql, ['id' => $id]);

        return $value === null ? null : (int) $value;
    }

    private static function assertOwner(int $ownerId): void
    {
        $userId = Auth::idOrFail();

        if ($ownerId !== $userId && !Auth::isAdmin()) {
            // Do not reveal that someone else's content exists.
            throw HttpException::notFound();
        }
    }
}
