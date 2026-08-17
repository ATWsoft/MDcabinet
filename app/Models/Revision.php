<?php

declare(strict_types=1);

namespace MDcabinet\Models;

use MDcabinet\Core\Database;

final class Revision extends Model
{
    protected const TABLE = 'document_revisions';
    protected const SOFT_DELETE = null;

    /** How many revisions per document are kept; older ones are pruned. */
    public const KEEP = 100;

    public static function record(
        int $documentId,
        ?int $userId,
        string $title,
        string $content,
        string $changeType = 'update',
        ?string $summary = null
    ): int {
        $next = (int) Database::scalar(
            'SELECT COALESCE(MAX(`revision_no`), 0) + 1 FROM `document_revisions` WHERE `document_id` = :doc',
            ['doc' => $documentId]
        );

        $id = Database::insert('document_revisions', [
            'document_id' => $documentId,
            'revision_no' => $next,
            'user_id'     => $userId,
            'title'       => $title,
            'content'     => $content,
            'summary'     => $summary,
            'change_type' => $changeType,
            'created_at'  => date('Y-m-d H:i:s'),
        ]);

        self::prune($documentId);

        return $id;
    }

    /**
     * Revisions without their content (content is loaded on demand).
     *
     * @return list<array<string,mixed>>
     */
    public static function listForDocument(int $documentId): array
    {
        return self::castAll(Database::fetchAll(
            'SELECT r.id, r.revision_no, r.title, r.summary, r.change_type, r.created_at,
                    r.user_id, u.name AS user_name, CHAR_LENGTH(r.content) AS content_length
               FROM `document_revisions` r
               LEFT JOIN `users` u ON u.id = r.user_id
              WHERE r.document_id = :doc
              ORDER BY r.revision_no DESC',
            ['doc' => $documentId]
        ));
    }

    /** @return array<string,mixed>|null */
    public static function findForDocument(int $documentId, int $revisionId): ?array
    {
        $row = Database::fetch(
            'SELECT r.*, u.name AS user_name
               FROM `document_revisions` r
               LEFT JOIN `users` u ON u.id = r.user_id
              WHERE r.id = :id AND r.document_id = :doc',
            ['id' => $revisionId, 'doc' => $documentId]
        );

        return $row === null ? null : self::cast($row);
    }

    private static function prune(int $documentId): void
    {
        $count = (int) Database::scalar(
            'SELECT COUNT(*) FROM `document_revisions` WHERE `document_id` = :doc',
            ['doc' => $documentId]
        );

        if ($count <= self::KEEP) {
            return;
        }

        Database::query(
            'DELETE FROM `document_revisions`
              WHERE `document_id` = :doc
              ORDER BY `revision_no` ASC
              LIMIT ' . ($count - self::KEEP),
            ['doc' => $documentId]
        );
    }
}
