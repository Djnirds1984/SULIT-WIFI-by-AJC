// FIX: Implemented the wifiService to handle API interactions.
import { WifiSession, AdminDashboardStats, NetworkSettings, Voucher } from '../types';

// In a real app, these would be fetch calls to a backend API.
// We'll simulate the API calls to our mock backend by assuming the backend logic
// is running and responding on these endpoints. For this project, no actual server
// is running; this is a conceptual setup. A mock service worker would typically intercept these.

export const activateVoucher = async (code: string): Promise<WifiSession> => {
  // This is a simplified simulation. In a real app, you'd have a server.
  // We'll mimic the behavior here for demonstration without a running server.
  if (code === 'INVALID') throw new Error('Invalid voucher code.');
  if (code === 'USED') throw new Error('Voucher has already been used.');
  
  const mockSession = {
      voucherCode: code,
      startTime: Date.now(),
      duration: 3600,
      remainingTime: 3600
  };
  
  // This is a placeholder for a real API call. Since there's no live backend,
  // we are returning a mock response. The full backend logic is in `backend/api.ts`.
  console.warn("Mocking API call for activateVoucher. No real backend is connected.");
  return Promise.resolve(mockSession);
};

// NOTE: The functions below are designed for a conceptual backend.
// Without a running server or a mock service worker (like MSW), they won't work as is.
// The logic for what these endpoints *should* do is in `backend/api.ts`.

export const checkSession = async (): Promise<WifiSession | null> => {
  console.warn("Mocking API call for checkSession. Returning null as default.");
  return Promise.resolve(null);
};

export const logout = async (): Promise<void> => {
  console.warn("Mocking API call for logout.");
  return Promise.resolve();
};

export const adminLogin = async (password: string): Promise<{ token: string }> => {
    if (password === 'admin123') {
        console.warn("Mocking API call for adminLogin.");
        return Promise.resolve({ token: 'mock-token' });
    }
    throw new Error('Invalid password');
}

export const getDashboardStats = async (): Promise<AdminDashboardStats> => {
  console.warn("Mocking API call for getDashboardStats.");
  return Promise.resolve({ activeSessions: 1, totalVouchersUsed: 1, totalVouchersAvailable: 2 });
};

export const getVouchers = async (): Promise<Voucher[]> => {
  console.warn("Mocking API call for getVouchers.");
  return Promise.resolve([
    { code: 'SULIT-FREE-5MIN', duration: 300, used: false },
    { code: 'SULIT-1HR-TRIAL', duration: 3600, used: true },
    { code: 'SULIT-GAMER-PACK', duration: 10800, used: false },
  ]);
};

export const generateNewVoucher = async (duration: number): Promise<string> => {
    console.warn("Mocking API call for generateNewVoucher.");
    const newCode = `SULIT-MOCK-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    return Promise.resolve(newCode);
};

export const getNetworkSettings = async (): Promise<NetworkSettings> => {
    console.warn("Mocking API call for getNetworkSettings.");
    return Promise.resolve({ ssid: 'SULIT WIFI Hotspot' });
};

export const updateNetworkSsid = async (ssid: string): Promise<void> => {
    if (!ssid || ssid.length < 3) {
        throw new Error("SSID must be at least 3 characters long.");
    }
    console.warn("Mocking API call for updateNetworkSsid.");
    return Promise.resolve();
};
