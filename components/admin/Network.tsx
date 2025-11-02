import React, { useState, useEffect, useCallback } from 'react';
import { getNetworkInfo, getNetworkConfiguration, updateNetworkConfiguration } from '../../services/wifiService';
import { NetworkInfo, NetworkConfiguration, NetworkInterface, DhcpConfig } from '../../types';
import { WrenchScrewdriverIcon } from '../icons/WrenchScrewdriverIcon';
import { CodeBracketIcon } from '../icons/CodeBracketIcon';
import PortalEditor from './PortalEditor';

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

const NetworkConfigurator: React.FC = () => {
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

            if (configData.wanInterface === configData.hotspotInterface) {
                const fallbackHotspot = interfacesData.find(i => i.name !== configData.wanInterface);
                if (fallbackHotspot) {
                    configData.hotspotInterface = fallbackHotspot.name;
                }
            }
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

        if (!config.hotspotInterface) {
            setError("Please select a Hotspot Interface.");
            return;
        }
        
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
    
    const handleConfigChange = (field: keyof NetworkConfiguration, value: string) => {
        setConfig(prev => {
            if (!prev) return null;
            const newConfig = { ...prev, [field]: value };

            if (field === 'wanInterface' && newConfig.wanInterface === newConfig.hotspotInterface) {
                const fallbackHotspot = interfaces.find(i => i.name !== newConfig.wanInterface);
                if (fallbackHotspot) {
                    newConfig.hotspotInterface = fallbackHotspot.name;
                }
            }
            return newConfig;
        });
    };
    
    const handleDhcpConfigChange = (field: keyof DhcpConfig, value: string | boolean) => {
        setConfig(prev => {
            if (!prev) return null;
            return {
                ...prev,
                hotspotDhcpServer: {
                    ...prev.hotspotDhcpServer,
                    [field]: value,
                }
            };
        });
    };

    if (isLoading) return <LoadingPlaceholder />;
    if (error && !interfaces.length) return <ErrorPlaceholder message={error} onRetry={fetchData} />;

    const availableHotspotInterfaces = interfaces.filter(iface => iface.name !== config?.wanInterface);

    return (
        <div className="space-y-6">
             <div>
                <h3 className="text-xl font-bold text-indigo-400 mb-2">Interface Configuration</h3>
                <p className="text-xs text-slate-400">Assign roles and IP addresses to the available network interfaces.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-semibold text-slate-300 mb-2">WAN Interface</h4>
                        <p className="text-xs text-slate-500 mb-3">The interface connected to the internet. It will obtain an IP address automatically from your main router (DHCP).</p>
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
                    <div>
                        <h4 className="font-semibold text-slate-300 mb-2">Hotspot Interface</h4>
                        <p className="text-xs text-slate-500 mb-3">The interface broadcasting the Wi-Fi for users.</p>
                         <div className="space-y-2">
                            {availableHotspotInterfaces.map(iface => (
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
                             {availableHotspotInterfaces.length === 0 && (
                                <div className="text-center text-xs text-amber-400 p-2 bg-amber-900/30 rounded-md">
                                    Only one network interface was detected. Cannot assign a different one to the hotspot.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="font-semibold text-slate-300 mb-2">Hotspot Interface Static IP</h4>
                    <p className="text-xs text-slate-500 mb-3">The local IP for your hotspot portal (e.g., 192.168.200.13).</p>
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

                <div className="pt-6 border-t border-slate-700">
                    <h3 className="text-xl font-bold text-indigo-400 mb-2">Hotspot DHCP Server</h3>
                    <p className="text-xs text-slate-400 mb-4">Enable this to make the hotspot interface give IP addresses to connected Wi-Fi clients.</p>
                     <label className="flex items-center gap-3 p-3 rounded-md bg-slate-900/50 has-[:checked]:bg-green-900/30 has-[:checked]:ring-2 ring-green-500 transition-all cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config?.hotspotDhcpServer.enabled || false}
                            onChange={(e) => handleDhcpConfigChange('enabled', e.target.checked)}
                            className="form-checkbox h-5 w-5 rounded text-green-600 bg-slate-700 border-slate-500 focus:ring-green-500"
                        />
                        <span className="text-sm font-medium text-white">Enable DHCP Server on Hotspot Interface</span>
                    </label>

                    {config?.hotspotDhcpServer.enabled && (
                        <div className="mt-4 pl-5 space-y-4 animate-fade-in-slow">
                             <div>
                                <label htmlFor="dhcpStart" className="text-sm font-semibold text-slate-300">DHCP Start Range</label>
                                <input id="dhcpStart" type="text" value={config.hotspotDhcpServer.start} onChange={(e) => handleDhcpConfigChange('start', e.target.value)} placeholder="e.g., 192.168.200.100" className="mt-1 w-full bg-slate-800/50 border-2 border-slate-600 rounded-lg py-2 px-4 text-white"/>
                            </div>
                             <div>
                                <label htmlFor="dhcpEnd" className="text-sm font-semibold text-slate-300">DHCP End Range</label>
                                <input id="dhcpEnd" type="text" value={config.hotspotDhcpServer.end} onChange={(e) => handleDhcpConfigChange('end', e.target.value)} placeholder="e.g., 192.168.200.200" className="mt-1 w-full bg-slate-800/50 border-2 border-slate-600 rounded-lg py-2 px-4 text-white"/>
                            </div>
                             <div>
                                <label htmlFor="dhcpLease" className="text-sm font-semibold text-slate-300">Lease Time</label>
                                <input id="dhcpLease" type="text" value={config.hotspotDhcpServer.lease} onChange={(e) => handleDhcpConfigChange('lease', e.target.value)} placeholder="e.g., 12h" className="mt-1 w-full bg-slate-800/50 border-2 border-slate-600 rounded-lg py-2 px-4 text-white"/>
                            </div>
                        </div>
                    )}
                </div>


                {error && <p className="text-sm text-center text-red-400 p-2 bg-red-900/30 rounded-md">{error}</p>}
                {success && <p className="text-sm text-center text-green-400 p-2 bg-green-900/30 rounded-md">{success}</p>}

                <button type="submit" disabled={isSaving || !config || availableHotspotInterfaces.length === 0} className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-400">
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

const Network: React.FC = () => {
    const [subView, setSubView] = useState<'config' | 'portal'>('config');

    const TabButton = ({ view, label, icon }: { view: 'config' | 'portal', label: string, icon: React.ReactNode }) => {
        const isActive = subView === view;
        return (
            <button
                onClick={() => setSubView(view)}
                className={`flex items-center justify-center flex-1 gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                    isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-300 hover:bg-slate-700/50'
                }`}
            >
                {icon}
                <span>{label}</span>
            </button>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in-slow">
            <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-lg border border-slate-700">
                <TabButton view="config" label="Configuration" icon={<WrenchScrewdriverIcon className="w-5 h-5" />} />
                <TabButton view="portal" label="Portal Editor" icon={<CodeBracketIcon className="w-5 h-5" />} />
            </div>

            {subView === 'config' && <NetworkConfigurator />}
            {subView === 'portal' && <PortalEditor />}
        </div>
    );
};


export default Network;