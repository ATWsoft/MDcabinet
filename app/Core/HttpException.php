<?php

declare(strict_types=1);

namespace MDcabinet\Core;

use RuntimeException;

/**
 * An exception that carries an HTTP status code and, for validation failures,
 * a per-field error map. Messages are already translated when thrown.
 */
class HttpException extends RuntimeException
{
    /** @param array<string,string> $errors */
    public function __construct(
        private readonly int $statusCode,
        string $message = '',
        private readonly array $errors = []
    ) {
        parent::__construct($message !== '' ? $message : self::defaultMessage($statusCode));
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    /** @return array<string,string> */
    public function getErrors(): array
    {
        return $this->errors;
    }

    public static function badRequest(string $message = ''): self
    {
        return new self(400, $message);
    }

    /** @param array<string,string> $errors */
    public static function validation(array $errors, string $message = ''): self
    {
        return new self(422, $message !== '' ? $message : Lang::t('The submitted data is not valid.'), $errors);
    }

    public static function unauthorized(string $message = ''): self
    {
        return new self(401, $message !== '' ? $message : Lang::t('You are not signed in.'));
    }

    public static function forbidden(string $message = ''): self
    {
        return new self(403, $message !== '' ? $message : Lang::t('You are not allowed to do this.'));
    }

    public static function notFound(string $message = ''): self
    {
        return new self(404, $message !== '' ? $message : Lang::t('Not found.'));
    }

    public static function conflict(string $message = ''): self
    {
        return new self(409, $message !== '' ? $message : Lang::t('Conflict.'));
    }

    private static function defaultMessage(int $status): string
    {
        return match ($status) {
            400 => Lang::t('Bad request.'),
            401 => Lang::t('You are not signed in.'),
            403 => Lang::t('You are not allowed to do this.'),
            404 => Lang::t('Not found.'),
            409 => Lang::t('Conflict.'),
            413 => Lang::t('The file is too large.'),
            422 => Lang::t('The submitted data is not valid.'),
            429 => Lang::t('Too many requests, try again in a moment.'),
            default => Lang::t('Something went wrong.'),
        };
    }
}
