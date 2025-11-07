<?php
namespace Sulit;

class Backup
{
    private Db $db;
    private array $env;
    private string $root;

    public function __construct(Db $db, array $env)
    {
        $this->db = $db;
        $this->env = $env;
        $this->root = dirname(__DIR__, 2);
    }

    private function backupDir(): string
    {
        return $this->root . DIRECTORY_SEPARATOR . 'backups';
    }

    public function listBackups(): array
    {
        $dir = $this->backupDir();
        if (!is_dir($dir)) return [];
        $files = scandir($dir) ?: [];
        return array_values(array_filter($files, fn($f) => str_ends_with($f, '.backup')));
    }

    public function createBackup(): string
    {
        $dir = $this->backupDir();
        if (!is_dir($dir)) mkdir($dir, 0775, true);
        $timestamp = str_replace(':', '-', date('c'));
        $filename = "sulitwifi_backup_{$timestamp}.backup";
        $filepath = $dir . DIRECTORY_SEPARATOR . $filename;

        $pgUser = $this->env['PGUSER'] ?? 'sulituser';
        $pgDb = $this->env['PGDATABASE'] ?? 'sulitwifi';
        $cmd = sprintf('pg_dump -U %s -d %s -F c -b -v -f %s', escapeshellarg($pgUser), escapeshellarg($pgDb), escapeshellarg($filepath));

        $env = array_merge($_ENV, $_SERVER, getenv(), [ 'PGPASSWORD' => ($this->env['PGPASSWORD'] ?? '') ]);
        $this->run($cmd, $env);
        return "Backup created successfully: {$filename}";
    }

    public function deleteBackup(string $filename): void
    {
        $filepath = $this->backupDir() . DIRECTORY_SEPARATOR . basename($filename);
        if (is_file($filepath)) unlink($filepath);
    }

    public function restoreBackup(string $filename): void
    {
        $filepath = $this->backupDir() . DIRECTORY_SEPARATOR . basename($filename);
        if (!is_file($filepath)) throw new \RuntimeException('Backup file not found.');

        $pgUser = $this->env['PGUSER'] ?? 'sulituser';
        $pgDb = $this->env['PGDATABASE'] ?? 'sulitwifi';
        $cmd = sprintf('pg_restore -U %s -d %s -v %s', escapeshellarg($pgUser), escapeshellarg($pgDb), escapeshellarg($filepath));

        $env = array_merge($_ENV, $_SERVER, getenv(), [ 'PGPASSWORD' => ($this->env['PGPASSWORD'] ?? '') ]);
        $this->run($cmd, $env);
    }

    private function run(string $cmd, array $env): void
    {
        // Best-effort execution
        $descriptorspec = [ 1 => ['pipe', 'w'], 2 => ['pipe', 'w'] ];
        $proc = proc_open($cmd, $descriptorspec, $pipes, $this->root, $env);
        if (!is_resource($proc)) throw new \RuntimeException('Failed to start process');
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        foreach ($pipes as $p) fclose($p);
        $code = proc_close($proc);
        if ($code !== 0) {
            throw new \RuntimeException('Command failed: ' . $stderr);
        }
    }
}