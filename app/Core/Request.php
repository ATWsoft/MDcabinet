<?php

declare(strict_types=1);

namespace MDcabinet\Core;

/**
 * Obal nad superglobálmi. JSON body sa parsuje lazy pri prvom prístupe.
 */
final class Request
{
    /** @var array<string,mixed>|null */
    private ?array $json = null;

    /** @var array<string,string> */
    private array $routeParams = [];

    private function __construct(
        public readonly string $method,
        public readonly string $path,
    ) {
    }

    public static function capture(): self
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

        // Podpora pre _method override (formuláre, staré proxy).
        if ($method === 'POST' && isset($_POST['_method'])) {
            $method = strtoupper((string) $_POST['_method']);
        }

        $uri  = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $base = Config::basePath();
        if ($base !== '' && str_starts_with($uri, $base)) {
            $uri = substr($uri, strlen($base));
        }

        $path = '/' . trim(rawurldecode($uri), '/');

        return new self($method, $path === '//' ? '/' : $path);
    }

    // ------------------------------------------------------------- vstupy ---

    /** Hodnota z JSON body, POST alebo query stringu (v tomto poradí). */
    public function input(string $key, mixed $default = null): mixed
    {
        $json = $this->json();
        if (array_key_exists($key, $json)) {
            return $json[$key];
        }
        if (array_key_exists($key, $_POST)) {
            return $_POST[$key];
        }
        if (array_key_exists($key, $_GET)) {
            return $_GET[$key];
        }

        return $default;
    }

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->json())
            || array_key_exists($key, $_POST)
            || array_key_exists($key, $_GET);
    }

    public function string(string $key, string $default = ''): string
    {
        $value = $this->input($key, $default);

        return is_scalar($value) ? trim((string) $value) : $default;
    }

    public function int(string $key, int $default = 0): int
    {
        $value = $this->input($key, $default);

        return is_numeric($value) ? (int) $value : $default;
    }

    public function bool(string $key, bool $default = false): bool
    {
        $value = $this->input($key, $default);
        if (is_bool($value)) {
            return $value;
        }

        return in_array(strtolower((string) $value), ['1', 'true', 'yes', 'on'], true);
    }

    /** @return array<string,mixed> */
    public function all(): array
    {
        return array_merge($_GET, $_POST, $this->json());
    }

    /** @return array<string,mixed> */
    public function json(): array
    {
        if ($this->json !== null) {
            return $this->json;
        }

        $contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
        if (!str_contains($contentType, 'application/json')) {
            return $this->json = [];
        }

        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') {
            return $this->json = [];
        }

        $decoded = json_decode($raw, true);

        return $this->json = is_array($decoded) ? $decoded : [];
    }

    public function query(string $key, ?string $default = null): ?string
    {
        $value = $_GET[$key] ?? $default;

        return is_scalar($value) ? (string) $value : $default;
    }

    // ------------------------------------------------------ route parametre ---

    /** @param array<string,string> $params */
    public function setRouteParams(array $params): void
    {
        $this->routeParams = $params;
    }

    public function param(string $key, ?string $default = null): ?string
    {
        return $this->routeParams[$key] ?? $default;
    }

    public function paramInt(string $key): int
    {
        return (int) ($this->routeParams[$key] ?? 0);
    }

    // ------------------------------------------------------------ hlavičky ---

    public function header(string $name): ?string
    {
        $key = 'HTTP_' . str_replace('-', '_', strtoupper($name));

        return isset($_SERVER[$key]) ? (string) $_SERVER[$key] : null;
    }

    public function bearerToken(): ?string
    {
        $header = $this->header('Authorization') ?? '';

        return preg_match('/Bearer\s+(.+)/i', $header, $m) ? trim($m[1]) : null;
    }

    public function ip(): string
    {
        return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    }

    public function userAgent(): string
    {
        return substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
    }

    public function isApi(): bool
    {
        return str_starts_with($this->path, '/api/') || $this->path === '/api';
    }

    public function expectsJson(): bool
    {
        return $this->isApi()
            || str_contains((string) $this->header('Accept'), 'application/json')
            || $this->header('X-Requested-With') === 'XMLHttpRequest';
    }
}
