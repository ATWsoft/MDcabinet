<?php

declare(strict_types=1);

namespace MDcabinet\Core;

use PDO;
use PDOException;
use PDOStatement;

/**
 * Tenká vrstva nad PDO – jedno spojenie na request, pripravené dopyty,
 * pár skratiek (`fetch`, `fetchAll`, `insert`, `update`, `delete`).
 */
final class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            (string) Config::get('db.host'),
            (int) Config::get('db.port', 3306),
            (string) Config::get('db.name'),
            (string) Config::get('db.charset', 'utf8mb4')
        );

        try {
            self::$pdo = new PDO(
                $dsn,
                (string) Config::get('db.user'),
                (string) Config::get('db.pass'),
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                    PDO::ATTR_STRINGIFY_FETCHES  => false,
                ]
            );
        } catch (PDOException $e) {
            throw new HttpException(500, 'Nepodarilo sa pripojiť k databáze: ' . $e->getMessage());
        }

        return self::$pdo;
    }

    /** @param array<string|int,mixed> $params */
    public static function query(string $sql, array $params = []): PDOStatement
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);

        return $stmt;
    }

    /**
     * @param array<string|int,mixed> $params
     * @return array<string,mixed>|null
     */
    public static function fetch(string $sql, array $params = []): ?array
    {
        $row = self::query($sql, $params)->fetch();

        return $row === false ? null : $row;
    }

    /**
     * @param array<string|int,mixed> $params
     * @return list<array<string,mixed>>
     */
    public static function fetchAll(string $sql, array $params = []): array
    {
        return self::query($sql, $params)->fetchAll();
    }

    /** @param array<string|int,mixed> $params */
    public static function scalar(string $sql, array $params = []): mixed
    {
        $value = self::query($sql, $params)->fetchColumn();

        return $value === false ? null : $value;
    }

    /** @param array<string,mixed> $data */
    public static function insert(string $table, array $data): int
    {
        $columns = array_keys($data);
        $sql = sprintf(
            'INSERT INTO `%s` (%s) VALUES (%s)',
            $table,
            implode(', ', array_map(static fn ($c) => "`$c`", $columns)),
            implode(', ', array_map(static fn ($c) => ":$c", $columns))
        );

        self::query($sql, $data);

        return (int) self::pdo()->lastInsertId();
    }

    /**
     * @param array<string,mixed> $data
     * @param array<string,mixed> $where
     */
    public static function update(string $table, array $data, array $where): int
    {
        if ($data === []) {
            return 0;
        }

        $set    = [];
        $params = [];
        foreach ($data as $column => $value) {
            $set[] = "`$column` = :set_$column";
            $params["set_$column"] = $value;
        }

        $conditions = [];
        foreach ($where as $column => $value) {
            $conditions[] = "`$column` = :where_$column";
            $params["where_$column"] = $value;
        }

        $sql = sprintf(
            'UPDATE `%s` SET %s WHERE %s',
            $table,
            implode(', ', $set),
            implode(' AND ', $conditions)
        );

        return self::query($sql, $params)->rowCount();
    }

    /** @param array<string,mixed> $where */
    public static function delete(string $table, array $where): int
    {
        $conditions = [];
        foreach ($where as $column => $value) {
            $conditions[] = "`$column` = :$column";
        }

        $sql = sprintf('DELETE FROM `%s` WHERE %s', $table, implode(' AND ', $conditions));

        return self::query($sql, $where)->rowCount();
    }

    public static function transaction(callable $callback): mixed
    {
        $pdo = self::pdo();
        $pdo->beginTransaction();

        try {
            $result = $callback();
            $pdo->commit();

            return $result;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }
}
