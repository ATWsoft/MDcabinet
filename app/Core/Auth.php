<?php

declare(strict_types=1);

namespace MDcabinet\Core;

/**
 * Sign-in is built on the native PHP session (the SPA runs on the same
 * origin), so neither JWT nor any extra dependency is needed. CSRF is covered
 * by a SameSite=Lax cookie plus a token in the X-CSRF-Token header.
 */
final class Auth
{
    private const SESSION_USER = 'mdc_user_id';
    private const SESSION_CSRF = 'mdc_csrf';

    /** @var array<string,mixed>|null */
    private static ?array $user = null;

    private static bool $started = false;

    public static function start(): void
    {
        if (self::$started || session_status() === PHP_SESSION_ACTIVE) {
            self::$started = true;
            return;
        }

        $lifetime = (int) Config::get('security.session_lifetime', 2592000);
        $https    = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

        session_name((string) Config::get('security.session_name', 'mdcabinet_session'));
        session_set_cookie_params([
            'lifetime' => $lifetime,
            'path'     => Config::basePath() . '/',
            'domain'   => '',
            'secure'   => $https,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        ini_set('session.gc_maxlifetime', (string) $lifetime);

        session_start();
        self::$started = true;
    }

    public static function login(int $userId): void
    {
        self::start();
        session_regenerate_id(true);
        $_SESSION[self::SESSION_USER] = $userId;
        $_SESSION[self::SESSION_CSRF] = Str::token(40);
        self::$user = null;
    }

    public static function logout(): void
    {
        self::start();
        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires'  => time() - 42000,
                'path'     => $params['path'],
                'domain'   => $params['domain'],
                'secure'   => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite'] ?? 'Lax',
            ]);
        }

        session_destroy();
        self::$user    = null;
        self::$started = false;
    }

    public static function id(): ?int
    {
        self::start();
        $id = $_SESSION[self::SESSION_USER] ?? null;

        return is_int($id) ? $id : (is_numeric($id) ? (int) $id : null);
    }

    public static function check(): bool
    {
        return self::user() !== null;
    }

    /** @return array<string,mixed>|null */
    public static function user(): ?array
    {
        if (self::$user !== null) {
            return self::$user;
        }

        $id = self::id();
        if ($id === null) {
            return null;
        }

        // SELECT * on purpose: an explicit column list would make the whole
        // app fail with a 500 whenever a migration adding a column has not
        // been applied yet. The hash is dropped right after.
        $user = Database::fetch(
            'SELECT * FROM users WHERE id = :id AND deleted_at IS NULL',
            ['id' => $id]
        );

        if ($user === null) {
            self::logout();
            return null;
        }

        unset($user['password_hash']);
        $user['id'] = (int) $user['id'];

        return self::$user = $user;
    }

    /** @return array<string,mixed> */
    public static function userOrFail(): array
    {
        $user = self::user();
        if ($user === null) {
            throw HttpException::unauthorized();
        }

        return $user;
    }

    public static function idOrFail(): int
    {
        return (int) self::userOrFail()['id'];
    }

    public static function isAdmin(): bool
    {
        return (self::user()['role'] ?? '') === 'admin';
    }

    /** Forgets the cached user so the next read hits the database again. */
    public static function forgetCachedUser(): void
    {
        self::$user = null;
    }

    // -------------------------------------------------------------- CSRF ---

    public static function csrfToken(): string
    {
        self::start();

        if (empty($_SESSION[self::SESSION_CSRF])) {
            $_SESSION[self::SESSION_CSRF] = Str::token(40);
        }

        return (string) $_SESSION[self::SESSION_CSRF];
    }

    public static function verifyCsrf(?string $token): bool
    {
        self::start();
        $expected = $_SESSION[self::SESSION_CSRF] ?? null;

        return is_string($expected) && is_string($token) && hash_equals($expected, $token);
    }
}
