
import { Session, AdminStats, SystemInfo, Voucher, UpdaterStatus, NetworkConfig, NetworkInterface, Settings, GpioConfig } from '../types';

const API_BASE_URL = '/api';

// Helper to handle API responses
const handleResponse = async (response: Response) => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || 'An unknown error occurred');
    }
    return response.json();
};

// Helper for authenticated API calls
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('admin_token');
    const headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    return fetch(url, { ...options, headers });
};


// Public routes
export const getCurrentSession = (): Promise<Session> => {
    return fetch(`${API_BASE_URL}/session`).then(handleResponse);
};

export const logout = (): Promise<{ message: string }> => {
    return fetch(`${API_BASE_URL}/logout`, { method: 'POST' }).then(handleResponse);
};

// FIX: Removed geminiApiKey from public settings per API key guidelines.
export const getPublicSettings = (): Promise<{ ssid: string }> => {
    return fetch(`${API_BASE_URL}/settings/public`).then(handleResponse);
};

export const activateVoucher = (code: string): Promise<Session> => {
    return fetch(`${API_BASE_URL}/voucher/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
    }).then(handleResponse);
};

export const activateCoinSession = (): Promise<Session> => {
    return fetch(`${API_BASE_URL}/session/coin`, { method: 'POST' }).then(handleResponse);
};

export const loginAdmin = async (password: string): Promise<string> => {
    const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    const data = await handleResponse(response);
    return data.token;
};

// Admin routes
export const getAdminStats = (): Promise<AdminStats> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/stats`).then(handleResponse);
};

export const getSystemInfo = (): Promise<SystemInfo> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/system-info`).then(handleResponse);
};

export const getVouchers = (): Promise<Voucher[]> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/vouchers`).then(handleResponse);
};

export const createVoucher = (duration: number): Promise<Voucher> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/vouchers`, {
        method: 'POST',
        body: JSON.stringify({ duration }),
    }).then(handleResponse);
};

export const getUpdaterStatus = (): Promise<UpdaterStatus> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/updater/status`).then(handleResponse);
};

export const startUpdate = (): Promise<{ message: string }> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/updater/start`, { method: 'POST' }).then(handleResponse);
};

export const listBackups = (): Promise<string[]> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/backups`).then(handleResponse);
};

export const createBackup = (): Promise<{ message: string }> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/backups`, { method: 'POST' }).then(handleResponse);
};

export const restoreBackup = (filename: string): Promise<{ message: string }> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/backups/restore`, {
        method: 'POST',
        body: JSON.stringify({ filename }),
    }).then(handleResponse);
};

export const deleteBackup = (filename: string): Promise<{ message: string }> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/backups`, {
        method: 'DELETE',
        body: JSON.stringify({ filename }),
    }).then(handleResponse);
};

export const getNetworkConfig = (): Promise<NetworkConfig> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/network/config`).then(handleResponse);
};

export const updateNetworkConfig = (config: NetworkConfig): Promise<{ message: string }> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/network/config`, {
        method: 'POST',
        body: JSON.stringify(config),
    }).then(handleResponse);
};

export const getNetworkInfo = (): Promise<NetworkInterface[]> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/network/info`).then(handleResponse);
};

export const getWanInfo = (): Promise<{ name: string }> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/network/wan`).then(handleResponse);
};

export const getPortalHtml = (): Promise<{ html: string }> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/portal/html`).then(handleResponse);
};

export const updatePortalHtml = (html: string): Promise<{ message: string }> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/portal/html`, {
        method: 'POST',
        body: JSON.stringify({ html }),
    }).then(handleResponse);
};

export const resetPortalHtml = (): Promise<{ html: string, message: string }> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/portal/html/reset`, { method: 'POST' }).then(handleResponse);
};

export const getSettings = (): Promise<Settings> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/settings`).then(handleResponse);
};

export const updateSettings = (settings: Settings): Promise<{ message: string }> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/settings`, {
        method: 'POST',
        body: JSON.stringify(settings),
    }).then(handleResponse);
};

export const getGpioConfig = (): Promise<GpioConfig> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/gpio/config`).then(handleResponse);
};

export const updateGpioConfig = (config: GpioConfig): Promise<{ message: string }> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/gpio/config`, {
        method: 'POST',
        body: JSON.stringify(config),
    }).then(handleResponse);
};
