<?php

declare(strict_types=1);

namespace MDcabinet\Models;

use MDcabinet\Core\Database;
use MDcabinet\Core\Lang;

final class User extends Model
{
    protected const TABLE = 'users';

    private const AVATAR_COLORS = [
        '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
        '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6',
    ];

    /** @return array<string,mixed>|null */
    public static function findByEmail(string $email): ?array
    {
        $row = Database::fetch(
            'SELECT * FROM `users` WHERE `email` = :email AND `deleted_at` IS NULL',
            ['email' => mb_strtolower(trim($email))]
        );

        return $row === null ? null : self::cast($row);
    }

    public static function register(
        string $email,
        string $name,
        string $password,
        string $role = 'user',
        string $locale = Lang::FALLBACK
    ): int {
        return self::create([
            'email'         => mb_strtolower(trim($email)),
            'name'          => trim($name),
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'role'          => $role,
            'locale'        => Lang::isSupported($locale) ? Lang::normalize($locale) : Lang::FALLBACK,
            'avatar_color'  => self::AVATAR_COLORS[array_rand(self::AVATAR_COLORS)],
        ]);
    }

    public static function setPassword(int $id, string $password): void
    {
        self::update($id, ['password_hash' => password_hash($password, PASSWORD_DEFAULT)]);
    }

    /** @param array<string,mixed> $user */
    public static function verifyPassword(array $user, string $password): bool
    {
        return password_verify($password, (string) $user['password_hash']);
    }

    public static function touchLogin(int $id): void
    {
        Database::update('users', ['last_login_at' => date('Y-m-d H:i:s')], ['id' => $id]);
    }

    public static function count(): int
    {
        return (int) Database::scalar('SELECT COUNT(*) FROM `users` WHERE `deleted_at` IS NULL');
    }

    /**
     * The version without the password hash – what may be sent through the API.
     *
     * @param array<string,mixed> $user
     * @return array<string,mixed>
     */
    public static function toPublic(array $user): array
    {
        return [
            'id'          => (int) $user['id'],
            'email'       => $user['email'],
            'name'        => $user['name'],
            'role'        => $user['role'],
            'locale'      => $user['locale'] ?? Lang::FALLBACK,
            'avatarColor' => $user['avatar_color'] ?? '#6366f1',
            'createdAt'   => $user['created_at'] ?? null,
        ];
    }
}
