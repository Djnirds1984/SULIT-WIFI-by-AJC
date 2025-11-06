import React, { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../../services/wifiService';
import { Settings as SettingsType } from '../../types';
import SaveIcon from '../icons/SaveIcon';
import CogIcon from '../icons/CogIcon';

const Settings: React.FC = () => {
    // FIX: Removed geminiApiKey from state as it's handled by environment variables.
    const [settings, setSettings] = useState<Partial<SettingsType>>({});
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            setError('');
            try {
                const currentSettings = await getSettings();
                setSettings(currentSettings);
            } catch (err: any) {
                setError(err.message || "Could not load settings.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (newPassword && newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (!newPassword) {
            setMessage("No changes to save.");
            return;
        }

        setIsSaving(true);
        try {
            const payload: Partial<SettingsType> = {};
            if (newPassword) {
                payload.adminPassword = newPassword;
            }
            const res = await updateSettings(payload);
            setMessage(res.message);
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setError(err.message || "Failed to save settings.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div>Loading settings...</div>;

    return (
        <div className="animate-fade-in space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">System Settings</h1>
            
            {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">{message}</div>}
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">{error}</div>}

            <form onSubmit={handleSave} className="space-y-8">
                 <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
                        <CogIcon className="h-6 w-6 mr-3 text-gray-500"/>
                        General Settings
                    </h2>
                     <p className="text-sm text-gray-600">
                        The Google Gemini API Key is now configured via server environment variables for improved security.
                        The Creative SSID Generator will be enabled if the `API_KEY` is set.
                    </p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">Change Admin Password</h2>
                    <div className="space-y-4 max-w-lg">
                         <div>
                            <label htmlFor="newPassword"  className="block text-sm font-medium text-gray-700">New Password</label>
                            <input
                                type="password"
                                id="newPassword"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                placeholder="Leave blank to keep current password"
                            />
                        </div>
                         <div>
                            <label htmlFor="confirmPassword"  className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>
                
                <div>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                    >
                        <SaveIcon className="h-5 w-5 mr-2" />
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Settings;
