<?php

declare(strict_types=1);

namespace MDcabinet\Models;

use MDcabinet\Core\Config;
use MDcabinet\Core\Database;
use MDcabinet\Core\Str;

final class ShareLink
{
    public const TYPES = ['cabinet', 'tray', 'folder', 'document'];

    public static function create(
        string $targetType,
        int $targetId,
        int $userId,
        ?string $password = null,
        ?string $expiresAt = null
    ): string {
        $token = Str::token(40);

        Database::insert('share_links', [
            'token'         => $token,
            'target_type'   => $targetType,
            'target_id'     => $targetId,
            'created_by'    => $userId,
            'password_hash' => $password !== null && $password !== '' ? password_hash($password, PASSWORD_DEFAULT) : null,
            'expires_at'    => $expiresAt,
            'created_at'    => date('Y-m-d H:i:s'),
        ]);

        return $token;
    }

    /** @return array<string,mixed>|null */
    public static function find(string $token): ?array
    {
        return Database::fetch('SELECT * FROM `share_links` WHERE `token` = :token', ['token' => $token]);
    }

    /** @param array<string,mixed> $share */
    public static function isExpired(array $share): bool
    {
        return $share['expires_at'] !== null && strtotime((string) $share['expires_at']) < time();
    }

    /** @param array<string,mixed> $share */
    public static function needsPassword(array $share): bool
    {
        return $share['password_hash'] !== null && $share['password_hash'] !== '';
    }

    public static function delete(string $token, int $userId): int
    {
        return Database::delete('share_links', ['token' => $token, 'created_by' => $userId]);
    }

    public static function touch(string $token): void
    {
        Database::query(
            'UPDATE `share_links` SET `views` = `views` + 1, `last_viewed_at` = :now WHERE `token` = :token',
            ['now' => date('Y-m-d H:i:s'), 'token' => $token]
        );
    }

    /** @return list<array<string,mixed>> */
    public static function listForTarget(string $targetType, int $targetId, int $userId): array
    {
        $rows = Database::fetchAll(
            'SELECT * FROM `share_links`
              WHERE `target_type` = :type AND `target_id` = :id AND `created_by` = :user
              ORDER BY `created_at` DESC',
            ['type' => $targetType, 'id' => $targetId, 'user' => $userId]
        );

        return array_map([self::class, 'toPublic'], $rows);
    }

    /**
     * @param array<string,mixed> $share
     * @return array<string,mixed>
     */
    public static function toPublic(array $share): array
    {
        return [
            'token'        => $share['token'],
            // The frontend rebuilds this URL for the routing mode in use;
            // this value is a sensible default for pretty URLs.
            'url'          => Config::url() . '/s/' . $share['token'],
            'targetType'   => $share['target_type'],
            'targetId'     => (int) $share['target_id'],
            'hasPassword'  => self::needsPassword($share),
            'expiresAt'    => $share['expires_at'],
            'views'        => (int) $share['views'],
            'lastViewedAt' => $share['last_viewed_at'],
            'createdAt'    => $share['created_at'],
        ];
    }
}
