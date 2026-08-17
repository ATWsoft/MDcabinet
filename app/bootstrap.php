<?php
/**
 * Shared bootstrap: autoloader, configuration, error handling.
 * Deliberately without Composer so the app runs on any classic hosting.
 */

declare(strict_types=1);

define('MDC_START', microtime(true));
define('MDC_ROOT', dirname(__DIR__));
define('MDC_APP', MDC_ROOT . '/app');
define('MDC_STORAGE', MDC_ROOT . '/storage');

if (PHP_VERSION_ID < 80100) {
    http_response_code(500);
    exit('MDcabinet requires PHP 8.1 or newer. Currently running ' . PHP_VERSION . '.');
}

// Say plainly what is missing instead of failing later with an opaque 500.
$missingExtensions = array_values(array_filter(
    ['pdo_mysql', 'mbstring', 'json'],
    static fn (string $extension) => !extension_loaded($extension)
));

if ($missingExtensions !== []) {
    http_response_code(500);
    exit(
        'MDcabinet needs these PHP extensions, which are not enabled: '
        . implode(', ', $missingExtensions)
        . '. Enable them in your hosting control panel.'
    );
}

// -------------------------------------------------------------- autoloader ---
spl_autoload_register(static function (string $class): void {
    $prefix = 'MDcabinet\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = MDC_APP . '/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

// ------------------------------------------------------------ configuration ---
\MDcabinet\Core\Config::load();

// ----------------------------------------------------------- error handling ---
\MDcabinet\Core\ErrorHandler::register();
