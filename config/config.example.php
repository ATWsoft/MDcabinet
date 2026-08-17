<?php
/**
 * MDcabinet configuration.
 *
 * Copy this file to `config/config.php` and fill in the database details.
 * `config/config.php` is in .gitignore, so it never reaches the repository.
 *
 * Every value can also be overridden by an environment variable (MDC_*),
 * which is what docker-compose uses during local development.
 */

return [
    // ----------------------------------------------------------------- app ---
    'app' => [
        'name'  => 'MDcabinet',
        // 'local' | 'production'
        'env'   => 'production',
        // Keep this false in production – errors are logged to storage/logs.
        'debug' => false,
        // Absolute app URL without a trailing slash, e.g. https://docs.example.com
        // Empty = derived automatically from the request.
        'url'   => '',
    ],

    // ------------------------------------------------------------------ db ---
    'db' => [
        'host'    => 'localhost',
        'port'    => 3306,
        'name'    => 'mdcabinet',
        'user'    => 'root',
        'pass'    => '',
        'charset' => 'utf8mb4',
    ],

    // ------------------------------------------------------------ security ---
    'security' => [
        // Random string, at least 32 characters. /setup generates one for you.
        'app_key'          => '',
        'session_name'     => 'mdcabinet_session',
        // How long a sign-in lasts, in seconds (default 30 days).
        'session_lifetime' => 60 * 60 * 24 * 30,

        // Registration defaults for a fresh installation. Once saved in the
        // app (Account settings → Registration) the database values apply.
        //
        // Turn this off for a closed instance without self-registration.
        'allow_registration' => true,
        // Code an applicant must supply when registering. Empty means anyone
        // can register, which bots will eventually find on a public domain.
        'registration_code'  => '',
    ],

    // ------------------------------------------------------------- uploads ---
    'uploads' => [
        'max_size'   => 16 * 1024 * 1024, // 16 MB
        'mime_allow' => [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
            'application/pdf', 'text/plain', 'text/markdown',
            'application/zip',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
    ],
];
