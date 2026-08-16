<?php

declare(strict_types=1);

namespace MDcabinet\Support;

/**
 * Prevod DB riadkov (snake_case) na tvar, ktorý konzumuje frontend (camelCase).
 * Drží API stabilné aj keď sa schéma zmení.
 */
final class Presenter
{
    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function cabinet(array $row): array
    {
        $out = [
            'id'          => (int) $row['id'],
            'name'        => $row['name'],
            'slug'        => $row['slug'],
            'description' => $row['description'],
            'color'       => $row['color'],
            'icon'        => $row['icon'],
            'position'    => (int) $row['position'],
            'createdAt'   => $row['created_at'],
            'updatedAt'   => $row['updated_at'],
        ];

        if (isset($row['tray_count'])) {
            $out['trayCount'] = (int) $row['tray_count'];
        }
        if (isset($row['document_count'])) {
            $out['documentCount'] = (int) $row['document_count'];
        }
        if (isset($row['trays'])) {
            $out['trays'] = array_map([self::class, 'tray'], $row['trays']);
        }

        return $out;
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function tray(array $row): array
    {
        $out = [
            'id'          => (int) $row['id'],
            'cabinetId'   => (int) $row['cabinet_id'],
            'name'        => $row['name'],
            'slug'        => $row['slug'],
            'description' => $row['description'],
            'icon'        => $row['icon'],
            'position'    => (int) $row['position'],
            'createdAt'   => $row['created_at'],
            'updatedAt'   => $row['updated_at'],
        ];

        if (isset($row['folders'])) {
            $out['folders'] = array_map([self::class, 'folder'], $row['folders']);
        }
        if (isset($row['documents'])) {
            $out['documents'] = array_map([self::class, 'documentSummary'], $row['documents']);
        }

        return $out;
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function folder(array $row): array
    {
        $out = [
            'id'        => (int) $row['id'],
            'trayId'    => (int) $row['tray_id'],
            'parentId'  => $row['parent_id'] === null ? null : (int) $row['parent_id'],
            'name'      => $row['name'],
            'slug'      => $row['slug'],
            'position'  => (int) $row['position'],
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'],
        ];

        if (isset($row['children'])) {
            $out['children'] = array_map([self::class, 'folder'], $row['children']);
        }
        if (isset($row['documents'])) {
            $out['documents'] = array_map([self::class, 'documentSummary'], $row['documents']);
        }

        return $out;
    }

    /**
     * Dokument bez obsahu – pre stromy, zoznamy a výsledky hľadania.
     *
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function documentSummary(array $row): array
    {
        $out = [
            'id'        => (int) $row['id'],
            'trayId'    => (int) $row['tray_id'],
            'folderId'  => isset($row['folder_id']) && $row['folder_id'] !== null ? (int) $row['folder_id'] : null,
            'title'     => $row['title'],
            'slug'      => $row['slug'] ?? null,
            'excerpt'   => $row['excerpt'] ?? '',
            'wordCount' => isset($row['word_count']) ? (int) $row['word_count'] : null,
            'isPinned'  => (bool) ($row['is_pinned'] ?? false),
            'position'  => isset($row['position']) ? (int) $row['position'] : 0,
            'createdAt' => $row['created_at'] ?? null,
            'updatedAt' => $row['updated_at'] ?? null,
        ];

        // Doplnkový kontext z hľadania / posledne upravených.
        foreach (['tray_name' => 'trayName', 'cabinet_id' => 'cabinetId',
                  'cabinet_name' => 'cabinetName', 'cabinet_color' => 'cabinetColor'] as $from => $to) {
            if (isset($row[$from])) {
                $out[$to] = $from === 'cabinet_id' ? (int) $row[$from] : $row[$from];
            }
        }

        return $out;
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function document(array $row): array
    {
        return self::documentSummary($row) + [
            'content'   => $row['content'] ?? '',
            'createdBy' => isset($row['created_by']) ? (int) $row['created_by'] : null,
            'updatedBy' => isset($row['updated_by']) ? (int) $row['updated_by'] : null,
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function revision(array $row): array
    {
        $out = [
            'id'         => (int) $row['id'],
            'revisionNo' => (int) $row['revision_no'],
            'title'      => $row['title'],
            'summary'    => $row['summary'],
            'changeType' => $row['change_type'],
            'userId'     => isset($row['user_id']) && $row['user_id'] !== null ? (int) $row['user_id'] : null,
            'userName'   => $row['user_name'] ?? null,
            'createdAt'  => $row['created_at'],
        ];

        if (isset($row['content_length'])) {
            $out['contentLength'] = (int) $row['content_length'];
        }
        if (array_key_exists('content', $row)) {
            $out['content'] = $row['content'];
        }

        return $out;
    }
}
