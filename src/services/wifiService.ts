
import { Session, AdminStats, SystemInfo, Voucher, UpdaterStatus, NetworkConfig, NetworkInterface, PortalSettings, GpioConfig } from '../types';

const API_BASE_URL = '/api';

// Helper to handle API responses and parse JSON error messages
const handleResponse = async (response: Response) => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP Error ${response.status}: ${response.statusText}` }));
        throw new Error(errorData.message || 'An unknown error occurred');
    }
    // Handle cases where the response might be empty (e.g., a 204 No Content)
    const text = await response.text();
    return text ? JSON.parse(text) : {};
};

// Helper for authenticated API calls, ensuring token and headers are set
const fetchWithAuth = (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('admin_token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
     if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
};

// --- Public Routes ---

export const getCurrentSession = (): Promise<Session> => {
    return fetch(`${API_BASE_URL}/session`).then(handleResponse);
};

export const logout = (): Promise<{ message: string }> => {
    return fetch(`${API_BASE_URL}/logout`, { method: 'POST' }).then(handleResponse);
};

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

// --- Admin Auth ---

export const loginAdmin = async (password: string): Promise<string> => {
    const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    const data = await handleResponse(response);
    return data.token;
};

// --- Admin Routes ---

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

export const getSettings = (): Promise<PortalSettings> => {
    return fetchWithAuth(`${API_BASE_URL}/admin/settings`).then(handleResponse);
};

export const updateSettings = (settings: PortalSettings): Promise<{ message: string }> => {
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

// FIX: Add placeholder functions for the portal editor to resolve import errors.
// --- Admin Portal Editor (Placeholders since feature is not implemented on backend) ---

const DEFAULT_PORTAL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to SULIT WIFI</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding-top: 50px; }
    </style>
</head>
<body>
    <h1>Welcome to SULIT WIFI</h1>
    <p>This is the default portal page content.</p>
    <p>To connect, please use a voucher or insert a coin.</p>
</body>
</html>`;

export const getPortalHtml = (): Promise<{ html: string }> => {
    console.warn('getPortalHtml is a placeholder and does not fetch from the server.');
    // Simulate network delay
    return new Promise(resolve => setTimeout(() => resolve({ html: DEFAULT_PORTAL_HTML }), 500));
};

export const updatePortalHtml = (html: string): Promise<{ message: string }> => {
    console.warn('updatePortalHtml is a placeholder and does not save to the server.');
    // In a real implementation, you would send the 'html' string to the server
    return new Promise(resolve => setTimeout(() => {
        console.log('Simulated save:', html);
        resolve({ message: 'Portal HTML updated successfully (simulation).' });
    }, 500));
};

export const resetPortalHtml = (): Promise<{ html: string }> => {
    console.warn('resetPortalHtml is a placeholder and does not communicate with the server.');
    return new Promise(resolve => setTimeout(() => resolve({ html: DEFAULT_PORTAL_HTML }), 500));
};
