// FIX: Implemented the main App component to manage application state and views.
import React, { useState, useEffect, useCallback } from 'react';
import { WifiSession } from './types';
import * as wifiService from './services/wifiService';
import PortalView from './components/PortalView';
import ConnectView from './components/ConnectView';
import AdminLoginView from './components/AdminLoginView';
import AdminView from './components/AdminView';
import { WifiIcon } from './components/icons/WifiIcon';

// Define a type for the possible views to improve type safety
type AppView = 'PORTAL' | 'CONNECTED' | 'ADMIN_LOGIN' | 'ADMIN_DASHBOARD';

function App() {
  const [session, setSession] = useState<WifiSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('PORTAL');
  const [networkSsid, setNetworkSsid] = useState('SULIT WIFI');
  const [macAddress, setMacAddress] = useState<string | null>(null);

  const fetchSession = useCallback(async (mac: string) => {
    try {
      setIsLoading(true);
      const currentSession = await wifiService.checkSession(mac);
      if (currentSession) {
        setSession(currentSession);
        setView('CONNECTED');
      } else {
        setSession(null);
        // stay on portal or login view
      }
      const settings = await wifiService.getPublicNetworkSettings();
      setNetworkSsid(settings.ssid);
    } catch (e) {
      setError('Could not connect to the service. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mac = urlParams.get('mac');
    setMacAddress(mac);

    if (window.location.pathname === '/admin') {
      setView('ADMIN_LOGIN');
      setIsLoading(false);
    } else {
      if (mac) {
        fetchSession(mac);
      } else {
        setError("Could not identify your device. Please reconnect to the Wi-Fi and try again.");
        setIsLoading(false);
      }
    }
  }, [fetchSession]);

  const handleActivate = async (code: string) => {
    if (!macAddress) {
        setError("Cannot activate voucher: device MAC address is missing.");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const newSession = await wifiService.activateVoucher(code, macAddress);
      setSession(newSession);
      setView('CONNECTED');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCoinInsert = async () => {
    if (!macAddress) {
        setError("Cannot start coin session: device MAC address is missing.");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const newSession = await wifiService.activateCoinSession(macAddress);
      setSession(newSession);
      setView('CONNECTED');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (session && macAddress) {
      await wifiService.logout(macAddress);
      setSession(null);
      setView('PORTAL');
    }
  };
  
  const handleAdminLoginSuccess = () => {
      setView('ADMIN_DASHBOARD');
  };

  const renderView = () => {
    if (isLoading && view !== 'ADMIN_LOGIN') {
      return <div className="text-center text-slate-400">Checking connection status...</div>;
    }

    switch (view) {
      case 'CONNECTED':
        return session && <ConnectView session={session} onLogout={handleLogout} onAddTime={() => setView('PORTAL')} />;
      case 'ADMIN_LOGIN':
          return <AdminLoginView onLoginSuccess={handleAdminLoginSuccess} />;
      case 'ADMIN_DASHBOARD':
          return <AdminView />;
      case 'PORTAL':
      default:
        return <PortalView onActivate={handleActivate} onCoinInsert={handleCoinInsert} isLoading={isLoading} error={error} />;
    }
  };
  
  const handleHeaderClick = () => {
    // Navigate to the home page if on an admin view
    if (view === 'ADMIN_LOGIN' || view === 'ADMIN_DASHBOARD') {
      window.location.href = '/';
    }
  }

  const isAdminView = view === 'ADMIN_LOGIN' || view === 'ADMIN_DASHBOARD';

  return (
    <div className="bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans">
      <div className={`w-full ${isAdminView ? 'max-w-4xl' : 'max-w-md'} mx-auto bg-slate-800/50 rounded-2xl shadow-2xl shadow-black/50 p-6 md:p-8 border border-slate-700 backdrop-blur-sm`}>
        <header onClick={handleHeaderClick} className={`flex flex-col items-center mb-6 ${isAdminView ? '' : 'cursor-pointer group'}`}>
          <WifiIcon className={`w-12 h-12 text-sky-400 ${isAdminView ? '' : 'group-hover:text-sky-300'} transition-colors`} />
          <h1 className={`mt-2 text-xl font-bold text-center tracking-wider text-slate-200 ${isAdminView ? '' : 'group-hover:text-white'} transition-colors`}>{networkSsid}</h1>
        </header>

        <main>
          {renderView()}
        </main>
      </div>
      <footer className="text-center mt-6 text-xs text-slate-600">
        <p>Powered by SULIT Hotspot Solutions | v1.1.0</p>
         <a href="/admin" className="hover:text-slate-400 transition-colors">Admin Panel</a>
      </footer>
    </div>
  );
}

export default App;