import React, { useState, useEffect, useCallback } from 'react';
import { getNetworkSettings, updateNetworkSsid } from '../../services/wifiService';
import WifiNameGenerator from '../WifiNameGenerator';

const Settings: React.FC = () => {
    const [ssid, setSsid] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const settings = await getNetworkSettings();
                setSsid(settings.ssid);
            } catch (err) {
                setError('Failed to load settings.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        setSuccess(null);
        try {
            await updateNetworkSsid(ssid);
            setSuccess('SSID updated successfully!');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
            setTimeout(() => setSuccess(null), 3000);
        }
    };
    
    const handleIdeaApplied = useCallback((idea: string) => {
        setSsid(idea);
    }, []);

    if (isLoading) {
        return <p className="text-slate-400 text-center">Loading settings...</p>;
    }

    return (
        <div className="space-y-6 animate-fade-in-slow">
            <div>
                <h3 className="text-xl font-bold text-indigo-400 mb-2">Network Name (SSID)</h3>
                <form onSubmit={handleSave} className="space-y-3">
                    <input
                        type="text"
                        value={ssid}
                        onChange={(e) => setSsid(e.target.value)}
                        placeholder="My Hotspot Name"
                        className="w-full bg-slate-900/50 border-2 border-slate-600 rounded-lg py-2 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={isSaving}
                        aria-label="Network SSID Input"
                    />
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    {success && <p className="text-sm text-green-400">{success}</p>}
                    <button type="submit" disabled={isSaving} className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-wait">
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </form>
            </div>
            
            <WifiNameGenerator onApplyIdea={handleIdeaApplied} />
        </div>
    );
};

export default Settings;