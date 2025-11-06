import { PublicSettings, Session, AdminStats, SystemInfo, NetworkInterface, Voucher, NetworkConfig, UpdaterStatus } from '../types';

const getMacAddress = (): string | null => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mac') || params.get('client_mac'); // Some systems use client_mac
};

const handleResponse = async (response: Response) => {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        throw new Error(error.message || `An unknown error occurred. Status: ${response.status}`);
    }
    if (response.status === 204) {
        return;
    }
    return response.json();
};

const getAuthHeaders = () => {
    const token = localStorage.getItem('admin_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// --- Public API ---

export const getPublicSettings = async (): Promise<PublicSettings> => {
    const response = await fetch('/api/public/settings');
    return handleResponse(response);
};

export const getCurrentSession = async (): Promise<Session | null> => {
    const mac = getMacAddress();
    if (!mac) return null; // No MAC, no session
    const response = await fetch(`/api/sessions/current?mac=${mac}`);
    if (response.status === 404) {
        return null;
    }
    return handleResponse(response);
};

export const activateVoucher = async (code: string): Promise<Session> => {
    const mac = getMacAddress();
    if (!mac) throw new Error("MAC address not found in URL. Cannot activate voucher.");
    const response = await fetch(`/api/sessions/voucher?mac=${mac}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
    });
    return handleResponse(response);
};

export const activateCoinSession = async (): Promise<Session> => {
    const mac = getMacAddress();
    if (!mac) throw new Error("MAC address not found in URL. Cannot start session.");
    const response = await fetch(`/api/sessions/coin?mac=${mac}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
};

export const logout = async (): Promise<void> => {
    const mac = getMacAddress();
    if (!mac) throw new Error("MAC address not found in URL. Cannot log out.");
    const response = await fetch(`/api/sessions/current?mac=${mac}`, {
        method: 'DELETE',
    });
    await handleResponse(response);
};

// --- Admin API ---

export const loginAdmin = async (password: string): Promise<string> => {
    const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    const data = await handleResponse(response);
    return data.token;
};

export const getAdminStats = async (): Promise<AdminStats> => {
    const response = await fetch('/api/admin/stats', { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const getSystemInfo = async (): Promise<SystemInfo> => {
    const response = await fetch('/api/admin/system-info', { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const getNetworkInfo = async (): Promise<NetworkInterface[]> => {
    const response = await fetch('/api/admin/network-info', { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const getWanInfo = async (): Promise<{ name: string }> => {
    const response = await fetch('/api/admin/network-wan-info', { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const getVouchers = async (): Promise<Voucher[]> => {
    const response = await fetch('/api/admin/vouchers', { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const createVoucher = async (duration: number): Promise<{ code: string }> => {
    const response = await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration }),
    });
    return handleResponse(response);
};

export const getNetworkConfig = async (): Promise<NetworkConfig> => {
    const response = await fetch('/api/admin/network-config', { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const updateNetworkConfig = async (config: NetworkConfig): Promise<{ message: string }> => {
    const response = await fetch('/api/admin/network-config', {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
    });
    return handleResponse(response);
};

export const resetDatabase = async (): Promise<{ message: string }> => {
    const response = await fetch('/api/admin/database/reset', {
        method: 'POST',
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};

export const getUpdaterStatus = async (): Promise<UpdaterStatus> => {
    const response = await fetch('/api/admin/updater/status', { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const startUpdate = async (): Promise<{ message: string }> => {
    const response = await fetch('/api/admin/updater/update', {
        method: 'POST',
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};

export const getPortalHtml = async (): Promise<{ html: string }> => {
    const response = await fetch('/api/admin/portal-html', { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const updatePortalHtml = async (html: string): Promise<{ message: string }> => {
    const response = await fetch('/api/admin/portal-html', {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ html }),
    });
    return handleResponse(response);
};

export const resetPortalHtml = async (): Promise<{ html: string }> => {
    const response = await fetch('/api/admin/portal-html/reset', {
        method: 'POST',
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};

// --- Backup & Restore API ---
export const listBackups = async (): Promise<string[]> => {
    const response = await fetch('/api/admin/backups/list', { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const createBackup = async (): Promise<{ message: string }> => {
    const response = await fetch('/api/admin/backups/create', {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const restoreBackup = async (filename: string): Promise<{ message: string }> => {
    const response = await fetch('/api/admin/backups/restore', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
    });
    return handleResponse(response);
};

export const deleteBackup = async (filename: string): Promise<{ message: string }> => {
    const response = await fetch('/api/admin/backups/delete', {
        method: 'DELETE',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
    });
    return handleResponse(response);
};