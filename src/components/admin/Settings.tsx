import React, { useState } from 'react';
import { resetDatabase } from '../../services/wifiService';

const Settings: React.FC = () => {
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleResetDatabase = async () => {
        if (window.confirm("ARE YOU SURE? This will delete all vouchers and session data permanently. This action cannot be undone.")) {
            if (window.confirm("LAST CHANCE. Are you absolutely sure you want to reset the entire database?")) {
                setIsSaving(true);
                setError('');
                setMessage('');
                try {
                    const res = await resetDatabase();
                    setMessage(res.message + " The page will now reload.");
                    setTimeout(() => window.location.reload(), 3000);
                } catch (err: any) {
                    setError(err.message);
                    setIsSaving(false);
                }
            }
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">System Settings</h1>

            {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">{message}</div>}
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">{error}</div>}
            
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
                <h2 className="text-xl font-semibold text-red-700 mb-4">Danger Zone</h2>
                <p className="text-gray-600 mb-4">Resetting the database will wipe all vouchers, sessions, and settings. Use with extreme caution.</p>
                <button
                    onClick={handleResetDatabase}
                    disabled={isSaving}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300"
                >
                    {isSaving ? 'Processing...' : 'Reset Database'}
                </button>
            </div>
        </div>
    );
};

export default Settings;