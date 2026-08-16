<?php
/**
 * Spoločný bootstrap – autoloader, konfigurácia, error handling.
 * Zámerne bez Composera, aby appka bežala na akomkoľvek klasickom hostingu.
 */

declare(strict_types=1);

define('MDC_START', microtime(true));
define('MDC_ROOT', dirname(__DIR__));
define('MDC_APP', MDC_ROOT . '/app');
define('MDC_STORAGE', MDC_ROOT . '/storage');

if (PHP_VERSION_ID < 80100) {
    http_response_code(500);
    exit('MDcabinet vyžaduje PHP 8.1 alebo novšie. Aktuálne beží ' . PHP_VERSION . '.');
}

// ------------------------------------------------------------- autoloader ---
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

// ------------------------------------------------------------ konfigurácia ---
\MDcabinet\Core\Config::load();

// ---------------------------------------------------------- error handling ---
\MDcabinet\Core\ErrorHandler::register();
