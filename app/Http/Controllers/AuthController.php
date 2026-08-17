<?php

declare(strict_types=1);

namespace MDcabinet\Http\Controllers;

use MDcabinet\Core\Auth;
use MDcabinet\Core\Config;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\Lang;
use MDcabinet\Core\RateLimiter;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;
use MDcabinet\Core\Validator;
use MDcabinet\Models\Cabinet;
use MDcabinet\Models\Setting;
use MDcabinet\Models\Tray;
use MDcabinet\Models\User;

final class AuthController
{
    public function register(Request $request): Response
    {
        // The very first account is created without restrictions – otherwise
        // nobody could sign in after installation.
        $firstUser = User::count() === 0;

        if (!$firstUser && !Setting::registrationOpen()) {
            throw HttpException::forbidden(Lang::t('Registration is disabled on this instance.'));
        }

        RateLimiter::hit('register:' . $request->ip(), 10, 3600);

        $data = Validator::check($request->all(), [
            'email'            => 'required|email|max:190',
            'name'             => 'required|string|min:2|max:120',
            'password'         => 'required|string|min:8|max:200',
            'locale'           => 'nullable|string|in:' . implode(',', Lang::SUPPORTED),
            'registrationCode' => 'nullable|string|max:190',
        ]);

        // The language picked in the form applies to this response too.
        $locale = isset($data['locale']) && $data['locale'] !== null
            ? (string) $data['locale']
            : Lang::locale();
        Lang::use($locale);

        if (!$firstUser && Setting::requiresRegistrationCode()) {
            // A separate limit for guessing the code. Success resets it, so a
            // colleague's typo blocks nobody – and a bot will not reach a
            // 12-character code anyway.
            RateLimiter::hit('regcode:' . $request->ip(), 10, 3600);

            $supplied = (string) ($data['registrationCode'] ?? '');

            if (!hash_equals(Setting::registrationCode(), $supplied)) {
                throw HttpException::validation(
                    ['registrationCode' => Lang::t('The registration code does not match.')],
                    Lang::t('You need a valid code from the administrator to register.')
                );
            }

            RateLimiter::clear('regcode:' . $request->ip());
        }

        if (User::findByEmail($data['email']) !== null) {
            throw HttpException::validation(['email' => Lang::t('An account with this e-mail already exists.')]);
        }

        // The first registered user becomes the instance administrator.
        $role = $firstUser ? 'admin' : 'user';

        $userId = User::register($data['email'], $data['name'], $data['password'], $role, $locale);
        $this->seedWorkspace($userId);

        Auth::login($userId);
        User::touchLogin($userId);

        return Response::json([
            'user' => User::toPublic(Auth::userOrFail()),
            'csrf' => Auth::csrfToken(),
        ], 201);
    }

    public function login(Request $request): Response
    {
        $email = mb_strtolower($request->string('email'));

        RateLimiter::hit('login:' . $request->ip(), 20, 900);
        RateLimiter::hit('login:' . $email, 10, 900);

        $data = Validator::check($request->all(), [
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::findByEmail($data['email']);
        if ($user === null || !User::verifyPassword($user, $data['password'])) {
            throw new HttpException(401, Lang::t('Wrong e-mail or password.'));
        }

        RateLimiter::clear('login:' . $email);

        Auth::login((int) $user['id']);
        User::touchLogin((int) $user['id']);

        return Response::json([
            'user' => User::toPublic($user),
            'csrf' => Auth::csrfToken(),
        ]);
    }

    public function logout(Request $request): Response
    {
        Auth::logout();

        return Response::json(['ok' => true]);
    }

    /** Bootstrap state for the SPA: who am I, the CSRF token, instance settings. */
    public function me(Request $request): Response
    {
        $user     = Auth::user();
        $hasUsers = User::count() > 0;

        return Response::json([
            'user'     => $user === null ? null : User::toPublic($user),
            'csrf'     => Auth::csrfToken(),
            'instance' => [
                'name'              => Config::get('app.name', 'MDcabinet'),
                'hasUsers'          => $hasUsers,
                'allowRegistration' => !$hasUsers || Setting::registrationOpen(),
                // The code itself is never sent out, only whether it is needed.
                'requiresRegistrationCode' => $hasUsers && Setting::requiresRegistrationCode(),
                'locales'           => Lang::SUPPORTED,
                'defaultLocale'     => Lang::FALLBACK,
            ],
        ]);
    }

    public function updateProfile(Request $request): Response
    {
        $user = Auth::userOrFail();

        $data = Validator::check($request->all(), [
            'name'        => 'required|string|min:2|max:120',
            'avatarColor' => 'nullable|string|max:7',
            'locale'      => 'nullable|string|in:' . implode(',', Lang::SUPPORTED),
        ]);

        $update = ['name' => $data['name']];

        if (!empty($data['avatarColor']) && preg_match('/^#[0-9a-fA-F]{6}$/', (string) $data['avatarColor'])) {
            $update['avatar_color'] = $data['avatarColor'];
        }

        if (!empty($data['locale'])) {
            $update['locale'] = Lang::normalize((string) $data['locale']);
            // Answer in the freshly chosen language.
            Lang::use($update['locale']);
        }

        User::update((int) $user['id'], $update);
        Auth::forgetCachedUser();

        return Response::json(['user' => User::toPublic(User::find((int) $user['id']) ?? [])]);
    }

    public function changePassword(Request $request): Response
    {
        $user = Auth::userOrFail();

        $data = Validator::check($request->all(), [
            'currentPassword' => 'required|string',
            'newPassword'     => 'required|string|min:8|max:200',
        ]);

        $full = User::find((int) $user['id']);
        if ($full === null || !User::verifyPassword($full, $data['currentPassword'])) {
            throw HttpException::validation(['currentPassword' => Lang::t('Your current password does not match.')]);
        }

        User::setPassword((int) $user['id'], $data['newPassword']);

        return Response::json(['ok' => true]);
    }

    /**
     * A new account gets an empty cabinet with one tray, so the user does not
     * start on a blank page.
     */
    private function seedWorkspace(int $userId): void
    {
        $cabinetId = Cabinet::createDefault($userId);
        $trayName  = Lang::t('Notes');

        Tray::create([
            'cabinet_id'  => $cabinetId,
            'name'        => $trayName,
            'slug'        => Tray::uniqueSlug($trayName, ['cabinet_id' => $cabinetId]),
            'description' => Lang::t('Your first tray – a place for whatever comes to mind.'),
            'position'    => 0,
        ]);
    }
}
