<?php

declare(strict_types=1);

namespace MDcabinet\Core;

/**
 * Súborový rate limiter pre citlivé endpointy (login, registrácia, share heslo).
 * Zámerne bez Redisu – na klasickom hostingu žiadny nie je.
 */
final class RateLimiter
{
    public static function hit(string $key, int $maxAttempts, int $decaySeconds): void
    {
        $file = self::path($key);
        $now  = time();

        $data = ['count' => 0, 'reset' => $now + $decaySeconds];
        if (is_file($file)) {
            $decoded = json_decode((string) @file_get_contents($file), true);
            if (is_array($decoded) && ($decoded['reset'] ?? 0) > $now) {
                $data = ['count' => (int) $decoded['count'], 'reset' => (int) $decoded['reset']];
            }
        }

        $data['count']++;

        if ($data['count'] > $maxAttempts) {
            $wait = max(1, $data['reset'] - $now);
            throw new HttpException(429, "Príliš veľa pokusov. Skús to znova o {$wait} s.");
        }

        @file_put_contents($file, json_encode($data), LOCK_EX);
    }

    public static function clear(string $key): void
    {
        @unlink(self::path($key));
    }

    private static function path(string $key): string
    {
        $dir = MDC_STORAGE . '/cache/ratelimit';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        return $dir . '/' . sha1($key) . '.json';
    }
}
