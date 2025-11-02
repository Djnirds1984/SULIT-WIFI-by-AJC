import React, { useState, useEffect, useCallback } from 'react';
import { getNetworkInfo, getNetworkConfiguration, updateNetworkConfiguration } from '../../services/wifiService';
import { NetworkInfo, NetworkConfiguration, NetworkInterface } from '../../types';

const LoadingPlaceholder = () => <div className="text-center p-4 text-slate-400 text-sm">Loading network data...</div>;
const ErrorPlaceholder = ({ message, onRetry }: { message: string, onRetry: () => void }) => (
    <div className="text-center p-4 text-red-400 text-sm">
        <p>{message}</p>
        <button onClick={onRetry} className="mt-2 text-xs bg-red-900/50 px-3 py-1 rounded-md hover:bg-red-800">
            Try Again
        </button>
    </div>
);

const InterfaceCard: React.FC<{ iface: NetworkInterface }> = ({ iface }) => (
    <div className="bg-slate-800 p-3 rounded-lg flex gap-4 items-center border border-slate-700">
        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${iface.status === 'UP' ? 'bg-green-500' : 'bg-slate-500'}`} title={`Status: ${iface.status}`}></span>
        <div>
            <p className="font-bold text-white truncate">{iface.name}</p>
            <div className="text-xs text-slate-400 font-mono">
                {iface.ip4 && <p>IPv4: {iface.ip4}</p>}
                {!iface.ip4 && <p className="text-slate-500">No IPv4 address</p>}
            </div>
        </div>
    </div>
);

const Network: React.FC = () => {
    const [interfaces, setInterfaces] = useState<NetworkInfo>([]);
    const [config, setConfig] = useState<NetworkConfiguration | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [interfacesData, configData] = await Promise.all([
                getNetworkInfo(),
                getNetworkConfiguration()
            ]);
            setInterfaces(interfacesData);
            setConfig(configData);
        } catch (err) {
            setError('Failed to load network configuration. Please check the connection and try again.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!config) return;
        
        if (config.wanInterface === config.hotspotInterface) {
            setError("WAN and Hotspot interfaces cannot be the same device.");
            return;
        }

        setIsSaving(true);
        setError(null);
        setSuccess(null);
        try {
            await updateNetworkConfiguration(config);
            setSuccess('Network configuration saved! The new settings are being applied to the system.');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
            setTimeout(() => setSuccess(null), 4000);
        }
    };
    
    const handleConfigChange = (role: keyof NetworkConfiguration, value: string) => {
        setConfig(prev => prev ? { ...prev, [role]: value } : null);
    };

    if (isLoading) return <LoadingPlaceholder />;
    if (error && !interfaces.length) return <ErrorPlaceholder message={error} onRetry={fetchData} />;

    return (
        <div className="space-y-6 animate-fade-in-slow">
            <div>
                <h3 className="text-xl font-bold text-indigo-400 mb-2">Network Configuration</h3>
                <p className="text-xs text-slate-400">Assign roles and IP addresses to the available network interfaces.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* WAN Interface Selection */}
                    <div>
                        <h4 className="font-semibold text-slate-300 mb-2">WAN Interface</h4>
                        <p className="text-xs text-slate-500 mb-3">The interface connected to the internet.</p>
                        <div className="space-y-2">
                            {interfaces.map(iface => (
                                <label key={`wan-${iface.name}`} className="flex items-center gap-3 p-2 rounded-md bg-slate-900/50 has-[:checked]:bg-sky-900/50 has-[:checked]:ring-2 ring-sky-500 transition-all cursor-pointer">
                                    <input
                                        type="radio"
                                        name="wanInterface"
                                        value={iface.name}
                                        checked={config?.wanInterface === iface.name}
                                        onChange={() => handleConfigChange('wanInterface', iface.name)}
                                        className="form-radio h-4 w-4 text-sky-600 bg-slate-700 border-slate-500 focus:ring-sky-500"
                                    />
                                    <span className="text-sm font-medium text-white">{iface.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                     {/* Hotspot Interface Selection */}
                    <div>
                        <h4 className="font-semibold text-slate-300 mb-2">Hotspot Interface</h4>
                        <p className="text-xs text-slate-500 mb-3">The interface broadcasting the Wi-Fi for users.</p>
                         <div className="space-y-2">
                            {interfaces.map(iface => (
                                <label key={`hotspot-${iface.name}`} className="flex items-center gap-3 p-2 rounded-md bg-slate-900/50 has-[:checked]:bg-purple-900/50 has-[:checked]:ring-2 ring-purple-500 transition-all cursor-pointer">
                                    <input
                                        type="radio"
                                        name="hotspotInterface"
                                        value={iface.name}
                                        checked={config?.hotspotInterface === iface.name}
                                        onChange={() => handleConfigChange('hotspotInterface', iface.name)}
                                        className="form-radio h-4 w-4 text-purple-600 bg-slate-700 border-slate-500 focus:ring-purple-500"
                                    />
                                     <span className="text-sm font-medium text-white">{iface.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="font-semibold text-slate-300 mb-2">Hotspot Static IP Address</h4>
                    <p className="text-xs text-slate-500 mb-3">The local IP address for your hotspot portal (e.g., 192.168.200.13).</p>
                    <input
                        type="text"
                        value={config?.hotspotIpAddress || ''}
                        onChange={(e) => handleConfigChange('hotspotIpAddress', e.target.value)}
                        placeholder="e.g., 192.168.200.13"
                        className="w-full bg-slate-900/50 border-2 border-slate-600 rounded-lg py-2 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={isSaving || !config}
                        aria-label="Hotspot Static IP"
                    />
                </div>


                {error && <p className="text-sm text-center text-red-400 p-2 bg-red-900/30 rounded-md">{error}</p>}
                {success && <p className="text-sm text-center text-green-400 p-2 bg-green-900/30 rounded-md">{success}</p>}

                <button type="submit" disabled={isSaving || !config} className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-wait">
                    {isSaving ? 'Applying Settings...' : 'Save & Apply Changes'}
                </button>
            </form>

            <div>
                <h3 className="text-xl font-bold text-indigo-400 mt-8 mb-2">Available Interfaces</h3>
                 <div className="space-y-3">
                     {interfaces.map(iface => <InterfaceCard key={iface.name} iface={iface} />)}
                </div>
            </div>
        </div>
    );
};

export default Network;