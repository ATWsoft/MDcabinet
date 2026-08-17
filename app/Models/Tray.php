<?php

declare(strict_types=1);

namespace MDcabinet\Models;

use MDcabinet\Core\Database;

final class Tray extends Model
{
    protected const TABLE = 'trays';

    /** @return list<array<string,mixed>> */
    public static function allForCabinet(int $cabinetId): array
    {
        return self::castAll(Database::fetchAll(
            'SELECT * FROM `trays`
              WHERE `cabinet_id` = :cabinet AND `deleted_at` IS NULL
              ORDER BY `position` ASC, `name` ASC',
            ['cabinet' => $cabinetId]
        ));
    }

    /** The cabinet the tray belongs to – used for ownership checks. */
    public static function cabinetId(int $trayId): ?int
    {
        $value = Database::scalar(
            'SELECT `cabinet_id` FROM `trays` WHERE `id` = :id AND `deleted_at` IS NULL',
            ['id' => $trayId]
        );

        return $value === null ? null : (int) $value;
    }
}
