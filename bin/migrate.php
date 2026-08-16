<?php
/**
 * CLI migrácie:  php bin/migrate.php
 *
 * Na hostingoch bez SSH použi radšej webový setup na /setup.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Tento skript sa dá spustiť iba z príkazového riadku.');
}

require __DIR__ . '/../app/bootstrap.php';

use MDcabinet\Core\Migrator;

$pending = Migrator::pending();

if ($pending === []) {
    echo "Databáza je aktuálna, nič na spustenie.\n";
    exit(0);
}

echo "Spúšťam migrácie:\n";
foreach (Migrator::run() as $name) {
    echo "  ✓ {$name}\n";
}
echo "Hotovo.\n";
