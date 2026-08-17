<?php

declare(strict_types=1);

namespace MDcabinet\Core;

final class Response
{
    /** When set, the body is streamed from this file instead of $body. */
    private ?string $streamFile = null;

    /** @param array<string,string> $headers */
    private function __construct(
        private string $body,
        private int $status = 200,
        private array $headers = []
    ) {
    }

    public static function json(mixed $data, int $status = 200): self
    {
        $body = json_encode(
            $data,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
        );

        return new self($body === false ? '{}' : $body, $status, [
            'Content-Type' => 'application/json; charset=utf-8',
        ]);
    }

    public static function noContent(): self
    {
        return new self('', 204);
    }

    /** @param array<string,string> $headers */
    public static function html(string $html, int $status = 200, array $headers = []): self
    {
        return new self($html, $status, $headers + [
            'Content-Type' => 'text/html; charset=utf-8',
        ]);
    }

    public static function redirect(string $location, int $status = 302): self
    {
        return new self('', $status, ['Location' => $location]);
    }

    /**
     * Sends a file from storage (uploads are never served by Apache directly).
     */
    public static function file(string $absolutePath, string $mime, string $downloadName = '', bool $inline = true): self
    {
        if (!is_file($absolutePath)) {
            throw HttpException::notFound(Lang::t('The file does not exist.'));
        }

        $disposition = $inline ? 'inline' : 'attachment';
        $name        = $downloadName !== '' ? $downloadName : basename($absolutePath);

        $response = new self('', 200, [
            'Content-Type'        => $mime,
            'Content-Length'      => (string) filesize($absolutePath),
            'Content-Disposition' => sprintf('%s; filename="%s"', $disposition, addslashes($name)),
            'Cache-Control'       => 'private, max-age=604800',
            'X-Content-Type-Options' => 'nosniff',
        ]);
        $response->streamFile = $absolutePath;

        return $response;
    }

    public function withHeader(string $name, string $value): self
    {
        $this->headers[$name] = $value;

        return $this;
    }

    public function send(): void
    {
        if (!headers_sent()) {
            http_response_code($this->status);
            foreach ($this->headers as $name => $value) {
                header($name . ': ' . $value);
            }
        }

        if ($this->streamFile !== null) {
            readfile($this->streamFile);
            return;
        }

        echo $this->body;
    }
}
