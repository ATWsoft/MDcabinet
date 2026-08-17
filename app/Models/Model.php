<?php

declare(strict_types=1);

namespace MDcabinet\Models;

use MDcabinet\Core\Database;
use MDcabinet\Core\Str;

/**
 * A lightweight "active record lite": static repositories over a single table.
 * No ORM – the queries stay visible and predictable.
 */
abstract class Model
{
    /** Table name – provided by the subclass. */
    protected const TABLE = '';

    /** Soft delete column (null when the table has none). */
    protected const SOFT_DELETE = 'deleted_at';

    /** @return array<string,mixed>|null */
    public static function find(int $id, bool $withTrashed = false): ?array
    {
        $sql = 'SELECT * FROM `' . static::TABLE . '` WHERE `id` = :id';
        if (!$withTrashed && static::SOFT_DELETE !== null) {
            $sql .= ' AND `' . static::SOFT_DELETE . '` IS NULL';
        }

        $row = Database::fetch($sql, ['id' => $id]);

        return $row === null ? null : static::cast($row);
    }

    /** @param array<string,mixed> $data */
    public static function create(array $data): int
    {
        $now = date('Y-m-d H:i:s');
        $data += ['created_at' => $now, 'updated_at' => $now];

        return Database::insert(static::TABLE, $data);
    }

    /** @param array<string,mixed> $data */
    public static function update(int $id, array $data): int
    {
        if ($data === []) {
            return 0;
        }
        $data['updated_at'] = date('Y-m-d H:i:s');

        return Database::update(static::TABLE, $data, ['id' => $id]);
    }

    public static function softDelete(int $id): void
    {
        Database::update(static::TABLE, [static::SOFT_DELETE => date('Y-m-d H:i:s')], ['id' => $id]);
    }

    public static function restore(int $id): void
    {
        Database::update(static::TABLE, [static::SOFT_DELETE => null], ['id' => $id]);
    }

    public static function forceDelete(int $id): void
    {
        Database::delete(static::TABLE, ['id' => $id]);
    }

    /**
     * The next free position within a parent (used for drag & drop ordering).
     *
     * @param array<string,mixed> $scope
     */
    public static function nextPosition(array $scope): int
    {
        $conditions = [];
        foreach (array_keys($scope) as $column) {
            $conditions[] = $scope[$column] === null
                ? "`$column` IS NULL"
                : "`$column` = :$column";
        }
        $params = array_filter($scope, static fn ($v) => $v !== null);

        $max = Database::scalar(
            'SELECT COALESCE(MAX(`position`), -1) FROM `' . static::TABLE . '` WHERE ' . implode(' AND ', $conditions),
            $params
        );

        return (int) $max + 1;
    }

    /**
     * A slug that is unique within the scope. Soft-deleted rows count too,
     * because the unique key still covers them.
     *
     * @param array<string,mixed> $scope
     */
    public static function uniqueSlug(string $name, array $scope, ?int $ignoreId = null): string
    {
        $base = Str::slug($name);
        $slug = $base;

        $conditions = ['`slug` = :slug'];
        $params     = [];
        foreach ($scope as $column => $value) {
            $conditions[] = "`$column` = :$column";
            $params[$column] = $value;
        }
        if ($ignoreId !== null) {
            $conditions[] = '`id` <> :ignore_id';
            $params['ignore_id'] = $ignoreId;
        }

        $sql = 'SELECT COUNT(*) FROM `' . static::TABLE . '` WHERE ' . implode(' AND ', $conditions);

        for ($i = 2; $i < 500; $i++) {
            $exists = (int) Database::scalar($sql, $params + ['slug' => $slug]);
            if ($exists === 0) {
                return $slug;
            }
            $slug = Str::limit($base, 130) . '-' . $i;
        }

        return $base . '-' . Str::token(6);
    }

    /**
     * Casts numeric columns from strings (some PDO drivers return them as text).
     *
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    protected static function cast(array $row): array
    {
        foreach (['id', 'owner_id', 'cabinet_id', 'tray_id', 'folder_id', 'parent_id', 'document_id',
                  'user_id', 'created_by', 'updated_by', 'position', 'word_count', 'revision_no',
                  'size', 'width', 'height', 'views'] as $column) {
            if (isset($row[$column]) && $row[$column] !== null) {
                $row[$column] = (int) $row[$column];
            }
        }
        foreach (['is_pinned'] as $column) {
            if (isset($row[$column])) {
                $row[$column] = (bool) $row[$column];
            }
        }

        return $row;
    }

    /**
     * @param list<array<string,mixed>> $rows
     * @return list<array<string,mixed>>
     */
    protected static function castAll(array $rows): array
    {
        return array_map(static fn (array $row) => static::cast($row), $rows);
    }
}
