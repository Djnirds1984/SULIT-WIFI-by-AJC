
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
        usedMb: number;
        totalMb: number;
    };
    disk: {
        usedMb: number;
        totalMb: number;
    };
}

export interface Voucher {
    code: string;
    duration: number; // in seconds
    is_used: boolean;
    created_at: string;
}

export interface UpdaterStatus {
    statusText: string;
    isUpdateAvailable: boolean;
    localCommit: string;
    remoteCommit: string | null;
}

export interface NetworkInterface {
    name: string;
    ip4: string;
    status: string;
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

export interface PortalSettings {
    adminPassword?: string; // Only used for sending, not receiving
    coinSlotEnabled: boolean;
    coinPulseValue: number; // e.g. minutes per coin
    portalTitle: string;
}

export interface GpioConfig {
    coinPin: number;
    relayPin: number;
    statusLedPin: number;
    coinSlotActiveLow: boolean;
}
