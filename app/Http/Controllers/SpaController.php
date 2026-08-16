<?php

declare(strict_types=1);

namespace MDcabinet\Http\Controllers;

use MDcabinet\Core\Config;
use MDcabinet\Core\Database;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;

/**
 * Servuje HTML obal pre React aplikáciu. Cesty k JS/CSS berie z Vite manifestu,
 * takže sa nič nemusí ručne prepisovať po builde.
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
        ];

        $styles = '';
        foreach ($assets['css'] as $css) {
            $styles .= '<link rel="stylesheet" href="' . htmlspecialchars($base . '/assets/' . $css, ENT_QUOTES) . '">';
        }

        $html = '<!doctype html>'
            . '<html lang="sk" class="h-full">'
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
        return '<!doctype html><html lang="sk"><meta charset="utf-8"><title>MDcabinet</title>'
            . '<style>body{font:16px/1.7 ui-sans-serif,system-ui,sans-serif;max-width:44rem;margin:12vh auto;padding:0 1.5rem;color:#1f2430}'
            . 'code{background:#eef1f6;padding:.15em .45em;border-radius:.3em;font-size:.95em}'
            . 'pre{background:#111827;color:#e5e7eb;padding:1rem 1.2rem;border-radius:.6rem;overflow:auto}</style>'
            . '<h1>MDcabinet ešte nemá zbuildovaný frontend</h1>'
            . '<p>Backend beží, ale chýba adresár <code>assets/</code>. Vygeneruj ho lokálne:</p>'
            . '<pre>cd frontend\nnpm install\nnpm run build</pre>'
            . '<p>Potom nahraj obsah adresára <code>assets/</code> na hosting (spolu so zvyškom aplikácie).</p>'
            . '</html>';
    }
}
