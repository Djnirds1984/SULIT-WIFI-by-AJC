import React, { useState } from 'react';
import { adminLogin } from '../services/wifiService';
import { UserIcon } from './icons/UserIcon';
import { LockClosedIcon } from './icons/LockClosedIcon';

interface AdminLoginViewProps {
    onLoginSuccess: () => void;
}

const AdminLoginView: React.FC<AdminLoginViewProps> = ({ onLoginSuccess }) => {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);
        try {
            await adminLogin(password);
            onLoginSuccess();
        } catch (err) {
            setError((err as Error).message || "Login failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center animate-fade-in">
            <h2 className="text-2xl font-bold text-center text-indigo-400">Admin Access</h2>
            <p className="mt-2 text-center text-slate-400">
                Enter your password to manage the hotspot.
            </p>

            <form onSubmit={handleSubmit} className="w-full mt-6">
                <div className="relative mb-4">
                    <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full bg-slate-900/50 border-2 border-slate-600 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-center"
                        disabled={isLoading}
                        aria-label="Admin Password Input"
                    />
                </div>

                {error && (
                    <p className="mt-3 text-sm text-center text-red-400 bg-red-900/50 px-3 py-2 rounded-md animate-shake">
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={isLoading || !password.trim()}
                    className="w-full mt-2 bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-all duration-300 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {isLoading ? (
                        <>
                             <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
                            Signing In...
                        </>
                    ) : 'Sign In'}
                </button>
            </form>
        </div>
    );
};

export default AdminLoginView;
