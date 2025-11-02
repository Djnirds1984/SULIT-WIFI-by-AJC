// FIX: Defined shared TypeScript types for the application.
export interface WifiSession {
  voucherCode: string;
  startTime: number;
  duration: number;
  remainingTime: number;
}

export interface AdminDashboardStats {
  activeSessions: number;
  totalVouchersUsed: number;
  totalVouchersAvailable: number;
}

export interface NetworkSettings {
  ssid: string;
}

export interface Voucher {
  code: string;
  duration: number; // in seconds
  used: boolean;
}

export interface CpuInfo {
    model: string;
    cores: number;
}

export interface ResourceUsage {
    totalMb: number;
    usedMb: number;
}

export interface SystemInfo {
    cpu: CpuInfo;
    ram: ResourceUsage;
    disk: ResourceUsage;
}

export interface NetworkInterface {
  name: string;
  status: string;
  ip4: string | null;
  ip6: string | null;
}

export type NetworkInfo = NetworkInterface[];

export interface UpdaterStatus {
  isUpdateAvailable: boolean;
  localCommit: string;
  remoteCommit: string;
  commitMessage: string;
  statusText: string;
  backupFile?: string;
  backupDate?: string;
}