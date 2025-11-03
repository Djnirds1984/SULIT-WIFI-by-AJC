// FIX: Implemented the wifiService to handle API interactions.
import { WifiSession, AdminDashboardStats, NetworkSettings, Voucher, SystemInfo, NetworkInfo, UpdaterStatus, NetworkConfiguration } from '../types';

// A helper for making API calls and handling standard responses
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    // Try to parse a JSON error message from the backend
    const errorData = await response.json().catch(() => ({ message: 'An unexpected error occurred.' }));
    throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
  }

  // For 204 No Content responses, return undefined as there's no body to parse
  if (response.status === 204) {
    return;
  }
  
  return response.json();
};


// --- User Session Management (Portal Server on port 3001) ---

// Helper to append MAC address for portal API calls
const portalApiUrl = (path: string, mac: string): string => {
  // The component should ensure mac is not null or empty.
  return `${path}?mac=${encodeURIComponent(mac)}`;
};

export const activateVoucher = async (code: string, mac: string): Promise<WifiSession> => {
  return apiFetch(portalApiUrl('/api/sessions/voucher', mac), {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
};

export const activateCoinSession = async (mac: string): Promise<WifiSession> => {
  return apiFetch(portalApiUrl('/api/sessions/coin', mac), {
    method: 'POST',
  });
};

export const checkSession = async (mac: string): Promise<WifiSession | null> => {
  const url = portalApiUrl('/api/sessions/current', mac);
  // Manually handle fetch to check for 404 status.
  const response = await fetch(url);
  if (response.ok) return response.json();
  if (response.status === 404) return null;

  const errorData = await response.json().catch(() => ({ message: 'Failed to check session.' }));
  throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
};

export const logout = async (mac: string): Promise<void> => {
  await apiFetch(portalApiUrl('/api/sessions/current', mac), { method: 'DELETE' });
};


// --- Public APIs (Portal Server on port 3001) ---

// Fetches network settings from the public endpoint for the portal page
export const getPublicNetworkSettings = async (): Promise<NetworkSettings> => {
    return apiFetch('/api/public/settings');
};


// --- Admin Panel API Calls (proxied to Admin Server by Nginx) ---

// Helper for authenticated admin calls that includes the auth token.
// These now use relative paths, and Nginx is responsible for routing them to the Admin Server.
const authenticatedAdminApiFetch = async (url: string, options: RequestInit = {}) => {
  const token = sessionStorage.getItem('adminToken');
  if (!token) {
    throw new Error('Authentication token not found. Please log in again.');
  }
  
  const authHeaders = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };

  return apiFetch(url, { ...options, headers: authHeaders });
};

export const adminLogin = async (password: string): Promise<{ token: string }> => {
    const data = await apiFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
    });
    if (data && data.token) {
        sessionStorage.setItem('adminToken', data.token);
    } else {
        throw new Error("Login failed: token not provided by server.");
    }
    return data;
};

export const getDashboardStats = async (): Promise<AdminDashboardStats> => {
  return authenticatedAdminApiFetch('/api/admin/stats');
};

export const getSystemInfo = async (): Promise<SystemInfo> => {
    return authenticatedAdminApiFetch('/api/admin/system-info');
};

export const getNetworkInfo = async (): Promise<NetworkInfo> => {
    return authenticatedAdminApiFetch('/api/admin/network-info');
};

export const getVouchers = async (): Promise<Voucher[]> => {
  return authenticatedAdminApiFetch('/api/admin/vouchers');
};

export const generateNewVoucher = async (duration: number): Promise<string> => {
    const data = await authenticatedAdminApiFetch('/api/admin/vouchers', {
        method: 'POST',
        body: JSON.stringify({ duration }),
    });
    if (!data || !data.code) {
        throw new Error("API did not return a new voucher code.");
    }
    return data.code;
};

export const getNetworkSettings = async (): Promise<NetworkSettings> => {
    // This is the *authenticated* version for the admin settings page
    return authenticatedAdminApiFetch('/api/admin/settings');
};

export const updateNetworkSsid = async (ssid: string): Promise<void> => {
    if (!ssid || ssid.length < 3) {
        throw new Error("SSID must be at least 3 characters long.");
    }
    await authenticatedAdminApiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ ssid }),
    });
};

export const getNetworkConfiguration = async (): Promise<NetworkConfiguration> => {
    return authenticatedAdminApiFetch('/api/admin/network-config');
};

export const updateNetworkConfiguration = async (config: NetworkConfiguration): Promise<void> => {
    await authenticatedAdminApiFetch('/api/admin/network-config', {
        method: 'PUT',
        body: JSON.stringify(config),
    });
};

export const getPortalHtml = async (): Promise<{ html: string }> => {
    return authenticatedAdminApiFetch('/api/admin/portal-html');
};

export const updatePortalHtml = async (html: string): Promise<void> => {
    await authenticatedAdminApiFetch('/api/admin/portal-html', {
        method: 'PUT',
        body: JSON.stringify({ html }),
    });
};

export const resetPortalHtml = async (): Promise<{ html: string }> => {
    return authenticatedAdminApiFetch('/api/admin/portal-html/reset', {
        method: 'POST',
    });
};

export const getUpdaterStatus = async (): Promise<UpdaterStatus> => {
    return authenticatedAdminApiFetch('/api/admin/updater/status');
};

export const triggerUpdate = async (): Promise<{ message: string }> => {
    return authenticatedAdminApiFetch('/api/admin/updater/update', {
        method: 'POST',
    });
};

export const createBackup = async (): Promise<{ message: string }> => {
    return authenticatedAdminApiFetch('/api/admin/updater/backup', {
        method: 'POST',
    });
};

export const restoreFromBackup = async (): Promise<{ message: string }> => {
    return authenticatedAdminApiFetch('/api/admin/updater/restore', {
        method: 'POST',
    });
};

export const deleteBackup = async (): Promise<{ message: string }> => {
    return authenticatedAdminApiFetch('/api/admin/updater/backup', {
        method: 'DELETE',
    });
};

export const resetDatabase = async (): Promise<{ message: string }> => {
    return authenticatedAdminApiFetch('/api/admin/database/reset', {
        method: 'POST',
    });
};