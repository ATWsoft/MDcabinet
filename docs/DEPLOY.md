# Nasadenie na klasický hosting

MDcabinet je navrhnutý tak, aby stačilo nahrať súbory cez FTP a otvoriť prehliadač.

## Čo musí hosting vedieť

| Požiadavka | Poznámka |
|---|---|
| PHP **8.1** alebo novšie | dnes štandard u všetkých poskytovateľov |
| Rozšírenia `pdo_mysql`, `mbstring`, `json`, `fileinfo` | bývajú zapnuté |
| Rozšírenie `gd` | voliteľné – bez neho sa len nezistia rozmery obrázkov |
| MySQL 5.7+ / MariaDB 10.2+ | kvôli InnoDB fulltextu |
| Apache s `mod_rewrite` a povoleným `AllowOverride` | `.htaccess` je súčasťou repozitára |
| Zapisovateľné `config/` a `storage/` | práva 755, prípadne 775 |

Nginx tiež funguje, len prepis treba prepísať ručne – viď na konci.

## 1. Zbuilduj frontend (na svojom počítači)

```bash
cd frontend && npm install && npm run build
```

Vznikne adresár `assets/` v koreni projektu. Node.js na serveri **netreba**.

## 2. Nahraj súbory

Do webroot (`public_html`, `www`, `htdocs`, `httpdocs` – podľa poskytovateľa) nahraj:

```
index.php
.htaccess
app/
assets/
config/
database/
storage/
bin/          (voliteľné – len CLI skripty)
```

> ⚠️ **Na `.htaccess` sa nezabudni.** Väčšina FTP klientov (FileZilla, WinSCP,
> Total Commander) skryté súbory začínajúce bodkou **štandardne nezobrazuje**,
> takže sa ľahko stane, že sa jediný nenahrá. Prejaví sa to tak, že úvodná
> stránka sa načíta, ale všetko ostatné vracia 404.
>
> - **FileZilla**: Server → Vynútiť zobrazovanie skrytých súborov
> - **WinSCP**: Možnosti → Predvoľby → Panely → Zobrazovať skryté súbory
>
> Po nahratí si over, že `.htaccess` je na serveri naozaj vidieť.

Nenahrávaj `frontend/`, `docker/`, `docs/`, `node_modules/` ani `.git/`.

> Adresáre `app/`, `config/`, `database/` a `storage/` majú vlastný `.htaccess`
> so `Require all denied`, takže sa k nim z webu nedá dostať ani keď ležia
> vo webroote. Ak tvoj hosting dovolí nastaviť document root inam, môžeš ich
> pokojne dať o úroveň vyššie a nechať vo webroote len `index.php`, `.htaccess`
> a `assets/`.

## 3. Nastav práva

```
config/    755  (musí byť zapisovateľný, kým prebehne inštalácia)
storage/   755  (musí zostať zapisovateľný natrvalo)
```

Ak inštalátor hlási, že sa nedá zapísať, skús 775.

## 4. Vytvor databázu

V administrácii hostingu založ prázdnu MySQL databázu a používateľa.
Tabuľky si MDcabinet vytvorí sám.

## 5. Spusti inštalátor

Otvor `https://tvoja-domena.sk/setup`, vyplň prístupy k databáze a potvrď.
Inštalátor:

1. skontroluje verziu PHP, rozšírenia a práva,
2. otestuje pripojenie k databáze,
3. zapíše `config/config.php` (s vygenerovaným `app_key`),
4. spustí migrácie z `database/migrations/`.

Potom sa presmeruje na registráciu. **Prvý účet dostane rolu správcu.**

Po inštalácii sa `/setup` sám uzamkne – ďalšie spustenie vráti `403`.

### Ak máš SSH

Nemusíš cez web:

```bash
cp config/config.example.php config/config.php   # a vyplň prístupy
php bin/migrate.php
```

## 6. Odporúčania po inštalácii

- **Zapni ochranu registrácie.** Hneď po vytvorení svojho účtu choď do
  *Nastavenia účtu → Registrácia*, klikni na **Vygenerovať** a ulož.
  Bez toho si na verejnej doméne skôr či neskôr založia účty boti.
  Kód potom pošli kolegom – zadajú ho pri registrácii.
  Registráciu sa dá aj úplne vypnúť; existujúce účty fungujú ďalej.
- Nastav `config/config.php` na práva `640`.
- Skontroluj, že `app.debug` je `false` (inštalátor to tak nastaví).
- Nastav `app.url` na plnú adresu, ak appka beží za reverznou proxy –
  inak sa zdieľacie odkazy môžu generovať s nesprávnou doménou.

## Aplikácia v podadresári

Ak má bežať na `https://firma.sk/dokumentacia/`, nahraj súbory do
`public_html/dokumentacia/` a nič nekonfiguruj. PHP si podadresár odvodí
zo `SCRIPT_NAME` a odovzdá ho frontendu; Vite builduje s relatívnym `base`,
takže sa všetko načíta správne.

## Aktualizácia na novšiu verziu

1. Zbuilduj frontend (`npm run build`).
2. Nahraj `app/`, `assets/`, `database/`, `index.php`, `.htaccess`.
   `config/config.php` ani `storage/` **neprepisuj**.
3. Spusti migrácie – buď `php bin/migrate.php`, alebo otvor `/setup`
   (ak už je nainštalované, migrácie sa dajú spustiť aj tak, že sa dočasne
   premenuje `config/config.php`; jednoduchšie je použiť CLI).

Migrácie sú evidované v tabuľke `migrations`, takže sa nikdy nespustia dvakrát.

## Zálohovanie

Stačia dve veci:

- **databáza** – export cez phpMyAdmin alebo `mysqldump`,
- **`storage/uploads/`** – nahraté obrázky a prílohy.

Zvyšok je kód, ten je v Gite.

## Konfigurácia pre nginx

`.htaccess` sa na nginxe ignoruje, prepíš ho do `server` bloku:

```nginx
server {
    root /var/www/mdcabinet;
    index index.php;

    # Citlivé adresáre nikdy neservuj
    location ~ ^/(app|config|database|frontend|docs|docker|bin|storage)/ {
        deny all;
        return 404;
    }

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    client_max_body_size 20m;
}
```

## Keď hosting nemá mod_rewrite

Niektoré hostingy (typicky tie zadarmo) `.htaccess` ignorujú alebo nemajú
zapnutý `mod_rewrite`. MDcabinet s tým počíta – frontend si pri štarte otestuje
tri tvary adries a použije prvý funkčný:

| Režim | Adresa API | Adresa v prehliadači |
|---|---|---|
| `pretty` | `/api/auth/me` | `/documents/5` |
| `pathinfo` | `/index.php/api/auth/me` | `/#/documents/5` |
| `query` | `/index.php?_route=/api/auth/me` | `/#/documents/5` |

Bez rewritu teda appka beží na **hash routeri** – v adrese pribudne mriežka,
inak sa nič nemení. Zdieľacie odkazy aj adresy vložených obrázkov sa
generujú v rovnakom tvare, takže fungujú tiež.

Zvolený režim si prehliadač pamätá v `sessionStorage` pod kľúčom
`mdcabinet.apiMode`. Ak si na hostingu neskôr rewrite zapneš, stačí zavrieť
a znova otvoriť kartu – appka sa pretestuje.

## Diagnostika

Keď niečo nehrá, nahraj vedľa `index.php` súbor `mdcabinet-check.php`
(je v repozitári) a otvor ho v prehliadači:

```
https://tvoja-domena.sk/mdcabinet-check.php
```

Ukáže verziu PHP, rozšírenia, práva na adresáre, či sú nahraté všetky súbory
a hlavne **otestuje všetky tri režimy smerovania**. Nepotrebuje nič
z aplikácie, takže funguje aj vtedy, keď je appka rozbitá.

Po vyriešení problému súbor zmaž – vypisuje informácie o serveri.

## Riešenie problémov

| Prejav | Príčina a riešenie |
|---|---|
| Stránka s textom „MDcabinet ešte nemá zbuildovaný frontend“ | Chýba `assets/`. Spusti `npm run build` a nahraj ho. |
| 500 hneď na úvod | Pozri `storage/logs/app-YYYY-MM-DD.log`. Najčastejšie zlé prístupy k databáze. |
| Inštalátor sa načíta, ale „Kontrola prostredia“ je prázdna a v konzole sú 404 na `/api/...` | Hosting nemá `mod_rewrite`. Nahraj aktuálnu verziu appky – prepne sa na záložný režim sama. Over cez `mdcabinet-check.php`. |
| Všetko vracia 404 okrem úvodnej stránky | To isté – ignorovaný `.htaccess` alebo `AllowOverride None`. |
| Inštalátor hlási, že `config/` nie je zapisovateľný | Nastav práva 775, alebo vytvor `config/config.php` ručne podľa `config.example.php`. |
| Prihlásenie sa hneď stratí | Hosting nemá zapisovateľný adresár pre session, alebo appka beží raz na `www.` a raz bez `www.`. Zjednoť doménu. |
| Nahrávanie väčších obrázkov zlyhá | Zvýš `upload_max_filesize` a `post_max_size` v PHP a `uploads.max_size` v configu. |
