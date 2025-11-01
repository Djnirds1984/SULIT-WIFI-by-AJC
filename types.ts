export interface WifiSession {
  remainingTime: number; // in seconds
  dataUsage?: {
    used: number; // in MB
    total: number; // in MB
  };
}

export interface AdminDashboardStats {
  activeSessions: number;
  totalVouchersUsed: number;
  totalVouchersAvailable: number;
}
