<?php

declare(strict_types=1);

namespace MDcabinet\Core;

/**
 * Runs the .sql migrations from database/migrations in alphabetical order
 * and records them in the `migrations` table.
 */
final class Migrator
{
    private const DIR = MDC_ROOT . '/database/migrations';

    /**
     * @return list<string> names of the migrations that were applied
     */
    public static function run(): array
    {
        self::ensureTable();

        $applied = array_column(
            Database::fetchAll('SELECT `migration` FROM `migrations`'),
            'migration'
        );

        $batch = (int) (Database::scalar('SELECT COALESCE(MAX(`batch`), 0) FROM `migrations`') ?? 0) + 1;
        $ran   = [];

        foreach (self::files() as $file) {
            $name = basename($file);
            if (in_array($name, $applied, true)) {
                continue;
            }

            $sql = (string) file_get_contents($file);
            foreach (self::statements($sql) as $statement) {
                Database::pdo()->exec($statement);
            }

            Database::insert('migrations', [
                'migration'   => $name,
                'batch'       => $batch,
                'executed_at' => date('Y-m-d H:i:s'),
            ]);

            $ran[] = $name;
        }

        return $ran;
    }

    /** @return list<string> */
    public static function pending(): array
    {
        self::ensureTable();

        $applied = array_column(
            Database::fetchAll('SELECT `migration` FROM `migrations`'),
            'migration'
        );

        return array_values(array_filter(
            array_map('basename', self::files()),
            static fn (string $name) => !in_array($name, $applied, true)
        ));
    }

    /** @return list<string> */
    private static function files(): array
    {
        $files = glob(self::DIR . '/*.sql') ?: [];
        sort($files, SORT_NATURAL);

        return array_values($files);
    }

    /**
     * Splits a file into individual statements. Migrations deliberately
     * contain no procedures or triggers, so splitting on a trailing
     * semicolon is enough.
     *
     * @return list<string>
     */
    private static function statements(string $sql): array
    {
        $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
        $parts = preg_split('/;\s*(?:\r?\n|$)/', $sql) ?: [];

        return array_values(array_filter(
            array_map('trim', $parts),
            static fn (string $part) => $part !== ''
        ));
    }

    private static function ensureTable(): void
    {
        Database::pdo()->exec(
            'CREATE TABLE IF NOT EXISTS `migrations` (
                `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
                `migration`   VARCHAR(190) NOT NULL,
                `batch`       INT UNSIGNED NOT NULL DEFAULT 1,
                `executed_at` DATETIME     NOT NULL,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uq_migrations_name` (`migration`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }
}
