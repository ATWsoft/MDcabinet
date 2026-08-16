<?php

declare(strict_types=1);

namespace MDcabinet\Core;

/**
 * Textové pomôcky. Slugify beží bez `intl` – hosting ho často nemá.
 */
final class Str
{
    /** @var array<string,string> */
    private const TRANSLIT = [
        'á' => 'a', 'ä' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'å' => 'a', 'ā' => 'a', 'ą' => 'a',
        'č' => 'c', 'ç' => 'c', 'ć' => 'c',
        'ď' => 'd', 'đ' => 'd',
        'é' => 'e', 'ě' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'ę' => 'e', 'ē' => 'e',
        'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i', 'ī' => 'i',
        'ĺ' => 'l', 'ľ' => 'l', 'ł' => 'l',
        'ň' => 'n', 'ñ' => 'n', 'ń' => 'n',
        'ó' => 'o', 'ô' => 'o', 'ö' => 'o', 'ò' => 'o', 'õ' => 'o', 'ø' => 'o', 'ō' => 'o',
        'ŕ' => 'r', 'ř' => 'r',
        'š' => 's', 'ś' => 's', 'ş' => 's',
        'ť' => 't', 'ţ' => 't',
        'ú' => 'u', 'ů' => 'u', 'ü' => 'u', 'ù' => 'u', 'û' => 'u', 'ū' => 'u',
        'ý' => 'y', 'ÿ' => 'y',
        'ž' => 'z', 'ź' => 'z', 'ż' => 'z',
        'ß' => 'ss', 'æ' => 'ae', 'œ' => 'oe',
    ];

    public static function slug(string $value, string $fallback = 'item'): string
    {
        $value = mb_strtolower(trim($value), 'UTF-8');
        $value = strtr($value, self::TRANSLIT);
        $value = preg_replace('/[^a-z0-9]+/u', '-', $value) ?? '';
        $value = trim($value, '-');
        $value = substr($value, 0, 120);

        return $value !== '' ? $value : $fallback . '-' . substr(bin2hex(random_bytes(4)), 0, 6);
    }

    /** Náhodný URL-safe token (dĺžka v znakoch, párna). */
    public static function token(int $length = 32): string
    {
        return substr(bin2hex(random_bytes((int) ceil($length / 2))), 0, $length);
    }

    /**
     * Krátky náhľad z Markdownu – odstráni najbežnejšiu MD syntax.
     */
    public static function excerpt(string $markdown, int $length = 300): string
    {
        $text = $markdown;
        $text = preg_replace('/^---\R.*?\R---\R/su', '', $text) ?? $text;   // front matter
        $text = preg_replace('/```.*?```/su', ' ', $text) ?? $text;          // code fences
        $text = preg_replace('/!\[[^\]]*\]\([^)]*\)/u', ' ', $text) ?? $text; // obrázky
        $text = preg_replace('/\[([^\]]*)\]\([^)]*\)/u', '$1', $text) ?? $text; // odkazy
        $text = preg_replace('/^\s*\|?[\s:|-]*\|[\s:|-]*$/mu', ' ', $text) ?? $text; // oddeľovače tabuliek
        $text = preg_replace('/^[>#\-\*\+\d\.\s]+/mu', '', $text) ?? $text;  // prefixy
        $text = preg_replace('/^\[[ xX]\]\s*/mu', '', $text) ?? $text;       // odškrtávacie políčka
        $text = str_replace('|', ' ', $text);                                // zvyšné bunky tabuliek
        $text = preg_replace('/[*_`~]+/u', '', $text) ?? $text;              // zvyšné značky
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
        $text = trim($text);

        if (mb_strlen($text, 'UTF-8') <= $length) {
            return $text;
        }

        return rtrim(mb_substr($text, 0, $length, 'UTF-8')) . '…';
    }

    /** Prvý H1 nadpis z Markdownu, ak existuje. */
    public static function headingFromMarkdown(string $markdown): ?string
    {
        if (preg_match('/^\s*#\s+(.+)$/mu', $markdown, $m)) {
            return trim($m[1]);
        }

        return null;
    }

    public static function limit(string $value, int $length): string
    {
        return mb_strlen($value, 'UTF-8') > $length
            ? mb_substr($value, 0, $length, 'UTF-8')
            : $value;
    }
}
