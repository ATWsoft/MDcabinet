<?php

declare(strict_types=1);

namespace MDcabinet\Core;

use RuntimeException;

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
    public static function validation(array $errors, string $message = 'Zadané údaje nie sú platné.'): self
    {
        return new self(422, $message, $errors);
    }

    public static function unauthorized(string $message = 'Nie si prihlásený.'): self
    {
        return new self(401, $message);
    }

    public static function forbidden(string $message = 'Na túto akciu nemáš oprávnenie.'): self
    {
        return new self(403, $message);
    }

    public static function notFound(string $message = 'Nenájdené.'): self
    {
        return new self(404, $message);
    }

    public static function conflict(string $message = 'Konflikt.'): self
    {
        return new self(409, $message);
    }

    private static function defaultMessage(int $status): string
    {
        return match ($status) {
            400 => 'Chybná požiadavka.',
            401 => 'Nie si prihlásený.',
            403 => 'Na túto akciu nemáš oprávnenie.',
            404 => 'Nenájdené.',
            409 => 'Konflikt.',
            413 => 'Súbor je príliš veľký.',
            422 => 'Zadané údaje nie sú platné.',
            429 => 'Príliš veľa požiadaviek, skús to o chvíľu.',
            default => 'Nastala chyba.',
        };
    }
}
