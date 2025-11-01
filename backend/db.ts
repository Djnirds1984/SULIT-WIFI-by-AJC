// FIX: Implemented an in-memory database to simulate a backend and resolve module import errors.
// In a real application, this would be replaced with a persistent database like PostgreSQL.

export interface Voucher {
    code: string;
    duration: number; // seconds
    used: boolean;
}

// Storing session with creation time to calculate remaining time dynamically
export interface StoredSession {
    sessionId: string;
    createdAt: number; // timestamp in ms
    duration: number; // seconds
}

interface NetworkSettings {
    ssid: string;
}

interface DB {
    vouchers: Voucher[];
    sessions: StoredSession[];
    settings: NetworkSettings;
}

export const db: DB = {
    vouchers: [
        { code: 'WIFI-1HR', duration: 3600, used: false },
        { code: 'WIFI-DAY', duration: 86400, used: false },
        { code: 'USED-CODE', duration: 300, used: true },
    ],
    sessions: [],
    settings: {
        ssid: 'SULIT WIFI by AJC'
    }
};
