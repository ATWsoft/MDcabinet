<?php

declare(strict_types=1);

namespace MDcabinet\Core;

/**
 * Translation of API messages.
 *
 * The English wording is used directly as the lookup key (gettext style).
 * That keeps the source readable, makes English the natural fallback and
 * means adding a language is just another file in app/lang.
 */
final class Lang
{
    /** @var list<string> */
    public const SUPPORTED = ['en', 'sk'];

    public const FALLBACK = 'en';

    private static string $locale = self::FALLBACK;

    /** @var array<string,string> */
    private static array $messages = [];

    public static function use(string $locale): void
    {
        $locale = self::normalize($locale);

        if ($locale === self::$locale && self::$messages !== []) {
            return;
        }

        self::$locale  = $locale;
        self::$messages = [];

        if ($locale === self::FALLBACK) {
            return;
        }

        $file = MDC_APP . '/lang/' . $locale . '.php';
        if (is_file($file)) {
            $loaded = require $file;
            if (is_array($loaded)) {
                self::$messages = $loaded;
            }
        }
    }

    public static function locale(): string
    {
        return self::$locale;
    }

    /**
     * Picks the language for the current request.
     *
     * The SPA sends its active language in X-Locale, which is the user's own
     * choice and therefore wins. Before the app knows who is logged in
     * (very first request) the browser preference is used instead.
     */
    public static function resolve(?string $header, ?string $acceptLanguage = null): string
    {
        if ($header !== null && in_array(self::normalize($header), self::SUPPORTED, true)) {
            return self::normalize($header);
        }

        foreach (self::parseAcceptLanguage($acceptLanguage ?? '') as $candidate) {
            if (in_array($candidate, self::SUPPORTED, true)) {
                return $candidate;
            }
        }

        return self::FALLBACK;
    }

    /**
     * Translates a message. Placeholders are written as {name}.
     *
     * @param array<string,string|int> $replace
     */
    public static function t(string $text, array $replace = []): string
    {
        $translated = self::$messages[$text] ?? $text;

        foreach ($replace as $key => $value) {
            $translated = str_replace('{' . $key . '}', (string) $value, $translated);
        }

        return $translated;
    }

    public static function isSupported(string $locale): bool
    {
        return in_array(self::normalize($locale), self::SUPPORTED, true);
    }

    /** "sk-SK" and "SK" both mean "sk". */
    public static function normalize(string $locale): string
    {
        return strtolower(substr(trim($locale), 0, 2));
    }

    /**
     * Language tags from an Accept-Language header, best quality first.
     *
     * @return list<string>
     */
    private static function parseAcceptLanguage(string $header): array
    {
        if (trim($header) === '') {
            return [];
        }

        $candidates = [];
        foreach (explode(',', $header) as $part) {
            $pieces = explode(';q=', trim($part));
            $tag    = self::normalize($pieces[0]);
            if ($tag === '') {
                continue;
            }
            $candidates[$tag] = isset($pieces[1]) ? (float) $pieces[1] : 1.0;
        }

        arsort($candidates);

        return array_keys($candidates);
    }
}
