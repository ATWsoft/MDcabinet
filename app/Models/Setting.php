<?php

declare(strict_types=1);

namespace MDcabinet\Models;

use MDcabinet\Core\Config;
use MDcabinet\Core\Database;

/**
 * Instance settings in the `settings` table (key/value).
 *
 * Deliberately in the database and not in config.php: an administrator
 * should be able to change them from the app, without touching FTP.
 */
final class Setting
{
    /** Is registering new accounts allowed at all? */
    public const REGISTRATION_OPEN = 'registration_open';

    /** Code an applicant must supply. Empty = registration without a code. */
    public const REGISTRATION_CODE = 'registration_code';

    /** @var array<string,string>|null */
    private static ?array $cache = null;

    public static function get(string $key, ?string $default = null): ?string
    {
        return self::all()[$key] ?? $default;
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $value = self::get($key);

        return $value === null ? $default : in_array($value, ['1', 'true', 'yes', 'on'], true);
    }

    public static function set(string $key, ?string $value): void
    {
        Database::query(
            'INSERT INTO `settings` (`key`, `value`, `updated_at`)
                  VALUES (:key, :value, :now)
             ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = VALUES(`updated_at`)',
            ['key' => $key, 'value' => $value, 'now' => date('Y-m-d H:i:s')]
        );

        self::$cache = null;
    }

    public static function setBool(string $key, bool $value): void
    {
        self::set($key, $value ? '1' : '0');
    }

    // ------------------------------------------------------- registration ---

    /**
     * Database values win; when nothing is stored yet the default from
     * config.php is used (fresh installation).
     */
    public static function registrationOpen(): bool
    {
        return self::bool(
            self::REGISTRATION_OPEN,
            (bool) Config::get('security.allow_registration', true)
        );
    }

    public static function registrationCode(): string
    {
        $code = self::get(self::REGISTRATION_CODE);
        if ($code === null) {
            $code = (string) Config::get('security.registration_code', '');
        }

        return trim($code);
    }

    public static function requiresRegistrationCode(): bool
    {
        return self::registrationCode() !== '';
    }

    /** @return array<string,string> */
    public static function all(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        $rows = Database::fetchAll('SELECT `key`, `value` FROM `settings`');

        $settings = [];
        foreach ($rows as $row) {
            $settings[(string) $row['key']] = (string) ($row['value'] ?? '');
        }

        return self::$cache = $settings;
    }
}
