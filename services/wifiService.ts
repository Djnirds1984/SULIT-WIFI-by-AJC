import { WifiSession, AdminDashboardStats } from '../types';
import * as api from '../backend/api';

const SESSION_KEY = 'wifi_session_id';

const simulateDelay = <T>(action: () => T, delay: number): Promise<T> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const result = action();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }, delay);
    });
};

export const activateVoucher = (code: string): Promise<WifiSession> => {
    return simulateDelay(() => {
        const session = api.handleActivateVoucher(code);
        try {
            localStorage.setItem(SESSION_KEY, session.sessionId);
        } catch (e) {
            console.warn("localStorage is not available.");
        }
        return session;
    }, 1500);
};

export const checkSessionStatus = (): Promise<WifiSession | null> => {
    return simulateDelay(() => {
        try {
            const sessionId = localStorage.getItem(SESSION_KEY);
            if (!sessionId) {
                return null;
            }
            const session = api.handleCheckSession(sessionId);
            if (!session) {
                localStorage.removeItem(SESSION_KEY);
            }
            return session;
        } catch (e) {
            console.warn("localStorage is not available.");
            return null;
        }
    }, 500);
};

export const endSession = (sessionId: string): Promise<void> => {
     return simulateDelay(() => {
        try {
            localStorage.removeItem(SESSION_KEY);
            api.handleEndSession(sessionId);
        } catch (e) {
            console.warn("localStorage is not available.");
        }
    }, 500);
}

// --- ADMIN FUNCTIONS ---

export const getNetworkSettings = (): Promise<{ ssid: string }> => {
    return simulateDelay(() => api.handleGetNetworkSettings(), 300);
};

export const updateNetworkSsid = (newSsid: string): Promise<{ ssid: string }> => {
    return simulateDelay(() => api.handleUpdateNetworkSsid(newSsid), 500);
};

export const getVouchers = (): Promise<Array<{ code: string; duration: number }>> => {
    return simulateDelay(() => api.handleGetVouchers(), 400);
};

export const generateNewVoucher = (durationInSeconds: number): Promise<string> => {
    return simulateDelay(() => api.handleGenerateNewVoucher(durationInSeconds), 700);
};

export const getDashboardStats = (): Promise<AdminDashboardStats> => {
    return simulateDelay(() => api.handleGetDashboardStats(), 600);
};
