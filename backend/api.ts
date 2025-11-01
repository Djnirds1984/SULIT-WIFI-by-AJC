// FIX: Implemented mock API functions to resolve module import errors and provide backend logic.
import { WifiSession, AdminDashboardStats } from '../types';
import { db, Voucher, StoredSession } from './db';

const getRemainingTime = (session: StoredSession): number => {
    const elapsedSeconds = (Date.now() - session.createdAt) / 1000;
    const remaining = Math.round(session.duration - elapsedSeconds);
    return remaining > 0 ? remaining : 0;
}

// --- SESSION MANAGEMENT ---

export const handleActivateVoucher = (code: string): WifiSession => {
    const voucher = db.vouchers.find(v => v.code === code.toUpperCase() && !v.used);
    if (!voucher) {
        throw new Error('Invalid or used voucher code.');
    }

    voucher.used = true;
    
    const newSession: StoredSession = {
        sessionId: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
        duration: voucher.duration,
    };
    
    db.sessions.push(newSession);
    
    return {
        sessionId: newSession.sessionId,
        remainingTime: getRemainingTime(newSession),
    };
};

export const handleCheckSession = (sessionId: string): WifiSession | null => {
    const session = db.sessions.find(s => s.sessionId === sessionId);
    if (!session) {
        return null;
    }
    
    const remainingTime = getRemainingTime(session);
    
    if (remainingTime > 0) {
        return { sessionId, remainingTime };
    }
    
    // Clean up expired sessions
    db.sessions = db.sessions.filter(s => s.sessionId !== sessionId);
    return null;
};

export const handleEndSession = (sessionId: string): void => {
    db.sessions = db.sessions.filter(s => s.sessionId !== sessionId);
};

// --- ADMIN FUNCTIONS ---

export const handleGetNetworkSettings = (): { ssid: string } => {
    return { ssid: db.settings.ssid };
};

export const handleUpdateNetworkSsid = (newSsid: string): { ssid: string } => {
    if (!newSsid || newSsid.length < 3) {
        throw new Error("SSID must be at least 3 characters long.");
    }
    if (newSsid.length > 32) {
        throw new Error("SSID cannot be longer than 32 characters.");
    }
    db.settings.ssid = newSsid;
    return { ssid: db.settings.ssid };
};

export const handleGetVouchers = (): Array<{ code: string; duration: number }> => {
    // only return unused vouchers for the admin panel's "available vouchers" list
    return db.vouchers.filter(v => !v.used).map(({ code, duration }) => ({ code, duration }));
};

const generateVoucherCode = (): string => {
    // Generates an 8-character alphanumeric code.
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export const handleGenerateNewVoucher = (durationInSeconds: number): string => {
    let newCode: string;
    let attempts = 0;
    // Ensure generated code is unique, with a failsafe
    do {
      newCode = generateVoucherCode();
      if (attempts++ > 10) throw new Error("Failed to generate a unique voucher code.");
    } while (db.vouchers.some(v => v.code === newCode));
    
    const newVoucher: Voucher = {
        code: newCode,
        duration: durationInSeconds,
        used: false,
    };
    db.vouchers.push(newVoucher);
    return newCode;
};

export const handleGetDashboardStats = (): AdminDashboardStats => {
    // Cleanup expired sessions before calculating stats
    db.sessions = db.sessions.filter(s => getRemainingTime(s) > 0);

    const activeSessions = db.sessions.length;
    const totalVouchersUsed = db.vouchers.filter(v => v.used).length;
    const totalVouchersAvailable = db.vouchers.filter(v => !v.used).length;

    return {
        activeSessions,
        totalVouchersUsed,
        totalVouchersAvailable,
    };
};
