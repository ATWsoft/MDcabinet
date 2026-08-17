<?php
/**
 * MDcabinet – hosting diagnostics.
 *
 * A standalone file that needs nothing from the application, so it works even
 * when the app is broken. Upload it next to index.php and open it in a browser:
 *
 *     https://your-domain.com/mdcabinet-check.php
 *
 * DELETE it once the problem is solved – it prints information about the server.
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
    $checks['Extension ' . $extension] = check(
        extension_loaded($extension),
        extension_loaded($extension) ? 'available' : 'MISSING'
    );
}

$checks['Extension gd (optional)'] = check(
    extension_loaded('gd'),
    extension_loaded('gd') ? 'available' : 'missing – the app works without it'
);

foreach (['index.php', 'app/bootstrap.php', 'database/migrations', 'assets/manifest.json'] as $needed) {
    $checks['File ' . $needed] = check(
        file_exists($root . '/' . $needed),
        file_exists($root . '/' . $needed) ? 'uploaded' : 'MISSING – did you upload the whole bundle?'
    );
}

foreach (['config', 'storage', 'storage/uploads', 'storage/logs'] as $directory) {
    $path = $root . '/' . $directory;
    $checks['Writable ' . $directory . '/'] = check(
        is_dir($path) && is_writable($path),
        !is_dir($path)
            ? 'the directory does not exist'
            : (is_writable($path) ? 'OK' : 'NO – set the permissions to 755 or 775')
    );
}

$checks['Configuration config/config.php'] = check(
    is_file($root . '/config/config.php'),
    is_file($root . '/config/config.php')
        ? 'exists (the installation has already run)'
        : 'not there yet – which is fine before installing'
);

// mod_rewrite can only be checked reliably under mod_php; elsewhere the
// JavaScript test below answers the question.
$modules = function_exists('apache_get_modules') ? apache_get_modules() : null;
$checks['mod_rewrite (according to Apache)'] = $modules === null
    ? check(true, 'cannot be determined from PHP – see the test below')
    : check(in_array('mod_rewrite', $modules, true), in_array('mod_rewrite', $modules, true) ? 'enabled' : 'DISABLED');

/**
 * Migration status. Read directly through PDO so this page keeps working even
 * when the application itself is broken.
 *
 * @return array{ok:bool,detail:string,pending:list<string>}
 */
function migrationStatus(string $root): array
{
    $configFile = $root . '/config/config.php';

    // config/config.php first, MDC_* environment variables second (docker).
    if (is_file($configFile)) {
        /** @var array<string,mixed> $config */
        $config = require $configFile;
        $db = is_array($config['db'] ?? null) ? $config['db'] : [];
    } elseif (getenv('MDC_DB_NAME') !== false) {
        $db = [
            'host' => getenv('MDC_DB_HOST') ?: 'localhost',
            'port' => (int) (getenv('MDC_DB_PORT') ?: 3306),
            'name' => getenv('MDC_DB_NAME'),
            'user' => getenv('MDC_DB_USER') ?: '',
            'pass' => getenv('MDC_DB_PASS') ?: '',
        ];
    } else {
        return ['ok' => false, 'detail' => 'config/config.php does not exist yet', 'pending' => []];
    }

    $available = [];
    foreach (glob($root . '/database/migrations/*.sql') ?: [] as $file) {
        $available[] = basename($file);
    }
    sort($available, SORT_NATURAL);

    if ($available === []) {
        return [
            'ok' => false,
            'detail' => 'database/migrations/ is empty – did you upload the directory?',
            'pending' => [],
        ];
    }

    try {
        $pdo = new PDO(
            sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                (string) ($db['host'] ?? 'localhost'),
                (int) ($db['port'] ?? 3306),
                (string) ($db['name'] ?? '')
            ),
            (string) ($db['user'] ?? ''),
            (string) ($db['pass'] ?? ''),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );

        $applied = $pdo->query('SELECT `migration` FROM `migrations`')->fetchAll(PDO::FETCH_COLUMN) ?: [];
    } catch (Throwable $e) {
        return ['ok' => false, 'detail' => 'cannot be read: ' . $e->getMessage(), 'pending' => []];
    }

    $pending = array_values(array_diff($available, $applied));

    return [
        'ok' => $pending === [],
        'detail' => $pending === []
            ? sprintf('all %d migrations applied', count($available))
            : sprintf('%d waiting: %s', count($pending), implode(', ', $pending)),
        'pending' => $pending,
    ];
}

$migrations = migrationStatus($root);
$checks['Database migrations'] = check($migrations['ok'], $migrations['detail']);

// Last log entries – usually the fastest way to explain a bare 500.
$logEntries = '';
$logFiles = glob($root . '/storage/logs/app-*.log') ?: [];
if ($logFiles !== []) {
    sort($logFiles);
    $newest = end($logFiles);
    $lines = @file($newest, FILE_IGNORE_NEW_LINES) ?: [];
    $logEntries = implode("\n", array_slice($lines, -40));
    $logLabel = basename((string) $newest);
} else {
    $logLabel = '';
}

$server = [
    'SCRIPT_NAME'      => $_SERVER['SCRIPT_NAME'] ?? '-',
    'REQUEST_URI'      => $_SERVER['REQUEST_URI'] ?? '-',
    'DOCUMENT_ROOT'    => $_SERVER['DOCUMENT_ROOT'] ?? '-',
    'Script directory' => $root,
    'SERVER_SOFTWARE'  => $_SERVER['SERVER_SOFTWARE'] ?? '-',
    'HTTP_HOST'        => $_SERVER['HTTP_HOST'] ?? '-',
];

$failed = count(array_filter($checks, static fn (array $c) => !$c[0]));
$baseUrl = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
?>
<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MDcabinet – diagnostics</title>
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
  .ok::before { content: "\2713"; color: #10b981; font-weight: 700; margin-right: .5rem; }
  .bad::before { content: "\2717"; color: #ef4444; font-weight: 700; margin-right: .5rem; }
  code { background: #eceef2; padding: .1em .4em; border-radius: .25em; font-size: .9em;
         word-break: break-all; }
  .note { background: #fff8e6; border: 1px solid #f5d98a; border-radius: .75rem;
          padding: .9rem 1.1rem; margin-top: 1rem; }
  #routes div { padding: .35rem 0; }
</style>

<h1>MDcabinet – hosting diagnostics</h1>
<p style="color:#62718c;margin-top:0">
  <?= $failed === 0 ? 'All server-side checks passed.' : "Checks failed: {$failed}." ?>
  Delete this file once the problem is solved.
</p>

<h2>Environment</h2>
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

<h2>Routing test</h2>
<div class="card">
  <p style="margin-top:0">
    MDcabinet needs at least one of these URL shapes to reach <code>index.php</code>.
    The app picks a working mode by itself.
  </p>
  <div id="routes">Testing…</div>
</div>

<?php if ($logEntries !== ''): ?>
  <h2>Last log entries (<?= htmlspecialchars($logLabel, ENT_QUOTES) ?>)</h2>
  <div class="card">
    <pre style="margin:0;overflow:auto;max-height:22rem;font-size:.8rem;line-height:1.45"><?=
      htmlspecialchars($logEntries, ENT_QUOTES)
    ?></pre>
  </div>
<?php endif; ?>

<h2>Server details</h2>
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
  <strong>How to read this:</strong> if <em>pretty URLs</em> passes, everything is ideal.
  If only <em>PATH_INFO</em> or <em>query parameter</em> passes, the app still works –
  the address just carries a hash (<code>/#/documents/5</code>). If none of them
  passes, the problem is in <code>.htaccess</code> or the files are not in the web root.
</div>

<script>
  const base = <?= json_encode($baseUrl, JSON_UNESCAPED_SLASHES) ?>;

  const candidates = [
    ['Pretty URLs (mod_rewrite)', base + '/api/auth/me'],
    ['PATH_INFO', base + '/index.php/api/auth/me'],
    ['Query parameter', base + '/index.php?_route=/api/auth/me'],
  ];

  const box = document.getElementById('routes');
  box.textContent = '';

  (async () => {
    for (const [label, url] of candidates) {
      const row = document.createElement('div');
      row.textContent = label + ': testing…';
      box.appendChild(row);

      let verdict;
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
        const text = await response.text();
        let json = null;
        try { json = JSON.parse(text); } catch (e) { /* not JSON */ }

        if (response.ok && json && 'csrf' in json) {
          verdict = ['ok', 'works'];
        } else if (json && json.message) {
          verdict = ['bad', 'HTTP ' + response.status + ' - ' + json.message];
        } else {
          verdict = ['bad', 'HTTP ' + response.status + ' - the response is not from MDcabinet (hosting error page)'];
        }
      } catch (error) {
        verdict = ['bad', 'the request failed: ' + error.message];
      }

      row.className = verdict[0];
      row.textContent = label + ' - ' + verdict[1];
      row.innerHTML = row.innerHTML + '<br><code>' + url + '</code>';
    }
  })();
</script>
