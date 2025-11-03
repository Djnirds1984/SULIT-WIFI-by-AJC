import React, { useState } from 'react';
import { loginAdmin } from '../services/wifiService';
import LockClosedIcon from './icons/LockClosedIcon';
import UserIcon from './icons/UserIcon';

interface AdminLoginViewProps {
    onLoginSuccess: () => void;
}

const AdminLoginView: React.FC<AdminLoginViewProps> = ({ onLoginSuccess }) => {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const token = await loginAdmin(password);
            localStorage.setItem('admin_token', token);
            onLoginSuccess();
        } catch (e: any) {
            setError(e.message || 'Login failed.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
                <div className="text-center mb-8">
                    <UserIcon className="mx-auto h-12 w-auto text-gray-400" />
                    <h1 className="mt-4 text-2xl font-bold text-gray-800">Admin Login</h1>
                    <p className="text-sm text-gray-500">SULIT WIFI Control Panel</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="password-admin" className="sr-only">Password</label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                                <LockClosedIcon className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="password-admin"
                                name="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="block w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                placeholder="Password"
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                     {error && <p className={`text-red-500 text-sm text-center ${error ? 'animate-shake' : ''}`}>{error}</p>}
                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
                        >
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminLoginView;