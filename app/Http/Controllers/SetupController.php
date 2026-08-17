<?php

declare(strict_types=1);

namespace MDcabinet\Http\Controllers;

use MDcabinet\Core\Config;
use MDcabinet\Core\Database;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\Lang;
use MDcabinet\Core\Migrator;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;
use MDcabinet\Core\Str;
use MDcabinet\Core\Validator;
use PDO;
use PDOException;

/**
 * Web installer for hostings without SSH: it checks the environment, tries
 * the database connection, writes config/config.php and runs the migrations.
 *
 * Once finished the endpoints lock themselves (a config and users both exist).
 */
final class SetupController
{
    public function status(Request $request): Response
    {
        return Response::json([
            'installed'    => $this->isInstalled(),
            'requirements' => $this->requirements(),
            'configPath'   => 'config/config.php',
            'suggestedUrl' => Config::url(),
        ]);
    }

    public function install(Request $request): Response
    {
        $this->assertNotInstalled();

        $data = Validator::check($request->all(), [
            'dbHost' => 'required|string|max:190',
            'dbPort' => 'nullable|int',
            'dbName' => 'required|string|max:120',
            'dbUser' => 'required|string|max:120',
            'dbPass' => 'nullable|string|max:190',
            'appUrl' => 'nullable|string|max:255',
        ]);

        $port = isset($data['dbPort']) && $data['dbPort'] ? (int) $data['dbPort'] : 3306;

        $this->testConnection(
            (string) $data['dbHost'],
            $port,
            (string) $data['dbName'],
            (string) $data['dbUser'],
            (string) ($data['dbPass'] ?? '')
        );

        $config = [
            'app' => [
                'name'  => 'MDcabinet',
                'env'   => 'production',
                'debug' => false,
                'url'   => rtrim((string) ($data['appUrl'] ?? ''), '/'),
            ],
            'db' => [
                'host' => (string) $data['dbHost'],
                'port' => $port,
                'name' => (string) $data['dbName'],
                'user' => (string) $data['dbUser'],
                'pass' => (string) ($data['dbPass'] ?? ''),
            ],
            'security' => [
                'app_key' => Str::token(64),
            ],
        ];

        $this->writeConfig($config);

        // Switch the running process over to the new configuration and migrate.
        foreach ($config['db'] as $key => $value) {
            Config::set('db.' . $key, $value);
        }
        Config::set('app.url', $config['app']['url']);
        Config::set('security.app_key', $config['security']['app_key']);

        $ran = Migrator::run();

        return Response::json([
            'ok'         => true,
            'migrations' => $ran,
            'next'       => 'register',
        ]);
    }

    // ------------------------------------------------------------- internals ---

    private function isInstalled(): bool
    {
        if (!is_file(MDC_ROOT . '/config/config.php') && getenv('MDC_DB_NAME') === false) {
            return false;
        }

        try {
            return (int) Database::scalar('SELECT COUNT(*) FROM `users`') > 0;
        } catch (\Throwable) {
            return false;
        }
    }

    private function assertNotInstalled(): void
    {
        if ($this->isInstalled()) {
            throw HttpException::forbidden(Lang::t('MDcabinet is already installed.'));
        }
    }

    /** @return list<array{key:string,label:string,ok:bool,detail:string}> */
    private function requirements(): array
    {
        $checks = [];

        $checks[] = [
            'key'    => 'php',
            'label'  => 'PHP 8.1+',
            'ok'     => PHP_VERSION_ID >= 80100,
            'detail' => PHP_VERSION,
        ];

        foreach (['pdo_mysql', 'mbstring', 'json', 'fileinfo'] as $ext) {
            $checks[] = [
                'key'    => 'ext_' . $ext,
                'label'  => Lang::t('Extension {name}', ['name' => $ext]),
                'ok'     => extension_loaded($ext),
                'detail' => extension_loaded($ext) ? Lang::t('available') : Lang::t('missing'),
            ];
        }

        $checks[] = [
            'key'    => 'ext_gd',
            'label'  => Lang::t('Extension gd (optional – image dimensions)'),
            'ok'     => extension_loaded('gd'),
            'detail' => extension_loaded('gd')
                ? Lang::t('available')
                : Lang::t('missing (the app works without it)'),
        ];

        foreach (['config' => MDC_ROOT . '/config', 'storage' => MDC_STORAGE] as $label => $path) {
            $checks[] = [
                'key'    => 'writable_' . $label,
                'label'  => Lang::t('Writable directory {name}/', ['name' => $label]),
                'ok'     => is_dir($path) && is_writable($path),
                'detail' => is_dir($path)
                    ? (is_writable($path) ? 'OK' : Lang::t('set permissions to 755 or 775'))
                    : Lang::t('the directory does not exist'),
            ];
        }

        $checks[] = [
            'key'    => 'assets',
            'label'  => Lang::t('Built frontend files (assets/)'),
            'ok'     => is_file(MDC_ROOT . '/assets/manifest.json') || is_file(MDC_ROOT . '/assets/.vite/manifest.json'),
            'detail' => Lang::t('created by `npm run build` in the frontend/ directory'),
        ];

        return $checks;
    }

    private function testConnection(string $host, int $port, string $name, string $user, string $pass): void
    {
        try {
            new PDO(
                sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $name),
                $user,
                $pass,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );
        } catch (PDOException $e) {
            throw HttpException::validation(
                ['dbHost' => Lang::t('Could not connect: {error}', ['error' => $e->getMessage()])],
                Lang::t('Could not connect to the database.')
            );
        }
    }

    /** @param array<string,mixed> $config */
    private function writeConfig(array $config): void
    {
        $path = MDC_ROOT . '/config/config.php';

        if (!is_writable(dirname($path))) {
            throw new HttpException(500, Lang::t(
                'The config/ directory is not writable. Set its permissions to 775 and try again.'
            ));
        }

        $php = "<?php\n\n/**\n * Generated by the MDcabinet installer on " . date('Y-m-d H:i') . ".\n"
             . " * Feel free to edit it by hand – the shape matches config/config.example.php.\n */\n\n"
             . 'return ' . $this->export($config) . ";\n";

        if (@file_put_contents($path, $php, LOCK_EX) === false) {
            throw new HttpException(500, Lang::t('config/config.php could not be written.'));
        }

        @chmod($path, 0640);
    }

    /** var_export with indentation that is actually readable. */
    private function export(mixed $value, int $indent = 0): string
    {
        $pad = str_repeat('    ', $indent);

        if (is_array($value)) {
            $lines = [];
            foreach ($value as $key => $item) {
                $lines[] = $pad . '    ' . var_export($key, true) . ' => ' . $this->export($item, $indent + 1) . ',';
            }

            return "[\n" . implode("\n", $lines) . "\n" . $pad . ']';
        }

        return var_export($value, true);
    }
}
