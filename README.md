# MDcabinet

Webová aplikácia na správu dokumentácie v Markdowne – niečo ako BookStack,
ale postavené tak, aby bežalo na **úplne bežnom PHP hostingu** (Apache + PHP + MySQL,
FTP, žiadne SSH, žiadny Node na serveri).

```
Cabinet  (skriňa)          → najvyššia úroveň, patrí používateľovi
  └─ Tray  (šuplík)        → tematický celok
      └─ Folder (zložka)   → dá sa vnárať do hĺbky
          └─ Document      → samotný Markdown dokument
```

## Čo appka vie

- **Markdown editor** – CodeMirror 6, živý náhľad vedľa textu, lišta s formátovaním,
  klávesové skratky, autosave, obrázky pretiahnutím alebo `Ctrl+V`.
- **História dokumentov** – každé uloženie vytvorí revíziu, staršiu verziu si vieš
  pozrieť a jedným klikom obnoviť.
- **Fulltextové hľadanie** – `Ctrl/⌘+K`, hľadá v názvoch aj obsahu naprieč skriňami.
- **Verejné odkazy** – dokument, zložku, šuplík či celú skriňu vieš zdieľať
  read-only odkazom, voliteľne s heslom a expiráciou.
- **Účty a role** – prvý účet je automaticky správca. Registráciu ďalších sa dá
  chrániť **registračným kódom** (alebo ju úplne vypnúť), aby si účty nezakladali boti.
- **Dva jazyky** – angličtina (predvolená) a slovenčina. Jazyk sa volí pri registrácii,
  mení sa v nastaveniach účtu alebo jedným klikom v hlavičke. Prekladá sa aj to,
  čo posiela server (chybové a validačné hlásenia).
- **Svetlý aj tmavý režim**, plne responzívne.

## Technológie

| Vrstva    | Riešenie                                                            |
|-----------|---------------------------------------------------------------------|
| Backend   | PHP 8.1+, **žiadny framework, žiadny Composer** – vlastný router, PDO |
| Databáza  | MySQL / MariaDB (InnoDB, `utf8mb4`, fulltext index)                  |
| Frontend  | React 18 + TypeScript + Vite + Tailwind, buildne sa lokálne do `assets/` |
| Editor    | CodeMirror 6, markdown-it, DOMPurify, highlight.js                   |
| Prihlásenie | Natívne PHP session + CSRF token (žiadne JWT, žiadny Redis)        |

Backend nemá **ani jednu** externú závislosť – na hosting sa nahrajú súbory
a appka beží. Node.js treba len na tvojom počítači pri buildovaní frontendu.

## Rýchly štart (lokálny vývoj)

Potrebuješ Docker a Node.js 18+.

```bash
docker compose up -d
```

```bash
docker exec mdcabinet-app php bin/migrate.php
```

```bash
cd frontend && npm install && npm run build
```

Appka beží na <http://localhost:8080>, Adminer na <http://localhost:8081>
(server `db`, používateľ `mdcabinet`, heslo `secret`).

Pri práci na frontende sa oplatí spustiť Vite dev server s hot reloadom –
API si preposiela do PHP kontajnera:

```bash
cd frontend && npm run dev
```

## Nasadenie na hosting

Podrobne v [docs/DEPLOY.md](docs/DEPLOY.md). V skratke: zbuilduj frontend,
nahraj obsah repozitára na FTP (bez `frontend/`, `docker/` a `docs/`),
otvor `https://tvoja-domena.sk/setup` a vyplň prístupy k databáze.

## Štruktúra repozitára

```
index.php              jediný vstupný bod (front controller)
.htaccess              rewrite + ochrana adresárov
app/                   PHP zdrojáky (Core, Http, Models, Support)
config/                config.example.php → skopíruj ako config.php
database/migrations/   .sql migrácie
storage/               uploady, logy, cache (zapisovateľné)
assets/                zbuildovaný frontend (negitovaný, vzniká buildom)
frontend/              React zdrojáky (na server sa nenahrávajú)
bin/                   migrate.php, smoke-test.sh
docs/                  architektúra, API, deploy
```

## Jazyky

- **Kód aj komentáre sú po anglicky**, dokumentácia v `docs/` po slovensky.
- UI texty sa neprekladajú kľúčmi, ale priamo anglickým textom (gettext štýl):
  `t('Save')`. Angličtina je tak zároveň fallback – chýbajúci preklad nikdy
  nezobrazí prázdny reťazec.
- Slovenský slovník frontendu: [frontend/src/locales/sk.ts](frontend/src/locales/sk.ts)
- Slovenský slovník API hlásení: [app/lang/sk.php](app/lang/sk.php)

Pridanie ďalšieho jazyka = doplniť ho do `LOCALES` v `frontend/src/lib/i18n.ts`,
do `Lang::SUPPORTED` v `app/Core/Lang.php` a pridať dva slovníkové súbory.

Kontrola, či je slovník kompletný (vypíše chýbajúce aj nepoužité kľúče):

```bash
node bin/check-translations.mjs
```

## Testy

Smoke test prejde hlavný scenár cez REST API (registrácia → skriňa → šuplík →
zložka → dokument → revízia → hľadanie → zdieľanie → kontrola oprávnení):

```bash
BASE=http://localhost:8080 bash bin/smoke-test.sh
```

## Dokumentácia

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – ako to je poskladané a prečo
- [docs/API.md](docs/API.md) – prehľad REST endpointov
- [docs/DEPLOY.md](docs/DEPLOY.md) – nasadenie na klasický hosting
