// FIX: Created a mock in-memory database for the backend.
import { WifiSession, Voucher, NetworkSettings } from '../types';

interface Database {
  vouchers: Map<string, Voucher>;
  sessions: Map<string, WifiSession>; // using a key to identify current user's session
  settings: NetworkSettings;
  admin: {
      passwordHash: string; // In a real app, use bcrypt
      sessionToken: string | null;
  };
}

// Pre-populate with some data for demonstration
const initialVouchers: Voucher[] = [
  { code: 'SULIT-FREE-5MIN', duration: 300, used: false },
  { code: 'SULIT-1HR-TRIAL', duration: 3600, used: true },
  { code: 'SULIT-GAMER-PACK', duration: 10800, used: false },
];

export const db: Database = {
  vouchers: new Map(initialVouchers.map(v => [v.code, v])),
  sessions: new Map(),
  settings: {
    ssid: 'SULIT WIFI Hotspot',
  },
  admin: {
      passwordHash: 'admin123', // Plain text for mock simplicity
      sessionToken: null,
  }
};
