import React, { useState, useEffect } from 'react';
import { getCurrentSession, logout, getPublicSettings } from '../services/wifiService';
import { Session } from '../types';
import Timer from './Timer';
import ConnectView from './ConnectView';
import WifiNameGenerator from './WifiNameGenerator';
import { WifiIcon } from './icons/WifiIcon';

const PortalView: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [ssid, setSsid] = useState('SULIT WIFI');
    const [generatedSsid, setGeneratedSsid] = useState('');

    const checkSession = async () => {
        try {
            const currentSession = await getCurrentSession();
            setSession(currentSession);
        } catch (e: any) {
            console.error("Failed to check session:", e);
            // Don't show an error, just assume no session
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const settings = await getPublicSettings();
            setSsid(settings.ssid);
        } catch (e) {
            console.error("Failed to fetch settings:", e);
        }
    };

    useEffect(() => {
        fetchSettings();
        checkSession();
    }, []);

    const handleLogout = async () => {
        setIsLoading(true);
        try {
            await logout();
            setSession(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <WifiIcon className="w-16 h-16 text-indigo-500 animate-pulse" />
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
            <main className="w-full max-w-md bg-white rounded-lg shadow-xl p-8 space-y-6">
                <div className="text-center">
                    <WifiIcon className="mx-auto h-12 w-auto text-indigo-600" />
                    <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900">
                        Welcome to {ssid}
                    </h1>
                </div>

                {session ? (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Connected!</h2>
                        <p className="text-center text-gray-600 mb-6">Time Remaining:</p>
                        <Timer initialRemainingTime={session.remainingTime} onExpire={() => setSession(null)} />
                        <button
                            onClick={handleLogout}
                            className="mt-8 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                            Disconnect
                        </button>
                    </div>
                ) : (
                    <ConnectView onConnect={setSession} />
                )}

                {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
                
                {!session && <WifiNameGenerator onNameGenerated={setGeneratedSsid} />}
                {generatedSsid && !session && (
                    <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-md text-center animate-fade-in-slow">
                        <p className="text-sm text-indigo-700">How about this name?</p>
                        <p className="font-bold text-lg text-indigo-900">{generatedSsid}</p>
                    </div>
                )}
            </main>
            <footer className="mt-8 text-center text-gray-500 text-sm">
                <p>&copy; {new Date().getFullYear()} SULIT WIFI. All Rights Reserved.</p>
            </footer>
        </div>
    );
};

export default PortalView;
