<?php

declare(strict_types=1);

namespace MDcabinet\Core;

use Throwable;

/**
 * Chyby nikdy nekončia bielou stránkou – buď JSON (pre /api), alebo krátka HTML hláška.
 * Detaily idú do storage/logs/app-YYYY-MM-DD.log.
 */
final class ErrorHandler
{
    public static function register(): void
    {
        $debug = Config::isDebug();

        error_reporting(E_ALL);
        ini_set('display_errors', $debug ? '1' : '0');
        ini_set('log_errors', '1');

        set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
            if (!(error_reporting() & $severity)) {
                return false;
            }
            throw new \ErrorException($message, 0, $severity, $file, $line);
        });

        set_exception_handler([self::class, 'handle']);

        register_shutdown_function(static function (): void {
            $error = error_get_last();
            if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
                self::handle(new \ErrorException(
                    $error['message'],
                    0,
                    $error['type'],
                    $error['file'],
                    $error['line']
                ));
            }
        });
    }

    public static function handle(Throwable $e): void
    {
        $status = $e instanceof HttpException ? $e->getStatusCode() : 500;

        if ($status >= 500) {
            self::log($e);
        }

        if (headers_sent()) {
            return;
        }

        $payload = [
            'error'   => true,
            'message' => $status >= 500 && !Config::isDebug()
                ? 'Nastala neočakávaná chyba na serveri.'
                : $e->getMessage(),
        ];

        if ($e instanceof HttpException && $e->getErrors() !== []) {
            $payload['errors'] = $e->getErrors();
        }

        if (Config::isDebug() && $status >= 500) {
            $payload['exception'] = get_class($e);
            $payload['file']      = $e->getFile() . ':' . $e->getLine();
            $payload['trace']     = explode("\n", $e->getTraceAsString());
        }

        if (self::wantsJson()) {
            Response::json($payload, $status)->send();
            return;
        }

        http_response_code($status);
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><meta charset="utf-8"><title>Chyba ' . $status . '</title>'
            . '<style>body{font:16px/1.6 system-ui,sans-serif;max-width:40rem;margin:15vh auto;padding:0 1.5rem;color:#1f2430}'
            . 'code{background:#f1f3f7;padding:.15em .4em;border-radius:.25em}</style>'
            . '<h1>Chyba ' . $status . '</h1><p>' . htmlspecialchars((string) $payload['message'], ENT_QUOTES) . '</p>';
    }

    public static function log(Throwable $e): void
    {
        $dir = MDC_STORAGE . '/logs';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        $line = sprintf(
            "[%s] %s: %s in %s:%d\n%s\n\n",
            date('Y-m-d H:i:s'),
            get_class($e),
            $e->getMessage(),
            $e->getFile(),
            $e->getLine(),
            $e->getTraceAsString()
        );

        @file_put_contents($dir . '/app-' . date('Y-m-d') . '.log', $line, FILE_APPEND | LOCK_EX);
    }

    private static function wantsJson(): bool
    {
        $uri    = $_SERVER['REQUEST_URI'] ?? '';
        $accept = $_SERVER['HTTP_ACCEPT'] ?? '';

        return str_contains($uri, '/api/') || str_contains($accept, 'application/json');
    }
}
