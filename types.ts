// FIX: Created type definitions to resolve module import errors across the application.
export interface WifiSession {
  sessionId: string;
  remainingTime: number; // in seconds
}

export interface AdminDashboardStats {
  activeSessions: number;
  totalVouchersUsed: number;
  totalVouchersAvailable: number;
}
