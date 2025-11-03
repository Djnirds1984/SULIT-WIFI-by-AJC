import React, { useState, useEffect } from 'react';
import { getNetworkConfig, updateNetworkConfig, getNetworkInfo } from '../../services/wifiService';
import { NetworkConfig, NetworkInterface } from '../../types';
import ServerStackIcon from '../icons/ServerStackIcon';

const Network: React.FC = () => {
    const [config, setConfig] = useState<NetworkConfig | null>(null);
    const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [netConfig, netInfo] = await Promise.all([getNetworkConfig(), getNetworkInfo()]);
                setConfig(netConfig);
                setInterfaces(netInfo);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!config) return;
        setIsSaving(true);
        setMessage('');
        setError('');
        try {
            const response = await updateNetworkConfig(config);
            setMessage(response.message);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        // Handle nested DHCP settings
        if (name.startsWith('dhcp.')) {
            const key = name.split('.')[1];
            setConfig(prev => {
                if (!prev) return null;
                const isCheckbox = type === 'checkbox';
                const checked = (e.target as HTMLInputElement).checked;
                return {
                    ...prev,
                    hotspotDhcpServer: {
                        ...prev.hotspotDhcpServer,
                        [key]: isCheckbox ? checked : value
                    }
                }
            });
        } else {
            setConfig(prev => (prev ? { ...prev, [name]: value } : null));
        }
    };

    if (isLoading) return <div>Loading network configuration...</div>;

    return (
        <div className="animate-fade-in space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Network Configuration</h1>

            {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">{message}</div>}
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">{error}</div>}

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Available Interfaces</h2>
                <div className="space-y-4">
                    {interfaces.map(iface => (
                        <div key={iface.name} className="flex items-center justify-between p-3 border rounded-md">
                            <div className="flex items-center">
                                <ServerStackIcon className="h-6 w-6 mr-3 text-gray-500"/>
                                <div>
                                    <p className="font-mono font-bold text-gray-800">{iface.name}</p>
                                    <p className="text-sm text-gray-600">{iface.ip4 || 'No IPv4 Address'}</p>
                                </div>
                            </div>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${iface.status === 'UP' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {iface.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {config ? (
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Interface Roles</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                                <label htmlFor="wanInterface" className="block text-sm font-medium text-gray-700">WAN Interface</label>
                                <select id="wanInterface" name="wanInterface" value={config.wanInterface} onChange={handleConfigChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                                    {interfaces.map(iface => <option key={iface.name} value={iface.name}>{iface.name}</option>)}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">The interface connected to the internet.</p>
                            </div>
                             <div>
                                <label htmlFor="hotspotInterface" className="block text-sm font-medium text-gray-700">Hotspot Interface</label>
                                <select id="hotspotInterface" name="hotspotInterface" value={config.hotspotInterface} onChange={handleConfigChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                                    {interfaces.map(iface => <option key={iface.name} value={iface.name}>{iface.name}</option>)}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">The interface broadcasting the Wi-Fi for users.</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Hotspot IP & DHCP</h2>
                         <div>
                            <label htmlFor="hotspotIpAddress" className="block text-sm font-medium text-gray-700">Hotspot Static IP Address</label>
                            <input type="text" id="hotspotIpAddress" name="hotspotIpAddress" value={config.hotspotIpAddress} onChange={handleConfigChange} className="mt-1 block w-full max-w-xs rounded-md border-gray-300 shadow-sm" />
                            <p className="text-xs text-gray-500 mt-1">The IP address of the Orange Pi on the hotspot network.</p>
                        </div>
                        <div className="mt-4 border-t pt-4">
                             <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    name="dhcp.enabled"
                                    checked={config.hotspotDhcpServer.enabled}
                                    onChange={handleConfigChange}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="ml-2 text-sm text-gray-900">Enable DHCP Server on Hotspot interface</span>
                            </label>
                        </div>
                        {config.hotspotDhcpServer.enabled && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                <div>
                                    <label htmlFor="dhcp.start" className="block text-sm font-medium text-gray-700">DHCP Start Range</label>
                                    <input type="text" id="dhcp.start" name="dhcp.start" value={config.hotspotDhcpServer.start} onChange={handleConfigChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                                </div>
                                <div>
                                    <label htmlFor="dhcp.end" className="block text-sm font-medium text-gray-700">DHCP End Range</label>
                                    <input type="text" id="dhcp.end" name="dhcp.end" value={config.hotspotDhcpServer.end} onChange={handleConfigChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                                </div>
                                <div>
                                    <label htmlFor="dhcp.lease" className="block text-sm font-medium text-gray-700">Lease Time</label>
                                    <input type="text" id="dhcp.lease" name="dhcp.lease" value={config.hotspotDhcpServer.lease} onChange={handleConfigChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                        <p className="font-bold text-yellow-800">Warning</p>
                        <p className="text-yellow-700">Changing these settings will restart your network interfaces and can make your device inaccessible if misconfigured. Proceed with caution.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
                    >
                        {isSaving ? 'Saving...' : 'Save & Apply Changes'}
                    </button>
                </form>
            ) : <p>Could not load hotspot configuration.</p>}
        </div>
    );
};

export default Network;
