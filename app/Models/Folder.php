<?php

declare(strict_types=1);

namespace MDcabinet\Models;

use MDcabinet\Core\Database;

final class Folder extends Model
{
    protected const TABLE = 'folders';

    /** Maximum nesting depth – a safeguard against an endless tree. */
    public const MAX_DEPTH = 8;

    /**
     * @param list<int> $trayIds
     * @return list<array<string,mixed>>
     */
    public static function allForTrays(array $trayIds): array
    {
        if ($trayIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($trayIds), '?'));

        return self::castAll(Database::fetchAll(
            "SELECT * FROM `folders`
              WHERE `tray_id` IN ($placeholders) AND `deleted_at` IS NULL
              ORDER BY `position` ASC, `name` ASC",
            $trayIds
        ));
    }

    /** @return list<array<string,mixed>> */
    public static function allForTray(int $trayId): array
    {
        return self::allForTrays([$trayId]);
    }

    /**
     * Turns a flat folder list into a tree and attaches the documents.
     *
     * @param list<array<string,mixed>> $folders
     * @param list<array<string,mixed>> $documents
     * @return list<array<string,mixed>>
     */
    public static function buildTree(array $folders, array $documents, ?int $parentId = null): array
    {
        $branch = [];

        foreach ($folders as $folder) {
            if ($folder['parent_id'] !== $parentId) {
                continue;
            }

            $folder['children']  = self::buildTree($folders, $documents, $folder['id']);
            $folder['documents'] = array_values(array_filter(
                $documents,
                static fn ($d) => $d['folder_id'] === $folder['id']
            ));

            $branch[] = $folder;
        }

        return $branch;
    }

    /** Nesting depth (0 = a root folder inside the tray). */
    public static function depth(?int $folderId): int
    {
        $depth = 0;
        while ($folderId !== null && $depth <= self::MAX_DEPTH) {
            $parent = Database::scalar('SELECT `parent_id` FROM `folders` WHERE `id` = :id', ['id' => $folderId]);
            if ($parent === null) {
                return $depth;
            }
            $folderId = (int) $parent;
            $depth++;
        }

        return $depth;
    }

    /** Is $candidateId a descendant of $folderId? Prevents moving a folder into itself. */
    public static function isDescendantOf(int $candidateId, int $folderId): bool
    {
        $current = $candidateId;
        for ($i = 0; $i < self::MAX_DEPTH + 2; $i++) {
            if ($current === $folderId) {
                return true;
            }
            $parent = Database::scalar('SELECT `parent_id` FROM `folders` WHERE `id` = :id', ['id' => $current]);
            if ($parent === null) {
                return false;
            }
            $current = (int) $parent;
        }

        return false;
    }

    public static function trayId(int $folderId): ?int
    {
        $value = Database::scalar(
            'SELECT `tray_id` FROM `folders` WHERE `id` = :id AND `deleted_at` IS NULL',
            ['id' => $folderId]
        );

        return $value === null ? null : (int) $value;
    }
}
