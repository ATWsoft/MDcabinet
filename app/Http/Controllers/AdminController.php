<?php

declare(strict_types=1);

namespace MDcabinet\Http\Controllers;

use MDcabinet\Core\Auth;
use MDcabinet\Core\Database;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\Lang;
use MDcabinet\Core\Migrator;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;
use MDcabinet\Core\Str;
use MDcabinet\Core\Validator;
use MDcabinet\Models\Setting;
use MDcabinet\Models\User;

/**
 * Instance settings – available to administrators only.
 */
final class AdminController
{
    public function settings(Request $request): Response
    {
        $this->assertAdmin();

        return Response::json(['settings' => $this->payload()]);
    }

    public function updateSettings(Request $request): Response
    {
        $this->assertAdmin();

        $data = Validator::check($request->all(), [
            'registrationOpen' => 'nullable|bool',
            'registrationCode' => 'nullable|string|max:190',
        ]);

        if (array_key_exists('registrationOpen', $data)) {
            Setting::setBool(Setting::REGISTRATION_OPEN, (bool) $data['registrationOpen']);
        }

        if (array_key_exists('registrationCode', $data)) {
            $code = trim((string) ($data['registrationCode'] ?? ''));

            if ($code !== '' && mb_strlen($code, 'UTF-8') < 6) {
                throw HttpException::validation(
                    ['registrationCode' => Lang::t('The code should be at least 6 characters, otherwise it is guessable.')]
                );
            }

            Setting::set(Setting::REGISTRATION_CODE, $code);
        }

        return Response::json(['settings' => $this->payload()]);
    }

    /** Suggests a code; it is only stored when the form is submitted. */
    public function suggestCode(Request $request): Response
    {
        $this->assertAdmin();

        return Response::json(['code' => strtoupper(Str::token(12))]);
    }

    /**
     * Database updates. After uploading a new version over FTP there is often
     * no SSH available to run bin/migrate.php, so an administrator can apply
     * the pending migrations from here.
     */
    public function migrations(Request $request): Response
    {
        $this->assertAdmin();

        return Response::json([
            'pending' => Migrator::pending(),
            'applied' => array_column(
                Database::fetchAll('SELECT `migration`, `executed_at` FROM `migrations` ORDER BY `id` ASC'),
                'migration'
            ),
        ]);
    }

    public function runMigrations(Request $request): Response
    {
        $this->assertAdmin();

        $pending = Migrator::pending();
        if ($pending === []) {
            return Response::json(['ran' => [], 'pending' => []]);
        }

        $ran = Migrator::run();

        return Response::json(['ran' => $ran, 'pending' => Migrator::pending()]);
    }

    /** @return array<string,mixed> */
    private function payload(): array
    {
        return [
            'registrationOpen' => Setting::registrationOpen(),
            // Only an administrator sees the code – they need to pass it on.
            'registrationCode' => Setting::registrationCode(),
            'userCount'        => User::count(),
        ];
    }

    private function assertAdmin(): void
    {
        if (!Auth::isAdmin()) {
            throw HttpException::forbidden(Lang::t('Only an administrator can change this setting.'));
        }
    }
}
