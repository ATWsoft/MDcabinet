<?php

declare(strict_types=1);

namespace MDcabinet\Models;

use MDcabinet\Core\Config;
use MDcabinet\Core\Database;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\Str;

final class Attachment extends Model
{
    protected const TABLE = 'attachments';
    protected const SOFT_DELETE = null;

    /** Prípony, ktoré sa nikdy nesmú uložiť, aj keby MIME sedelo. */
    private const BLOCKED_EXTENSIONS = [
        'php', 'php3', 'php4', 'php5', 'php7', 'php8', 'phtml', 'phar',
        'htaccess', 'htpasswd', 'cgi', 'pl', 'py', 'sh', 'exe', 'bat', 'com',
    ];

    /**
     * Uloží nahratý súbor na disk a zapíše záznam.
     *
     * @param array{name:string,type:string,tmp_name:string,error:int,size:int} $file
     * @return array<string,mixed>
     */
    public static function store(array $file, int $userId, ?int $documentId = null): array
    {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw HttpException::badRequest(self::uploadErrorMessage($file['error']));
        }

        $maxSize = (int) Config::get('uploads.max_size', 16 * 1024 * 1024);
        if ($file['size'] > $maxSize) {
            throw new HttpException(413, 'Súbor je väčší ako povolených ' . round($maxSize / 1048576) . ' MB.');
        }

        $mime = self::detectMime($file['tmp_name'], $file['name']);
        $allowed = (array) Config::get('uploads.mime_allow', []);
        if ($allowed !== [] && !in_array($mime, $allowed, true)) {
            throw HttpException::badRequest('Typ súboru "' . $mime . '" nie je povolený.');
        }

        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if ($extension === '' || in_array($extension, self::BLOCKED_EXTENSIONS, true)) {
            $extension = self::extensionFromMime($mime);
        }

        $relativeDir = date('Y/m');
        $absoluteDir = MDC_STORAGE . '/uploads/' . $relativeDir;
        if (!is_dir($absoluteDir) && !@mkdir($absoluteDir, 0775, true) && !is_dir($absoluteDir)) {
            throw new HttpException(500, 'Nepodarilo sa vytvoriť adresár pre uploady.');
        }

        $diskName = Str::token(24) . '.' . $extension;
        $diskPath = $relativeDir . '/' . $diskName;

        if (!move_uploaded_file($file['tmp_name'], $absoluteDir . '/' . $diskName)) {
            throw new HttpException(500, 'Súbor sa nepodarilo uložiť.');
        }

        [$width, $height] = self::imageSize($absoluteDir . '/' . $diskName, $mime);

        $id = Database::insert('attachments', [
            'user_id'       => $userId,
            'document_id'   => $documentId,
            'disk_path'     => $diskPath,
            'original_name' => Str::limit($file['name'], 250),
            'mime'          => $mime,
            'size'          => (int) $file['size'],
            'width'         => $width,
            'height'        => $height,
            'created_at'    => date('Y-m-d H:i:s'),
        ]);

        return self::find($id) ?? [];
    }

    public static function absolutePath(string $diskPath): string
    {
        return MDC_STORAGE . '/uploads/' . $diskPath;
    }

    /** URL, ktorá sa vloží do Markdownu. */
    public static function url(int $id): string
    {
        return Config::basePath() . '/api/files/' . $id;
    }

    /**
     * @param array<string,mixed> $attachment
     * @return array<string,mixed>
     */
    public static function toPublic(array $attachment): array
    {
        return [
            'id'           => (int) $attachment['id'],
            'url'          => self::url((int) $attachment['id']),
            'originalName' => $attachment['original_name'],
            'mime'         => $attachment['mime'],
            'size'         => (int) $attachment['size'],
            'width'        => $attachment['width'] ?? null,
            'height'       => $attachment['height'] ?? null,
            'isImage'      => str_starts_with((string) $attachment['mime'], 'image/'),
            'createdAt'    => $attachment['created_at'] ?? null,
        ];
    }

    private static function detectMime(string $tmpPath, string $originalName): string
    {
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo !== false) {
                $mime = finfo_file($finfo, $tmpPath);
                finfo_close($finfo);
                if (is_string($mime) && $mime !== '') {
                    return $mime === 'image/svg' ? 'image/svg+xml' : $mime;
                }
            }
        }

        return match (strtolower(pathinfo($originalName, PATHINFO_EXTENSION))) {
            'png'  => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'gif'  => 'image/gif',
            'webp' => 'image/webp',
            'svg'  => 'image/svg+xml',
            'pdf'  => 'application/pdf',
            'md'   => 'text/markdown',
            'txt'  => 'text/plain',
            default => 'application/octet-stream',
        };
    }

    private static function extensionFromMime(string $mime): string
    {
        return match ($mime) {
            'image/png'     => 'png',
            'image/jpeg'    => 'jpg',
            'image/gif'     => 'gif',
            'image/webp'    => 'webp',
            'image/svg+xml' => 'svg',
            'application/pdf' => 'pdf',
            'text/markdown' => 'md',
            'text/plain'    => 'txt',
            default         => 'bin',
        };
    }

    /** @return array{0:?int,1:?int} */
    private static function imageSize(string $path, string $mime): array
    {
        if (!str_starts_with($mime, 'image/') || $mime === 'image/svg+xml') {
            return [null, null];
        }

        $size = @getimagesize($path);

        return $size === false ? [null, null] : [(int) $size[0], (int) $size[1]];
    }

    private static function uploadErrorMessage(int $code): string
    {
        return match ($code) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Súbor je príliš veľký.',
            UPLOAD_ERR_PARTIAL   => 'Súbor sa nahral len čiastočne.',
            UPLOAD_ERR_NO_FILE   => 'Nebol poslaný žiadny súbor.',
            UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE => 'Server nedokáže zapísať dočasný súbor.',
            default => 'Nahrávanie zlyhalo (kód ' . $code . ').',
        };
    }
}
