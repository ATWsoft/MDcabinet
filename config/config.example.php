<?php
/**
 * MDcabinet – konfigurácia.
 *
 * Skopíruj tento súbor ako `config/config.php` a vyplň údaje k databáze.
 * `config/config.php` je v .gitignore, takže sa nikdy nedostane do repozitára.
 *
 * Každá hodnota sa dá prebiť aj environment premennou (MDC_*), čo využíva
 * docker-compose pri lokálnom vývoji.
 */

return [
    // ---------------------------------------------------------------- app ---
    'app' => [
        'name'  => 'MDcabinet',
        // 'local' | 'production'
        'env'   => 'production',
        // Pri production nechaj false – chyby sa logujú do storage/logs.
        'debug' => false,
        // Absolútna URL aplikácie bez lomky na konci, napr. https://docs.mojadomena.sk
        // Prázdne = odvodí sa automaticky z requestu.
        'url'   => '',
    ],

    // --------------------------------------------------------------- data ---
    'db' => [
        'host'    => 'localhost',
        'port'    => 3306,
        'name'    => 'mdcabinet',
        'user'    => 'root',
        'pass'    => '',
        'charset' => 'utf8mb4',
    ],

    // ---------------------------------------------------------- bezpečnosť ---
    'security' => [
        // Náhodný reťazec, min. 32 znakov. Vygeneruj napr. cez /setup.
        'app_key'          => '',
        'session_name'     => 'mdcabinet_session',
        // Dĺžka prihlásenia v sekundách (default 30 dní).
        'session_lifetime' => 60 * 60 * 24 * 30,
        // Vypni, ak chceš uzavretú inštanciu bez samoregistrácie.
        'allow_registration' => true,
    ],

    // -------------------------------------------------------------- upload ---
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
