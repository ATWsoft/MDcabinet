<?php
/**
 * MDcabinet – diagnostika hostingu.
 *
 * Samostatný súbor, ktorý nepotrebuje nič z aplikácie – funguje aj vtedy,
 * keď je appka rozbitá. Nahraj ho vedľa index.php a otvor v prehliadači:
 *
 *     https://tvoja-domena.sk/mdcabinet-check.php
 *
 * Po vyriešení problému súbor ZMAŽ – vypisuje informácie o serveri.
 */

declare(strict_types=1);

header('Content-Type: text/html; charset=utf-8');

$root = __DIR__;

/** @return array{0:bool,1:string} */
function check(bool $ok, string $detail): array
{
    return [$ok, $detail];
}

$checks = [
    'PHP 8.1+' => check(PHP_VERSION_ID >= 80100, PHP_VERSION . ' (' . PHP_SAPI . ')'),
];

foreach (['pdo_mysql', 'mbstring', 'json', 'fileinfo'] as $extension) {
    $checks['Rozšírenie ' . $extension] = check(
        extension_loaded($extension),
        extension_loaded($extension) ? 'k dispozícii' : 'CHÝBA'
    );
}

$checks['Rozšírenie gd (voliteľné)'] = check(
    extension_loaded('gd'),
    extension_loaded('gd') ? 'k dispozícii' : 'chýba – appka funguje aj bez neho'
);

foreach (['index.php', 'app/bootstrap.php', 'database/migrations', 'assets/manifest.json'] as $needed) {
    $checks['Súbor ' . $needed] = check(
        file_exists($root . '/' . $needed),
        file_exists($root . '/' . $needed) ? 'nahratý' : 'CHÝBA – nenahral si celý balík?'
    );
}

foreach (['config', 'storage', 'storage/uploads', 'storage/logs'] as $directory) {
    $path = $root . '/' . $directory;
    $checks['Zapisovateľné ' . $directory . '/'] = check(
        is_dir($path) && is_writable($path),
        !is_dir($path) ? 'adresár neexistuje' : (is_writable($path) ? 'OK' : 'NIE – nastav práva 755 alebo 775')
    );
}

$checks['Konfigurácia config/config.php'] = check(
    is_file($root . '/config/config.php'),
    is_file($root . '/config/config.php') ? 'existuje (inštalácia už prebehla)' : 'zatiaľ nie je – to je pred inštaláciou v poriadku'
);

// mod_rewrite sa dá spoľahlivo overiť len na mod_php; inde to otestuje JavaScript nižšie.
$modules = function_exists('apache_get_modules') ? apache_get_modules() : null;
$checks['mod_rewrite (podľa Apache)'] = $modules === null
    ? check(true, 'nedá sa zistiť z PHP – pozri test nižšie')
    : check(in_array('mod_rewrite', $modules, true), in_array('mod_rewrite', $modules, true) ? 'zapnutý' : 'VYPNUTÝ');

$server = [
    'SCRIPT_NAME'     => $_SERVER['SCRIPT_NAME'] ?? '–',
    'REQUEST_URI'     => $_SERVER['REQUEST_URI'] ?? '–',
    'DOCUMENT_ROOT'   => $_SERVER['DOCUMENT_ROOT'] ?? '–',
    'Adresár skriptu' => $root,
    'SERVER_SOFTWARE' => $_SERVER['SERVER_SOFTWARE'] ?? '–',
    'HTTP_HOST'       => $_SERVER['HTTP_HOST'] ?? '–',
];

$failed = count(array_filter($checks, static fn (array $c) => !$c[0]));
$baseUrl = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
?>
<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MDcabinet – diagnostika</title>
<style>
  body { font: 15px/1.6 ui-sans-serif, system-ui, "Segoe UI", sans-serif; max-width: 52rem;
         margin: 3rem auto; padding: 0 1.25rem; color: #1f2430; background: #f6f7f9; }
  h1 { font-size: 1.4rem; margin-bottom: .25rem; }
  h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: .05em; color: #62718c;
       margin: 2rem 0 .75rem; }
  .card { background: #fff; border: 1px solid #d4d9e2; border-radius: .75rem; padding: 1rem 1.25rem; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: .4rem 0; vertical-align: top; border-bottom: 1px solid #eceef2; }
  td:first-child { width: 45%; }
  td:last-child { color: #62718c; }
  tr:last-child td { border-bottom: 0; }
  .ok::before { content: "✓"; color: #10b981; font-weight: 700; margin-right: .5rem; }
  .bad::before { content: "✗"; color: #ef4444; font-weight: 700; margin-right: .5rem; }
  code { background: #eceef2; padding: .1em .4em; border-radius: .25em; font-size: .9em;
         word-break: break-all; }
  .note { background: #fff8e6; border: 1px solid #f5d98a; border-radius: .75rem;
          padding: .9rem 1.1rem; margin-top: 1rem; }
  #routes div { padding: .35rem 0; }
</style>

<h1>MDcabinet – diagnostika hostingu</h1>
<p style="color:#62718c;margin-top:0">
  <?= $failed === 0 ? 'Všetky serverové kontroly prešli.' : "Neprešlo kontrol: {$failed}." ?>
  Po vyriešení problému tento súbor zmaž.
</p>

<h2>Prostredie</h2>
<div class="card">
  <table>
    <?php foreach ($checks as $label => [$ok, $detail]): ?>
      <tr>
        <td class="<?= $ok ? 'ok' : 'bad' ?>"><?= htmlspecialchars($label, ENT_QUOTES) ?></td>
        <td><?= htmlspecialchars($detail, ENT_QUOTES) ?></td>
      </tr>
    <?php endforeach; ?>
  </table>
</div>

<h2>Test smerovania</h2>
<div class="card">
  <p style="margin-top:0">
    MDcabinet potrebuje, aby aspoň jeden z týchto tvarov adries dorazil do <code>index.php</code>.
    Appka si funkčný režim vyberie sama.
  </p>
  <div id="routes">Testujem…</div>
</div>

<h2>Údaje o serveri</h2>
<div class="card">
  <table>
    <?php foreach ($server as $label => $value): ?>
      <tr>
        <td><?= htmlspecialchars($label, ENT_QUOTES) ?></td>
        <td><code><?= htmlspecialchars((string) $value, ENT_QUOTES) ?></code></td>
      </tr>
    <?php endforeach; ?>
  </table>
</div>

<div class="note">
  <strong>Ako to čítať:</strong> ak prejde <em>pekné adresy</em>, všetko je ideálne.
  Ak prejde len <em>PATH_INFO</em> alebo <em>query parameter</em>, appka bude fungovať tiež –
  len s mriežkou v adrese (<code>/#/dokument/5</code>). Ak neprejde ani jeden,
  problém je v <code>.htaccess</code> alebo v tom, že súbory nie sú v koreni webu.
</div>

<script>
  const base = <?= json_encode($baseUrl, JSON_UNESCAPED_SLASHES) ?>;

  const candidates = [
    ['Pekné adresy (mod_rewrite)', base + '/api/auth/me'],
    ['PATH_INFO', base + '/index.php/api/auth/me'],
    ['Query parameter', base + '/index.php?_route=/api/auth/me'],
  ];

  const box = document.getElementById('routes');
  box.textContent = '';

  (async () => {
    for (const [label, url] of candidates) {
      const row = document.createElement('div');
      row.textContent = label + ': testujem…';
      box.appendChild(row);

      let verdict;
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
        const text = await response.text();
        let json = null;
        try { json = JSON.parse(text); } catch (e) { /* nie je JSON */ }

        if (response.ok && json && 'csrf' in json) {
          verdict = ['ok', 'funguje'];
        } else if (json && json.message) {
          verdict = ['bad', 'HTTP ' + response.status + ' – ' + json.message];
        } else {
          verdict = ['bad', 'HTTP ' + response.status + ' – odpoveď nie je z MDcabinetu (chybová stránka hostingu)'];
        }
      } catch (error) {
        verdict = ['bad', 'požiadavka zlyhala: ' + error.message];
      }

      row.className = verdict[0];
      row.textContent = label + ' — ' + verdict[1];
      row.innerHTML = row.innerHTML + '<br><code>' + url + '</code>';
    }
  })();
</script>
