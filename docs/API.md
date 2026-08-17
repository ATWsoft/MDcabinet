# REST API

Základ: `{app_url}/api`. Všetko je JSON, kódovanie `utf-8`.

## Autentifikácia

Prihlásenie stojí na **session cookie** (`mdcabinet_session`, `HttpOnly`, `SameSite=Lax`).
Klient posiela `credentials: 'same-origin'`, nič ďalšie netreba.

Zapisovacie požiadavky (`POST`, `PUT`, `PATCH`, `DELETE`) prihláseného používateľa
musia niesť hlavičku:

```
X-CSRF-Token: <token z /api/auth/me>
```

Ak token vyprší, API vráti `403` s `{"errors":{"csrf":"expired"}}`. Klient v `lib/api.ts`
si v takom prípade token sám obnoví a request zopakuje.

## Jazyk odpovedí

Klient posiela svoj aktívny jazyk v hlavičke:

```
X-Locale: sk
```

Podporované sú `en` (predvolený) a `sk`. Ak hlavička chýba, použije sa
`Accept-Language`, inak angličtina. Prekladajú sa aj validačné hlášky
po jednotlivých poliach.

## Chybové odpovede

```json
{
  "error": true,
  "message": "Zadané údaje nie sú platné.",
  "errors": { "email": "Neplatná e-mailová adresa." }
}
```

| Kód | Význam |
|-----|--------|
| 400 | chybná požiadavka |
| 401 | neprihlásený |
| 403 | bez oprávnenia / neplatný CSRF token |
| 404 | neexistuje (aj pri cudzom obsahu – zámerne) |
| 410 | zdieľaný odkaz expiroval |
| 413 | súbor je príliš veľký |
| 422 | validačná chyba (`errors` po poliach) |
| 429 | rate limit |

---

## Inštalácia

| Metóda | Cesta | Popis |
|---|---|---|
| `GET` | `/api/setup/status` | stav inštalácie + kontrola prostredia |
| `POST` | `/api/setup/install` | zapíše `config/config.php` a spustí migrácie |

Po dokončení inštalácie sa oba endpointy samy uzamknú.

## Účty

| Metóda | Cesta | Telo |
|---|---|---|
| `POST` | `/api/auth/register` | `email`, `name`, `password`, `locale?`, `registrationCode?` |
| `POST` | `/api/auth/login` | `email`, `password` |
| `POST` | `/api/auth/logout` | – |
| `GET` | `/api/auth/me` | vracia `user` (aj s `locale`), `csrf`, `instance` (aj s `locales`) |
| `PUT` | `/api/auth/profile` | `name`, `avatarColor?`, `locale?` |
| `PUT` | `/api/auth/password` | `currentPassword`, `newPassword` |

Prvý registrovaný účet na inštancii dostane rolu `admin` a vzniká bez obmedzení.

Ďalšie registrácie sa riadia nastaveniami inštancie:

- registrácia môže byť úplne vypnutá → `403`,
- môže vyžadovať **registračný kód** → bez neho alebo so zlým `422`
  s chybou v poli `registrationCode`.

Či je kód potrebný, prezradí `instance.requiresRegistrationCode` v `/api/auth/me`.
Samotný kód sa neprihlásenému klientovi nikdy neposiela.

Pokusy sú limitované: 10 registrácií a 10 hádaní kódu za hodinu z jednej IP
(úspešná registrácia počítadlo kódu vynuluje).

## Správa inštancie (len rola `admin`)

| Metóda | Cesta | Popis |
|---|---|---|
| `GET` | `/api/admin/settings` | `registrationOpen`, `registrationCode`, `userCount` |
| `PUT` | `/api/admin/settings` | `registrationOpen?`, `registrationCode?` |
| `POST` | `/api/admin/registration-code` | vygeneruje návrh kódu (neukladá ho) |

Prázdny `registrationCode` znamená registráciu bez kódu. Neprázdny musí mať
aspoň 6 znakov. Nastavenia sa držia v tabuľke `settings`, takže sa dajú meniť
z aplikácie bez zásahu do `config.php`.

## Prehľad a skrine

| Metóda | Cesta | Popis |
|---|---|---|
| `GET` | `/api/dashboard` | skrine + naposledy upravené dokumenty |
| `GET` | `/api/cabinets` | zoznam skríň s počtami |
| `POST` | `/api/cabinets` | `name`, `description?`, `color?`, `icon?` |
| `GET` | `/api/cabinets/{id}` | skriňa vrátane celého stromu |
| `PUT` | `/api/cabinets/{id}` | úprava |
| `DELETE` | `/api/cabinets/{id}` | soft delete |
| `POST` | `/api/cabinets/reorder` | `ids: number[]` |

## Šuplíky

| Metóda | Cesta | Popis |
|---|---|---|
| `GET` | `/api/trays/{id}` | šuplík so zložkami a dokumentmi |
| `POST` | `/api/trays` | `cabinetId`, `name`, `description?` |
| `PUT` | `/api/trays/{id}` | úprava |
| `DELETE` | `/api/trays/{id}` | soft delete |
| `POST` | `/api/trays/reorder` | `cabinetId`, `ids: number[]` |

## Zložky

| Metóda | Cesta | Popis |
|---|---|---|
| `POST` | `/api/folders` | `trayId`, `parentId?`, `name` |
| `PUT` | `/api/folders/{id}` | `name` |
| `PUT` | `/api/folders/{id}/move` | `parentId` (`null` = koreň šuplíka) |
| `DELETE` | `/api/folders/{id}` | soft delete |

Zanorenie je obmedzené na 8 úrovní; zložku nejde presunúť do vlastného podstromu.

## Dokumenty

| Metóda | Cesta | Popis |
|---|---|---|
| `GET` | `/api/documents/{id}` | dokument + drobečková navigácia |
| `POST` | `/api/documents` | `trayId`, `folderId?`, `title`, `content?` |
| `PUT` | `/api/documents/{id}` | `title?`, `content?`, `summary?`, `isPinned?` |
| `PUT` | `/api/documents/{id}/move` | `trayId?`, `folderId?` |
| `DELETE` | `/api/documents/{id}` | soft delete |
| `POST` | `/api/documents/reorder` | `trayId`, `ids: number[]` |

`PUT` vytvorí novú revíziu iba ak sa názov alebo obsah naozaj zmenil –
autosave teda nezaplaví históriu. Odpoveď obsahuje `revisionAdded: bool`.

## História

| Metóda | Cesta | Popis |
|---|---|---|
| `GET` | `/api/documents/{id}/revisions` | zoznam bez obsahu |
| `GET` | `/api/documents/{id}/revisions/{revisionId}` | revízia vrátane obsahu |
| `POST` | `/api/documents/{id}/revisions/{revisionId}/revert` | návrat na revíziu |

Návrat históriu nemaže – vznikne nová revízia typu `revert`.

## Hľadanie

```
GET /api/search?q=onboarding&cabinetId=3
```

Hľadá vo vlastných dokumentoch cez MySQL fulltext s `LIKE` fallbackom.
Nájdený výraz je v poli `highlight` obalený do `«…»`.

## Súbory

| Metóda | Cesta | Popis |
|---|---|---|
| `POST` | `/api/files` | `multipart/form-data`: `file`, `documentId?` |
| `GET` | `/api/files/{id}` | servuje súbor (kontroluje oprávnenie) |
| `DELETE` | `/api/files/{id}` | zmaže súbor aj záznam |

Povolené MIME typy a maximálnu veľkosť určuje `config/config.php`.

## Zdieľanie

| Metóda | Cesta | Popis |
|---|---|---|
| `GET` | `/api/shares?targetType=…&targetId=…` | odkazy k danému cieľu |
| `POST` | `/api/shares` | `targetType`, `targetId`, `password?`, `expiresAt?` |
| `DELETE` | `/api/shares/{token}` | zrušenie odkazu |

`targetType` je `cabinet`, `tray`, `folder` alebo `document`.

### Verejná časť (bez prihlásenia)

| Metóda | Cesta | Popis |
|---|---|---|
| `GET` | `/api/public/{token}` | obsah odkazu, alebo `{"needsPassword":true}` |
| `POST` | `/api/public/{token}/unlock` | `password` |
| `GET` | `/api/public/{token}/documents/{documentId}` | dokument v rozsahu odkazu |
| `GET` | `/api/public/{token}/files/{id}` | príloha v rozsahu odkazu |

Odomknutie heslom sa pamätá v session, takže sa zadáva raz.
Dokument mimo rozsahu odkazu vráti `404`, aj keď token je platný.
