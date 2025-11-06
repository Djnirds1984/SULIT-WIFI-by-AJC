
import React, { useState, useEffect } from 'react';
import { updateSettings, getGpioConfig, updateGpioConfig } from '../../services/wifiService';
import { Settings as SettingsType, GpioConfig } from '../../types';
import SaveIcon from '../icons/SaveIcon';
import CogIcon from '../icons/CogIcon';

const Settings: React.FC = () => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [gpioConfig, setGpioConfig] = useState<Partial<GpioConfig>>({});
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [passwordMessage, setPasswordMessage] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [gpioMessage, setGpioMessage] = useState('');
    const [gpioError, setGpioError] = useState('');

    useEffect(() => {
        const fetchAllSettings = async () => {
            setIsLoading(true);
            try {
                const currentGpioConfig = await getGpioConfig();
                setGpioConfig(currentGpioConfig || {});
            } catch (err: any) {
                setGpioError(err.message || "Could not load GPIO settings.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchAllSettings();
    }, []);
    
    const handlePasswordSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordMessage('');

        if (newPassword && newPassword !== confirmPassword) {
            setPasswordError("Passwords do not match.");
            return;
        }
        if (!newPassword) return;

        setIsSaving(true);
        try {
            const res = await updateSettings({ adminPassword: newPassword });
            setPasswordMessage(res.message);
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setPasswordError(err.message || "Failed to save password.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleGpioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        // Store empty string as null, otherwise parse as integer
        const pinValue = value === '' ? null : parseInt(value, 10);
        setGpioConfig(prev => ({...prev, [name]: pinValue }));
    };

    const handleGpioSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setGpioError('');
        setGpioMessage('');
        setIsSaving(true);
        try {
            const res = await updateGpioConfig(gpioConfig as GpioConfig);
            setGpioMessage(res.message);
        } catch (err: any) {
            setGpioError(err.message || "Failed to save GPIO settings.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div>Loading settings...</div>;

    return (
        <div className="animate-fade-in space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">System Settings</h1>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Change Admin Password</h2>
                 {passwordMessage && <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded">{passwordMessage}</div>}
                 {passwordError && <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">{passwordError}</div>}
                <form onSubmit={handlePasswordSave} className="space-y-4 max-w-lg">
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
                     <button
                        type="submit"
                        disabled={isSaving || !newPassword}
                        className="flex items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                    >
                        <SaveIcon className="h-5 w-5 mr-2" />
                        {isSaving ? 'Saving...' : 'Save Password'}
                    </button>
                </form>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">GPIO Pin Configuration (BCM)</h2>
                 {gpioMessage && <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded">{gpioMessage}</div>}
                 {gpioError && <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">{gpioError}</div>}
                <form onSubmit={handleGpioSave} className="space-y-4 max-w-lg">
                    <div>
                        <label htmlFor="coinSlotPin" className="block text-sm font-medium text-gray-700">Coin Slot Pin</label>
                        <input type="number" id="coinSlotPin" name="coinSlotPin" value={gpioConfig.coinSlotPin ?? ''} onChange={handleGpioChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="e.g., 2 (or leave blank to disable)" />
                        <p className="text-xs text-gray-500 mt-1">Input pin that receives pulses from the coin acceptor.</p>
                    </div>
                    <div>
                        <label htmlFor="relayPin" className="block text-sm font-medium text-gray-700">Relay Pin</label>
                        <input type="number" id="relayPin" name="relayPin" value={gpioConfig.relayPin ?? ''} onChange={handleGpioChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="Leave blank to disable" />
                        <p className="text-xs text-gray-500 mt-1">Output pin that is set HIGH when the server is running.</p>
                    </div>
                    <div>
                        <label htmlFor="statusLightPin" className="block text-sm font-medium text-gray-700">Status Light Pin</label>
                        <input type="number" id="statusLightPin" name="statusLightPin" value={gpioConfig.statusLightPin ?? ''} onChange={handleGpioChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="Leave blank to disable" />
                         <p className="text-xs text-gray-500 mt-1">Output pin that is set HIGH when the server is running.</p>
                    </div>
                     <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg text-sm text-blue-800">
                        A server restart is required to apply GPIO pin changes. You can restart by running <strong>pm2 restart sulit-wifi</strong> in the terminal.
                    </div>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                    >
                        <SaveIcon className="h-5 w-5 mr-2" />
                        {isSaving ? 'Saving...' : 'Save GPIO Settings'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Settings;
