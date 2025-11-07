<?php
// Simple PHP API front controller mirroring the Node server's routes

declare(strict_types=1);

// Load environment (.env at repo root)
$root = dirname(__DIR__, 2);
$env = [];
$envPath = $root . DIRECTORY_SEPARATOR . '.env';
if (file_exists($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $env[trim($parts[0])] = trim($parts[1]);
        }
    }
}

require_once __DIR__ . '/../src/Response.php';
require_once __DIR__ . '/../src/Db.php';
require_once __DIR__ . '/../src/Jwt.php';
require_once __DIR__ . '/../src/Portal.php';
require_once __DIR__ . '/../src/Network.php';
require_once __DIR__ . '/../src/Backup.php';

use Sulit\Response;
use Sulit\Db;
use Sulit\Jwt;
use Sulit\Portal;
use Sulit\Network;
use Sulit\Backup;

header('Content-Type: application/json');

// CORS (if needed)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    http_response_code(204);
    exit;
}
header('Access-Control-Allow-Origin: *');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = $_SERVER['REQUEST_URI'] ?? '/';

// Strip query string
if (($qpos = strpos($uri, '?')) !== false) {
    $uri = substr($uri, 0, $qpos);
}

// Parse JSON body
$input = null;
if (in_array($method, ['POST', 'PUT', 'PATCH'])) {
    $raw = file_get_contents('php://input');
    if ($raw !== false && strlen($raw) > 0) {
        $input = json_decode($raw, true);
    }
}

// Initialize services
$jwtSecret = $env['JWT_SECRET'] ?? 'a-very-secret-key-that-should-be-in-env';
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
    Response::json(['error' => 'Database init failed: ' . $e->getMessage()], 500);
}

$portal = new Portal($db);
$network = new Network();
$backup = new Backup($db, $env);
$jwt = new Jwt($jwtSecret);

// Auth middleware
$requireAuth = function () use ($jwt) {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($auth, 'Bearer ')) {
        Response::json(['error' => 'Unauthorized: No token provided'], 401);
    }
    $token = substr($auth, 7);
    $payload = $jwt->verify($token);
    if ($payload === null) {
        Response::json(['error' => 'Forbidden: Invalid token'], 403);
    }
    return $payload;
};

// Routing
switch (true) {
    // Public/Portal Routes
    case $method === 'GET' && $uri === '/api/settings/public':
        $networkConfig = $db->getSetting('networkConfig');
        $portalSettings = $db->getSetting('portalSettings');
        Response::json([
            'ssid' => $networkConfig['ssid'] ?? 'SULIT WIFI',
            'coinSlotEnabled' => $portalSettings['coinSlotEnabled'] ?? true,
        ]);
        break;

    case $method === 'POST' && $uri === '/api/connect/voucher':
        Response::json(['error' => 'Voucher connection not implemented yet'], 501);
        break;

    case $method === 'POST' && $uri === '/api/connect/coin':
        $settings = $db->getSetting('portalSettings');
        $durationMins = $settings['coinPulseValue'] ?? 15;
        Response::json(['remainingTime' => $durationMins * 60]);
        break;

    // Admin Login
    case $method === 'POST' && $uri === '/api/admin/login':
        $password = $input['password'] ?? '';
        $storedHash = $db->getSetting('adminPassword');
        if (!$storedHash || !is_string($storedHash)) {
            Response::json(['error' => 'Admin password not set.'], 500);
        }
        if (password_verify($password, $storedHash)) {
            $token = $jwt->sign(['user' => 'admin', 'exp' => time() + 8 * 3600]);
            Response::json(['token' => $token]);
        } else {
            Response::json(['error' => 'Invalid password'], 401);
        }
        break;

    // --- Authenticated Admin Routes ---
    case $method === 'GET' && $uri === '/api/admin/stats':
        $requireAuth();
        $activeSessions = 0; // placeholder
        $used = $db->getUsedVoucherCount();
        $available = $db->getAvailableVoucherCount();
        Response::json(['activeSessions' => $activeSessions, 'totalVouchersUsed' => $used, 'totalVouchersAvailable' => $available]);
        break;

    case $method === 'GET' && $uri === '/api/admin/system-info':
        $requireAuth();
        Response::json($network->systemInfo());
        break;

    case $method === 'GET' && $uri === '/api/admin/vouchers':
        $requireAuth();
        Response::json($db->getAvailableVouchers());
        break;

    case $method === 'POST' && $uri === '/api/admin/vouchers':
        $requireAuth();
        $duration = (int)($input['duration'] ?? 0);
        if ($duration <= 0) Response::json(['error' => 'Invalid duration'], 400);
        $voucher = $db->createVoucher($duration);
        Response::json($voucher, 201);
        break;

    // Settings
    case $method === 'GET' && $uri === '/api/admin/settings/portal':
        $requireAuth();
        Response::json($db->getSetting('portalSettings'));
        break;

    case $method === 'POST' && $uri === '/api/admin/settings/portal':
        $requireAuth();
        $adminPassword = $input['adminPassword'] ?? null;
        $portalSettings = $input;
        unset($portalSettings['adminPassword']);
        $db->updateSetting('portalSettings', $portalSettings);
        if ($adminPassword) {
            // bcrypt hash
            $hash = password_hash($adminPassword, PASSWORD_BCRYPT, ['cost' => 10]);
            $db->updateSetting('adminPassword', $hash);
        }
        Response::json(['message' => 'Portal settings updated successfully.']);
        break;

    case $method === 'GET' && $uri === '/api/admin/settings/gpio':
        $requireAuth();
        Response::json($db->getSetting('gpioConfig'));
        break;

    case $method === 'POST' && $uri === '/api/admin/settings/gpio':
        $requireAuth();
        $db->updateSetting('gpioConfig', $input ?? []);
        // GPIO re-init will be handled by a future PHP GPIO module
        Response::json(['message' => 'GPIO settings applied successfully.']);
        break;

    // Network
    case $method === 'GET' && $uri === '/api/admin/network/config':
        $requireAuth();
        Response::json($db->getSetting('networkConfig'));
        break;

    case $method === 'POST' && $uri === '/api/admin/network/config':
        $requireAuth();
        $db->updateSetting('networkConfig', $input ?? []);
        Response::json(['message' => 'Network settings saved. Applying them requires a manual restart of networking services.']);
        break;

    case $method === 'GET' && $uri === '/api/admin/network/info':
        $requireAuth();
        Response::json($network->interfaces());
        break;

    case $method === 'GET' && $uri === '/api/admin/network/wan':
        $requireAuth();
        Response::json(['name' => $network->defaultGateway() ?? 'eth0']);
        break;

    // Backups
    case $method === 'GET' && $uri === '/api/admin/backups':
        $requireAuth();
        Response::json($backup->listBackups());
        break;

    // Portal Editor
    case $method === 'GET' && $uri === '/api/admin/portal/html':
        $requireAuth();
        $html = $db->getSetting('portalHtml');
        $htmlStr = is_string($html) ? $html : Portal::DEFAULT_HTML;
        Response::json(['html' => $htmlStr]);
        break;

    case $method === 'POST' && $uri === '/api/admin/portal/html':
        $requireAuth();
        $html = $input['html'] ?? null;
        if (!is_string($html)) Response::json(['error' => 'Invalid HTML content provided.'], 400);
        $db->updateSetting('portalHtml', $html);
        Response::json(['message' => 'Portal HTML saved successfully.']);
        break;

    case $method === 'POST' && $uri === '/api/admin/portal/reset':
        $requireAuth();
        $db->updateSetting('portalHtml', Portal::DEFAULT_HTML);
        Response::json(['message' => 'Portal has been reset to default.', 'html' => Portal::DEFAULT_HTML]);
        break;

    case $method === 'POST' && $uri === '/api/admin/backups':
        $requireAuth();
        Response::json(['message' => $backup->createBackup()], 200);
        break;

    case $method === 'DELETE' && $uri === '/api/admin/backups':
        $requireAuth();
        $filename = $input['filename'] ?? '';
        if (!$filename) Response::json(['error' => 'filename required'], 400);
        $backup->deleteBackup($filename);
        Response::json(['message' => 'Backup deleted.']);
        break;

    case $method === 'POST' && $uri === '/api/admin/backups/restore':
        $requireAuth();
        $filename = $input['filename'] ?? '';
        if (!$filename) Response::json(['error' => 'filename required'], 400);
        $backup->restoreBackup($filename);
        Response::json(['message' => 'Restore successful! Server restart required.']);
        break;

    // Updater (placeholder)
    case $method === 'GET' && $uri === '/api/admin/updater/status':
        $requireAuth();
        Response::json(['statusText' => 'Updater not implemented in PHP yet.', 'isUpdateAvailable' => false]);
        break;

    case $method === 'POST' && $uri === '/api/admin/updater/start':
        $requireAuth();
        Response::json(['message' => 'Updater not implemented in PHP yet.']);
        break;

    default:
        Response::json(['error' => 'Not Found'], 404);
        break;
}