import { WifiSession, AdminDashboardStats } from '../types';

// This is a mock service. In a real application, this would make API calls
// to the OpenWrt backend managing the captive portal.

const VOUCHER_DB: { [key: string]: number } = {
  '1HR-TEST': 3600,       // 1 hour
  '3HR-TEST': 10800,      // 3 hours
  '24HR-TEST': 86400,     // 24 hours
  'QUICK-5': 300,         // 5 minutes
};

// Mock for network settings
let networkSettings = {
    ssid: 'SULIT WIFI by AJC',
};

// Mock for stats
let stats = {
    vouchersActivated: 0,
};

export const activateVoucher = (code: string): Promise<WifiSession> => {
  return new Promise((resolve, reject) => {
    console.log(`Simulating activation for voucher: ${code}`);
    setTimeout(() => {
      if (VOUCHER_DB[code]) {
        const session: WifiSession = {
          remainingTime: VOUCHER_DB[code],
        };
        stats.vouchersActivated += 1;
        // In a real app, we'd store this session state on the server
        // and probably associate it with the user's MAC address.
        // For this mock, we'll store a simple flag in localStorage.
        try {
            localStorage.setItem('wifi_session_end', (Date.now() + session.remainingTime * 1000).toString());
        } catch(e) {
            console.warn("localStorage is not available.");
        }
        resolve(session);
      } else {
        reject(new Error('Invalid or expired voucher code.'));
      }
    }, 1500); // Simulate network delay
  });
};

export const checkSessionStatus = (): Promise<WifiSession | null> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            try {
                const sessionEnd = localStorage.getItem('wifi_session_end');
                if (sessionEnd) {
                    const endTime = parseInt(sessionEnd, 10);
                    const now = Date.now();
                    if (endTime > now) {
                        const remainingTime = Math.round((endTime - now) / 1000);
                        resolve({ remainingTime });
                        return;
                    } else {
                        localStorage.removeItem('wifi_session_end');
                    }
                }
            } catch (e) {
                 console.warn("localStorage is not available.");
            }
            resolve(null);
        }, 500);
    });
};

// --- ADMIN FUNCTIONS ---

export const getNetworkSettings = (): Promise<{ ssid: string }> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(networkSettings);
        }, 300);
    });
};

export const updateNetworkSsid = (newSsid: string): Promise<{ ssid: string }> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (!newSsid || newSsid.length < 3 || newSsid.length > 32) {
                return reject(new Error('SSID must be between 3 and 32 characters.'));
            }
            networkSettings.ssid = newSsid;
            resolve(networkSettings);
        }, 500);
    });
};

export const getVouchers = (): Promise<Array<{ code: string; duration: number }>> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const voucherList = Object.entries(VOUCHER_DB).map(([code, duration]) => ({ code, duration }));
            resolve(voucherList);
        }, 400);
    });
};

export const generateNewVoucher = (durationInSeconds: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (durationInSeconds <= 0) {
                return reject(new Error('Invalid duration.'));
            }
            const newCode = `GEN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            VOUCHER_DB[newCode] = durationInSeconds;
            resolve(newCode);
        }, 700);
    });
};

export const getDashboardStats = (): Promise<AdminDashboardStats> => {
    return new Promise((resolve) => {
        setTimeout(async () => {
            const currentSession = await checkSessionStatus();
            resolve({
                activeSessions: currentSession ? 1 : 0, // Simplified for mock
                totalVouchersUsed: stats.vouchersActivated,
                totalVouchersAvailable: Object.keys(VOUCHER_DB).length,
            });
        }, 600);
    });
};