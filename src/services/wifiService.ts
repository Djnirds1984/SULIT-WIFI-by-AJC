import { 
    Session, 
    AdminStats, 
    SystemInfo, 
    Voucher, 
    UpdaterStatus, 
    NetworkInterface, 
    NetworkConfig, 
    PortalSettings, 
    GpioConfig 
} from '../types';

const getAuthToken = (): string | null => {
    return localStorage.getItem('admin_token');
};

const apiFetch = async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`/api${url}`, { ...options, headers });

        if (!response.ok) {
            let errorMessage = `Server error: ${response.status} ${response.statusText}`;
            try {
                const errorJson = await response.json();
                errorMessage = errorJson.error || errorJson.message || errorMessage;
            } catch (e) {
                // Not a JSON response
            }
            throw new Error(errorMessage);
        }

        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return null; // Return null for empty responses
        }
        
        return response.json();
    } catch (error) {
        // Handle network errors or other fetch-related issues
        if (error instanceof Error) {
             throw new Error(error.message || 'A network error occurred.');
        }
        throw new Error('An unknown error occurred.');
    }
};

// --- Public/Portal Routes ---

export const getCurrentSession = (): Promise<Session> => {
    return apiFetch('/session');
};

export const logout = (): Promise<void> => {
    return apiFetch('/logout', { method: 'POST' });
};

export const getPublicSettings = (): Promise<{ ssid: string, coinSlotEnabled: boolean }> => {
    return apiFetch('/settings/public');
};

export const activateVoucher = (code: string): Promise<Session> => {
    return apiFetch('/connect/voucher', {
        method: 'POST',
        body: JSON.stringify({ code }),
    });
};

export const activateCoinSession = (): Promise<Session> => {
    return apiFetch('/connect/coin', { method: 'POST' });
};

export const loginAdmin = async (password: string): Promise<string> => {
    const data = await apiFetch('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
    });
    return data.token;
};


// --- Admin Routes ---

// Dashboard
export const getAdminStats = (): Promise<AdminStats> => {
    return apiFetch('/admin/stats');
};

export const getSystemInfo = (): Promise<SystemInfo> => {
    return apiFetch('/admin/system-info');
};

// Vouchers
export const getVouchers = (): Promise<Voucher[]> => {
    return apiFetch('/admin/vouchers');
};

export const createVoucher = (durationSeconds: number): Promise<Voucher> => {
    return apiFetch('/admin/vouchers', {
        method: 'POST',
        body: JSON.stringify({ duration: durationSeconds }),
    });
};

// Settings
export const getSettings = (): Promise<PortalSettings> => {
    return apiFetch('/admin/settings/portal');
};

export const updateSettings = (settings: PortalSettings): Promise<{ message: string }> => {
    return apiFetch('/admin/settings/portal', {
        method: 'POST',
        body: JSON.stringify(settings),
    });
};

export const getGpioConfig = (): Promise<GpioConfig> => {
    return apiFetch('/admin/settings/gpio');
};

export const updateGpioConfig = (config: GpioConfig): Promise<{ message: string }> => {
    return apiFetch('/admin/settings/gpio', {
        method: 'POST',
        body: JSON.stringify(config),
    });
};

// Updater & Backup
export const getUpdaterStatus = (): Promise<UpdaterStatus> => {
    return apiFetch('/admin/updater/status');
};

export const startUpdate = (): Promise<{ message: string }> => {
    return apiFetch('/admin/updater/start', { method: 'POST' });
};

export const listBackups = (): Promise<string[]> => {
    return apiFetch('/admin/backups');
};

export const createBackup = (): Promise<{ message: string }> => {
    return apiFetch('/admin/backups', { method: 'POST' });
};

export const restoreBackup = (filename: string): Promise<{ message: string }> => {
    return apiFetch('/admin/backups/restore', {
        method: 'POST',
        body: JSON.stringify({ filename }),
    });
};

export const deleteBackup = (filename: string): Promise<{ message: string }> => {
    return apiFetch(`/admin/backups`, { 
        method: 'DELETE',
        body: JSON.stringify({ filename }),
    });
};

// Network
export const getNetworkConfig = (): Promise<NetworkConfig> => {
    return apiFetch('/admin/network/config');
};

export const updateNetworkConfig = (config: NetworkConfig): Promise<{ message: string }> => {
    return apiFetch('/admin/network/config', {
        method: 'POST',
        body: JSON.stringify(config),
    });
};

export const getNetworkInfo = (): Promise<NetworkInterface[]> => {
    return apiFetch('/admin/network/info');
};

export const getWanInfo = (): Promise<{ name: string }> => {
    return apiFetch('/admin/network/wan');
};

export const applyNetworkConfig = (): Promise<{ message: string; log?: string }> => {
    return apiFetch('/admin/network/apply', { method: 'POST' });
};


// Portal Editor
export const getPortalHtml = (): Promise<{ html: string }> => {
    return apiFetch('/admin/portal/html');
};

export const updatePortalHtml = (html: string): Promise<{ message: string }> => {
    return apiFetch('/admin/portal/html', {
        method: 'POST',
        body: JSON.stringify({ html }),
    });
};

export const resetPortalHtml = (): Promise<{ html: string; message: string }> => {
    return apiFetch('/admin/portal/reset', { method: 'POST' });
};
