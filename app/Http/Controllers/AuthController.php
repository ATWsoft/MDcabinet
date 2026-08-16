<?php

declare(strict_types=1);

namespace MDcabinet\Http\Controllers;

use MDcabinet\Core\Auth;
use MDcabinet\Core\Config;
use MDcabinet\Core\HttpException;
use MDcabinet\Core\RateLimiter;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;
use MDcabinet\Core\Validator;
use MDcabinet\Models\Cabinet;
use MDcabinet\Models\Tray;
use MDcabinet\Models\User;

final class AuthController
{
    public function register(Request $request): Response
    {
        if (!Config::get('security.allow_registration', true) && User::count() > 0) {
            throw HttpException::forbidden('Registrácia je na tejto inštancii vypnutá.');
        }

        RateLimiter::hit('register:' . $request->ip(), 10, 3600);

        $data = Validator::check($request->all(), [
            'email'    => 'required|email|max:190',
            'name'     => 'required|string|min:2|max:120',
            'password' => 'required|string|min:8|max:200',
        ]);

        if (User::findByEmail($data['email']) !== null) {
            throw HttpException::validation(['email' => 'Účet s týmto e-mailom už existuje.']);
        }

        // Prvý registrovaný používateľ sa stáva správcom inštancie.
        $role = User::count() === 0 ? 'admin' : 'user';

        $userId = User::register($data['email'], $data['name'], $data['password'], $role);
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
            throw new HttpException(401, 'Nesprávny e-mail alebo heslo.');
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

    /** Bootstrap stav pre SPA – kto som + CSRF token + nastavenia inštancie. */
    public function me(Request $request): Response
    {
        $user = Auth::user();

        return Response::json([
            'user'     => $user === null ? null : User::toPublic($user),
            'csrf'     => Auth::csrfToken(),
            'instance' => [
                'name'               => Config::get('app.name', 'MDcabinet'),
                'allowRegistration'  => (bool) Config::get('security.allow_registration', true),
                'hasUsers'           => User::count() > 0,
            ],
        ]);
    }

    public function updateProfile(Request $request): Response
    {
        $user = Auth::userOrFail();

        $data = Validator::check($request->all(), [
            'name'         => 'required|string|min:2|max:120',
            'avatarColor'  => 'nullable|string|max:7',
        ]);

        $update = ['name' => $data['name']];
        if (!empty($data['avatarColor']) && preg_match('/^#[0-9a-fA-F]{6}$/', (string) $data['avatarColor'])) {
            $update['avatar_color'] = $data['avatarColor'];
        }

        User::update((int) $user['id'], $update);

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
            throw HttpException::validation(['currentPassword' => 'Aktuálne heslo nesedí.']);
        }

        User::setPassword((int) $user['id'], $data['newPassword']);

        return Response::json(['ok' => true]);
    }

    /** Nový účet dostane rovno prázdnu skriňu so šuplíkom, nech nezačína na bielej stránke. */
    private function seedWorkspace(int $userId): void
    {
        $cabinetId = Cabinet::createDefault($userId);

        Tray::create([
            'cabinet_id'  => $cabinetId,
            'name'        => 'Poznámky',
            'slug'        => Tray::uniqueSlug('Poznámky', ['cabinet_id' => $cabinetId]),
            'description' => 'Prvý šuplík – sem si odkladaj, čo ťa napadne.',
            'position'    => 0,
        ]);
    }
}
