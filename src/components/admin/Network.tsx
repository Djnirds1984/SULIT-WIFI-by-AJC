import React, { useState, useEffect, useMemo } from 'react';
import { getNetworkConfig, updateNetworkConfig, getNetworkInfo, getWanInfo } from '../../services/wifiService';
import { NetworkConfig, NetworkInterface } from '../../types';
import ServerStackIcon from '../icons/ServerStackIcon';

const isValidIp = (ip: string) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip);

// Helper to get the /24 network prefix (e.g., "192.168.1.10" -> "192.168.1")
const getNetworkPrefix = (ip: string): string | null => {
    if (!isValidIp(ip)) return null;
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
};

const Network: React.FC = () => {
    const [config, setConfig] = useState<NetworkConfig | null>(null);
    const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
    const [wanInterfaceName, setWanInterfaceName] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError('');
            try {
                const [netConfig, netInfo, wanInfo] = await Promise.all([
                    getNetworkConfig(),
                    getNetworkInfo(),
                    getWanInfo()
                ]);
                setConfig(netConfig);
                setInterfaces(netInfo);
                setWanInterfaceName(wanInfo.name);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // Memoized validation logic with subnet checks
    const formErrors = useMemo(() => {
        if (!config) return {};
        const errors: Record<string, string> = {};

        if (!config.ssid) {
            errors.ssid = "SSID cannot be empty."
        }
        if (config.security === 'wpa2' && (!config.password || config.password.length < 8)) {
            errors.password = "Password must be at least 8 characters.";
        }
        if (!isValidIp(config.hotspotIpAddress)) {
            errors.hotspotIpAddress = 'Invalid IP format.';
        }

        const hotspotIpPrefix = getNetworkPrefix(config.hotspotIpAddress);

        if (config.hotspotDhcpServer.enabled) {
            if (!isValidIp(config.hotspotDhcpServer.start)) {
                errors.dhcpStart = 'Invalid IP format.';
            } else if (hotspotIpPrefix && getNetworkPrefix(config.hotspotDhcpServer.start) !== hotspotIpPrefix) {
                errors.dhcpStart = 'Must be on the same subnet as the Hotspot IP.';
            }

            if (!isValidIp(config.hotspotDhcpServer.end)) {
                errors.dhcpEnd = 'Invalid IP format.';
            } else if (hotspotIpPrefix && getNetworkPrefix(config.hotspotDhcpServer.end) !== hotspotIpPrefix) {
                errors.dhcpEnd = 'Must be on the same subnet as the Hotspot IP.';
            }
        }
        return errors;
    }, [config]);

    const isFormValid = useMemo(() => Object.keys(formErrors).length === 0, [formErrors]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!config || !isFormValid) return;
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
                };
            });
        } else {
             setConfig(prev => {
                if (!prev) return null;
                const newConfig = { ...prev, [name]: value };
                // If changing security to 'open', clear the password
                if (name === 'security' && value === 'open') {
                    newConfig.password = '';
                }
                return newConfig;
            });
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
                {interfaces.length > 0 ? (
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
                ) : <p>Could not load interface information.</p>}
            </div>

            {config ? (
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Hotspot Configuration</h2>
                        <div className="space-y-6">
                            <div className="bg-gray-50 p-4 rounded-lg border">
                                <label className="block text-sm font-medium text-gray-500">Detected WAN (Internet) Interface</label>
                                <p className="text-lg font-bold font-mono text-gray-800">{wanInterfaceName || 'Unknown'}</p>
                            </div>
                            <div>
                                <label htmlFor="hotspotInterface" className="block text-sm font-medium text-gray-700">Hotspot Interface</label>
                                <select id="hotspotInterface" name="hotspotInterface" value={config.hotspotInterface} onChange={handleConfigChange} className="mt-1 block w-full max-w-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                                    {interfaces.map(iface => <option key={iface.name} value={iface.name}>{iface.name}</option>)}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">The interface for broadcasting Wi-Fi to users.</p>
                            </div>
                           
                            {/* --- Wi-Fi Settings --- */}
                            <div className="border-t pt-6">
                               <h3 className="text-lg font-medium text-gray-900 mb-4">Wi-Fi Hotspot Settings</h3>
                               <div>
                                    <label htmlFor="ssid" className="block text-sm font-medium text-gray-700">Wi-Fi Name (SSID)</label>
                                    <input type="text" id="ssid" name="ssid" value={config.ssid} onChange={handleConfigChange} className={`mt-1 block w-full max-w-sm rounded-md border-gray-300 shadow-sm ${formErrors.ssid ? 'border-red-500' : ''}`} />
                                    {formErrors.ssid && <p className="text-xs text-red-600 mt-1">{formErrors.ssid}</p>}
                               </div>
                               <div className="mt-4">
                                    <label htmlFor="security" className="block text-sm font-medium text-gray-700">Security</label>
                                    <select id="security" name="security" value={config.security} onChange={handleConfigChange} className="mt-1 block w-full max-w-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                                        <option value="open">Open (No Password)</option>
                                        <option value="wpa2">WPA2 (Recommended)</option>
                                    </select>
                               </div>
                               {config.security === 'wpa2' && (
                                   <div className="mt-4">
                                       <label htmlFor="password"  className="block text-sm font-medium text-gray-700">Password</label>
                                       <input type="password" id="password" name="password" value={config.password} onChange={handleConfigChange} className={`mt-1 block w-full max-w-sm rounded-md border-gray-300 shadow-sm ${formErrors.password ? 'border-red-500' : ''}`} />
                                       {formErrors.password && <p className="text-xs text-red-600 mt-1">{formErrors.password}</p>}
                                   </div>
                               )}
                            </div>

                            {/* --- IP and DHCP Settings --- */}
                            <div className="border-t pt-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">IP & DHCP Settings</h3>
                                <div>
                                    <label htmlFor="hotspotIpAddress" className="block text-sm font-medium text-gray-700">Hotspot Static IP Address</label>
                                    <input type="text" id="hotspotIpAddress" name="hotspotIpAddress" value={config.hotspotIpAddress} onChange={handleConfigChange} className={`mt-1 block w-full max-w-sm rounded-md border-gray-300 shadow-sm ${formErrors.hotspotIpAddress ? 'border-red-500' : ''}`} />
                                    {formErrors.hotspotIpAddress && <p className="text-xs text-red-600 mt-1">{formErrors.hotspotIpAddress}</p>}
                                    <p className="text-xs text-gray-500 mt-1">The IP address of this device on the hotspot network.</p>
                                </div>

                                <div className="border-t pt-6 mt-6">
                                    <label className="flex items-center">
                                        <input type="checkbox" name="dhcp.enabled" checked={config.hotspotDhcpServer.enabled} onChange={handleConfigChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        <span className="ml-2 font-medium text-gray-900">Enable DHCP Server</span>
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1 ml-6">Automatically assign IP addresses to users on the hotspot network.</p>
                                </div>

                                {config.hotspotDhcpServer.enabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6 mt-4 border-l-2 border-indigo-100">
                                        <div>
                                            <label htmlFor="dhcp.start" className="block text-sm font-medium text-gray-700">DHCP Start</label>
                                            <input type="text" id="dhcp.start" name="dhcp.start" value={config.hotspotDhcpServer.start} onChange={handleConfigChange} className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${formErrors.dhcpStart ? 'border-red-500' : ''}`} />
                                            {formErrors.dhcpStart && <p className="text-xs text-red-600 mt-1">{formErrors.dhcpStart}</p>}
                                        </div>
                                        <div>
                                            <label htmlFor="dhcp.end" className="block text-sm font-medium text-gray-700">DHCP End</label>
                                            <input type="text" id="dhcp.end" name="dhcp.end" value={config.hotspotDhcpServer.end} onChange={handleConfigChange} className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${formErrors.dhcpEnd ? 'border-red-500' : ''}`} />
                                            {formErrors.dhcpEnd && <p className="text-xs text-red-600 mt-1">{formErrors.dhcpEnd}</p>}
                                        </div>
                                        <div>
                                            <label htmlFor="dhcp.lease" className="block text-sm font-medium text-gray-700">Lease Time</label>
                                            <input type="text" id="dhcp.lease" name="dhcp.lease" value={config.hotspotDhcpServer.lease} onChange={handleConfigChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                        <p className="font-bold text-yellow-800">Warning</p>
                        <p className="text-sm text-yellow-700">Applying changes will restart your Wi-Fi and networking services, briefly disconnecting all users. Incorrect settings can make your device inaccessible.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving || !isFormValid}
                        className="py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                    >
                        {isSaving ? 'Applying...' : 'Save & Apply All Changes'}
                    </button>
                </form>
            ) : <p>Could not load hotspot configuration.</p>}
        </div>
    );
};

export default Network;