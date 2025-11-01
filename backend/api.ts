// FIX: Implemented mock API logic to be used by the backend.
// This file would typically set up a server (e.g., Express) and define API routes.
// For this mock environment, we'll simulate the API logic that manipulates the in-memory DB.
// This code is conceptual and would need a server like Express or Next.js API routes to run.

import { db } from './db';
import { WifiSession, Voucher } from '../types';

// --- Voucher/Session Logic ---

export function activateVoucher(code: string): WifiSession {
  const voucher = db.vouchers.get(code);
  if (!voucher) {
    throw new Error('Invalid voucher code.');
  }
  if (voucher.used) {
    throw new Error('Voucher has already been used.');
  }
  
  voucher.used = true;
  db.vouchers.set(code, voucher);

  const session: WifiSession = {
    voucherCode: code,
    startTime: Date.now(),
    duration: voucher.duration,
    remainingTime: voucher.duration,
  };

  // For this mock, we'll use a well-known key for the "current" session.
  db.sessions.set('currentUser', session);

  return session;
}

export function checkSession(): WifiSession | null {
    const session = db.sessions.get('currentUser');
    if (!session) {
        return null;
    }
    const elapsedTime = (Date.now() - session.startTime) / 1000;
    const remainingTime = Math.max(0, session.duration - elapsedTime);
    
    if (remainingTime <= 0) {
        db.sessions.delete('currentUser');
        return null;
    }
    
    return { ...session, remainingTime: Math.round(remainingTime) };
}

export function logout() {
    db.sessions.delete('currentUser');
}


// --- Admin Logic ---

export function adminLogin(password: string): { token: string } {
    if (password === db.admin.passwordHash) {
        const token = `mock-token-${Date.now()}`;
        db.admin.sessionToken = token;
        return { token };
    }
    throw new Error("Invalid password");
}

export function getDashboardStats() {
    const activeSessions = db.sessions.has('currentUser') ? 1 : 0;
    const totalVouchersUsed = Array.from(db.vouchers.values()).filter(v => v.used).length;
    const totalVouchersAvailable = Array.from(db.vouchers.values()).filter(v => !v.used).length;
    return { activeSessions, totalVouchersUsed, totalVouchersAvailable };
}

export function getVouchers(): Voucher[] {
    return Array.from(db.vouchers.values());
}

export function generateNewVoucher(duration: number): { code: string } {
    const newCode = `SULIT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const newVoucher: Voucher = {
        code: newCode,
        duration,
        used: false,
    };
    db.vouchers.set(newCode, newVoucher);
    return { code: newCode };
}

export function getNetworkSettings() {
    return db.settings;
}

export function updateNetworkSsid(ssid: string) {
    if (!ssid || ssid.length < 3) {
        throw new Error("SSID must be at least 3 characters long.");
    }
    db.settings.ssid = ssid;
    return db.settings;
}
