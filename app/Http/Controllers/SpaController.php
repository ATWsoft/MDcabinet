<?php

declare(strict_types=1);

namespace MDcabinet\Http\Controllers;

use MDcabinet\Core\Config;
use MDcabinet\Core\Database;
use MDcabinet\Core\Lang;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;

/**
 * Serves the HTML shell for the React application. JS/CSS paths come from the
 * Vite manifest, so nothing has to be rewritten by hand after a build.
 */
final class SpaController
{
    public function index(Request $request): Response
    {
        $assets = $this->assets();

        if ($assets === null) {
            return Response::html($this->missingBuildPage(), 200);
        }

        $base = Config::basePath();

        $bootstrap = [
            'basePath'  => $base,
            'appName'   => Config::get('app.name', 'MDcabinet'),
            'installed' => $this->isInstalled(),
            'locale'    => Lang::locale(),
            'locales'   => Lang::SUPPORTED,
        ];

        $styles = '';
        foreach ($assets['css'] as $css) {
            $styles .= '<link rel="stylesheet" href="' . htmlspecialchars($base . '/assets/' . $css, ENT_QUOTES) . '">';
        }

        $html = '<!doctype html>'
            . '<html lang="' . htmlspecialchars(Lang::locale(), ENT_QUOTES) . '" class="h-full">'
            . '<head>'
            . '<meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
            . '<meta name="color-scheme" content="light dark">'
            . '<title>' . htmlspecialchars((string) Config::get('app.name', 'MDcabinet'), ENT_QUOTES) . '</title>'
            . '<link rel="icon" href="' . htmlspecialchars($base . '/assets/favicon.svg', ENT_QUOTES) . '" type="image/svg+xml">'
            . $styles
            . '<script>window.__MDCABINET__=' . json_encode($bootstrap, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ';</script>'
            . '</head>'
            . '<body class="h-full">'
            . '<div id="root" class="h-full"></div>'
            . '<script type="module" src="' . htmlspecialchars($base . '/assets/' . $assets['js'], ENT_QUOTES) . '"></script>'
            . '</body></html>';

        return Response::html($html)
            ->withHeader('Cache-Control', 'no-store')
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withHeader('Referrer-Policy', 'same-origin');
    }

    /**
     * @return array{js:string, css:list<string>}|null
     */
    private function assets(): ?array
    {
        foreach (['/assets/manifest.json', '/assets/.vite/manifest.json'] as $candidate) {
            $path = MDC_ROOT . $candidate;
            if (!is_file($path)) {
                continue;
            }

            $manifest = json_decode((string) file_get_contents($path), true);
            if (!is_array($manifest)) {
                continue;
            }

            foreach ($manifest as $key => $entry) {
                if (!is_array($entry) || empty($entry['isEntry'])) {
                    continue;
                }
                unset($key);

                return [
                    'js'  => (string) $entry['file'],
                    'css' => array_values(array_map('strval', $entry['css'] ?? [])),
                ];
            }
        }

        return null;
    }

    private function isInstalled(): bool
    {
        if (!Config::isInstalled()) {
            return false;
        }

        try {
            return (int) Database::scalar('SELECT COUNT(*) FROM `users`') >= 0;
        } catch (\Throwable) {
            return false;
        }
    }

    private function missingBuildPage(): string
    {
        $heading = Lang::t('The MDcabinet frontend has not been built yet');
        $intro   = Lang::t('The backend is running, but the assets/ directory is missing. Generate it locally:');
        $outro   = Lang::t('Then upload the contents of assets/ to your hosting (together with the rest of the app).');

        return '<!doctype html><html lang="' . htmlspecialchars(Lang::locale(), ENT_QUOTES) . '">'
            . '<meta charset="utf-8"><title>MDcabinet</title>'
            . '<style>body{font:16px/1.7 ui-sans-serif,system-ui,sans-serif;max-width:44rem;margin:12vh auto;padding:0 1.5rem;color:#1f2430}'
            . 'code{background:#eef1f6;padding:.15em .45em;border-radius:.3em;font-size:.95em}'
            . 'pre{background:#111827;color:#e5e7eb;padding:1rem 1.2rem;border-radius:.6rem;overflow:auto}</style>'
            . '<h1>' . htmlspecialchars($heading, ENT_QUOTES) . '</h1>'
            . '<p>' . htmlspecialchars($intro, ENT_QUOTES) . '</p>'
            . '<pre>cd frontend' . PHP_EOL . 'npm install' . PHP_EOL . 'npm run build</pre>'
            . '<p>' . htmlspecialchars($outro, ENT_QUOTES) . '</p>'
            . '</html>';
    }
}
