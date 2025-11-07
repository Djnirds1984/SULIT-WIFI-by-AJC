<?php
// PHP built-in server router: serve SPA from /public and route /api/* to PHP backend
declare(strict_types=1);

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$docroot = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/');

// Route API requests to PHP backend controller
if (str_starts_with($uri, '/api/')) {
    require __DIR__ . '/public/index.php';
    exit;
}

// If the requested file exists in docroot, let the server serve it
$file = $docroot . $uri;
if ($uri !== '/' && is_file($file)) {
    return false; // Serve the requested resource as-is.
}

// SPA fallback: always serve index.html for non-API routes
header('Content-Type: text/html; charset=utf-8');
readfile($docroot . '/index.html');
exit;