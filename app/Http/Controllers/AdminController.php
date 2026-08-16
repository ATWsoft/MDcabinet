<?php

declare(strict_types=1);

namespace MDcabinet\Http\Controllers;

use MDcabinet\Core\Auth;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;
use MDcabinet\Core\Str;
use MDcabinet\Core\Validator;
use MDcabinet\Models\Setting;
use MDcabinet\Models\User;

/**
 * Nastavenia inštancie – dostupné len správcovi.
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
                    ['registrationCode' => 'Kód má mať aspoň 6 znakov, inak sa dá uhádnuť.']
                );
            }

            Setting::set(Setting::REGISTRATION_CODE, $code);
        }

        return Response::json(['settings' => $this->payload()]);
    }

    /** Vygeneruje návrh kódu; uloží sa až s formulárom. */
    public function suggestCode(Request $request): Response
    {
        $this->assertAdmin();

        return Response::json(['code' => strtoupper(Str::token(12))]);
    }

    /** @return array<string,mixed> */
    private function payload(): array
    {
        return [
            'registrationOpen' => Setting::registrationOpen(),
            // Kód vidí len správca – potrebuje ho vedieť poslať kolegom.
            'registrationCode' => Setting::registrationCode(),
            'userCount'        => User::count(),
        ];
    }

    private function assertAdmin(): void
    {
        if (!Auth::isAdmin()) {
            throw HttpException::forbidden('Toto nastavenie môže meniť len správca.');
        }
    }
}
