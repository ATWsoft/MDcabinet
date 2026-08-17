<?php

/**
 * Slovak translations of API messages.
 *
 * Keys are the English wording used in the source code. A missing key simply
 * falls back to English, so the app never shows an empty string.
 */

declare(strict_types=1);

return [
    // ------------------------------------------------------------- generic ---
    'Bad request.'                              => 'Chybná požiadavka.',
    'You are not signed in.'                    => 'Nie si prihlásený.',
    'You are not allowed to do this.'           => 'Na túto akciu nemáš oprávnenie.',
    'Not found.'                                => 'Nenájdené.',
    'Conflict.'                                 => 'Konflikt.',
    'The file is too large.'                    => 'Súbor je príliš veľký.',
    'The submitted data is not valid.'          => 'Zadané údaje nie sú platné.',
    'Too many requests, try again in a moment.' => 'Príliš veľa požiadaviek, skús to o chvíľu.',
    'Something went wrong.'                     => 'Nastala chyba.',
    'An unexpected server error occurred.'      => 'Nastala neočakávaná chyba na serveri.',
    'Error {status}'                            => 'Chyba {status}',
    'Method {method} is not allowed here.'      => 'Metóda {method} tu nie je povolená.',
    'Endpoint {path} does not exist.'           => 'Endpoint {path} neexistuje.',
    'Invalid route handler.'                    => 'Neplatný route handler.',
    'Could not connect to the database: {error}' => 'Nepodarilo sa pripojiť k databáze: {error}',

    // ---------------------------------------------------------- validation ---
    'This field is required.'                => 'Pole je povinné.',
    'Text expected.'                         => 'Očakáva sa text.',
    'A number is expected.'                  => 'Očakáva sa číslo.',
    'A list is expected.'                    => 'Očakáva sa zoznam.',
    'Invalid e-mail address.'                => 'Neplatná e-mailová adresa.',
    'Invalid date.'                          => 'Neplatný dátum.',
    'Minimum length: {min} characters.'      => 'Minimálna dĺžka: {min} znakov.',
    'Minimum value: {min}.'                  => 'Minimálna hodnota: {min}.',
    'Maximum length: {max} characters.'      => 'Maximálna dĺžka: {max} znakov.',
    'Maximum value: {max}.'                  => 'Maximálna hodnota: {max}.',
    'Allowed values: {values}.'              => 'Povolené hodnoty: {values}.',

    // -------------------------------------------------------------- limits ---
    'Too many attempts. Try again in {seconds} s.' => 'Príliš veľa pokusov. Skús to znova o {seconds} s.',

    // -------------------------------------------------------------- accounts ---
    'Registration is disabled on this instance.'  => 'Registrácia je na tejto inštancii vypnutá.',
    'An account with this e-mail already exists.' => 'Účet s týmto e-mailom už existuje.',
    'The registration code does not match.'       => 'Registračný kód nesedí.',
    'You need a valid code from the administrator to register.'
        => 'Na registráciu potrebuješ platný kód od správcu.',
    'Wrong e-mail or password.'                   => 'Nesprávny e-mail alebo heslo.',
    'Your current password does not match.'       => 'Aktuálne heslo nesedí.',
    'Session expired, reload the page and try again.'
        => 'Platnosť relácie vypršala, obnov stránku a skús to znova.',
    'Only an administrator can change this setting.'
        => 'Toto nastavenie môže meniť len správca.',
    'The code should be at least 6 characters, otherwise it is guessable.'
        => 'Kód má mať aspoň 6 znakov, inak sa dá uhádnuť.',

    // ------------------------------------------------------- initial content ---
    'My space' => 'Môj priestor',
    'Your first cabinet – rename it or create more.'
        => 'Prvá skriňa – premenuj ju alebo si vytvor ďalšie.',
    'Notes' => 'Poznámky',
    'Your first tray – a place for whatever comes to mind.'
        => 'Prvý šuplík – sem si odkladaj, čo ťa napadne.',

    // -------------------------------------------------------------- content ---
    'The cabinet does not exist.'  => 'Skriňa neexistuje.',
    'The tray does not exist.'     => 'Šuplík neexistuje.',
    'The folder does not exist.'   => 'Zložka neexistuje.',
    'The document does not exist.' => 'Dokument neexistuje.',
    'The revision does not exist.' => 'Revízia neexistuje.',
    'Unknown target type.'         => 'Neznámy typ cieľa.',

    'The parent folder belongs to a different tray.' => 'Nadradená zložka patrí do iného šuplíka.',
    'The folder belongs to a different tray.'        => 'Zložka patrí do iného šuplíka.',
    'The target folder is not in the target tray.'   => 'Cieľová zložka nie je v cieľovom šuplíku.',
    'Folders can be nested at most {depth} levels deep.'
        => 'Zložky sa dajú vnárať maximálne {depth} úrovní.',
    'Moving between trays is not supported yet.' => 'Presun medzi šuplíkmi zatiaľ nie je podporovaný.',
    'A folder cannot be moved into itself.'      => 'Zložku nemôžeš presunúť do seba samej.',

    'Document created'             => 'Vytvorenie dokumentu',
    'Reverted to revision #{number}' => 'Návrat na revíziu #{number}',

    // --------------------------------------------------------------- files ---
    'The "file" field is missing.'   => 'Chýba súbor v poli „file“.',
    'The file does not exist.'       => 'Súbor neexistuje.',
    'The file is larger than the allowed {size} MB.' => 'Súbor je väčší ako povolených {size} MB.',
    'File type "{mime}" is not allowed.' => 'Typ súboru „{mime}“ nie je povolený.',
    'The upload directory could not be created.' => 'Nepodarilo sa vytvoriť adresár pre uploady.',
    'The file could not be saved.'   => 'Súbor sa nepodarilo uložiť.',
    'The file was only partially uploaded.' => 'Súbor sa nahral len čiastočne.',
    'No file was sent.'              => 'Nebol poslaný žiadny súbor.',
    'The server cannot write the temporary file.' => 'Server nedokáže zapísať dočasný súbor.',
    'Upload failed (code {code}).'   => 'Nahrávanie zlyhalo (kód {code}).',

    // -------------------------------------------------------------- sharing ---
    'targetType or targetId is missing.'      => 'Chýba targetType alebo targetId.',
    'The link does not exist.'                => 'Odkaz neexistuje.',
    'The link does not exist or was revoked.' => 'Odkaz neexistuje alebo bol zrušený.',
    'The link has expired.'                   => 'Platnosť odkazu vypršala.',
    'The link is password protected.'          => 'Odkaz je chránený heslom.',
    'Wrong password.'                          => 'Nesprávne heslo.',
    'The document is not part of this link.'   => 'Dokument nie je súčasťou tohto odkazu.',

    // ---------------------------------------------------------------- setup ---
    'MDcabinet is already installed.' => 'MDcabinet je už nainštalovaný.',
    'Could not connect: {error}'      => 'Pripojenie zlyhalo: {error}',
    'Could not connect to the database.' => 'K databáze sa nepodarilo pripojiť.',
    'The config/ directory is not writable. Set its permissions to 775 and try again.'
        => 'Adresár config/ nie je zapisovateľný. Nastav mu práva 775 a skús znova.',
    'config/config.php could not be written.' => 'Súbor config/config.php sa nepodarilo zapísať.',
    'Extension {name}'                => 'Rozšírenie {name}',
    'Extension gd (optional – image dimensions)' => 'Rozšírenie gd (voliteľné – rozmery obrázkov)',
    'available'                       => 'k dispozícii',
    'missing'                         => 'chýba',
    'missing (the app works without it)' => 'chýba (appka funguje aj bez neho)',
    'Writable directory {name}/'      => 'Zapisovateľný adresár {name}/',
    'set permissions to 755 or 775'   => 'nastav práva 755 alebo 775',
    'the directory does not exist'    => 'adresár neexistuje',
    'Built frontend files (assets/)'  => 'Zbuildované frontend súbory (assets/)',
    'created by `npm run build` in the frontend/ directory'
        => 'vytvorí ich `npm run build` v adresári frontend/',

    // ------------------------------------------------------- missing build ---
    'The MDcabinet frontend has not been built yet'
        => 'MDcabinet ešte nemá zbuildovaný frontend',
    'The backend is running, but the assets/ directory is missing. Generate it locally:'
        => 'Backend beží, ale chýba adresár assets/. Vygeneruj ho lokálne:',
    'Then upload the contents of assets/ to your hosting (together with the rest of the app).'
        => 'Potom nahraj obsah adresára assets/ na hosting (spolu so zvyškom aplikácie).',
];
