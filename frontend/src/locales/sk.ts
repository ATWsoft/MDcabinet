import type { Dictionary } from '@/lib/i18n'

/**
 * Slovak translations.
 *
 * Keys are the English wording from the components. A missing key simply falls
 * back to English, so nothing ever renders empty. Plural entries hold the three
 * Slovak forms: [1, 2–4, 5+].
 */
export const sk: Dictionary = {
  // ---------------------------------------------------------- common verbs ---
  Save: 'Uložiť',
  Saved: 'Uložené',
  Cancel: 'Zrušiť',
  Create: 'Vytvoriť',
  Delete: 'Zmazať',
  Edit: 'Upraviť',
  Share: 'Zdieľať',
  Close: 'Zavrieť',
  Rename: 'Premenovať',
  Restore: 'Obnoviť',
  Generate: 'Vygenerovať',
  Install: 'Nainštalovať',
  Unlock: 'Odomknúť',
  'Sign in': 'Prihlásiť sa',
  'Sign out': 'Odhlásiť sa',
  Register: 'Zaregistrovať sa',
  'Loading…': 'Načítavam…',
  'Saving…': 'Ukladám…',

  // ----------------------------------------------------------- navigation ---
  Overview: 'Prehľad',
  Cabinets: 'Skrine',
  Cabinet: 'Skriňa',
  Trays: 'Šuplíky',
  Folders: 'Zložky',
  Folder: 'Zložka',
  Documents: 'Dokumenty',
  Contents: 'Obsah',
  History: 'História',
  'Search…': 'Hľadať…',
  'Open menu': 'Otvoriť menu',
  'Close menu': 'Zavrieť menu',
  Collapse: 'Zbaliť',
  Expand: 'Rozbaliť',
  'Collapse cabinet': 'Zbaliť skriňu',
  'Expand cabinet': 'Rozbaliť skriňu',
  empty: 'prázdny',

  // -------------------------------------------------------------- account ---
  'Account settings': 'Nastavenia účtu',
  Profile: 'Profil',
  Name: 'Meno',
  'E-mail': 'E-mail',
  Password: 'Heslo',
  Language: 'Jazyk',
  Appearance: 'Vzhľad',
  'Avatar colour': 'Farba avatara',
  Colour: 'Farba',
  'Colour {value}': 'Farba {value}',
  'Save profile': 'Uložiť profil',
  'Change password': 'Zmeniť heslo',
  'Current password': 'Aktuálne heslo',
  'New password': 'Nové heslo',
  'At least 8 characters.': 'Minimálne 8 znakov.',
  'Instance administrator': 'Správca inštancie',
  User: 'Používateľ',
  administrator: 'správca',
  'member since {date}': 'účet od {date}',
  'Your profile was saved.': 'Profil je uložený.',
  'Your password was changed.': 'Heslo je zmenené.',
  'Changing the password failed.': 'Zmena hesla zlyhala.',
  'Saving failed.': 'Uloženie zlyhalo.',
  'Applies to the interface and to messages from the server.':
    'Platí pre rozhranie aj pre hlásenia zo servera.',
  'You can change this later in your account settings.':
    'Neskôr sa to dá zmeniť v nastaveniach účtu.',

  // ------------------------------------------------------------- sign in ---
  'Checking your session…': 'Overujem prihlásenie…',
  'Sign in to your cabinets of documents.': 'Prihlás sa do svojich skríň s dokumentmi.',
  'Create an account and start organising your notes.':
    'Vytvor si účet a začni si organizovať poznámky.',
  'Welcome! Create the first account – it automatically gets administrator rights.':
    'Vitaj! Vytvor si prvý účet – automaticky dostane práva správcu.',
  'Create account': 'Vytvoriť účet',
  'No account yet?': 'Ešte nemáš účet?',
  'Already have an account?': 'Už máš účet?',
  'Could not reach the server.': 'Nepodarilo sa spojiť so serverom.',
  'Registration code': 'Registračný kód',
  'The administrator of this instance will give you the code.':
    'Kód dostaneš od správcu tejto inštancie.',

  // -------------------------------------------------------- registration ---
  Registration: 'Registrácia',
  'Allow new accounts to register': 'Povoliť registráciu nových účtov',
  'When off, nobody can register – not even with a valid code.':
    'Po vypnutí sa nezaregistruje nikto – ani s platným kódom.',
  'Without protection, bots will eventually create accounts on a public domain. Set a registration code and pass it to the people who should be able to register.':
    'Bez ochrany si na verejnej doméne účet skôr či neskôr vytvoria aj boti. Nastav registračný kód a pošli ho tým, ktorí sa majú zaregistrovať.',
  'empty = anyone can register': 'prázdne = ktokoľvek sa môže zaregistrovať',
  'Registration is protected. Share the code only with people who should have access.':
    'Registrácia je chránená. Kód pošli len tým, ktorí majú mať prístup.',
  'Without a code, registration is open to anyone.':
    'Bez kódu je registrácia otvorená pre kohokoľvek.',
  'Registration is currently open to anyone.':
    'Registrácia je momentálne otvorená pre kohokoľvek.',
  'Registration settings saved.': 'Nastavenia registrácie sú uložené.',
  'Save settings': 'Uložiť nastavenia',
  'Copy code': 'Kopírovať kód',
  'The code is in your clipboard.': 'Kód je v schránke.',
  'Copying failed – select the code and copy it manually.':
    'Kopírovanie zlyhalo – kód si označ a skopíruj ručne.',
  'Accounts on this instance: {count}': 'Účtov na inštancii: {count}',

  // --------------------------------------------------------------- theme ---
  Light: 'Svetlý',
  Dark: 'Tmavý',
  'Follow system': 'Podľa systému',
  'Light theme': 'Svetlý režim',
  'Dark theme': 'Tmavý režim',
  '{theme} – click to switch': '{theme} – kliknutím prepneš',

  // ----------------------------------------------------------- dashboard ---
  'Good morning': 'Dobré ráno',
  'Good afternoon': 'Dobrý deň',
  'Good evening': 'Dobrý večer',
  '{greeting}, {name}.': '{greeting}, {name}.',
  'Start by creating your first cabinet.': 'Začni tým, že si vytvoríš prvú skriňu.',
  'Nothing here yet': 'Zatiaľ tu nič nie je',
  'A cabinet is the top level. It holds trays, trays hold folders, folders hold documents.':
    'Skriňa je najvyššia úroveň. V nej sú šuplíky, v šuplíkoch zložky a v zložkách dokumenty.',
  'Recently updated': 'Naposledy upravené',

  // ------------------------------------------------------------- cabinets ---
  'New cabinet': 'Nová skriňa',
  'Edit cabinet': 'Upraviť skriňu',
  'Delete cabinet': 'Zmazať skriňu',
  'Delete this cabinet?': 'Zmazať skriňu?',
  'Cabinet not found': 'Skriňa sa nenašla',
  'Cabinet “{name}” created.': 'Skriňa „{name}“ je vytvorená.',
  'The cabinet was deleted.': 'Skriňa bola zmazaná.',
  'A cabinet is the top level – it groups trays with documents.':
    'Skriňa je najvyššia úroveň – zoskupuje šuplíky s dokumentmi.',
  'No cabinets yet. Create your first one with the + above.':
    'Zatiaľ nemáš žiadnu skriňu. Vytvor prvú cez + vyššie.',
  'This cabinet is empty': 'Skriňa je prázdna',
  '“{name}” with all its trays and documents.':
    '„{name}“ aj so všetkými šuplíkmi a dokumentmi.',
  'e.g. Company documentation': 'napr. Firemná dokumentácia',

  // ---------------------------------------------------------------- trays ---
  'New tray': 'Nový šuplík',
  'Edit tray': 'Upraviť šuplík',
  'Delete tray': 'Zmazať šuplík',
  'Delete this tray?': 'Zmazať šuplík?',
  'Tray not found': 'Šuplík sa nenašiel',
  'The tray was created.': 'Šuplík je vytvorený.',
  'The tray was deleted.': 'Šuplík bol zmazaný.',
  'Create the first tray': 'Vytvoriť prvý šuplík',
  'A tray groups folders and documents around one topic.':
    'Šuplík zoskupuje zložky a dokumenty k jednej téme.',
  'No trays yet.': 'Zatiaľ žiadne šuplíky.',
  'This tray is empty': 'Šuplík je prázdny',
  '“{name}” with all its folders and documents.':
    '„{name}“ aj so všetkými zložkami a dokumentmi.',
  'e.g. Processes and policies': 'napr. Procesy a smernice',
  Description: 'Popis',
  'Description (optional)': 'Popis (voliteľné)',

  // -------------------------------------------------------------- folders ---
  'New folder': 'Nová zložka',
  'New subfolder': 'Nová podzložka',
  Subfolder: 'Podzložka',
  'Folder name': 'Názov zložky',
  'Rename folder': 'Premenovať zložku',
  'Delete folder': 'Zmazať zložku',
  'Delete this folder?': 'Zmazať zložku?',
  'The folder was created.': 'Zložka je vytvorená.',
  'The folder was renamed.': 'Zložka je premenovaná.',
  'The folder was deleted.': 'Zložka bola zmazaná.',
  'this folder is empty': 'zložka je prázdna',
  '“{name}” with everything inside.': '„{name}“ aj s obsahom.',

  // ------------------------------------------------------------ documents ---
  'New document': 'Nový dokument',
  'New document in this folder': 'Nový dokument v zložke',
  'Document title': 'Názov dokumentu',
  'Create and open': 'Vytvoriť a otvoriť',
  'Delete document': 'Zmazať dokument',
  'Delete this document?': 'Zmazať dokument?',
  'Document not found': 'Dokument sa nenašiel',
  'The document was deleted.': 'Dokument bol zmazaný.',
  '“{name}” will disappear from the tray.': '„{name}“ zmizne zo šuplíka.',
  'e.g. Onboarding a new colleague': 'napr. Onboarding nového kolegu',
  Untitled: 'Bez názvu',
  'Pin document': 'Pripnúť dokument',
  Unpin: 'Zrušiť pripnutie',
  'Unsaved changes': 'Neuložené zmeny',
  'Saved {when}': 'Uložené {when}',
  'Saving failed: {error}': 'Uloženie zlyhalo: {error}',
  'Create the first document, or split the content into folders first.':
    'Vytvor prvý dokument alebo si obsah najskôr rozčleň do zložiek.',
  'It may have been deleted or it belongs to another account.':
    'Možno bol zmazaný alebo patrí inému účtu.',

  // --------------------------------------------------------------- editor ---
  'Heading 1': 'Nadpis 1',
  'Heading 2': 'Nadpis 2',
  'Heading 3': 'Nadpis 3',
  Bold: 'Tučné',
  Italic: 'Kurzíva',
  'Inline code': 'Kód',
  'Code block': 'Blok kódu',
  'Bullet list': 'Odrážky',
  'Numbered list': 'Číslovaný zoznam',
  Quote: 'Citácia',
  Link: 'Odkaz',
  Table: 'Tabuľka',
  'link text': 'text odkazu',
  'Column A': 'Stĺpec A',
  'Column B': 'Stĺpec B',
  value: 'hodnota',
  'Editor only': 'Len editor',
  'Editor and preview': 'Editor + náhľad',
  'Preview only': 'Len náhľad',
  'Full screen': 'Na celú obrazovku',
  'Leave full screen': 'Ukončiť režim na celú obrazovku',
  'Upload an image or attachment': 'Nahrať obrázok alebo prílohu',
  'The upload failed.': 'Nahrávanie zlyhalo.',
  'Write in Markdown… Drop an image in or paste it with {key}+V.':
    'Píš v Markdowne… Obrázok vlož pretiahnutím alebo {key}+V.',
  '{key}+S save · {key}+B bold · {key}+K link':
    '{key}+S uložiť · {key}+B tučné · {key}+K odkaz',
  '{count} characters': '{count} znakov',
  'This document is still empty – start typing on the left.':
    'Dokument je zatiaľ prázdny – začni písať vľavo.',

  // -------------------------------------------------------------- history ---
  'Document history': 'História dokumentu',
  'Loading revisions…': 'Načítavam revízie…',
  'No revisions yet.': 'Zatiaľ žiadne revízie.',
  'Pick a revision on the left to see how the document looked then.':
    'Vyber revíziu vľavo a uvidíš, ako dokument vtedy vyzeral.',
  'revision #{number}': 'revízia #{number}',
  'Restore this version': 'Obnoviť túto verziu',
  'Restore an older version?': 'Obnoviť staršiu verziu?',
  'The current text will be replaced by the selected revision.':
    'Aktuálny text sa nahradí obsahom vybranej revízie.',
  'The history is preserved – a new “restored” revision is created, so you can go back again.':
    'História zostane zachovaná – vznikne nová revízia typu „návrat“, takže sa vieš vrátiť aj späť.',
  'The document was restored to the selected revision.':
    'Dokument je vrátený na zvolenú revíziu.',
  created: 'vytvorenie',
  edited: 'úprava',
  restored: 'návrat',
  'unknown author': 'neznámy autor',

  // --------------------------------------------------------------- search ---
  'Search documents': 'Hľadanie v dokumentoch',
  'Search documents…': 'Hľadaj v dokumentoch…',
  'Type at least two characters. Titles and document contents are searched.':
    'Napíš aspoň dva znaky. Hľadá sa v názvoch aj v obsahu dokumentov.',
  'Nothing found for “{query}”.': 'Pre „{query}“ sa nič nenašlo.',
  '↑↓ to select · Enter to open · Esc to close':
    '↑↓ výber · Enter otvoriť · Esc zavrieť',

  // -------------------------------------------------------------- sharing ---
  'Share cabinet': 'Zdieľať skriňu',
  'Share tray': 'Zdieľať šuplík',
  'Share folder': 'Zdieľať zložku',
  'Share document': 'Zdieľať dokument',
  'New public link': 'Nový verejný odkaz',
  'Password (optional)': 'Heslo (voliteľné)',
  'no password': 'bez hesla',
  'At least 4 characters if you want to use one.':
    'Aspoň 4 znaky, ak ho chceš použiť.',
  'Valid until (optional)': 'Platnosť do (voliteľné)',
  'Create link': 'Vytvoriť odkaz',
  'Anyone with the link can read the content. Nobody can change anything.':
    'Ktokoľvek s odkazom uvidí obsah len na čítanie. Upravovať nemôže nič.',
  'Existing links': 'Existujúce odkazy',
  'No links yet – the content is private.':
    'Zatiaľ žiadne odkazy – obsah je súkromný.',
  'Link created and copied to the clipboard.':
    'Odkaz vytvorený a skopírovaný do schránky.',
  'The link was revoked.': 'Odkaz bol zrušený.',
  'The link is in your clipboard.': 'Odkaz je v schránke.',
  'Copying failed – select the link and copy it manually.':
    'Kopírovanie zlyhalo – odkaz si označ a skopíruj ručne.',
  'Copy link': 'Kopírovať odkaz',
  'Revoke link': 'Zrušiť odkaz',
  'password protected': 'chránené heslom',
  'valid until {date}': 'platí do {date}',

  // ------------------------------------------------------- public sharing ---
  'shared · read only': 'zdieľané · len na čítanie',
  'This link is not available': 'Odkaz nie je dostupný',
  'The link does not exist or has expired.':
    'Odkaz neexistuje alebo mu vypršala platnosť.',
  'This content is locked': 'Obsah je zamknutý',
  'Enter the password you were given.': 'Zadaj heslo, ktoré ti poslali.',
  'Unlocking failed.': 'Odomknutie zlyhalo.',
  'Pick a document': 'Vyber dokument',
  'The contents of the shared section are on the left.':
    'Vľavo je obsah zdieľanej sekcie.',
  'The shared section is empty.': 'Zdieľaná sekcia je prázdna.',
  'The document could not be loaded': 'Dokument sa nepodarilo načítať',

  // ---------------------------------------------------------------- setup ---
  'Install MDcabinet': 'Inštalácia MDcabinetu',
  'A few details and you can start writing.': 'Pár údajov a môžeš začať písať.',
  'Checking the environment…': 'Kontrolujem prostredie…',
  'Environment check': 'Kontrola prostredia',
  'Database connection': 'Pripojenie k databáze',
  'You will find these in your hosting control panel. The database has to exist already – MDcabinet creates the tables itself.':
    'Údaje nájdeš v administrácii hostingu. Databáza musí už existovať – MDcabinet si v nej sám vytvorí tabuľky.',
  Server: 'Server',
  Port: 'Port',
  'Database name': 'Názov databázy',
  'Application URL (optional)': 'Adresa aplikácie (voliteľné)',
  'Leave empty to derive it automatically. Fill it in when running behind a reverse proxy.':
    'Nechaj prázdne a odvodí sa automaticky. Vyplň, ak beží za reverznou proxy.',
  'Some requirements are not met – the installation may fail.':
    'Niektoré požiadavky nie sú splnené – inštalácia môže zlyhať.',
  'Done – {count} migrations were applied.':
    'Hotovo – spustených {count} migrácií.',
  'The installation failed.': 'Inštalácia zlyhala.',
  'MDcabinet is already installed': 'MDcabinet je už nainštalovaný',
  'The installer is locked for safety.':
    'Inštalátor je z bezpečnostných dôvodov uzamknutý.',
  'Go to the app': 'Prejsť do aplikácie',

  // ------------------------------------------------------------ database ---
  Database: 'Databáza',
  'The database schema is up to date.': 'Schéma databázy je aktuálna.',
  'There are migrations waiting to be applied. Until they run, parts of the app may fail.':
    'Čakajú nespustené migrácie. Kým neprebehnú, časti aplikácie môžu zlyhávať.',
  'Apply migrations': 'Spustiť migrácie',
  'Database updated – {count} migrations applied.':
    'Databáza aktualizovaná – spustených {count} migrácií.',
  'Applied so far: {count}': 'Spustených doteraz: {count}',

  // ---------------------------------------------------------------- misc ---
  'Changes saved.': 'Zmeny sú uložené.',
  'This page does not exist': 'Stránka neexistuje',
  'Check the address or go back to the overview.':
    'Skontroluj adresu alebo sa vráť na prehľad.',
  'The content is flagged as deleted in the database (not removed for good), but it disappears from the app.':
    'Obsah sa v databáze označí ako zmazaný (neodstráni sa natvrdo), z aplikácie ale zmizne.',

  // ------------------------------------------------------------- plurals ---
  '{count} cabinet': ['{count} skriňa', '{count} skrine', '{count} skríň'],
  '{count} document': ['{count} dokument', '{count} dokumenty', '{count} dokumentov'],
  '{count} word': ['{count} slovo', '{count} slová', '{count} slov'],
  '{count} result': ['{count} výsledok', '{count} výsledky', '{count} výsledkov'],
  '{count} doc': ['{count} dok.', '{count} dok.', '{count} dok.'],
  '{count} file uploaded.': [
    '{count} súbor nahratý.',
    '{count} súbory nahraté.',
    '{count} súborov nahratých.',
  ],
  'opened {count} time': [
    '{count}× otvorené',
    '{count}× otvorené',
    '{count}× otvorené',
  ],
}
