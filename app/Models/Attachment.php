<?php

declare(strict_types=1);

namespace MDcabinet\Models;

use MDcabinet\Core\Config;
use MDcabinet\Core\Database;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\Lang;
use MDcabinet\Core\Request;
use MDcabinet\Core\Str;

final class Attachment extends Model
{
    protected const TABLE = 'attachments';
    protected const SOFT_DELETE = null;

    /** Extensions that are never stored, even if the MIME type looks fine. */
    private const BLOCKED_EXTENSIONS = [
        'php', 'php3', 'php4', 'php5', 'php7', 'php8', 'phtml', 'phar',
        'htaccess', 'htpasswd', 'cgi', 'pl', 'py', 'sh', 'exe', 'bat', 'com',
    ];

    /**
     * Stores an uploaded file on disk and records it.
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
            throw new HttpException(413, Lang::t(
                'The file is larger than the allowed {size} MB.',
                ['size' => (int) round($maxSize / 1048576)]
            ));
        }

        $mime = self::detectMime($file['tmp_name'], $file['name']);
        $allowed = (array) Config::get('uploads.mime_allow', []);
        if ($allowed !== [] && !in_array($mime, $allowed, true)) {
            throw HttpException::badRequest(Lang::t('File type "{mime}" is not allowed.', ['mime' => $mime]));
        }

        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if ($extension === '' || in_array($extension, self::BLOCKED_EXTENSIONS, true)) {
            $extension = self::extensionFromMime($mime);
        }

        $relativeDir = date('Y/m');
        $absoluteDir = MDC_STORAGE . '/uploads/' . $relativeDir;
        if (!is_dir($absoluteDir) && !@mkdir($absoluteDir, 0775, true) && !is_dir($absoluteDir)) {
            throw new HttpException(500, Lang::t('The upload directory could not be created.'));
        }

        $diskName = Str::token(24) . '.' . $extension;
        $diskPath = $relativeDir . '/' . $diskName;

        if (!move_uploaded_file($file['tmp_name'], $absoluteDir . '/' . $diskName)) {
            throw new HttpException(500, Lang::t('The file could not be saved.'));
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

    /**
     * The URL inserted into Markdown. Its shape matches how the request
     * reached this hosting, so images also work where mod_rewrite is absent.
     */
    public static function url(int $id): string
    {
        return Request::apiUrl('/files/' . $id);
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
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => Lang::t('The file is too large.'),
            UPLOAD_ERR_PARTIAL   => Lang::t('The file was only partially uploaded.'),
            UPLOAD_ERR_NO_FILE   => Lang::t('No file was sent.'),
            UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE => Lang::t('The server cannot write the temporary file.'),
            default => Lang::t('Upload failed (code {code}).', ['code' => $code]),
        };
    }
}
