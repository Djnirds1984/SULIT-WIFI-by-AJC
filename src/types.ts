export interface Session {
    voucherCode: string;
    startTime: number;
    duration: number;
    remainingTime: number;
}

export interface PublicSettings {
    ssid: string;
    geminiApiKey?: string | null;
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

export interface NetworkInterface {
    name: string;
    status: string;
    ip4: string | null;
    ip6: string | null;
}

export interface Voucher {
    code: string;
    duration: number;
}

export interface NetworkConfig {
    hotspotInterface: string;
    hotspotIpAddress: string;
    hotspotDhcpServer: {
        enabled: boolean;
        start: string;
        end: string;
        lease: string;
    };
}

export interface UpdaterStatus {
    isUpdateAvailable: boolean;
    statusText: string;
    localCommit: string;
    remoteCommit?: string;
}