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
