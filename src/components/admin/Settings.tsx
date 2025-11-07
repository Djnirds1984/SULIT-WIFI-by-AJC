
import React, { useState, useEffect } from 'react';
import { getSettings, updateSettings, getGpioConfig, updateGpioConfig } from '../../services/wifiService';
import { PortalSettings, GpioConfig } from '../../types';
import SaveIcon from '../icons/SaveIcon';
import WrenchScrewdriverIcon from '../icons/WrenchScrewdriverIcon';
import CpuChipIcon from '../icons/CpuChipIcon';
import LockClosedIcon from '../icons/LockClosedIcon';

type TabName = 'general' | 'gpio' | 'security';

const Settings: React.FC = () => {
    const [settings, setSettings] = useState<PortalSettings | null>(null);
    const [gpioConfig, setGpioConfig] = useState<GpioConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [activeTab, setActiveTab] = useState<TabName>('general');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError('');
            try {
                const [settingsData, gpioData] = await Promise.all([
                    getSettings(),
                    getGpioConfig(),
                ]);
                setSettings(settingsData);
                setGpioConfig(gpioData);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => {
            if (!prev) return null;
            return {
                ...prev,
                [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value, 10) || 0 : value),
            };
        });
    };

    const handleGpioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setGpioConfig(prev => {
            if (!prev) return null;
            return {
                ...prev,
                [name]: type === 'checkbox' ? checked : parseInt(value, 10) || 0,
            };
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password || confirmPassword) {
            if (password !== confirmPassword) {
                setPasswordError("Passwords do not match.");
                setActiveTab('security');
                return;
            }
            if (password.length > 0 && password.length < 6) {
                setPasswordError("Password must be at least 6 characters long.");
                setActiveTab('security');
                return;
            }
        }
        setPasswordError('');

        if (!settings || !gpioConfig) {
            setError("Settings data is not loaded, cannot save.");
            return;
        }

        setIsSaving(true);
        setMessage('');
        setError('');
        
        try {
            const settingsPayload: PortalSettings = {
                portalTitle: settings.portalTitle,
                coinSlotEnabled: settings.coinSlotEnabled,
                coinPulseValue: settings.coinPulseValue,
            };

            if (password) {
                settingsPayload.adminPassword = password;
            }

            const portalUpdatePromise = updateSettings(settingsPayload);
            const gpioUpdatePromise = updateGpioConfig(gpioConfig);

            await Promise.all([portalUpdatePromise, gpioUpdatePromise]);

            setMessage('Settings saved successfully. A server restart may be required for GPIO changes to take effect.');
            setPassword('');
            setConfirmPassword('');

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const tabs: { name: TabName, label: string, icon: React.FC<any> }[] = [
        { name: 'general', label: 'General', icon: WrenchScrewdriverIcon },
        { name: 'gpio', label: 'Hardware (GPIO)', icon: CpuChipIcon },
        { name: 'security', label: 'Security', icon: LockClosedIcon },
    ];
    
    if (isLoading) return <div>Loading settings...</div>;
    
    if (error && !settings && !gpioConfig) {
        return <div className="bg-red-100 p-4 rounded-md text-red-700">Could not load settings data. Please ensure the server is running and the database is connected.</div>;
    }

    return (
        <div className="animate-fade-in space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">System Settings</h1>
            
            {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">{message}</div>}
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">{error}</div>}

            <form onSubmit={handleSave}>
                {/* Tab Navigation */}
                <div className="mb-6">
                    <div className="sm:hidden">
                        <label htmlFor="tabs" className="sr-only">Select a tab</label>
                        <select
                            id="tabs"
                            name="tabs"
                            className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                            onChange={(e) => setActiveTab(e.target.value as TabName)}
                            value={activeTab}
                        >
                            {tabs.map((tab) => (
                                <option key={tab.name} value={tab.name}>{tab.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="hidden sm:block">
                        <div className="border-b border-gray-200">
                            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.name}
                                        type="button"
                                        onClick={() => setActiveTab(tab.name)}
                                        className={`${
                                            activeTab === tab.name
                                                ? 'border-indigo-500 text-indigo-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        } flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                                    >
                                        <tab.icon className="mr-2 h-5 w-5" />
                                        {tab.label}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>
                </div>

                {/* General Tab */}
                <div className={activeTab === 'general' ? 'space-y-6' : 'hidden'}>
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Portal Settings</h2>
                        <div>
                            <label htmlFor="portalTitle" className="block text-sm font-medium text-gray-700">Portal Title</label>
                            <input
                                type="text"
                                id="portalTitle"
                                name="portalTitle"
                                value={settings?.portalTitle || ''}
                                onChange={handleSettingsChange}
                                className="mt-1 block w-full max-w-lg rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Coin Slot</h2>
                        <div className="space-y-4">
                            <label className="flex items-center">
                                <input type="checkbox" name="coinSlotEnabled" checked={settings?.coinSlotEnabled || false} onChange={handleSettingsChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                <span className="ml-2 font-medium text-gray-900">Enable Coin Slot</span>
                            </label>
                            {settings?.coinSlotEnabled && (
                                <div>
                                    <label htmlFor="coinPulseValue" className="block text-sm font-medium text-gray-700">Minutes per Coin/Pulse</label>
                                    <input
                                        type="number"
                                        id="coinPulseValue"
                                        name="coinPulseValue"
                                        value={settings?.coinPulseValue || 15}
                                        onChange={handleSettingsChange}
                                        className="mt-1 block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        min="1"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">How many minutes of internet to grant per coin insertion.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* GPIO Tab */}
                <div className={activeTab === 'gpio' ? 'space-y-6' : 'hidden'}>
                     <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">GPIO Pin Configuration</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label htmlFor="coinPin" className="block text-sm font-medium text-gray-700">Coin Slot Pin (BCM)</label>
                                <input
                                    type="number" id="coinPin" name="coinPin"
                                    value={gpioConfig?.coinPin || 0} onChange={handleGpioChange}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                />
                            </div>
                            <div>
                                <label htmlFor="relayPin" className="block text-sm font-medium text-gray-700">Relay Pin (BCM)</label>
                                <input
                                    type="number" id="relayPin" name="relayPin"
                                    value={gpioConfig?.relayPin || 0} onChange={handleGpioChange}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                />
                            </div>
                            <div>
                                <label htmlFor="statusLedPin" className="block text-sm font-medium text-gray-700">Status LED Pin (BCM)</label>
                                <input
                                    type="number" id="statusLedPin" name="statusLedPin"
                                    value={gpioConfig?.statusLedPin || 0} onChange={handleGpioChange}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="flex items-center">
                                <input type="checkbox" name="coinSlotActiveLow" checked={gpioConfig?.coinSlotActiveLow || false} onChange={handleGpioChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                                <span className="ml-2 text-sm font-medium text-gray-900">Coin slot is active-low</span>
                            </label>
                            <p className="text-xs text-gray-500 mt-1 ml-6">Check this if your coin acceptor sends a LOW signal on coin insert. This is the most common type.</p>
                        </div>
                        <div className="mt-4 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                            <p className="font-bold text-blue-800">Important</p>
                            <p className="text-sm text-blue-700">A server restart is required to apply new GPIO pin settings. You can do this by running `pm2 restart sulit-wifi` in the terminal.</p>
                        </div>
                    </div>
                </div>
                
                {/* Security Tab */}
                <div className={activeTab === 'security' ? 'space-y-6' : 'hidden'}>
                     <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Change Admin Password</h2>
                        <p className="text-sm text-gray-500 mb-4">Leave fields blank to keep the current password.</p>
                        <div className="space-y-4 max-w-lg">
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700">New Password</label>
                                <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                            </div>
                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                                <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                            </div>
                            {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-5 border-t border-gray-200">
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex items-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400"
                        >
                            <SaveIcon className="h-5 w-5 mr-2" />
                            {isSaving ? 'Saving...' : 'Save All Settings'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default Settings;
