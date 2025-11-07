#!/usr/bin/env php
<?php
// GPIO daemon: monitors coin pin via libgpiod and triggers handlers

declare(strict_types=1);

// Load env from project root
$root = dirname(__DIR__, 2);
$env = [];
$envPath = $root . DIRECTORY_SEPARATOR . '.env';
if (file_exists($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) $env[trim($parts[0])] = trim($parts[1]);
    }
}

require_once __DIR__ . '/../src/Db.php';
require_once __DIR__ . '/../src/Portal.php';

use Sulit\Db;
use Sulit\Portal;

function logmsg(string $msg): void {
    fwrite(STDOUT, '[' . date('c') . "] GPIOD: $msg\n");
}

function which(string $cmd): ?string {
    $out = shell_exec('command -v ' . escapeshellarg($cmd));
    return $out ? trim($out) : null;
}

// Init DB
$db = new Db([
    'host' => $env['PGHOST'] ?? 'localhost',
    'port' => (int)($env['PGPORT'] ?? 5432),
    'dbname' => $env['PGDATABASE'] ?? 'sulitwifi',
    'user' => $env['PGUSER'] ?? 'sulituser',
    'password' => $env['PGPASSWORD'] ?? '',
]);

try {
    $db->connect();
    $db->initSchema();
} catch (Throwable $e) {
    logmsg('DB init failed: ' . $e->getMessage());
    exit(1);
}

$cfg = $db->getSetting('gpioConfig') ?? [
    'coinPin' => 17,
    'coinSlotActiveLow' => true,
];

$coinPin = (int)($cfg['coinPin'] ?? 17);
$activeLow = !!($cfg['coinSlotActiveLow'] ?? true);
$chipIndex = (int)($env['GPIO_CHIP_INDEX'] ?? 0);
$chipName = 'gpiochip' . $chipIndex;

logmsg("Starting coin monitor on {$chipName} line {$coinPin} (activeLow=" . ($activeLow ? 'true' : 'false') . ")");

// Handler: called when a coin pulse is detected
function handleCoinPulse(Db $db): void {
    // Record last pulse time and increment a counter
    $state = $db->getSetting('coinPulseState') ?? ['count' => 0, 'lastAt' => null];
    $state['count'] = (int)($state['count'] ?? 0) + 1;
    $state['lastAt'] = date('c');
    $db->updateSetting('coinPulseState', $state);
    // Optionally poke the API to trigger time credit logic
    $url = 'http://localhost:3001/api/connect/coin';
    $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => 'Content-Type: application/json', 'content' => json_encode([]), 'timeout' => 1]]);
    @file_get_contents($url, false, $ctx);
    logmsg('Coin pulse handled: count=' . $state['count']);
}

$gpiomon = which('gpiomon');
$gpioget = which('gpioget');

if ($gpiomon) {
    // Prefer event-driven monitoring
    $edgeFlag = $activeLow ? '-f' : '-r';
    $cmd = sprintf('%s %s %s %d', $gpiomon, $edgeFlag, escapeshellarg($chipName), $coinPin);
    logmsg('Executing: ' . $cmd);

    $desc = [ 0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w'] ];
    $proc = proc_open($cmd, $desc, $pipes);
    if (!is_resource($proc)) {
        logmsg('Failed to start gpiomon.');
        exit(1);
    }

    // Software debounce in milliseconds
    $debounceMs = 120;
    $lastMs = 0;

    while (true) {
        $line = fgets($pipes[1]);
        if ($line === false) {
            // If gpiomon ends, try to restart
            $status = proc_get_status($proc);
            if (!$status['running']) {
                logmsg('gpiomon exited, restarting in 1s...');
                sleep(1);
                $proc = proc_open($cmd, $desc, $pipes);
                if (!is_resource($proc)) {
                    logmsg('Failed to restart gpiomon.');
                    break;
                }
                continue;
            }
            usleep(50000);
            continue;
        }
        $nowMs = (int)(microtime(true) * 1000);
        if (($nowMs - $lastMs) < $debounceMs) {
            continue;
        }
        $lastMs = $nowMs;
        handleCoinPulse($db);
    }
} elseif ($gpioget) {
    // Fallback: polling using gpioget
    logmsg('gpiomon not found, falling back to polling via gpioget');
    $prev = null; $debounceMs = 120; $lastMs = 0;
    while (true) {
        $cmd = sprintf('%s %s %d', $gpioget, escapeshellarg($chipName), $coinPin);
        $out = shell_exec($cmd);
        $val = null;
        if ($out !== null) {
            $trim = trim($out);
            // gpioget outputs 0 or 1
            $val = ($trim === '1') ? 1 : 0;
        }
        if ($val !== null) {
            $isActivePulse = $activeLow ? ($val === 0) : ($val === 1);
            if ($prev !== null && $isActivePulse && $prev !== $val) {
                $nowMs = (int)(microtime(true) * 1000);
                if (($nowMs - $lastMs) >= $debounceMs) {
                    $lastMs = $nowMs;
                    handleCoinPulse($db);
                }
            }
            $prev = $val;
        }
        usleep(5000); // 5ms poll
    }
} else {
    logmsg('Neither gpiomon nor gpioget found. Please install libgpiod tools: sudo apt-get install -y gpiod libgpiod2');
    exit(1);
}