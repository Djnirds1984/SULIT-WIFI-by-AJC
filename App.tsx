// FIX: Implemented the main App component to manage application state and views.
import React, { useState, useEffect, useCallback } from 'react';
import { WifiSession } from './types';
import * as wifiService from './services/wifiService';
import PortalView from './components/PortalView';
import ConnectView from './components/ConnectView';
import AdminLoginView from './components/AdminLoginView';
import AdminView from './components/AdminView';
import { WifiIcon } from './components/icons/WifiIcon';

type AppView = 'PORTAL' | 'CONNECTED' | 'ADMIN_LOGIN' | 'ADMIN_DASHBOARD';

function App() {
  const [session, setSession] = useState<WifiSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('PORTAL');
  const [networkSsid, setNetworkSsid] = useState('SULIT WIFI');

  const fetchSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentSession = await wifiService.checkSession();
      if (currentSession) {
        setSession(currentSession);
        setView('CONNECTED');
      } else {
        setSession(null);
        // stay on portal or login view
      }
      const settings = await wifiService.getNetworkSettings();
      setNetworkSsid(settings.ssid);
    } catch (e) {
      setError('Could not connect to the service. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check for admin view first from hash
    if (window.location.hash === '#admin') {
      setView('ADMIN_LOGIN');
      setIsLoading(false);
    } else {
      fetchSession();
    }
  }, [fetchSession]);

  const handleActivate = async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const newSession = await wifiService.activateVoucher(code);
      setSession(newSession);
      setView('CONNECTED');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCoinInsert = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const newSession = await wifiService.activateCoinSession();
      setSession(newSession);
      setView('CONNECTED');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (session) {
      await wifiService.logout();
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
    if (view === 'ADMIN_LOGIN' || view === 'ADMIN_DASHBOARD') {
      window.location.hash = '';
      setView('PORTAL');
      fetchSession();
    }
  }

  return (
    <div className="bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md mx-auto bg-slate-800/50 rounded-2xl shadow-2xl shadow-black/50 p-6 md:p-8 border border-slate-700 backdrop-blur-sm">
        <header onClick={handleHeaderClick} className="flex flex-col items-center mb-6 cursor-pointer group">
          <WifiIcon className="w-12 h-12 text-sky-400 group-hover:text-sky-300 transition-colors" />
          <h1 className="mt-2 text-xl font-bold text-center tracking-wider text-slate-200 group-hover:text-white transition-colors">{networkSsid}</h1>
        </header>

        <main>
          {renderView()}
        </main>
      </div>
      <footer className="text-center mt-6 text-xs text-slate-600">
        <p>Powered by SULIT Hotspot Solutions</p>
         <a href="#admin" onClick={() => { if (view !== 'ADMIN_LOGIN' && view !== 'ADMIN_DASHBOARD') setView('ADMIN_LOGIN')}} className="hover:text-slate-400 transition-colors">Admin Panel</a>
      </footer>
    </div>
  );
}

export default App;