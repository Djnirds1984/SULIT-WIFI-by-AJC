export interface Session {
    remainingTime: number;
}

export interface AdminStats {
    activeSessions: number;
    totalVouchersUsed: number;
    totalVouchersAvailable: number;
}

export interface SystemInfo {
    cpu: {
        model: string;
        cores: number;
    };
    ram: {
        totalMb: number;
        usedMb: number;
    };
    disk: {
        totalMb: number;
        usedMb: number;
    };
}

export interface Voucher {
    code: string;
    duration: number; // in seconds
    isUsed: boolean;
}

export interface UpdaterStatus {
    statusText: string;
    localCommit: string;
    remoteCommit: string | null;
    isUpdateAvailable: boolean;
}

export interface NetworkInterface {
    name: string;
    ip4: string | null;
    status: 'UP' | 'DOWN' | 'UNKNOWN';
}

export interface NetworkConfig {
    hotspotInterface: string;
    ssid: string;
    security: 'open' | 'wpa2';
    password?: string;
    hotspotIpAddress: string;
    hotspotDhcpServer: {
        enabled: boolean;
        start: string;
        end: string;
        lease: string;
    };
}

// FIX: Removed geminiApiKey as per guideline to use environment variables.
export interface Settings {
    adminPassword?: string; // Optional for update payload
    ssid?: string;
}
