<?php

declare(strict_types=1);

namespace MDcabinet\Models;

use MDcabinet\Core\Database;

final class Cabinet extends Model
{
    protected const TABLE = 'cabinets';

    /** @return list<array<string,mixed>> */
    public static function allForUser(int $userId): array
    {
        $rows = Database::fetchAll(
            'SELECT c.*,
                    (SELECT COUNT(*) FROM `trays` t
                      WHERE t.cabinet_id = c.id AND t.deleted_at IS NULL) AS tray_count,
                    (SELECT COUNT(*) FROM `documents` d
                       JOIN `trays` t2 ON t2.id = d.tray_id
                      WHERE t2.cabinet_id = c.id AND d.deleted_at IS NULL AND t2.deleted_at IS NULL) AS document_count
               FROM `cabinets` c
              WHERE c.owner_id = :owner AND c.deleted_at IS NULL
              ORDER BY c.position ASC, c.name ASC',
            ['owner' => $userId]
        );

        return array_map(static function (array $row): array {
            $row = self::cast($row);
            $row['tray_count']     = (int) $row['tray_count'];
            $row['document_count'] = (int) $row['document_count'];

            return $row;
        }, $rows);
    }

    /**
     * Celý strom skrine: trays → folders → documents (bez obsahu dokumentov).
     *
     * @return array<string,mixed>
     */
    public static function tree(int $cabinetId): array
    {
        $cabinet = self::find($cabinetId);
        if ($cabinet === null) {
            return [];
        }

        $trays     = Tray::allForCabinet($cabinetId);
        $trayIds   = array_column($trays, 'id');
        $folders   = $trayIds === [] ? [] : Folder::allForTrays($trayIds);
        $documents = $trayIds === [] ? [] : Document::listForTrays($trayIds);

        foreach ($trays as &$tray) {
            $trayFolders   = array_values(array_filter($folders, static fn ($f) => $f['tray_id'] === $tray['id']));
            $trayDocuments = array_values(array_filter($documents, static fn ($d) => $d['tray_id'] === $tray['id']));

            $tray['folders']   = Folder::buildTree($trayFolders, $trayDocuments);
            $tray['documents'] = array_values(array_filter($trayDocuments, static fn ($d) => $d['folder_id'] === null));
        }
        unset($tray);

        $cabinet['trays'] = $trays;

        return $cabinet;
    }

    /** Prvý cabinet používateľa – použije sa po registrácii ako "Môj priestor". */
    public static function createDefault(int $userId): int
    {
        return self::create([
            'owner_id'    => $userId,
            'name'        => 'Môj priestor',
            'slug'        => self::uniqueSlug('Môj priestor', ['owner_id' => $userId]),
            'description' => 'Prvá skriňa – premenuj ju alebo si vytvor ďalšie.',
            'color'       => '#6366f1',
            'position'    => 0,
        ]);
    }
}
