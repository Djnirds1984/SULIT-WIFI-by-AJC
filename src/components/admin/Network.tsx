import React, { useState, useEffect } from 'react';
import { getNetworkConfig, updateNetworkConfig, getNetworkInfo } from '../../services/wifiService';
import { NetworkConfig, NetworkInterface } from '../../types';
import { ServerStackIcon } from '../icons';

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setConfig(prev => (prev ? { ...prev, [name]: value } : null));
    };

    if (isLoading) return <div>Loading network configuration...</div>;

    return (
        <div className="animate-fade-in space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Network Configuration</h1>

            {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">{message}</div>}
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">{error}</div>}

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Interfaces</h2>
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

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Hotspot Settings</h2>
                {config ? (
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label htmlFor="hotspotInterface" className="block text-sm font-medium text-gray-700">Hotspot Interface</label>
                            <select id="hotspotInterface" name="hotspotInterface" value={config.hotspotInterface} onChange={handleChange} className="mt-1 block w-full max-w-xs rounded-md border-gray-300 shadow-sm">
                                {interfaces.map(iface => <option key={iface.name} value={iface.name}>{iface.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="hotspotIpAddress" className="block text-sm font-medium text-gray-700">Hotspot IP Address</label>
                            <input type="text" id="hotspotIpAddress" name="hotspotIpAddress" value={config.hotspotIpAddress} onChange={handleChange} className="mt-1 block w-full max-w-xs rounded-md border-gray-300 shadow-sm" />
                        </div>
                        <p className="text-sm text-yellow-600">Warning: Changing these settings can make your device inaccessible. Proceed with caution.</p>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
                        >
                            {isSaving ? 'Saving...' : 'Save & Apply Configuration'}
                        </button>
                    </form>
                ) : <p>Could not load hotspot configuration.</p>}
            </div>
        </div>
    );
};

export default Network;
