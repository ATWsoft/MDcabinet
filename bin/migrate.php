<?php
/**
 * CLI migrations:  php bin/migrate.php
 *
 * On hostings without SSH use the web installer at /setup instead.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('This script can only be run from the command line.');
}

require __DIR__ . '/../app/bootstrap.php';

use MDcabinet\Core\Migrator;

$pending = Migrator::pending();

if ($pending === []) {
    echo "The database is up to date, nothing to run.\n";
    exit(0);
}

echo "Running migrations:\n";
foreach (Migrator::run() as $name) {
    echo "  + {$name}\n";
}
echo "Done.\n";
