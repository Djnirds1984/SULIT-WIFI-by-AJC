<?php
namespace Sulit;

use PDO;
use PDOException;

class Db
{
    private PDO $pdo;
    private array $cfg;

    public function __construct(array $cfg)
    {
        $this->cfg = $cfg;
    }

    public function connect(): void
    {
        $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s', $this->cfg['host'], $this->cfg['port'], $this->cfg['dbname']);
        $this->pdo = new PDO($dsn, $this->cfg['user'], $this->cfg['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
    }

    public function initSchema(): void
    {
        $sql = <<<SQL
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value JSONB
        );
        CREATE TABLE IF NOT EXISTS vouchers (
            id SERIAL PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            duration INTEGER NOT NULL,
            type TEXT DEFAULT 'VOUCHER',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            is_used BOOLEAN DEFAULT FALSE
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id SERIAL PRIMARY KEY,
            mac_address TEXT UNIQUE NOT NULL,
            start_time TIMESTAMP WITH TIME ZONE NOT NULL,
            end_time TIMESTAMP WITH TIME ZONE NOT NULL,
            voucher_code TEXT
        );
        SQL;
        $this->pdo->exec($sql);

        // Seed defaults
        $adminPassword = $this->getSetting('adminPassword');
        if ($adminPassword === null) {
            $hash = password_hash('admin', PASSWORD_BCRYPT, ['cost' => 10]);
            $this->updateSetting('adminPassword', $hash);
            $this->updateSetting('portalSettings', [
                'portalTitle' => 'SULIT WIFI Portal',
                'coinSlotEnabled' => true,
                'coinPulseValue' => 15,
            ]);
            $this->updateSetting('networkConfig', [
                'hotspotInterface' => 'wlan0',
                'ssid' => 'SULIT WIFI Hotspot',
                'security' => 'open',
                'password' => '',
                'hotspotIpAddress' => '192.168.10.1',
                'hotspotDhcpServer' => [
                    'enabled' => true,
                    'start' => '192.168.10.100',
                    'end' => '192.168.10.200',
                    'lease' => '12h'
                ]
            ]);
            $this->updateSetting('gpioConfig', [
                'coinPin' => 17,
                'relayPin' => 0,
                'statusLedPin' => 0,
                'coinSlotActiveLow' => true,
            ]);
            $this->updateSetting('portalHtml', Portal::DEFAULT_HTML);
        }
    }

    public function getSetting(string $key)
    {
        $stmt = $this->pdo->prepare('SELECT value FROM settings WHERE key = :key');
        $stmt->execute([':key' => $key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;
        return json_decode($row['value'], true);
    }

    public function updateSetting(string $key, $value): void
    {
        $json = json_encode($value);
        $sql = 'INSERT INTO settings (key, value) VALUES (:key, CAST(:value AS JSONB)) ON CONFLICT (key) DO UPDATE SET value = CAST(:value AS JSONB)';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':key' => $key, ':value' => $json]);
    }

    public function createVoucher(int $duration, string $type = 'VOUCHER'): array
    {
        $code = 'SULIT-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
        $stmt = $this->pdo->prepare('INSERT INTO vouchers (code, duration, type) VALUES (:code, :duration, :type) RETURNING id, code, duration, type, created_at');
        $stmt->execute([':code' => $code, ':duration' => $duration, ':type' => $type]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getAvailableVouchers(): array
    {
        $stmt = $this->pdo->query('SELECT code, duration FROM vouchers WHERE is_used = FALSE ORDER BY created_at DESC');
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getUsedVoucherCount(): int
    {
        $stmt = $this->pdo->query('SELECT COUNT(*) AS c FROM vouchers WHERE is_used = TRUE');
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int)$row['c'];
    }

    public function getAvailableVoucherCount(): int
    {
        $stmt = $this->pdo->query('SELECT COUNT(*) AS c FROM vouchers WHERE is_used = FALSE');
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int)$row['c'];
    }
}