# Architektúra MDcabinetu

## Hlavné obmedzenie: klasický hosting

Celý návrh vychádza z jedného zadania – **appka musí bežať na bežnom
webhostingu**. To znamená Apache s `mod_rewrite`, PHP, MySQL, FTP prístup.
Žiadne SSH, žiadny Composer, žiadny Node, žiadny Redis, žiadne dlhobežiace procesy.

Z toho plynú všetky ďalšie rozhodnutia:

| Rozhodnutie | Dôvod |
|---|---|
| Backend bez frameworku a bez Composera | Na hosting sa nahrajú súbory a appka beží. Nič sa nemusí inštalovať. |
| React sa builduje **lokálne** do `assets/` | Server nepotrebuje Node. Nahrávaš hotové `.js` a `.css`. |
| Prihlásenie cez natívnu PHP session | SPA beží na tej istej doméne, takže cookie stačí. Žiadny JWT ani token storage. |
| Rate limiting cez súbory v `storage/cache` | Redis na zdieľanom hostingu nie je. |
| Uploady mimo webroot, servuje ich PHP | Nedá sa nahrať a spustiť podstrčený skript, dá sa kontrolovať prístup. |
| Migrácie ako obyčajné `.sql` súbory | Spustí ich buď CLI skript, alebo webový inštalátor na `/setup`. |

## Tok requestu

```
prehliadač
   │
   ├── /assets/*  ──────────────────► Apache servuje priamo (statické súbory)
   │
   └── čokoľvek iné ────────────────► .htaccess → index.php
                                          │
                                          ├── app/bootstrap.php  (autoloader, config, error handler)
                                          ├── app/routes.php     (definícia ciest)
                                          └── Router::dispatch()
                                                 │
                                                 ├── /api/*  → Controller → Model → PDO → MySQL
                                                 └── ostatné → SpaController → HTML obal s React appkou
```

Neznáma `GET` cesta mimo `/api` nie je chyba – je to klientská route Reactu,
takže `index.php` v takom prípade pošle SPA obal (fallback v `index.php`).

## Vrstvy backendu

```
app/
├── bootstrap.php            autoloader (PSR-4 bez Composera), config, error handling
├── routes.php               všetky cesty na jednom mieste
├── Core/
│   ├── Config.php           config.example.php + config.php + MDC_* env premenné
│   ├── Database.php         tenká vrstva nad PDO (fetch, insert, update, transaction)
│   ├── Router.php           statické segmenty + {param}, skupiny s middlewarom
│   ├── Request.php          obal nad superglobálmi, lazy JSON body
│   ├── Response.php         JSON / HTML / súbor, hlavičky
│   ├── Auth.php             session, CSRF token, aktuálny používateľ
│   ├── Validator.php        pravidlá typu 'required|string|max:190'
│   ├── RateLimiter.php      súborový limiter pre login a zdieľanie
│   ├── Migrator.php         spúšťa database/migrations/*.sql
│   ├── ErrorHandler.php     nikdy biela stránka; JSON pre API, HTML inak
│   └── HttpException.php    stavové kódy + validačné chyby
├── Http/
│   ├── Controllers/         jeden controller na doménovú oblasť
│   └── Middleware/          AuthMiddleware, CsrfMiddleware
├── Models/                  statické repozitáre nad tabuľkami (Model.php = spoločný základ)
└── Support/
    ├── Access.php           jediné miesto, kde sa rieši "smie to tento používateľ?"
    └── Presenter.php        DB riadok (snake_case) → API tvar (camelCase)
```

### Prečo `Access.php`

Oprávnenia sa dajú ľahko rozbiť tým, že sa kontrola zabudne v jednom
controlleri. Preto ich rieši jediná trieda: každý controller si objekt vypýta
cez `Access::document($id)` a dostane ho **iba** ak naň má právo. Kontrola
sa reťazí smerom hore: dokument → šuplík → skriňa → vlastník.

Cudzí obsah vracia `404`, nie `403` – aby sa nedalo zisťovať, čo v systéme existuje.

### Prečo `Presenter.php`

Frontend nikdy nevidí surové stĺpce z databázy. Vďaka tomu sa dá schéma zmeniť
(premenovať stĺpec, pridať soft delete) bez zásahu do TypeScriptu.

## Dátový model

```
users ──< cabinets ──< trays ──< folders ──< folders (rekurzívne)
                          │         └──< documents
                          └──────────────< documents (priamo v šuplíku)

documents ──< document_revisions
documents ──< attachments
share_links ── polymorfný cieľ (cabinet | tray | folder | document)
```

- **Soft delete** – všetko podstatné má `deleted_at`. Omylom zmazaný obsah sa
  dá vrátiť priamo v databáze.
- **Fulltext index** `ft_documents (title, content)` – hľadanie beží cez
  `MATCH … AGAINST` s `LIKE` fallbackom (MySQL fulltext ignoruje krátke slová).
- **Revízie** sa držia do počtu `Revision::KEEP` (100) na dokument, staršie sa
  priebežne mažú, aby tabuľka nerástla donekonečna.
- **Pozície** (`position`) sú pripravené na drag & drop preusporiadanie;
  endpointy `*/reorder` už existujú.

## Frontend

```
frontend/src/
├── main.tsx              providery: Router → QueryClient → Theme → Toast → Auth
├── App.tsx               routy; DocumentPage a PublicSharePage sú lazy
├── lib/
│   ├── api.ts            typovaný klient, CSRF, automatické obnovenie tokenu
│   ├── types.ts          tvary z API
│   ├── markdown.ts       markdown-it + DOMPurify + highlight.js
│   └── utils.ts          dátumy, skloňovanie, cx()
├── state/                auth.tsx, theme.tsx
├── components/
│   ├── ui.tsx            Button, Input, Modal, Toast, EmptyState…
│   ├── Layout.tsx        hlavička, sidebar, Ctrl+K
│   ├── Sidebar.tsx       skrine + lazy načítanie stromu
│   ├── TreeNav.tsx       strom Tray → Folder → Document
│   ├── SearchPalette.tsx rýchle hľadanie
│   ├── ShareDialog.tsx   verejné odkazy
│   ├── RevisionsDrawer.tsx história
│   └── editor/           MarkdownEditor.tsx + commands.ts
└── pages/                Auth, Dashboard, Cabinet, Tray, Document, Settings, PublicShare, Setup
```

### Bezpečnosť renderovania Markdownu

Markdown môže obsahovať surové HTML, preto **každý** vyrenderovaný dokument
prechádza cez DOMPurify (`lib/markdown.ts`). Zakázané sú `<script>`, `<iframe>`,
`<form>`, inline `style` aj `on*` atribúty. SVG prílohy sa servujú s
`Content-Disposition: attachment`, nie inline – inline SVG je bežný vektor XSS.

### Načítavanie dát

TanStack Query drží cache podľa kľúčov `['cabinets']`, `['cabinet', id]`,
`['tray', id]`, `['document', id]`. Po mutácii sa invalidujú len dotknuté kľúče,
takže sidebar aj obsah zostanú konzistentné bez ručného prepisovania stavu.

Editor je výnimka: obsah dokumentu sa do lokálneho stavu naleje **iba raz**
(`loadedId` ref v `DocumentPage`), inak by refetch prepísal rozpísaný text.

## Nasadenie do podadresára

Appka funguje aj na `https://firma.sk/dokumentacia/`:

- PHP si podadresár odvodí zo `SCRIPT_NAME` (`Config::basePath()`),
- do HTML obalu ho vloží ako `window.__MDCABINET__.basePath`,
- React ho použije ako `basename` routera aj prefix API volaní,
- Vite builduje s `base: './'`, takže aj chunky sa načítavajú relatívne.

Nič sa teda nemusí prekonfigurovať.

## Čo zámerne nie je vo v1

- Skupinové oprávnenia (zatiaľ platí: obsah patrí vlastníkovi skrine).
- Drag & drop preusporiadanie v UI (API a stĺpce `position` sú pripravené).
- Export do PDF a hromadný import `.md` súborov.
- WYSIWYG režim – editor je zámerne Markdown-first.
