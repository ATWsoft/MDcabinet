<?php

declare(strict_types=1);

namespace MDcabinet\Models;

use MDcabinet\Core\Database;
use MDcabinet\Core\Lang;
use MDcabinet\Core\Str;

final class Document extends Model
{
    protected const TABLE = 'documents';

    /** Columns without `content` – for lists and trees. */
    private const LIST_COLUMNS = 'id, tray_id, folder_id, title, slug, excerpt, word_count,
        is_pinned, position, created_by, updated_by, created_at, updated_at';

    /**
     * @param list<int> $trayIds
     * @return list<array<string,mixed>>
     */
    public static function listForTrays(array $trayIds): array
    {
        if ($trayIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($trayIds), '?'));

        return self::castAll(Database::fetchAll(
            'SELECT ' . self::LIST_COLUMNS . " FROM `documents`
              WHERE `tray_id` IN ($placeholders) AND `deleted_at` IS NULL
              ORDER BY `is_pinned` DESC, `position` ASC, `title` ASC",
            $trayIds
        ));
    }

    /** @return list<array<string,mixed>> */
    public static function listForFolder(int $trayId, ?int $folderId): array
    {
        $sql = 'SELECT ' . self::LIST_COLUMNS . ' FROM `documents`
                 WHERE `tray_id` = :tray AND `deleted_at` IS NULL AND '
             . ($folderId === null ? '`folder_id` IS NULL' : '`folder_id` = :folder')
             . ' ORDER BY `is_pinned` DESC, `position` ASC, `title` ASC';

        $params = ['tray' => $trayId];
        if ($folderId !== null) {
            $params['folder'] = $folderId;
        }

        return self::castAll(Database::fetchAll($sql, $params));
    }

    /**
     * The user's most recently edited documents (dashboard).
     *
     * @return list<array<string,mixed>>
     */
    public static function recentForUser(int $userId, int $limit = 10): array
    {
        return self::castAll(Database::fetchAll(
            'SELECT d.id, d.tray_id, d.folder_id, d.title, d.slug, d.excerpt, d.updated_at,
                    t.name AS tray_name, c.id AS cabinet_id, c.name AS cabinet_name, c.color AS cabinet_color
               FROM `documents` d
               JOIN `trays` t     ON t.id = d.tray_id AND t.deleted_at IS NULL
               JOIN `cabinets` c  ON c.id = t.cabinet_id AND c.deleted_at IS NULL
              WHERE c.owner_id = :owner AND d.deleted_at IS NULL
              ORDER BY d.updated_at DESC
              LIMIT ' . max(1, min(50, $limit)),
            ['owner' => $userId]
        ));
    }

    /**
     * Full-text search with a LIKE fallback (MySQL full-text ignores very
     * short words and stop words).
     *
     * @return list<array<string,mixed>>
     */
    public static function search(int $userId, string $query, ?int $cabinetId = null, int $limit = 40): array
    {
        $query = trim($query);
        if ($query === '') {
            return [];
        }

        // With emulation disabled, PDO does not allow reusing the same named
        // placeholder, hence :q_score/:q_match and :like_title/:like_content.
        $params = [
            'owner'        => $userId,
            'q_score'      => $query,
            'q_match'      => $query,
            'like_title'   => '%' . $query . '%',
            'like_content' => '%' . $query . '%',
        ];

        $scope = '';
        if ($cabinetId !== null) {
            $scope = ' AND c.id = :cabinet';
            $params['cabinet'] = $cabinetId;
        }

        $rows = Database::fetchAll(
            'SELECT d.id, d.tray_id, d.folder_id, d.title, d.slug, d.excerpt, d.updated_at,
                    t.name AS tray_name, c.id AS cabinet_id, c.name AS cabinet_name, c.color AS cabinet_color,
                    MATCH(d.title, d.content) AGAINST (:q_score IN NATURAL LANGUAGE MODE) AS score
               FROM `documents` d
               JOIN `trays` t    ON t.id = d.tray_id AND t.deleted_at IS NULL
               JOIN `cabinets` c ON c.id = t.cabinet_id AND c.deleted_at IS NULL
              WHERE c.owner_id = :owner AND d.deleted_at IS NULL' . $scope . '
                AND (MATCH(d.title, d.content) AGAINST (:q_match IN NATURAL LANGUAGE MODE)
                     OR d.title LIKE :like_title OR d.content LIKE :like_content)
              ORDER BY score DESC, d.updated_at DESC
              LIMIT ' . max(1, min(100, $limit)),
            $params
        );

        return array_map(static function (array $row): array {
            $row = self::cast($row);
            $row['score'] = (float) ($row['score'] ?? 0);

            return $row;
        }, $rows);
    }

    /**
     * Creates a document together with its first revision.
     *
     * @param array<string,mixed> $data
     */
    public static function createWithRevision(array $data, int $userId): int
    {
        $content = (string) ($data['content'] ?? '');

        $id = self::create($data + [
            'excerpt'    => Str::excerpt($content),
            'word_count' => self::wordCount($content),
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);

        Revision::record($id, $userId, (string) $data['title'], $content, 'create', Lang::t('Document created'));

        return $id;
    }

    /**
     * Saves a change and adds a revision, but only when the title or the
     * content actually changed.
     *
     * @param array<string,mixed> $current
     */
    public static function saveContent(array $current, string $title, string $content, int $userId, ?string $summary = null): bool
    {
        $changed = $current['title'] !== $title || $current['content'] !== $content;

        self::update((int) $current['id'], [
            'title'      => $title,
            'content'    => $content,
            'excerpt'    => Str::excerpt($content),
            'word_count' => self::wordCount($content),
            'updated_by' => $userId,
        ]);

        if ($changed) {
            Revision::record((int) $current['id'], $userId, $title, $content, 'update', $summary);
        }

        return $changed;
    }

    public static function wordCount(string $content): int
    {
        $plain = Str::excerpt($content, PHP_INT_MAX);

        return $plain === '' ? 0 : count(preg_split('/\s+/u', $plain) ?: []);
    }

    /** The cabinet the document belongs to (through its tray). */
    public static function cabinetId(int $documentId): ?int
    {
        $value = Database::scalar(
            'SELECT t.cabinet_id FROM `documents` d
               JOIN `trays` t ON t.id = d.tray_id
              WHERE d.id = :id AND d.deleted_at IS NULL',
            ['id' => $documentId]
        );

        return $value === null ? null : (int) $value;
    }

    /**
     * Breadcrumb trail for a document.
     *
     * @return list<array{type:string,id:int,name:string}>
     */
    public static function breadcrumbs(int $documentId): array
    {
        $row = Database::fetch(
            'SELECT d.id, d.title, d.folder_id, t.id AS tray_id, t.name AS tray_name,
                    c.id AS cabinet_id, c.name AS cabinet_name
               FROM `documents` d
               JOIN `trays` t    ON t.id = d.tray_id
               JOIN `cabinets` c ON c.id = t.cabinet_id
              WHERE d.id = :id',
            ['id' => $documentId]
        );

        if ($row === null) {
            return [];
        }

        $crumbs = [
            ['type' => 'cabinet', 'id' => (int) $row['cabinet_id'], 'name' => (string) $row['cabinet_name']],
            ['type' => 'tray',    'id' => (int) $row['tray_id'],    'name' => (string) $row['tray_name']],
        ];

        $folderChain = [];
        $folderId    = $row['folder_id'] === null ? null : (int) $row['folder_id'];
        $guard       = 0;
        while ($folderId !== null && $guard++ < Folder::MAX_DEPTH + 2) {
            $folder = Database::fetch('SELECT `id`, `name`, `parent_id` FROM `folders` WHERE `id` = :id', ['id' => $folderId]);
            if ($folder === null) {
                break;
            }
            array_unshift($folderChain, [
                'type' => 'folder',
                'id'   => (int) $folder['id'],
                'name' => (string) $folder['name'],
            ]);
            $folderId = $folder['parent_id'] === null ? null : (int) $folder['parent_id'];
        }

        $crumbs = array_merge($crumbs, $folderChain);
        $crumbs[] = ['type' => 'document', 'id' => (int) $row['id'], 'name' => (string) $row['title']];

        return $crumbs;
    }
}
