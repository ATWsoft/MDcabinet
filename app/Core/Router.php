<?php

declare(strict_types=1);

namespace MDcabinet\Core;

/**
 * Minimalistický router: statické segmenty + `{param}` placeholdery.
 * Handler je [Trieda::class, 'metoda'] alebo callable.
 */
final class Router
{
    /** @var array<string, list<array{pattern:string, regex:string, params:list<string>, handler:mixed, middleware:list<string>}>> */
    private array $routes = [];

    /** @var list<string> */
    private array $groupMiddleware = [];

    private string $groupPrefix = '';

    public function get(string $path, mixed $handler): self
    {
        return $this->add('GET', $path, $handler);
    }

    public function post(string $path, mixed $handler): self
    {
        return $this->add('POST', $path, $handler);
    }

    public function put(string $path, mixed $handler): self
    {
        return $this->add('PUT', $path, $handler);
    }

    public function patch(string $path, mixed $handler): self
    {
        return $this->add('PATCH', $path, $handler);
    }

    public function delete(string $path, mixed $handler): self
    {
        return $this->add('DELETE', $path, $handler);
    }

    /**
     * @param list<string> $middleware
     */
    public function group(string $prefix, array $middleware, callable $callback): void
    {
        $previousPrefix     = $this->groupPrefix;
        $previousMiddleware = $this->groupMiddleware;

        $this->groupPrefix     = $previousPrefix . $prefix;
        $this->groupMiddleware = array_merge($previousMiddleware, $middleware);

        $callback($this);

        $this->groupPrefix     = $previousPrefix;
        $this->groupMiddleware = $previousMiddleware;
    }

    private function add(string $method, string $path, mixed $handler): self
    {
        $full   = rtrim($this->groupPrefix . $path, '/');
        $full   = $full === '' ? '/' : $full;
        $params = [];

        // Literálne časty escapujeme, {param} nahradíme skupinou. Delimiter je #,
        // takže lomky v ceste nepotrebujú escapovanie.
        $segments = preg_split('/(\{[a-zA-Z_][a-zA-Z0-9_]*\})/', $full, -1, PREG_SPLIT_DELIM_CAPTURE) ?: [];
        $regex    = '';
        foreach ($segments as $segment) {
            if (preg_match('/^\{([a-zA-Z_][a-zA-Z0-9_]*)\}$/', $segment, $m) === 1) {
                $params[] = $m[1];
                $regex   .= '([^/]+)';
            } else {
                $regex .= preg_quote($segment, '#');
            }
        }

        $this->routes[$method][] = [
            'pattern'    => $full,
            'regex'      => '#^' . $regex . '$#',
            'params'     => $params,
            'handler'    => $handler,
            'middleware' => $this->groupMiddleware,
        ];

        return $this;
    }

    public function dispatch(Request $request): Response
    {
        $method = $request->method;
        $path   = rtrim($request->path, '/');
        $path   = $path === '' ? '/' : $path;

        foreach ($this->routes[$method] ?? [] as $route) {
            if (!preg_match($route['regex'], $path, $matches)) {
                continue;
            }

            array_shift($matches);
            $request->setRouteParams(array_combine($route['params'], $matches) ?: []);

            foreach ($route['middleware'] as $middleware) {
                /** @var class-string<Middleware> $middleware */
                $result = (new $middleware())->handle($request);
                if ($result instanceof Response) {
                    return $result;
                }
            }

            return $this->call($route['handler'], $request);
        }

        // Existuje cesta pod iným HTTP metódou? Potom 405, inak necháme 404 na volajúceho.
        foreach ($this->routes as $otherMethod => $routes) {
            if ($otherMethod === $method) {
                continue;
            }
            foreach ($routes as $route) {
                if (preg_match($route['regex'], $path)) {
                    throw new HttpException(405, 'Metóda ' . $method . ' tu nie je povolená.');
                }
            }
        }

        throw HttpException::notFound('Endpoint ' . $path . ' neexistuje.');
    }

    private function call(mixed $handler, Request $request): Response
    {
        if (is_array($handler) && count($handler) === 2) {
            [$class, $method] = $handler;
            $controller = is_string($class) ? new $class() : $class;
            $result = $controller->{$method}($request);
        } elseif (is_callable($handler)) {
            $result = $handler($request);
        } else {
            throw new HttpException(500, 'Neplatný route handler.');
        }

        if ($result instanceof Response) {
            return $result;
        }

        return Response::json($result);
    }
}
