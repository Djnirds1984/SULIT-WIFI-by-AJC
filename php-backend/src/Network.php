<?php
namespace Sulit;

class Network
{
    public function systemInfo(): array
    {
        $cpuModel = 'Unknown';
        $cpuCores = 0;
        if (is_readable('/proc/cpuinfo')) {
            $data = file_get_contents('/proc/cpuinfo');
            if ($data !== false) {
                if (preg_match('/model name\s*:\s*(.+)/', $data, $m)) $cpuModel = trim($m[1]);
                $cpuCores = substr_count($data, "\nprocessor\t:");
            }
        }

        $memTotalMb = 0; $memAvailMb = 0;
        if (is_readable('/proc/meminfo')) {
            $mem = file('/proc/meminfo');
            foreach ($mem as $line) {
                if (str_starts_with($line, 'MemTotal')) $memTotalMb = (int)filter_var($line, FILTER_SANITIZE_NUMBER_INT) / 1024;
                if (str_starts_with($line, 'MemAvailable')) $memAvailMb = (int)filter_var($line, FILTER_SANITIZE_NUMBER_INT) / 1024;
            }
        }

        $diskUsedMb = 0; $diskTotalMb = 0;
        $out = shell_exec('df -P --block-size=1M /');
        if ($out) {
            $lines = explode("\n", trim($out));
            if (count($lines) >= 2) {
                $cols = preg_split('/\s+/', $lines[1]);
                if (count($cols) >= 3) {
                    $diskTotalMb = (int)$cols[1];
                    $diskUsedMb = (int)$cols[2];
                }
            }
        }

        return [
            'cpu' => ['model' => $cpuModel, 'cores' => $cpuCores],
            'ram' => ['usedMb' => max(0, (int)($memTotalMb - $memAvailMb)), 'totalMb' => (int)$memTotalMb],
            'disk' => ['usedMb' => (int)$diskUsedMb, 'totalMb' => (int)$diskTotalMb],
        ];
    }

    public function interfaces(): array
    {
        $out = shell_exec('ip -j address');
        if (!$out) return [];
        $json = json_decode($out, true);
        $res = [];
        foreach ($json as $iface) {
            $name = $iface['ifname'] ?? 'unknown';
            $oper = $iface['operstate'] ?? 'unknown';
            $ip4 = null;
            foreach (($iface['addr_info'] ?? []) as $addr) {
                if (($addr['family'] ?? '') === 'inet') { $ip4 = $addr['local'] ?? null; break; }
            }
            $res[] = ['name' => $name, 'ip4' => $ip4, 'status' => $oper];
        }
        return $res;
    }

    public function defaultGateway(): ?string
    {
        $out = shell_exec('ip route show default');
        if (!$out) return null;
        $line = trim(explode("\n", trim($out))[0] ?? '');
        if ($line === '') return null;
        // default via 192.168.1.1 dev eth0
        $parts = preg_split('/\s+/', $line);
        $idx = array_search('dev', $parts, true);
        if ($idx !== false && isset($parts[$idx+1])) return $parts[$idx+1];
        return null;
    }
}