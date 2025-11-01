import React, { useState, useEffect, useCallback } from 'react';
import { WifiSession } from './types';
import { activateVoucher, checkSessionStatus } from './services/wifiService';
import PortalView from './components/PortalView';
import ConnectView from './components/ConnectView';
import AdminView from './components/AdminView';
import { WifiIcon } from './components/icons/WifiIcon';
import { CogIcon } from './components/icons/CogIcon';

const App: React.FC = () => {
  const [session, setSession] = useState<WifiSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdminView, setIsAdminView] = useState<boolean>(false);

  const handleActivateVoucher = useCallback(async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const newSession = await activateVoucher(code);
      setSession(newSession);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    setSession(null);
    // In a real app, this would also call a backend endpoint to terminate the session.
    try {
      localStorage.removeItem('wifi_session_end');
    } catch(e) { console.warn("localStorage not available"); }
  }, []);
  
  const handleAddTime = useCallback(() => {
      setSession(null);
  }, []);

  const handleToggleAdminView = () => {
    setIsAdminView(prev => !prev);
  };

  useEffect(() => {
    const fetchSession = async () => {
        setIsCheckingStatus(true);
        try {
            const existingSession = await checkSessionStatus();
            setSession(existingSession);
        } catch (error) {
            setSession(null);
        } finally {
            setIsCheckingStatus(false);
        }
    };
    
    fetchSession();
  }, []);
  
  const renderContent = () => {
    if (isAdminView) {
      return <AdminView onExit={handleToggleAdminView} />;
    }

    if (isCheckingStatus) {
        return (
            <div className="flex flex-col items-center justify-center text-white h-60">
                <WifiIcon className="w-12 h-12 mb-4 animate-pulse" />
                <p className="text-xl">Checking connection status...</p>
            </div>
        );
    }

    if (session && session.remainingTime > 0) {
      return <ConnectView session={session} onLogout={handleLogout} onAddTime={handleAddTime} />;
    } else {
      return <PortalView onActivate={handleActivateVoucher} isLoading={isLoading} error={error} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white flex flex-col items-center justify-center p-4 selection:bg-sky-400 selection:text-sky-900">
      <div className="w-full max-w-md">
        <header className="flex flex-col items-center justify-center mb-8 text-center">
          <WifiIcon className="w-16 h-16 mb-4 text-sky-400" />
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
            {isAdminView ? 'Admin Portal' : 'SULIT WIFI Portal'}
          </h1>
          <p className="text-lg text-slate-400 mt-1">
            {isAdminView ? 'Manage your hotspot settings' : 'Your Gateway to the Internet'}
          </p>
        </header>

        <main className="w-full bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl shadow-black/20 p-6 md:p-8 transition-all duration-500">
          {renderContent()}
        </main>
      </div>

      <footer className="mt-8 text-center text-slate-500 w-full max-w-md px-4">
         {!isAdminView && (
          <button 
            onClick={handleToggleAdminView} 
            className="text-slate-500 hover:text-sky-400 transition-colors duration-300 flex items-center justify-center gap-2 mx-auto mb-4 text-sm"
            aria-label="Open Admin Portal"
          >
            <CogIcon className="w-4 h-4" />
            Admin Login
          </button>
        )}
        <p className="text-sm">&copy; {new Date().getFullYear()} SULIT WIFI by AJC. Powered by OpenWrt.</p>
      </footer>
    </div>
  );
};

export default App;