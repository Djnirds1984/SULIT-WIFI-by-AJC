// FIX: Implemented the wifiService to handle API interactions.
import { WifiSession, AdminDashboardStats, NetworkSettings, Voucher } from '../types';

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


// --- User Session Management ---

export const activateVoucher = async (code: string): Promise<WifiSession> => {
  return apiFetch('/api/sessions/voucher', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
};

export const activateCoinSession = async (): Promise<WifiSession> => {
  // This endpoint on the backend should be responsible for
  // handling the hardware interaction (e.g., waiting for a GPIO signal).
  return apiFetch('/api/sessions/coin', {
    method: 'POST',
  });
};

export const checkSession = async (): Promise<WifiSession | null> => {
  const response = await fetch('/api/sessions/current');
  
  if (response.ok) {
    return response.json();
  }
  
  if (response.status === 404) {
    return null; // This is an expected "not found" state, not an error.
  }

  // For all other non-ok statuses, throw an error.
  const errorData = await response.json().catch(() => ({ message: 'Failed to check session.' }));
  throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
};


export const logout = async (): Promise<void> => {
  await apiFetch('/api/sessions/current', { method: 'DELETE' });
};


// --- Admin Panel API Calls ---

// Helper for authenticated admin calls that includes the auth token
const adminApiFetch = async (url: string, options: RequestInit = {}) => {
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
  return adminApiFetch('/api/admin/stats');
};

export const getVouchers = async (): Promise<Voucher[]> => {
  return adminApiFetch('/api/admin/vouchers');
};

export const generateNewVoucher = async (duration: number): Promise<string> => {
    // The backend is expected to return a JSON object like: { "code": "NEW-VOUCHER-CODE" }
    const data = await adminApiFetch('/api/admin/vouchers', {
        method: 'POST',
        body: JSON.stringify({ duration }),
    });
    if (!data || !data.code) {
        throw new Error("API did not return a new voucher code.");
    }
    return data.code;
};

export const getNetworkSettings = async (): Promise<NetworkSettings> => {
    return adminApiFetch('/api/admin/settings');
};

export const updateNetworkSsid = async (ssid: string): Promise<void> => {
    if (!ssid || ssid.length < 3) {
        throw new Error("SSID must be at least 3 characters long.");
    }
    await adminApiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ ssid }),
    });
};