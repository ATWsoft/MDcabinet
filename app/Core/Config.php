<?php

declare(strict_types=1);

namespace MDcabinet\Core;

/**
 * Configuration: config/config.php on top of the defaults, with MDC_* env
 * variables taking precedence (used by docker-compose during development).
 */
final class Config
{
    /** @var array<string,mixed> */
    private static array $data = [];

    private static bool $loaded = false;

    public static function load(): void
    {
        if (self::$loaded) {
            return;
        }

        $defaults = require MDC_ROOT . '/config/config.example.php';
        $local    = is_file(MDC_ROOT . '/config/config.php')
            ? require MDC_ROOT . '/config/config.php'
            : [];

        self::$data = self::merge($defaults, is_array($local) ? $local : []);

        // Must be set before applyEnv(): that calls set(), which would ask
        // for load() again and recurse forever.
        self::$loaded = true;

        self::applyEnv();
    }

    /** Is there a usable configuration (i.e. has setup been completed)? */
    public static function isInstalled(): bool
    {
        return is_file(MDC_ROOT . '/config/config.php')
            || getenv('MDC_DB_NAME') !== false;
    }

    /**
     * Reads a value using dot notation: Config::get('db.host').
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        self::load();

        $value = self::$data;
        foreach (explode('.', $key) as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }
            $value = $value[$segment];
        }

        return $value;
    }

    public static function set(string $key, mixed $value): void
    {
        self::load();

        $segments = explode('.', $key);
        $ref =& self::$data;
        foreach ($segments as $segment) {
            if (!isset($ref[$segment]) || !is_array($ref[$segment])) {
                $ref[$segment] = [];
            }
            $ref =& $ref[$segment];
        }
        $ref = $value;
    }

    public static function isDebug(): bool
    {
        return (bool) self::get('app.debug', false);
    }

    /** Base URL of the application without a trailing slash. */
    public static function url(): string
    {
        $configured = (string) self::get('app.url', '');
        if ($configured !== '') {
            return rtrim($configured, '/');
        }

        $https  = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        $scheme = $https ? 'https' : 'http';
        $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';

        return $scheme . '://' . $host . rtrim(self::basePath(), '/');
    }

    /**
     * The sub-directory the app runs in (e.g. "/docs" when installed into a
     * folder). Returns either "" or "/something".
     */
    public static function basePath(): string
    {
        static $base = null;
        if ($base !== null) {
            return $base;
        }

        $script = $_SERVER['SCRIPT_NAME'] ?? '/index.php';
        $dir    = rtrim(str_replace('\\', '/', dirname($script)), '/');

        return $base = ($dir === '/' ? '' : $dir);
    }

    /** Environment variables win – used by docker-compose and by setup. */
    private static function applyEnv(): void
    {
        $map = [
            'MDC_APP_NAME'   => 'app.name',
            'MDC_APP_ENV'    => 'app.env',
            'MDC_APP_DEBUG'  => 'app.debug',
            'MDC_APP_URL'    => 'app.url',
            'MDC_DB_HOST'    => 'db.host',
            'MDC_DB_PORT'    => 'db.port',
            'MDC_DB_NAME'    => 'db.name',
            'MDC_DB_USER'    => 'db.user',
            'MDC_DB_PASS'    => 'db.pass',
            'MDC_APP_KEY'    => 'security.app_key',
        ];

        foreach ($map as $env => $key) {
            $value = getenv($env);
            if ($value === false || $value === '') {
                continue;
            }
            if (in_array($key, ['app.debug'], true)) {
                $value = in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
            } elseif ($key === 'db.port') {
                $value = (int) $value;
            }
            self::set($key, $value);
        }
    }

    /**
     * @param array<string,mixed> $base
     * @param array<string,mixed> $override
     * @return array<string,mixed>
     */
    private static function merge(array $base, array $override): array
    {
        foreach ($override as $key => $value) {
            if (is_array($value) && isset($base[$key]) && is_array($base[$key]) && !array_is_list($value)) {
                $base[$key] = self::merge($base[$key], $value);
            } else {
                $base[$key] = $value;
            }
        }

        return $base;
    }
}
